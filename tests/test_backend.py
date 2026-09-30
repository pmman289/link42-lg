import asyncio
import os
import tempfile
import time
import unittest
from pathlib import Path


class BackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        root = Path(cls.temp_dir.name)
        os.environ["LG_ADMIN_PASSWORD"] = "unit-test-password"
        os.environ["LG_DATA_DIR"] = str(root / "data")
        os.environ["LG_CONFIG_DIR"] = str(root / "config")
        os.environ["LG_DB_PATH"] = str(root / "data" / "looking-glass.sqlite3")
        from backend import main

        cls.main = main

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def setUp(self):
        with self.main.connect_db() as db:
            db.execute("delete from query_slots")
            db.execute("delete from query_access")

    def test_route_and_protocol_output_hide_complete_blocked_routes(self):
        stdout = (
            "BIRD 2.19.1 ready.\n"
            "Table master4:\n"
            "1.1.1.1/32 unicast [hidden_peer 2026-01-01] * (100/?) [192.0.2.1]\n"
            "\tvia 192.0.2.1 on eth0\n"
            "1.1.1.1/32 unicast [visible_peer 2026-01-01] (200/?) [192.0.2.2]\n"
            "\tvia 192.0.2.2 on eth1\n"
        )
        filtered = self.main.filter_route_stdout(stdout, {"hidden_peer"})
        self.assertNotIn("hidden_peer", filtered)
        self.assertNotIn("192.0.2.1", filtered)
        self.assertIn("visible_peer", filtered)
        self.assertIn("192.0.2.2", filtered)

    def test_structured_route_result_filters_blocked_protocols(self):
        result = {
            "stdout": "",
            "routes": [
                {"protocol": "hidden_peer", "prefix": "10.0.0.0/8"},
                {"protocol_name": "visible_peer", "prefix": "192.0.2.0/24"},
            ],
        }
        filtered = self.main.filter_route_result(result, {"hidden_peer"})
        self.assertEqual(filtered["routes"], [{"protocol_name": "visible_peer", "prefix": "192.0.2.0/24"}])

    def test_public_node_is_explicit_field_allowlist(self):
        settings = {
            "nodeOverrides": {},
        }
        node = {
            "node_ref": "node-test",
            "name": "Public name",
            "raw_name": "internal-name",
            "ips": {"management_ip": "10.0.0.1"},
            "region": "Test",
            "online": True,
            "capabilities": {"ping": True},
        }
        presented = self.main.present_node(node, settings, False)
        self.assertEqual(presented["name"], "Public name")
        self.assertNotIn("raw_name", presented)
        self.assertNotIn("ips", presented)

    def test_route_input_rejects_command_text_and_private_targets_are_valid(self):
        with self.assertRaises(ValueError):
            self.main.RouteLookupBody(ip="1.1.1.1; show protocols")
        self.assertEqual(self.main.normalize_diagnostic_target("fd00::1"), "fd00::1")
        self.assertEqual(self.main.normalize_diagnostic_target("127.0.0.1"), "127.0.0.1")

    def test_asn_input_rejects_zero_and_overflow(self):
        for value in ("0", "4294967296", "AS-2"):
            with self.assertRaises(self.main.HTTPException):
                asyncio.run(self.main.as_name(value))

    def test_api_host_normalization_keeps_private_http_compatibility(self):
        self.assertEqual(
            self.main.normalize_api_base("http://127.0.0.1:8080"),
            "http://127.0.0.1:8080/third-party-api/looking-glass/v1",
        )

    def test_query_slots_limit_each_owner_and_allow_second_visitor(self):
        owner_a = self.main.query_owner_hash("visitor-a")
        owner_b = self.main.query_owner_hash("visitor-b")
        first = self.main.acquire_node_slot("node-test", owner_a)
        with self.assertRaises(self.main.HTTPException) as same_owner:
            self.main.acquire_node_slot("node-test", owner_a)
        self.assertEqual(same_owner.exception.status_code, 429)
        second = self.main.acquire_node_slot("node-test", owner_b)
        self.main.release_node_slot(first)
        self.main.release_node_slot(second)

    def test_expired_slot_is_reclaimed(self):
        first = self.main.acquire_node_slot("node-test", None)
        with self.main.connect_db() as db:
            db.execute("update query_slots set deadline_at = ? where slot_id = ?", (int(time.time()) - 1, first))
        second = self.main.acquire_node_slot("node-test", None)
        self.main.release_node_slot(second)

    def test_query_access_is_owner_bound(self):
        owner_a = self.main.query_owner_hash("visitor-a")
        owner_b = self.main.query_owner_hash("visitor-b")
        self.main.store_query_owner("query-test", "node-test", owner_a)
        self.assertEqual(self.main.get_query_owner("query-test", owner_a, False), "node-test")
        self.assertIsNone(self.main.get_query_owner("query-test", owner_b, False))


if __name__ == "__main__":
    unittest.main()

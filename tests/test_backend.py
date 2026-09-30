import asyncio
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx


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

    def test_sanitize_query_payload_filters_structured_route_and_protocol_results(self):
        settings = {"publicProtocols": {"node-test": ["hidden_peer"]}}
        route_payload = {
            "operation": "bird.route_lookup",
            "node_ref": "node-test",
            "result": {"routes": [{"source": "hidden_peer"}, {"source": "visible_peer"}]},
        }
        protocol_payload = {
            "operation": "bird.protocols",
            "node_ref": "node-test",
            "result": {"protocols": [{"name": "hidden_peer"}, {"name": "visible_peer"}]},
        }
        route_result = self.main.sanitize_query_payload(route_payload, settings, False)["result"]
        protocol_result = self.main.sanitize_query_payload(protocol_payload, settings, False)["result"]
        self.assertEqual(route_result["routes"], [{"source": "visible_peer"}])
        self.assertEqual(protocol_result["protocols"], [{"name": "visible_peer"}])

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

    def test_clearing_api_base_does_not_clear_host_pin(self):
        if self.main.API_ALLOWED_HOSTS:
            self.skipTest("host migration allowlist is configured for this environment")
        original = self.main.get_settings()
        session_id = "host-pin-test-session"
        with self.main.connect_db() as db:
            db.execute(
                "update settings set api_base = ?, api_token = ?, pinned_api_host = ? where id = 1",
                ("http://127.0.0.1:18001", "old-token", "127.0.0.1"),
            )
            db.execute("insert or replace into sessions (session_id, created_at) values (?, ?)", (session_id, int(time.time())))
        try:
            asyncio.run(self.main.update_admin_settings(self.main.SettingsBody(apiBase=""), session_id))
            with self.assertRaises(self.main.HTTPException) as rejected:
                asyncio.run(self.main.update_admin_settings(self.main.SettingsBody(apiBase="http://localhost:18001"), session_id))
            self.assertEqual(rejected.exception.status_code, 400)
            self.assertEqual(rejected.exception.detail["code"], "api_host_not_allowed")
        finally:
            self.main.save_settings(original)
            with self.main.connect_db() as db:
                db.execute("delete from sessions where session_id = ?", (session_id,))

    def test_allowlisted_host_migration_repins_and_requires_new_token(self):
        original = self.main.get_settings()
        session_id = "host-migration-test-session"
        with self.main.connect_db() as db:
            db.execute(
                "update settings set api_base = ?, api_token = ?, pinned_api_host = ? where id = 1",
                ("http://127.0.0.1:18001", "old-token", "127.0.0.1"),
            )
            db.execute("insert or replace into sessions (session_id, created_at) values (?, ?)", (session_id, int(time.time())))
        try:
            with patch.object(self.main, "API_ALLOWED_HOSTS", {"localhost"}):
                result = asyncio.run(
                    self.main.update_admin_settings(
                        self.main.SettingsBody(apiBase="http://localhost:18001", apiToken="new-token"),
                        session_id,
                    )
                )
            self.assertEqual(result["apiBase"], "http://localhost:18001/third-party-api/looking-glass/v1")
            self.assertTrue(result["apiTokenSet"])
            self.assertEqual(self.main.get_settings()["pinnedApiHost"], "localhost")
        finally:
            self.main.save_settings(original)
            with self.main.connect_db() as db:
                db.execute("delete from sessions where session_id = ?", (session_id,))

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

    def test_global_slot_limit_has_retry_after(self):
        first = self.main.acquire_node_slot("node-test", None)
        second = self.main.acquire_node_slot("node-test", None)
        try:
            with self.assertRaises(self.main.HTTPException) as queue_full:
                self.main.acquire_node_slot("node-test", None)
            self.assertEqual(queue_full.exception.status_code, 429)
            self.assertEqual(queue_full.exception.headers.get("Retry-After"), "2")
        finally:
            self.main.release_node_slot(first)
            self.main.release_node_slot(second)

    def test_expired_slot_is_reclaimed(self):
        first = self.main.acquire_node_slot("node-test", None)
        with self.main.connect_db() as db:
            db.execute("update query_slots set deadline_at = ? where slot_id = ?", (int(time.time()) - 1, first))
        second = self.main.acquire_node_slot("node-test", None)
        self.main.release_node_slot(second)

    def test_abnormal_upstream_deadlines_fall_back_to_local_deadline(self):
        now = int(time.time())
        for upstream_deadline in (now - 60, now * 1000, now + 3600):
            slot_id = self.main.acquire_node_slot("node-test", None)
            try:
                self.main.bind_node_slot(slot_id, f"query-{upstream_deadline}", upstream_deadline)
                with self.main.connect_db() as db:
                    row = db.execute("select deadline_at from query_slots where slot_id = ?", (slot_id,)).fetchone()
                self.assertGreaterEqual(int(row["deadline_at"]), int(time.time()) + 80)
                self.assertLessEqual(int(row["deadline_at"]), int(time.time()) + self.main.LOCAL_QUERY_DEADLINE_SECONDS)
            finally:
                self.main.release_node_slot(slot_id)

    def test_upstream_errors_are_structured(self):
        class FailingClient:
            def __init__(self, error):
                self.error = error

            async def request(self, *args, **kwargs):
                raise self.error

        original = self.main.get_settings()
        with self.main.connect_db() as db:
            db.execute("update settings set api_base = ?, api_token = ? where id = 1", ("http://127.0.0.1:18001", "test-token"))
        try:
            with patch.object(self.main, "get_upstream_client", return_value=FailingClient(httpx.ConnectError("refused"))):
                with self.assertRaises(self.main.HTTPException) as unavailable:
                    asyncio.run(self.main.link42_request("/nodes"))
            self.assertEqual(unavailable.exception.status_code, 502)
            self.assertEqual(unavailable.exception.detail["code"], "upstream_unavailable")

            response = httpx.Response(200, json=["not-an-object"], request=httpx.Request("GET", "http://127.0.0.1:18001/nodes"))

            class InvalidJsonClient:
                async def request(self, *args, **kwargs):
                    return response

            with patch.object(self.main, "get_upstream_client", return_value=InvalidJsonClient()):
                with self.assertRaises(self.main.HTTPException) as invalid:
                    asyncio.run(self.main.link42_request("/nodes"))
            self.assertEqual(invalid.exception.status_code, 502)
            self.assertEqual(invalid.exception.detail["code"], "invalid_upstream_response")

            auth_response = httpx.Response(
                401,
                json={"error": {"code": "invalid_api_key", "message": "do not expose this"}},
                request=httpx.Request("GET", "http://127.0.0.1:18001/nodes"),
            )

            class AuthFailureClient:
                async def request(self, *args, **kwargs):
                    return auth_response

            with patch.object(self.main, "get_upstream_client", return_value=AuthFailureClient()):
                with self.assertRaises(self.main.HTTPException) as auth_failure:
                    asyncio.run(self.main.link42_request("/nodes"))
            self.assertEqual(auth_failure.exception.status_code, 502)
            self.assertEqual(auth_failure.exception.detail["code"], "upstream_auth_failed")
            self.assertNotIn("do not expose this", str(auth_failure.exception.detail))

            with patch.object(self.main, "get_upstream_client", return_value=FailingClient(httpx.ReadTimeout("timed out"))):
                with self.assertRaises(self.main.HTTPException) as timed_out:
                    asyncio.run(self.main.link42_request("/nodes"))
            self.assertEqual(timed_out.exception.status_code, 504)
            self.assertEqual(timed_out.exception.detail["code"], "upstream_timeout")
        finally:
            self.main.save_settings(original)

    def test_query_access_is_owner_bound(self):
        owner_a = self.main.query_owner_hash("visitor-a")
        owner_b = self.main.query_owner_hash("visitor-b")
        self.main.store_query_owner("query-test", "node-test", owner_a)
        self.assertEqual(self.main.get_query_owner("query-test", owner_a, False), "node-test")
        self.assertIsNone(self.main.get_query_owner("query-test", owner_b, False))


if __name__ == "__main__":
    unittest.main()

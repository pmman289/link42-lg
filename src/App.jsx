import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Globe2,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Moon,
  Play,
  RefreshCw,
  Route,
  Save,
  Server,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import flagCountries from "flag-icons/country.json";

const defaultSettings = {
  title: "Link42 Looking Glass",
  apiBase: "",
  apiToken: "",
  apiTokenSet: false,
  apiTokenPreview: "",
  configured: false,
  publicNodeRefs: [],
  nodeOverrides: {},
  publicProtocols: {},
};

const emojiFlagCodes = {
  "🌐": "xx",
  "🇦🇺": "au",
  "🇧🇷": "br",
  "🇨🇦": "ca",
  "🇨🇳": "cn",
  "🇩🇪": "de",
  "🇫🇮": "fi",
  "🇫🇷": "fr",
  "🇬🇧": "gb",
  "🇭🇰": "hk",
  "🇯🇵": "jp",
  "🇰🇷": "kr",
  "🇳🇱": "nl",
  "🇸🇪": "se",
  "🇸🇬": "sg",
  "🇹🇼": "tw",
  "🇺🇸": "us",
};

const specialFlagOptions = [
  { value: "", label: "Default" },
  { value: "xx", label: "Network / Unknown" },
  { value: "un", label: "United Nations" },
  { value: "eu", label: "European Union" },
  { value: "asean", label: "ASEAN" },
  { value: "gb-eng", label: "England" },
  { value: "gb-sct", label: "Scotland" },
  { value: "gb-wls", label: "Wales" },
  { value: "gb-nir", label: "Northern Ireland" },
];

const flagOptions = [
  ...specialFlagOptions,
  ...flagCountries
    .filter((country) => country.iso)
    .map((country) => ({
      value: country.code,
      label: country.name,
    }))
    .sort((left, right) => left.label.localeCompare(right.label)),
];

const flagCodeSet = new Set(flagOptions.map((option) => option.value).filter(Boolean));

const copy = {
  zh: {
    brand: "Link42 Looking Glass",
    subtitle: "BIRD 路由查询控制台",
    apiBadge: "API v1",
    demo: "未配置 API",
    live: "实时 API",
    login: "登录",
    logout: "退出",
    admin: "管理",
    loginTitle: "管理员登录",
    password: "密码",
    passwordPlaceholder: "请输入管理密码",
    loginFailed: "密码不正确",
    loginHint: "请输入后端配置的管理员密码。",
    settings: "Looking Glass 设置",
    settingsHint: "登录后可配置 API、Token，并选择哪些节点对访客公开。",
    customTitle: "页面标题",
    apiBase: "API 地址",
    apiBaseHint: "可填写站点根地址，例如 https://link42.pmman.tech；也可填写完整 /third-party-api/looking-glass/v1 地址。",
    apiToken: "API Token",
    apiTokenPlaceholder: "l42lg_xxx_xxx",
    showToken: "显示 Token",
    hideToken: "隐藏 Token",
    publicNodes: "公开节点",
    publicNodesHint: "未登录访客只能看到勾选的节点；管理员登录后可看到全部节点。",
    publicProtocols: "隐藏协议",
    publicProtocolsHint: "黑名单制：默认公开展示全部协议，勾选后访客将看不到这些协议及详情。",
    loadProtocolChoices: "加载协议",
    refreshProtocolChoices: "刷新协议",
    protocolsLoading: "正在加载协议",
    protocolDetailLoading: "正在打开协议详情",
    noProtocolChoices: "暂无可选择协议",
    nodeName: "节点名称",
    nodeIcon: "图标",
    originalName: "原始名称",
    regionFilter: "地域筛选",
    allRegions: "全部地域",
    unknownRegion: "未知地域",
    saveSettings: "保存设置",
    saved: "已保存设置",
    selectAll: "全选",
    clearAll: "清空",
    nodes: "节点",
    nodeCount: "个公开",
    adminNodeCount: "个节点",
    closeNodes: "关闭节点",
    openNodes: "打开节点",
    refresh: "刷新",
    online: "在线",
    offline: "离线",
    lastSeen: "最后心跳",
    managementIp: "管理地址",
    publicIp: "公网地址",
    endpointIps: "入口地址",
    capability: "能力",
    protocols: "BIRD 协议",
    protocolName: "协议名",
    protocolType: "类型",
    protocolTable: "表",
    protocolState: "状态",
    protocolSince: "时间",
    protocolInfo: "信息",
    loadProtocols: "加载协议",
    refreshProtocols: "刷新协议",
    protocolDetail: "协议详情",
    backToLookingGlass: "返回 Looking Glass",
    ebgpPeerDetail: "eBGP 邻居详情",
    rawProtocolOutput: "原始协议输出",
    bgpState: "BGP 状态",
    neighborAddress: "邻居地址",
    neighborAs: "邻居 AS",
    localAs: "本地 AS",
    neighborId: "邻居 ID",
    session: "会话",
    sourceAddress: "源地址",
    holdTimer: "Hold Timer",
    keepaliveTimer: "Keepalive Timer",
    sendHoldTimer: "Send Hold Timer",
    channels: "Channel",
    filters: "过滤器",
    routes: "路由",
    routeStats: "路由变化统计",
    imported: "导入",
    exported: "导出",
    preferred: "优选",
    queryOriginAsRoutes: "查询来源路由",
    originAsRoutes: "来自 AS 的路由",
    originAsUnsupported: "该节点不支持按来源 AS 查询路由",
    preferredRoutesOnly: "结果均为首选路由",
    loadingRoutes: "正在加载路由",
    close: "关闭",
    noProtocols: "暂无可展示协议",
    supported: "支持",
    unsupported: "不支持",
    selectedNode: "当前节点",
    lookupTools: "网络诊断",
    routeOperation: "Route",
    pingOperation: "Ping",
    tracerouteOperation: "Traceroute",
    routeLookup: "BIRD 路由查询",
    routeLookupHint: "当前 API 仅支持合法 IPv4 或 IPv6 字面量查询。",
    pingHint: "从选定节点执行受限 ping 查询。",
    tracerouteHint: "从选定节点执行受限 traceroute 查询。",
    ipAddress: "IP 地址",
    ipPlaceholder: "例如 1.1.1.1 或 2606:4700:4700::1111",
    target: "目标",
    targetPlaceholder: "例如 1.1.1.1 或 example.com",
    count: "次数",
    probeTimeout: "单次超时",
    maxHops: "最大跳数",
    waitSeconds: "等待秒数",
    traceQueries: "每跳探测",
    run: "查询",
    running: "查询中",
    ready: "就绪",
    queued: "排队中",
    succeeded: "成功",
    failed: "失败",
    expired: "已过期",
    cancelled: "已取消",
    invalidIp: "请输入合法 IPv4 或 IPv6 地址",
    invalidTarget: "请输入合法 IP 地址或普通域名",
    offlineBlocked: "节点离线，无法查询",
    capabilityBlocked: "该节点不支持 BIRD 路由查询",
    protocolCapabilityBlocked: "该节点不支持 BIRD 协议查询",
    operationCapabilityBlocked: "该节点不支持当前查询类型",
    queryStatus: "查询状态",
    routeView: "路由视图",
    routeBest: "最佳路由",
    routeCandidate: "候选路由",
    matchedPrefix: "匹配前缀",
    routeTable: "路由表",
    protocol: "协议",
    preference: "优先级",
    nextHop: "下一跳",
    interface: "接口",
    source: "来源",
    asPath: "AS Path",
    asNameLoading: "解析中",
    asNameUnknown: "未知名称",
    localPref: "Local Pref",
    routeType: "类型",
    noRouteParsed: "未解析到路由条目",
    queryId: "查询 ID",
    operation: "操作",
    duration: "耗时",
    stderr: "错误输出",
    noOutput: "暂无输出",
    copy: "复制",
    copied: "已复制",
    loadingNodes: "正在读取节点",
    emptyNodes: "没有匹配节点",
    noPublicNodes: "暂无公开节点",
    noApiConfigured: "请登录管理页配置 API 地址和 Token。",
    hiddenForPublic: "公开视图已隐藏",
    apiError: "API 请求失败",
    tokenHint: "未配置 API Token，当前不显示节点数据。",
    frontendSecurityHint: "Token 保存在后端 SQLite 中；留空保存时会保留现有 Token。",
    footer: "支持登录后配置 API、Token 与公开节点；公开视图仅保留 API 已支持功能。",
  },
  en: {
    brand: "Link42 Looking Glass",
    subtitle: "BIRD route lookup console",
    apiBadge: "API v1",
    demo: "No API",
    live: "Live API",
    login: "Login",
    logout: "Logout",
    admin: "Admin",
    loginTitle: "Admin login",
    password: "Password",
    passwordPlaceholder: "Enter admin password",
    loginFailed: "Incorrect password",
    loginHint: "Enter the admin password configured on the backend.",
    settings: "Looking Glass settings",
    settingsHint: "After login, configure the API, token, and public node list.",
    customTitle: "Page title",
    apiBase: "API URL",
    apiBaseHint: "Use a site origin such as https://link42.pmman.tech, or a full /third-party-api/looking-glass/v1 URL.",
    apiToken: "API Token",
    apiTokenPlaceholder: "l42lg_xxx_xxx",
    showToken: "Show token",
    hideToken: "Hide token",
    publicNodes: "Public nodes",
    publicNodesHint: "Visitors only see selected nodes. Admins can see every loaded node.",
    publicProtocols: "Hidden protocols",
    publicProtocolsHint: "Blacklist mode: visitors see every protocol except the selected hidden entries.",
    loadProtocolChoices: "Load protocols",
    refreshProtocolChoices: "Refresh protocols",
    protocolsLoading: "Loading protocols",
    protocolDetailLoading: "Opening protocol detail",
    noProtocolChoices: "No protocols available",
    nodeName: "Node name",
    nodeIcon: "Icon",
    originalName: "Original name",
    regionFilter: "Region filter",
    allRegions: "All regions",
    unknownRegion: "Unknown region",
    saveSettings: "Save settings",
    saved: "Settings saved",
    selectAll: "Select all",
    clearAll: "Clear",
    nodes: "Nodes",
    nodeCount: "public",
    adminNodeCount: "nodes",
    closeNodes: "Close nodes",
    openNodes: "Open nodes",
    refresh: "Refresh",
    online: "Online",
    offline: "Offline",
    lastSeen: "Last seen",
    managementIp: "Management IP",
    publicIp: "Public IP",
    endpointIps: "Endpoint IPs",
    capability: "Capability",
    protocols: "BIRD protocols",
    protocolName: "Name",
    protocolType: "Type",
    protocolTable: "Table",
    protocolState: "State",
    protocolSince: "Since",
    protocolInfo: "Info",
    loadProtocols: "Load protocols",
    refreshProtocols: "Refresh protocols",
    protocolDetail: "Protocol detail",
    backToLookingGlass: "Back to Looking Glass",
    ebgpPeerDetail: "eBGP peer detail",
    rawProtocolOutput: "Raw protocol output",
    bgpState: "BGP state",
    neighborAddress: "Neighbor address",
    neighborAs: "Neighbor AS",
    localAs: "Local AS",
    neighborId: "Neighbor ID",
    session: "Session",
    sourceAddress: "Source address",
    holdTimer: "Hold timer",
    keepaliveTimer: "Keepalive timer",
    sendHoldTimer: "Send hold timer",
    channels: "Channels",
    filters: "Filters",
    routes: "Routes",
    routeStats: "Route change stats",
    imported: "Imported",
    exported: "Exported",
    preferred: "Preferred",
    queryOriginAsRoutes: "Query origin routes",
    originAsRoutes: "Routes from AS",
    originAsUnsupported: "This node does not support origin AS route lookup",
    preferredRoutesOnly: "Every result is a preferred route",
    loadingRoutes: "Loading routes",
    close: "Close",
    noProtocols: "No visible protocols",
    supported: "Supported",
    unsupported: "Unsupported",
    selectedNode: "Selected node",
    lookupTools: "Network diagnostics",
    routeOperation: "Route",
    pingOperation: "Ping",
    tracerouteOperation: "Traceroute",
    routeLookup: "BIRD route lookup",
    routeLookupHint: "The current API only accepts literal IPv4 or IPv6 addresses.",
    pingHint: "Run a restricted ping query from the selected node.",
    tracerouteHint: "Run a restricted traceroute query from the selected node.",
    ipAddress: "IP address",
    ipPlaceholder: "e.g. 1.1.1.1 or 2606:4700:4700::1111",
    target: "Target",
    targetPlaceholder: "e.g. 1.1.1.1 or example.com",
    count: "Count",
    probeTimeout: "Probe timeout",
    maxHops: "Max hops",
    waitSeconds: "Wait seconds",
    traceQueries: "Queries",
    run: "Lookup",
    running: "Running",
    ready: "Ready",
    queued: "Queued",
    succeeded: "Succeeded",
    failed: "Failed",
    expired: "Expired",
    cancelled: "Cancelled",
    invalidIp: "Enter a valid IPv4 or IPv6 address",
    invalidTarget: "Enter a valid IP address or hostname",
    offlineBlocked: "This node is offline",
    capabilityBlocked: "This node does not support BIRD route lookup",
    protocolCapabilityBlocked: "This node does not support BIRD protocol lookup",
    operationCapabilityBlocked: "This node does not support the selected query type",
    queryStatus: "Query status",
    routeView: "Route view",
    routeBest: "Best route",
    routeCandidate: "Candidate route",
    matchedPrefix: "Matched prefix",
    routeTable: "Route table",
    protocol: "Protocol",
    preference: "Preference",
    nextHop: "Next hop",
    interface: "Interface",
    source: "Source",
    asPath: "AS Path",
    asNameLoading: "Resolving",
    asNameUnknown: "Unknown name",
    localPref: "Local Pref",
    routeType: "Type",
    noRouteParsed: "No route entry parsed",
    queryId: "Query ID",
    operation: "Operation",
    duration: "Duration",
    stderr: "Stderr",
    noOutput: "No output yet",
    copy: "Copy",
    copied: "Copied",
    loadingNodes: "Loading nodes",
    emptyNodes: "No matching nodes",
    noPublicNodes: "No public nodes",
    noApiConfigured: "Login to configure the API URL and token.",
    hiddenForPublic: "Hidden in public view",
    apiError: "API request failed",
    tokenHint: "API token is not configured. No node data is shown.",
    frontendSecurityHint: "The token is stored in backend SQLite. Leave it blank to keep the current token.",
    footer: "Login can configure API, token, and public nodes. Public view only keeps supported API features.",
  },
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function nodeInitial(name) {
  return String(name || "?").slice(0, 2).toUpperCase();
}

function normalizeFlagCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (emojiFlagCodes[raw]) return emojiFlagCodes[raw];
  const code = raw.toLowerCase();
  return flagCodeSet.has(code) ? code : "";
}

function NodeAvatar({ node, name, icon, large = false }) {
  const label = name || node?.name || "?";
  const flagCode = normalizeFlagCode(icon ?? node?.icon);
  return (
    <span className={`node-avatar ${large ? "node-avatar-large" : ""}`}>
      {flagCode ? <span className={`fi fi-${flagCode}`} title={label} /> : nodeInitial(label)}
    </span>
  );
}

function regionOf(node, fallback) {
  return node?.region || fallback;
}

function formatTime(value, locale) {
  if (!value) return "—";
  try {
    const dateValue = typeof value === "number" ? new Date(value * 1000) : new Date(value);
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateValue);
  } catch {
    return value;
  }
}

function validateIp(value) {
  const trimmed = value.trim();
  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(trimmed);
  const ipv6 = trimmed.includes(":") && /^[0-9a-fA-F:.]+$/.test(trimmed) && trimmed.length >= 3;
  return ipv4 || ipv6;
}

function validateTarget(value) {
  const trimmed = value.trim().replace(/\.$/, "");
  if (!trimmed || trimmed.length > 253) return false;
  if (validateIp(trimmed)) return true;
  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(trimmed);
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

async function apiFetch(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json?.detail || json?.error;
    const message = detail?.message || json?.error?.message || response.statusText || "Request failed";
    const error = new Error(message);
    error.code = detail?.code || json?.error?.code;
    throw error;
  }
  return { json, response };
}

function parseBirdRoutes(stdout = "") {
  const lines = stdout.split(/\r?\n/);
  const table = lines.find((line) => line.startsWith("Table "))?.match(/^Table\s+([^:]+):/)?.[1] || "";
  const routes = [];
  let current = null;
  let lastPrefix = "";

  for (const line of lines) {
    const routeMatch = line.match(/^\s*(?:(\S+)\s+)?unicast\s+\[([^\]]+)\]\s*(\*)?\s*(\S+)?\s*\(([^)]*)\)\s*(?:\[([^\]]*)\])?/);
    if (routeMatch) {
      const [, prefix, sourceRaw, selectedMark, flag, preference, routeId] = routeMatch;
      const sourceMatch = sourceRaw.match(/^(\S+)(?:\s+(.+?))?(?:\s+from\s+(.+))?$/);
      lastPrefix = prefix || lastPrefix;
      current = {
        prefix: lastPrefix || "—",
        source: sourceMatch?.[1] || sourceRaw,
        sourceTime: sourceMatch?.[2] || "",
        from: sourceMatch?.[3] || "",
        selected: Boolean(selectedMark),
        flag: flag || "",
        preference,
        routeId,
        via: "",
        iface: "",
        type: "",
        attrs: {},
      };
      routes.push(current);
      continue;
    }

    if (!current) continue;

    const viaMatch = line.match(/^\s*via\s+(.+?)\s+on\s+(.+)$/);
    if (viaMatch) {
      current.via = viaMatch[1];
      current.iface = viaMatch[2];
      continue;
    }

    const attrMatch = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (attrMatch) {
      const key = attrMatch[1].trim();
      const value = attrMatch[2].trim();
      current.attrs[key] = value;
      if (key === "Type") current.type = value;
    }
  }

  return { table, routes };
}

function parseBirdProtocols(stdout = "") {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("BIRD ") && !line.startsWith("Name ") && !line.startsWith("bird>"))
    .map((line) => {
      const parts = line.split(/\s+/);
      const [name, proto, table, state] = parts;
      const since = parts.length >= 6 ? `${parts[4]} ${parts[5]}` : parts[4] || "";
      const info = parts.slice(parts.length >= 6 ? 6 : 5).join(" ");
      return { name, proto, table, state, since, info, raw: line };
    })
    .filter((item) => item.name && item.proto);
}

function protocolStateClass(protocol) {
  const state = String(protocol?.state || "").toLowerCase();
  const info = String(protocol?.info || "").toLowerCase();
  if (state === "up" && !/(error|fail|down|timeout|refus|unreach|disable)/.test(info)) return "up";
  if (!state) return "unknown";
  if (state !== "up" || /(error|fail|down|timeout|refus|unreach|disable)/.test(info)) return "error";
  return state;
}

function normalizeDetailKey(key) {
  return key.trim().replace(/\s+/g, " ");
}

function parseRouteCounts(value = "") {
  const counts = {};
  for (const match of value.matchAll(/(\d+)\s+(imported|exported|preferred)/gi)) {
    counts[match[2].toLowerCase()] = match[1];
  }
  return counts;
}

function parseBirdProtocolDetail(stdout = "", fallbackProtocol = {}) {
  const rows = parseBirdProtocols(stdout);
  const summary = rows.find((row) => row.name === fallbackProtocol.name) || rows[0] || fallbackProtocol;
  const fields = {};
  const channels = [];
  let currentChannel = null;
  let statColumns = [];

  stdout.split(/\r?\n/).forEach((line) => {
    const channelMatch = line.match(/^\s{2}Channel\s+(.+?)\s*$/);
    if (channelMatch) {
      currentChannel = { name: channelMatch[1], fields: {}, routeCounts: {}, stats: [] };
      channels.push(currentChannel);
      statColumns = [];
      return;
    }

    if (currentChannel) {
      const statRow = line.match(/^\s{6}([^:]+):\s+(.+)$/);
      if (statRow && statColumns.length) {
        const values = statRow[2].trim().split(/\s+/);
        currentChannel.stats.push({
          name: normalizeDetailKey(statRow[1]),
          values: statColumns.map((column, index) => ({ column, value: values[index] || "—" })),
        });
        return;
      }

      const channelField = line.match(/^\s{4}([^:]+):\s*(.*)$/);
      if (channelField) {
        const key = normalizeDetailKey(channelField[1]);
        const value = channelField[2].trim();
        if (key === "Route change stats") {
          statColumns = value.split(/\s+/).filter(Boolean);
        } else {
          currentChannel.fields[key] = value;
          if (key === "Routes") currentChannel.routeCounts = parseRouteCounts(value);
        }
      }
      return;
    }

    const field = line.match(/^\s{2,}([^:]+):\s*(.*)$/);
    if (field) {
      fields[normalizeDetailKey(field[1])] = field[2].trim();
    }
  });

  const neighborAs = fields["Neighbor AS"] || "";
  const localAs = fields["Local AS"] || "";
  const session = fields.Session || "";
  const proto = String(summary.proto || fallbackProtocol.proto || "").toUpperCase();
  const isExternalBgp = proto === "BGP" && (
    (neighborAs && localAs && neighborAs !== localAs) ||
    /\bexternal\b/i.test(session)
  );

  return { summary, fields, channels, isExternalBgp };
}

const asNameCache = new Map();

function extractAsns(asPath = "") {
  return Array.from(new Set((asPath.match(/\b\d{1,10}\b/g) || []).map((asn) => asn.trim())));
}

async function fetchAsName(asn) {
  if (asNameCache.has(asn)) return asNameCache.get(asn);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    if (/^424242\d+$/.test(asn)) {
      // DN42 and public ASN lookup are both proxied by the backend.
    }
    const response = await fetch(`/api/as/${asn}`, {
      signal: controller.signal,
      credentials: "include",
    });
    const json = await response.json();
    const value = json?.name?.trim() || "";
    asNameCache.set(asn, value);
    return value;
  } catch {
    asNameCache.set(asn, "");
    return "";
  } finally {
    window.clearTimeout(timeout);
  }
}

function RouteVisual({ query, result, labels, title, allPreferred = false }) {
  const parsed = parseBirdRoutes(result?.stdout || "");
  const best = parsed.routes.find((route) => route.selected) || parsed.routes[0];
  const [asNames, setAsNames] = useState({});
  const asns = useMemo(() => {
    return Array.from(
      new Set(parsed.routes.flatMap((route) => extractAsns(route.attrs["BGP.as_path"]))),
    );
  }, [result?.stdout]);

  useEffect(() => {
    let cancelled = false;
    if (!asns.length) {
      setAsNames({});
      return;
    }

    setAsNames((current) => {
      const next = { ...current };
      for (const asn of asns) {
        if (!(asn in next)) next[asn] = asNameCache.has(asn) ? asNameCache.get(asn) : null;
      }
      return next;
    });

    Promise.all(asns.map(async (asn) => [asn, await fetchAsName(asn)])).then((entries) => {
      if (cancelled) return;
      setAsNames(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [asns.join("|")]);

  if (!parsed.routes.length) {
    return (
      <section className="route-visual">
        <div className="route-visual-head">
          <div>
            <span className="eyebrow">{labels.routeView}</span>
            <h2>{labels.noRouteParsed}</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="route-visual">
      <div className="route-visual-head">
        <div>
          <span className="eyebrow">{labels.routeView}</span>
          <h2>{title || query?.request?.normalized_ip || query?.request?.ip || (query?.request?.asn ? `AS${query.request.asn}` : "—")}</h2>
        </div>
        <div className="route-summary-pills">
          <span>{labels.routeTable}: <strong>{parsed.table || "—"}</strong></span>
          <span>{labels.matchedPrefix}: <strong>{best?.prefix || "—"}</strong></span>
          {allPreferred && <span><strong>{labels.preferredRoutesOnly}</strong></span>}
        </div>
      </div>

      <div className="route-card-list">
        {parsed.routes.map((route, index) => {
          const asPath = route.attrs["BGP.as_path"];
          const asList = asPath ? asPath.split(/\s+/).filter(Boolean) : [];
          const isPreferred = allPreferred || route.selected;
          return (
            <article className={`route-card ${isPreferred ? "selected" : ""}`} key={`${route.prefix}-${route.source}-${index}`}>
              <div className="route-card-top">
                <div>
                  <strong>{route.prefix}</strong>
                  <span>{isPreferred ? labels.routeBest : labels.routeCandidate}</span>
                </div>
                <code>{route.source}</code>
              </div>

              <dl className="route-fields route-fields-primary">
                <div><dt>{labels.matchedPrefix}</dt><dd>{route.prefix}</dd></div>
                <div><dt>{labels.nextHop}</dt><dd>{route.via || route.attrs["BGP.next_hop"] || "—"}</dd></div>
                <div><dt>{labels.interface}</dt><dd>{route.iface || "—"}</dd></div>
              </dl>

              <dl className="route-fields">
                <div><dt>{labels.protocol}</dt><dd>{route.type || "—"}</dd></div>
                <div><dt>{labels.preference}</dt><dd>{route.preference || "—"}</dd></div>
                <div><dt>{labels.source}</dt><dd>{route.from || route.routeId || "—"}</dd></div>
                <div><dt>{labels.localPref}</dt><dd>{route.attrs["BGP.local_pref"] || "—"}</dd></div>
              </dl>

              {asList.length > 0 ? (
                <div className="as-path">
                  <span>{labels.asPath}</span>
                  <div className="as-path-chain">
                    {asList.map((asn, asIndex) => (
                      <React.Fragment key={`${asn}-${asIndex}`}>
                        <code>
                          <strong>AS{asn}</strong>
                          <small>
                            {asNames[asn] === null
                              ? labels.asNameLoading
                              : asNames[asn] || labels.asNameUnknown}
                          </small>
                        </code>
                        {asIndex < asList.length - 1 && <i aria-hidden="true" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [language, setLanguage] = useState("zh");
  const [theme, setTheme] = useState("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [draftSettings, setDraftSettings] = useState(defaultSettings);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [page, setPage] = useState("lg");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [activeNodeRef, setActiveNodeRef] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesError, setNodesError] = useState("");
  const [operation, setOperation] = useState("route");
  const [ip, setIp] = useState("1.1.1.1");
  const [target, setTarget] = useState("1.1.1.1");
  const [pingCount, setPingCount] = useState(4);
  const [pingTimeout, setPingTimeout] = useState(2);
  const [traceMaxHops, setTraceMaxHops] = useState(30);
  const [traceWait, setTraceWait] = useState(3);
  const [traceQueries, setTraceQueries] = useState(3);
  const [query, setQuery] = useState(null);
  const [queryStatus, setQueryStatus] = useState("ready");
  const [queryError, setQueryError] = useState("");
  const [protocolQuery, setProtocolQuery] = useState(null);
  const [protocolStatus, setProtocolStatus] = useState("ready");
  const [protocolError, setProtocolError] = useState("");
  const [protocolDetailQuery, setProtocolDetailQuery] = useState(null);
  const [protocolDetailStatus, setProtocolDetailStatus] = useState("ready");
  const [activeProtocolName, setActiveProtocolName] = useState("");
  const [protocolDetailPage, setProtocolDetailPage] = useState(null);
  const [originRoutesOpen, setOriginRoutesOpen] = useState(false);
  const [originRoutesQuery, setOriginRoutesQuery] = useState(null);
  const [originRoutesStatus, setOriginRoutesStatus] = useState("ready");
  const [originRoutesError, setOriginRoutesError] = useState("");
  const [settingsProtocolOptions, setSettingsProtocolOptions] = useState({});
  const [settingsProtocolStatus, setSettingsProtocolStatus] = useState({});
  const [settingsProtocolError, setSettingsProtocolError] = useState({});
  const [copied, setCopied] = useState(false);

  const t = copy[language];
  const isDemo = !settings.configured;
  const hideAddresses = !isAdmin;
  const visibleNodes = useMemo(() => {
    return nodes;
  }, [nodes]);
  const regionOptions = useMemo(() => {
    return Array.from(new Set(visibleNodes.map((node) => regionOf(node, t.unknownRegion)))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [visibleNodes, t.unknownRegion]);

  const filteredNodes = useMemo(() => {
    if (selectedRegion === "all") return visibleNodes;
    return visibleNodes.filter((node) => regionOf(node, t.unknownRegion) === selectedRegion);
  }, [selectedRegion, visibleNodes, t.unknownRegion]);

  const activeNode = filteredNodes.find((node) => node.node_ref === activeNodeRef) || filteredNodes[0] || visibleNodes[0];
  const operationOptions = useMemo(() => [
    {
      id: "route",
      label: t.routeOperation,
      capability: "bird_route_lookup",
      hint: t.routeLookupHint,
    },
    {
      id: "ping",
      label: t.pingOperation,
      capability: "ping",
      hint: t.pingHint,
    },
    {
      id: "traceroute",
      label: t.tracerouteOperation,
      capability: "traceroute",
      hint: t.tracerouteHint,
    },
  ], [t]);
  const currentOperation = operationOptions.find((item) => item.id === operation) || operationOptions[0];
  const operationSupported = Boolean(activeNode?.capabilities?.[currentOperation.capability]);
  const operationInputValid = operation === "route" ? validateIp(ip) : validateTarget(target);

  const canRun = Boolean(
    activeNode &&
      activeNode.online &&
      operationSupported &&
      operationInputValid &&
      !["queued", "running"].includes(queryStatus),
  );

  async function loadSession() {
    setSessionLoading(true);
    try {
      const { json } = await apiFetch("/api/session");
      setIsAdmin(Boolean(json.isAdmin));
      const nextSettings = {
        ...defaultSettings,
        ...json.settings,
        configured: Boolean(json.settings?.configured || (json.settings?.apiBase && json.settings?.apiTokenSet)),
      };
      setSettings(nextSettings);
      setDraftSettings({ ...nextSettings, apiToken: "" });
    } finally {
      setSessionLoading(false);
    }
  }

  async function loadNodes() {
    if (isDemo) {
      setNodes([]);
      setActiveNodeRef("");
      setNodesError("");
      setQuery(null);
      setQueryStatus("ready");
      setQueryError("");
      return;
    }

    setNodesLoading(true);
    setNodesError("");
    try {
      const { json } = await apiFetch("/api/nodes?limit=100");
      const items = Array.isArray(json.items) ? json.items : [];
      setNodes(items);
    } catch (error) {
      setNodesError(error.message);
    } finally {
      setNodesLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!sessionLoading) loadNodes();
  }, [sessionLoading, settings.configured, settings.apiBase, settings.apiTokenSet, settings.nodeOverrides, isAdmin]);

  useEffect(() => {
    if (visibleNodes.length && !visibleNodes.some((node) => node.node_ref === activeNodeRef)) {
      setActiveNodeRef(visibleNodes[0].node_ref);
      setQuery(null);
      setQueryStatus("ready");
      setQueryError("");
      setProtocolQuery(null);
      setProtocolStatus("ready");
      setProtocolError("");
      setProtocolDetailQuery(null);
      setProtocolDetailStatus("ready");
      setActiveProtocolName("");
      setProtocolDetailPage(null);
      setOriginRoutesOpen(false);
      setOriginRoutesQuery(null);
      setOriginRoutesStatus("ready");
      setOriginRoutesError("");
    }
  }, [activeNodeRef, visibleNodes]);

  useEffect(() => {
    if (selectedRegion !== "all" && !regionOptions.includes(selectedRegion)) {
      setSelectedRegion("all");
    }
  }, [selectedRegion, regionOptions]);

  useEffect(() => {
    if (filteredNodes.length && !filteredNodes.some((node) => node.node_ref === activeNodeRef)) {
      setActiveNodeRef(filteredNodes[0].node_ref);
      setQuery(null);
      setQueryStatus("ready");
      setQueryError("");
      setProtocolQuery(null);
      setProtocolStatus("ready");
      setProtocolError("");
      setProtocolDetailQuery(null);
      setProtocolDetailStatus("ready");
      setActiveProtocolName("");
      setProtocolDetailPage(null);
      setOriginRoutesOpen(false);
      setOriginRoutesQuery(null);
      setOriginRoutesStatus("ready");
      setOriginRoutesError("");
    }
  }, [activeNodeRef, filteredNodes]);

  function selectNode(nodeRef) {
    setActiveNodeRef(nodeRef);
    setSidebarOpen(false);
    setQuery(null);
    setQueryStatus("ready");
    setQueryError("");
    setProtocolQuery(null);
    setProtocolStatus("ready");
    setProtocolError("");
    setProtocolDetailQuery(null);
    setProtocolDetailStatus("ready");
    setActiveProtocolName("");
    setProtocolDetailPage(null);
    setOriginRoutesOpen(false);
    setOriginRoutesQuery(null);
    setOriginRoutesStatus("ready");
    setOriginRoutesError("");
    if (page === "protocol") setPage("lg");
  }

  function selectOperation(nextOperation) {
    setOperation(nextOperation);
    setQuery(null);
    setQueryStatus("ready");
    setQueryError("");
    setProtocolDetailPage(null);
  }

  async function pollQuery(queryId, firstDelayMs = 500) {
    let delay = firstDelayMs;
    const localDeadline = Date.now() + 90000;
    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const { json, response } = await apiFetch(`/api/queries/${queryId}`);
      setQuery(json);
      setQueryStatus(json.status);
      if (!["queued", "running"].includes(json.status)) return json;
      const retryAfter = Number(response.headers.get("Retry-After"));
      delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(delay + 1000, 2000);
      if (Date.now() > localDeadline) {
        throw new Error("Query deadline exceeded");
      }
    }
  }

  async function pollDetachedQuery(queryId, firstDelayMs, onUpdate) {
    let delay = firstDelayMs;
    const localDeadline = Date.now() + 90000;
    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const { json, response } = await apiFetch(`/api/queries/${queryId}`);
      onUpdate(json);
      if (!["queued", "running"].includes(json.status)) return json;
      const retryAfter = Number(response.headers.get("Retry-After"));
      delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(delay + 1000, 2000);
      if (Date.now() > localDeadline) {
        throw new Error("Query deadline exceeded");
      }
    }
  }

  async function loadProtocols(nodeOverride = activeNode) {
    const selectedNode = nodeOverride;
    setProtocolError("");
    setProtocolDetailQuery(null);
    setProtocolDetailStatus("ready");
    setActiveProtocolName("");
    if (!selectedNode?.online) {
      setProtocolError(t.offlineBlocked);
      return;
    }
    if (!selectedNode?.capabilities?.bird_protocols) {
      setProtocolError(t.protocolCapabilityBlocked);
      return;
    }
    try {
      setProtocolStatus("queued");
      const { json, response } = await apiFetch(`/api/nodes/${selectedNode.node_ref}/bird/protocols:lookup`, {
        method: "POST",
      });
      setProtocolQuery(json);
      setProtocolStatus(json.status);
      const retryAfter = Number(response.headers.get("Retry-After"));
      await pollDetachedQuery(
        json.query_id,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500,
        (next) => {
          setProtocolQuery(next);
          setProtocolStatus(next.status);
        },
      );
    } catch (error) {
      setProtocolStatus("failed");
      setProtocolError(error.message);
    }
  }

  async function loadSettingsProtocolOptions(node) {
    if (!node?.online || !node?.capabilities?.bird_protocols) return;
    const nodeRef = node.node_ref;
    if (["queued", "running"].includes(settingsProtocolStatus[nodeRef])) return;
    setSettingsProtocolError((current) => ({ ...current, [nodeRef]: "" }));
    setSettingsProtocolStatus((current) => ({ ...current, [nodeRef]: "queued" }));
    try {
      const { json, response } = await apiFetch(`/api/nodes/${nodeRef}/bird/protocols:lookup`, {
        method: "POST",
      });
      setSettingsProtocolStatus((current) => ({ ...current, [nodeRef]: json.status }));
      const retryAfter = Number(response.headers.get("Retry-After"));
      const finalQuery = await pollDetachedQuery(
        json.query_id,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500,
        (next) => setSettingsProtocolStatus((current) => ({ ...current, [nodeRef]: next.status })),
      );
      const options = parseBirdProtocols(finalQuery?.result?.stdout || "");
      setSettingsProtocolOptions((current) => ({ ...current, [nodeRef]: options }));
      setSettingsProtocolStatus((current) => ({ ...current, [nodeRef]: finalQuery.status }));
    } catch (error) {
      setSettingsProtocolStatus((current) => ({ ...current, [nodeRef]: "failed" }));
      setSettingsProtocolError((current) => ({ ...current, [nodeRef]: error.message }));
    }
  }

  async function loadProtocolDetail(protocolOrName) {
    const selectedNode = activeNode;
    const protocol = typeof protocolOrName === "string"
      ? protocols.find((item) => item.name === protocolOrName) || { name: protocolOrName }
      : protocolOrName;
    const protocolName = protocol.name;
    setProtocolError("");
    setActiveProtocolName(protocolName);
    setProtocolDetailPage(null);
    if (!selectedNode?.online) {
      setProtocolError(t.offlineBlocked);
      return;
    }
    try {
      setProtocolDetailStatus("queued");
      setProtocolDetailQuery(null);
      const { json, response } = await apiFetch(`/api/nodes/${selectedNode.node_ref}/bird/protocols:lookup-detail`, {
        method: "POST",
        body: JSON.stringify({ protocol_name: protocolName }),
      });
      setProtocolDetailQuery(json);
      setProtocolDetailStatus(json.status);
      const retryAfter = Number(response.headers.get("Retry-After"));
      const finalQuery = await pollDetachedQuery(
        json.query_id,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500,
        (next) => {
          setProtocolDetailQuery(next);
          setProtocolDetailStatus(next.status);
        },
      );
      const parsed = parseBirdProtocolDetail(finalQuery?.result?.stdout || "", protocol);
      setProtocolDetailPage({ node: selectedNode, protocol, query: finalQuery, parsed });
      setPage("protocol");
    } catch (error) {
      setProtocolDetailStatus("failed");
      setProtocolError(error.message);
    }
  }

  async function loadOriginAsRoutes(asn) {
    const node = protocolDetailPage?.node;
    const normalizedAsn = Number(asn);
    setOriginRoutesOpen(true);
    setOriginRoutesQuery(null);
    setOriginRoutesError("");
    if (!node?.online) {
      setOriginRoutesStatus("failed");
      setOriginRoutesError(t.offlineBlocked);
      return;
    }
    if (!node?.capabilities?.bird_routes_by_origin_as) {
      setOriginRoutesStatus("failed");
      setOriginRoutesError(t.originAsUnsupported);
      return;
    }
    if (!Number.isInteger(normalizedAsn) || normalizedAsn < 1 || normalizedAsn > 4294967295) {
      setOriginRoutesStatus("failed");
      setOriginRoutesError("Invalid ASN");
      return;
    }

    try {
      setOriginRoutesStatus("queued");
      const { json, response } = await apiFetch(`/api/nodes/${node.node_ref}/bird/routes:lookup-origin-as`, {
        method: "POST",
        body: JSON.stringify({ asn: normalizedAsn }),
      });
      setOriginRoutesQuery(json);
      setOriginRoutesStatus(json.status);
      const retryAfter = Number(response.headers.get("Retry-After"));
      await pollDetachedQuery(
        json.query_id,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500,
        (next) => {
          setOriginRoutesQuery(next);
          setOriginRoutesStatus(next.status);
        },
      );
    } catch (error) {
      setOriginRoutesStatus("failed");
      setOriginRoutesError(error.message);
    }
  }

  useEffect(() => {
    if (
      !activeNode?.node_ref ||
      !activeNode.online ||
      !activeNode.capabilities?.bird_protocols ||
      protocolQuery ||
      ["queued", "running"].includes(protocolStatus)
    ) {
      return;
    }
    loadProtocols(activeNode);
  }, [activeNode?.node_ref, activeNode?.online, activeNode?.capabilities?.bird_protocols]);

  async function runLookup(event) {
    event.preventDefault();
    const normalizedIp = ip.trim();
    const normalizedTarget = target.trim().replace(/\.$/, "");
    setQueryError("");

    if (operation === "route" && !validateIp(normalizedIp)) {
      setQueryError(t.invalidIp);
      return;
    }
    if (operation !== "route" && !validateTarget(normalizedTarget)) {
      setQueryError(t.invalidTarget);
      return;
    }
    if (!activeNode?.online) {
      setQueryError(t.offlineBlocked);
      return;
    }
    if (!operationSupported) {
      setQueryError(operation === "route" ? t.capabilityBlocked : t.operationCapabilityBlocked);
      return;
    }

    const queryConfig = {
      route: {
        path: `/api/nodes/${activeNode.node_ref}/bird/routes:lookup`,
        body: { ip: normalizedIp },
      },
      ping: {
        path: `/api/nodes/${activeNode.node_ref}/ping`,
        body: {
          target: normalizedTarget,
          count: clampNumber(pingCount, 4, 1, 10),
          per_probe_timeout_seconds: clampNumber(pingTimeout, 2, 1, 10),
        },
      },
      traceroute: {
        path: `/api/nodes/${activeNode.node_ref}/traceroute`,
        body: {
          target: normalizedTarget,
          max_hops: clampNumber(traceMaxHops, 30, 1, 64),
          wait_seconds: clampNumber(traceWait, 3, 1, 10),
          queries: clampNumber(traceQueries, 3, 1, 5),
        },
      },
    }[operation];

    try {
      setQuery(null);
      setQueryStatus("queued");
      const { json, response } = await apiFetch(queryConfig.path, {
        method: "POST",
        body: JSON.stringify(queryConfig.body),
      });
      setQuery(json);
      setQueryStatus(json.status);
      const retryAfter = Number(response.headers.get("Retry-After"));
      await pollQuery(json.query_id, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500);
    } catch (error) {
      setQueryStatus("failed");
      setQueryError(error.message);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword }),
      });
      await loadSession();
      setLoginOpen(false);
      setPage("admin");
      setLoginPassword("");
      setLoginError("");
    } catch {
      setLoginError(t.loginFailed);
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await loadSession();
    setPage("lg");
    setQuery(null);
    setQueryStatus("ready");
    setQueryError("");
  }

  function togglePublicNode(nodeRef) {
    setDraftSettings((current) => {
      const exists = current.publicNodeRefs.includes(nodeRef);
      return {
        ...current,
        publicNodeRefs: exists
          ? current.publicNodeRefs.filter((item) => item !== nodeRef)
          : [...current.publicNodeRefs, nodeRef],
      };
    });
  }

  function updateNodeOverride(nodeRef, field, value) {
    setDraftSettings((current) => {
      const currentOverride = current.nodeOverrides?.[nodeRef] || {};
      const nextOverride = { ...currentOverride, [field]: value };
      if (!nextOverride.name?.trim()) delete nextOverride.name;
      if (!nextOverride.icon?.trim()) delete nextOverride.icon;

      const nodeOverrides = { ...(current.nodeOverrides || {}) };
      if (Object.keys(nextOverride).length) {
        nodeOverrides[nodeRef] = nextOverride;
      } else {
        delete nodeOverrides[nodeRef];
      }
      return { ...current, nodeOverrides };
    });
  }

  function toggleHiddenProtocol(nodeRef, protocolName) {
    setDraftSettings((current) => {
      const currentNames = current.publicProtocols?.[nodeRef] || [];
      const names = currentNames.includes(protocolName)
        ? currentNames.filter((name) => name !== protocolName)
        : [...currentNames, protocolName];
      const publicProtocols = { ...(current.publicProtocols || {}) };
      if (names.length) {
        publicProtocols[nodeRef] = names;
      } else {
        delete publicProtocols[nodeRef];
      }
      return { ...current, publicProtocols };
    });
  }

  async function saveSettings(event) {
    event.preventDefault();
    const payload = {
      title: draftSettings.title.trim() || "Link42 Looking Glass",
      apiBase: draftSettings.apiBase.trim(),
      apiToken: draftSettings.apiToken.trim(),
      publicNodeRefs: draftSettings.publicNodeRefs,
      nodeOverrides: draftSettings.nodeOverrides || {},
      publicProtocols: draftSettings.publicProtocols || {},
    };
    const { json } = await apiFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const next = { ...defaultSettings, ...json, configured: Boolean(json.apiBase && json.apiTokenSet) };
    setSettings(next);
    setDraftSettings({ ...next, apiToken: "" });
    setSettingsSaved(true);
    window.setTimeout(() => setSettingsSaved(false), 1600);
  }

  async function copyOutput() {
    const result = query?.result;
    const text = [result?.command, result?.stdout, result?.stderr].filter(Boolean).join("\n\n");
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const result = query?.result;
  const protocolResult = protocolQuery?.result;
  const protocols = parseBirdProtocols(protocolResult?.stdout || "");
  const protocolPageResult = protocolDetailPage?.query?.result;
  const protocolPageParsed = protocolDetailPage?.parsed;
  const protocolPageFields = protocolPageParsed?.fields || {};
  const protocolPageSummary = protocolPageParsed?.summary || protocolDetailPage?.protocol || {};
  const protocolPageRaw = protocolPageResult?.stdout || protocolPageResult?.stderr || protocolDetailPage?.query?.error?.message || "";
  const isEbgpDetailPage = Boolean(protocolPageParsed?.isExternalBgp);
  const originAsn = protocolPageFields["Neighbor AS"] || "";
  const canQueryOriginRoutes = Boolean(protocolDetailPage?.node?.capabilities?.bird_routes_by_origin_as && originAsn);
  const originRoutesResult = originRoutesQuery?.result;
  const originRoutesStatusLabel = t[originRoutesStatus] || originRoutesStatus;
  const statusLabel = t[queryStatus] || queryStatus;
  const protocolStatusLabel = t[protocolStatus] || protocolStatus;
  const protocolDetailStatusLabel = t[protocolDetailStatus] || protocolDetailStatus;
  const protocolDetailLoading = ["queued", "running"].includes(protocolDetailStatus) && Boolean(activeProtocolName);
  const nodeCountLabel = isAdmin ? `${nodes.length} ${t.adminNodeCount}` : `${visibleNodes.length} ${t.nodeCount}`;
  const pageTitle = settings.title || "Link42 Looking Glass";
  const hasVisibleNode = Boolean(activeNode);

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  return (
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <div className="topbar-inner">
          {page !== "protocol" && (
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} title={t.openNodes}>
              <Menu size={19} />
            </button>
          )}
          <div className="brand" aria-label={t.brand}>
            <BrandMark />
            <span className="brand-copy">
              <strong>{pageTitle}</strong>
              <small>Link42 Looking Glass</small>
            </span>
          </div>
          <div className="topbar-actions">
            <span className={`mode-pill ${isDemo ? "demo" : "live"}`}>
              <Database size={14} />
              {isDemo ? t.demo : t.live}
            </span>
            {isAdmin ? (
              <>
                <button className="text-icon-button" onClick={() => setPage((current) => (current === "admin" ? "lg" : "admin"))}>
                  <Settings2 size={16} />
                  <span>{t.admin}</span>
                </button>
              </>
            ) : null}
            <button
              className="text-icon-button"
              onClick={() => setLanguage((current) => (current === "zh" ? "en" : "zh"))}
              title="Switch language"
            >
              <Languages size={16} />
              <span>{language === "zh" ? "中文" : "EN"}</span>
            </button>
            <button className="icon-button" onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))} title="Theme">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {isAdmin ? (
              <button className="text-icon-button login-action" onClick={logout}>
                <LogOut size={16} />
                <span>{t.logout}</span>
              </button>
            ) : (
              <button className="text-icon-button login-action" onClick={() => setLoginOpen(true)}>
                <Lock size={16} />
                <span>{t.login}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {page === "admin" && isAdmin ? (
        <main className="admin-page">
          <section className="admin-panel">
            <div className="admin-head">
              <div>
                <span className="eyebrow">{t.admin}</span>
                <h2>{t.settings}</h2>
                <p>{t.settingsHint}</p>
              </div>
              {settingsSaved && <span className="saved-pill">{t.saved}</span>}
            </div>
            <form className="settings-form" onSubmit={saveSettings}>
              <label>
                <span>{t.customTitle}</span>
                <input
                  value={draftSettings.title}
                  onChange={(event) => setDraftSettings((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Link42 Looking Glass"
                />
              </label>
              <label>
                <span>{t.apiBase}</span>
                <input
                  value={draftSettings.apiBase}
                  onChange={(event) => setDraftSettings((current) => ({ ...current, apiBase: event.target.value }))}
                  placeholder="https://link42.pmman.tech"
                />
                <small className="field-hint">{t.apiBaseHint}</small>
              </label>
              <label>
                <span>{t.apiToken}</span>
                <div className="token-field">
                  <input
                    type={showToken ? "text" : "password"}
                    value={draftSettings.apiToken}
                    onChange={(event) => setDraftSettings((current) => ({ ...current, apiToken: event.target.value }))}
                    placeholder={draftSettings.apiTokenPreview || t.apiTokenPlaceholder}
                  />
                  <button type="button" onClick={() => setShowToken((current) => !current)} title={showToken ? t.hideToken : t.showToken}>
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {draftSettings.apiTokenPreview && <small className="field-hint">{draftSettings.apiTokenPreview}</small>}
              </label>
              <div className="public-node-box">
                <div className="public-node-head">
                  <div>
                    <span>{t.publicNodes}</span>
                    <small>{t.publicNodesHint}</small>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setDraftSettings((current) => ({ ...current, publicNodeRefs: nodes.map((node) => node.node_ref) }))}
                    >
                      {t.selectAll}
                    </button>
                    <button type="button" onClick={() => setDraftSettings((current) => ({ ...current, publicNodeRefs: [] }))}>
                      {t.clearAll}
                    </button>
                  </div>
                </div>
                <div className="public-node-list">
                  {nodes.map((node) => {
                    const override = draftSettings.nodeOverrides?.[node.node_ref] || {};
                    const displayName = override.name ?? node.name;
                    const icon = normalizeFlagCode(override.icon ?? node.icon ?? "");
                    const hiddenProtocols = draftSettings.publicProtocols?.[node.node_ref] || [];
                    const protocolOptions = settingsProtocolOptions[node.node_ref] || [];
                    const protocolPickerStatus = settingsProtocolStatus[node.node_ref] || "ready";
                    const protocolPickerLoading = ["queued", "running"].includes(protocolPickerStatus);
                    const canLoadProtocolChoices = node.online && node.capabilities?.bird_protocols;
                    return (
                      <div className="public-node-item" key={node.node_ref}>
                        <label className="node-public-toggle">
                          <input
                            type="checkbox"
                            checked={draftSettings.publicNodeRefs.includes(node.node_ref)}
                            onChange={() => togglePublicNode(node.node_ref)}
                          />
                        </label>
                        <NodeAvatar name={displayName} icon={icon} />
                        <span className="public-node-base">
                          <strong>{displayName}</strong>
                          <small>{regionOf(node, t.unknownRegion)} · {node.node_ref}</small>
                          <em>{t.originalName}: {node.raw_name || node.name}</em>
                        </span>
                        <div className="node-override-fields">
                          <label>
                            <span>{t.nodeName}</span>
                            <input
                              value={override.name || ""}
                              onChange={(event) => updateNodeOverride(node.node_ref, "name", event.target.value)}
                              placeholder={node.raw_name || node.name}
                            />
                          </label>
                          <label>
                            <span>{t.nodeIcon}</span>
                            <div className="flag-select-row">
                              <span className="flag-preview">
                                {icon ? <span className={`fi fi-${icon}`} /> : nodeInitial(displayName)}
                              </span>
                              <select
                                value={icon}
                                onChange={(event) => updateNodeOverride(node.node_ref, "icon", event.target.value)}
                              >
                                {flagOptions.map((option) => (
                                  <option value={option.value} key={option.value || "default"}>
                                    {option.value ? `${option.value.toUpperCase()} · ${option.label}` : option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                          <div
                            className="public-protocol-field"
                            onClick={() => {
                              if (canLoadProtocolChoices && !protocolOptions.length) loadSettingsProtocolOptions(node);
                            }}
                          >
                            <div className="protocol-picker-head">
                              <span>{t.publicProtocols}</span>
                              <button
                                className="text-icon-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  loadSettingsProtocolOptions(node);
                                }}
                                disabled={!canLoadProtocolChoices || protocolPickerLoading}
                              >
                                {protocolPickerLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
                                <span>{protocolOptions.length ? t.refreshProtocolChoices : t.loadProtocolChoices}</span>
                              </button>
                            </div>
                            <small>{t.publicProtocolsHint}</small>
                            {protocolPickerLoading && (
                              <div className="inline-loading">
                                <Loader2 className="spin" size={14} />
                                <span>{t.protocolsLoading}</span>
                              </div>
                            )}
                            {settingsProtocolError[node.node_ref] && <small className="field-error">{settingsProtocolError[node.node_ref]}</small>}
                            {protocolOptions.length ? (
                              <div className="protocol-choice-list">
                                {protocolOptions.map((protocol) => (
                                  <label className="protocol-choice" key={protocol.name}>
                                    <input
                                      type="checkbox"
                                      checked={hiddenProtocols.includes(protocol.name)}
                                      onChange={() => toggleHiddenProtocol(node.node_ref, protocol.name)}
                                    />
                                    <strong>{protocol.name}</strong>
                                    <span>{protocol.proto}</span>
                                    <em className={`protocol-state ${protocolStateClass(protocol)}`}>{protocol.state}</em>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              !protocolPickerLoading && <small className="field-hint">{canLoadProtocolChoices ? t.noProtocolChoices : t.protocolCapabilityBlocked}</small>
                            )}
                          </div>
                        </div>
                        <i className={`node-state ${node.online ? "online" : "offline"}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="security-note">{t.frontendSecurityHint}</p>
              <button className="save-button" type="submit">
                <Save size={15} />
                {t.saveSettings}
              </button>
            </form>
          </section>
        </main>
      ) : page === "protocol" && protocolDetailPage ? (
        <main className="protocol-page">
          <div className="protocol-page-actions">
            <button className="back-button" type="button" onClick={() => setPage("lg")}>
              <ArrowLeft size={16} />
              <span>{t.backToLookingGlass}</span>
            </button>
            {isEbgpDetailPage && (
              <button
                className="back-button origin-route-button"
                type="button"
                onClick={() => loadOriginAsRoutes(originAsn)}
                disabled={!canQueryOriginRoutes || ["queued", "running"].includes(originRoutesStatus)}
                title={canQueryOriginRoutes ? `${t.queryOriginAsRoutes} AS${originAsn}` : t.originAsUnsupported}
              >
                {["queued", "running"].includes(originRoutesStatus) ? <Loader2 className="spin" size={16} /> : <Route size={16} />}
                <span>{t.queryOriginAsRoutes}</span>
              </button>
            )}
          </div>

          <section className="protocol-hero">
            <div className="node-title-row">
              <NodeAvatar node={protocolDetailPage.node} large />
              <div>
                <span className="eyebrow">{isEbgpDetailPage ? t.ebgpPeerDetail : t.rawProtocolOutput}</span>
                <h1>{protocolPageSummary.name || activeProtocolName}</h1>
                <p>{protocolDetailPage.node?.name} · {regionOf(protocolDetailPage.node, t.unknownRegion)}</p>
              </div>
            </div>
            <div className="protocol-hero-meta">
              <span className={`protocol-state ${protocolStateClass(protocolPageSummary)}`}>{protocolPageSummary.state || "—"}</span>
              <code>{protocolPageSummary.proto || protocolDetailPage.protocol?.proto || "—"}</code>
            </div>
          </section>

          {isEbgpDetailPage ? (
            <>
              <section className="peer-overview">
                <div className="peer-as-line">
                  <div>
                    <span>{t.localAs}</span>
                    <strong>AS{protocolPageFields["Local AS"] || "—"}</strong>
                  </div>
                  <Route size={20} />
                  <div>
                    <span>{t.neighborAs}</span>
                    <strong>AS{protocolPageFields["Neighbor AS"] || "—"}</strong>
                  </div>
                </div>
                <div className="peer-detail-grid">
                  {[
                    [t.bgpState, protocolPageFields["BGP state"]],
                    [t.neighborAddress, protocolPageFields["Neighbor address"]],
                    [t.neighborId, protocolPageFields["Neighbor ID"]],
                    [t.session, protocolPageFields.Session],
                    [t.sourceAddress, protocolPageFields["Source address"]],
                    [t.holdTimer, protocolPageFields["Hold timer"]],
                    [t.keepaliveTimer, protocolPageFields["Keepalive timer"]],
                    [t.sendHoldTimer, protocolPageFields["Send hold timer"]],
                  ].map(([label, value]) => (
                    <div className="peer-detail-cell" key={label}>
                      <span>{label}</span>
                      <strong>{value || "—"}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="channel-section">
                <div className="section-heading compact">
                  <div>
                    <span className="eyebrow">{t.channels}</span>
                    <h2>{protocolPageParsed.channels.length}</h2>
                  </div>
                </div>
                <div className="channel-grid">
                  {protocolPageParsed.channels.map((channel) => (
                    <article className="channel-card" key={channel.name}>
                      <div className="channel-head">
                        <strong>{channel.name}</strong>
                        <span className={`protocol-state ${String(channel.fields.State || "").toLowerCase() === "up" ? "up" : "error"}`}>
                          {channel.fields.State || "—"}
                        </span>
                      </div>
                      <div className="channel-metrics">
                        <div><span>{t.routeTable}</span><strong>{channel.fields.Table || "—"}</strong></div>
                        <div><span>{t.preference}</span><strong>{channel.fields.Preference || "—"}</strong></div>
                        <div><span>{t.imported}</span><strong>{channel.routeCounts.imported || "—"}</strong></div>
                        <div><span>{t.exported}</span><strong>{channel.routeCounts.exported || "—"}</strong></div>
                        <div><span>{t.preferred}</span><strong>{channel.routeCounts.preferred || "—"}</strong></div>
                      </div>
                      <div className="channel-filters">
                        <span>{t.filters}</span>
                        <code>{channel.fields["Input filter"] || "—"}</code>
                        <code>{channel.fields["Output filter"] || "—"}</code>
                      </div>
                      {channel.stats.length ? (
                        <div className="route-stat-table">
                          <strong>{t.routeStats}</strong>
                          <div className="route-stat-head">
                            <span />
                            {channel.stats[0].values.map((item) => <span key={item.column}>{item.column}</span>)}
                          </div>
                          {channel.stats.map((row) => (
                            <div className="route-stat-row" key={row.name}>
                              <span>{row.name}</span>
                              {row.values.map((item) => <code key={`${row.name}-${item.column}`}>{item.value}</code>)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <section className="terminal-panel protocol-raw-panel">
            <div className="terminal-head">
              <div>
                <span className="terminal-dot red" />
                <span className="terminal-dot yellow" />
                <span className="terminal-dot green" />
                <strong>{t.rawProtocolOutput}</strong>
              </div>
              <Server size={15} />
            </div>
            <pre>{protocolPageRaw || t.noOutput}</pre>
          </section>
        </main>
      ) : (
      <div className="layout">
        <aside className={`node-sidebar ${sidebarOpen ? "is-open" : ""}`}>
          <div className="sidebar-top">
            <div>
              <span className="section-kicker">{t.nodes}</span>
              <strong>{nodeCountLabel}</strong>
            </div>
            <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} title={t.closeNodes}>
              <X size={18} />
            </button>
          </div>

          <div className="region-filter">
            <Globe2 size={15} />
            <label>
              <span>{t.regionFilter}</span>
              <select value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
                <option value="all">{t.allRegions}</option>
                {regionOptions.map((region) => (
                  <option value={region} key={region}>{region}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="node-list">
            {nodesLoading && <div className="side-state"><Loader2 className="spin" size={16} /> {t.loadingNodes}</div>}
            {!nodesLoading && filteredNodes.map((node) => (
              <button
                className={`node-item ${activeNode?.node_ref === node.node_ref ? "active" : ""}`}
                key={node.node_ref}
                onClick={() => selectNode(node.node_ref)}
              >
                <NodeAvatar node={node} />
                <span className="node-copy">
                  <strong>{node.name}</strong>
                  <small>{regionOf(node, t.unknownRegion)} · {node.node_ref}</small>
                </span>
                <span className={`node-state ${node.online ? "online" : "offline"}`} />
              </button>
            ))}
            {!nodesLoading && filteredNodes.length === 0 && (
              <div className="side-state">{visibleNodes.length === 0 ? t.noPublicNodes : t.emptyNodes}</div>
            )}
          </div>

          <div className="sidebar-foot">
            <button className="refresh-link" onClick={loadNodes}>
              <RefreshCw size={15} className={nodesLoading ? "spin" : ""} />
              {t.refresh}
            </button>
          </div>
        </aside>
        {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label={t.closeNodes} />}

        <main className="content">
          {hasVisibleNode && (
            <section className="hero-panel">
              <div>
                <span className="eyebrow">{t.selectedNode}</span>
                <div className="node-title-row">
                  <NodeAvatar node={activeNode} large />
                  <div>
                    <h1>{activeNode?.name || "—"}</h1>
                    <p>{t.subtitle}</p>
                  </div>
                </div>
              </div>
              <div className="hero-actions">
                <span className={`status-pill ${activeNode?.online ? "online" : "offline"}`}>
                  {activeNode?.online ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  {activeNode?.online ? t.online : t.offline}
                </span>
              </div>
            </section>
          )}

          {(nodesError || isDemo) && (
            <div className={`notice ${nodesError ? "error" : ""}`}>
              {nodesError ? `${t.apiError}: ${nodesError}` : `${t.tokenHint} ${t.noApiConfigured}`}
            </div>
          )}

          {hasVisibleNode ? (
            <>
              <section className={`node-detail-grid ${hideAddresses ? "public" : "admin"}`}>
                <div className="detail-cell">
                  <span>{t.lastSeen}</span>
                  <strong>{formatTime(activeNode?.last_seen_at, language)}</strong>
                </div>
                {!hideAddresses && (
                  <>
                    <div className="detail-cell">
                      <span>{t.managementIp}</span>
                      <code>{activeNode?.ips?.management_ip || "—"}</code>
                    </div>
                    <div className="detail-cell">
                      <span>{t.publicIp}</span>
                      <code>{activeNode?.ips?.public_ip || "—"}</code>
                    </div>
                  </>
                )}
                <div className="detail-cell">
                  <span>{t.capability}</span>
                  <strong>
                    {[
                      activeNode?.capabilities?.bird_route_lookup ? "BIRD" : "",
                      activeNode?.capabilities?.bird_routes_by_origin_as ? "Origin AS" : "",
                      activeNode?.capabilities?.bird_protocols ? "Protocols" : "",
                      activeNode?.capabilities?.ping ? "Ping" : "",
                      activeNode?.capabilities?.traceroute ? "Traceroute" : "",
                    ].filter(Boolean).join(" / ") || t.unsupported}
                  </strong>
                </div>
                {hideAddresses ? (
                  <div className="detail-cell endpoints">
                    <span>{t.endpointIps}</span>
                    <strong>{t.hiddenForPublic}</strong>
                  </div>
                ) : (
                  <div className="detail-cell endpoints">
                    <span>{t.endpointIps}</span>
                    <div>
                      {(activeNode?.ips?.endpoint_ips || []).map((endpoint) => <code key={endpoint}>{endpoint}</code>)}
                    </div>
                  </div>
                )}
              </section>

              <section className="protocol-panel">
                <div className="result-head protocol-head">
                  <div>
                    <Route size={18} />
                    <strong>{t.protocols}</strong>
                    <span className={`status-text state-${protocolStatus}`}>{protocolStatusLabel}</span>
                  </div>
                  <button
                    className="text-icon-button"
                    type="button"
                    onClick={loadProtocols}
                    disabled={!activeNode?.online || !activeNode?.capabilities?.bird_protocols || ["queued", "running"].includes(protocolStatus)}
                  >
                    {["queued", "running"].includes(protocolStatus) ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                    <span>{protocolQuery ? t.refreshProtocols : t.loadProtocols}</span>
                  </button>
                </div>
                {protocolError && <div className="form-error protocol-error">{protocolError}</div>}
                {["queued", "running"].includes(protocolStatus) && (
                  <div className="protocol-loading">
                    <Loader2 className="spin" size={18} />
                    <span>{t.protocolsLoading}</span>
                  </div>
                )}
                {!["queued", "running"].includes(protocolStatus) && protocolQuery && (
                  protocols.length ? (
                    <div className="protocol-table">
                      <div className="protocol-row protocol-row-head">
                        <span>{t.protocolName}</span>
                        <span>{t.protocolType}</span>
                        <span>{t.protocolTable}</span>
                        <span>{t.protocolState}</span>
                        <span>{t.protocolSince}</span>
                        <span>{t.protocolInfo}</span>
                      </div>
                      {protocols.map((protocol) => (
                        <button
                          className={`protocol-row ${activeProtocolName === protocol.name ? "active" : ""}`}
                          type="button"
                          key={protocol.name}
                          onClick={() => loadProtocolDetail(protocol)}
                        >
                          <strong>{protocol.name}</strong>
                          <span>{protocol.proto}</span>
                          <span>{protocol.table}</span>
                          <span className={`protocol-state ${protocolStateClass(protocol)}`}>{protocol.state}</span>
                          <span>{protocol.since || "—"}</span>
                          <span>{protocol.info || "—"}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="side-state">{t.noProtocols}</div>
                  )
                )}
              </section>

              <section className="lookup-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{t.lookupTools}</span>
                    <h2>{currentOperation.label}</h2>
                  </div>
                  <p>{currentOperation.hint}</p>
                </div>

                <div className="operation-tabs" role="tablist" aria-label={t.lookupTools}>
                  {operationOptions.map((item) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={operation === item.id}
                      className={operation === item.id ? "active" : ""}
                      key={item.id}
                      onClick={() => selectOperation(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <form className={`lookup-form lookup-form-${operation}`} onSubmit={runLookup}>
                  <label>
                    <span>{operation === "route" ? t.ipAddress : t.target}</span>
                    <input
                      value={operation === "route" ? ip : target}
                      onChange={(event) => {
                        if (operation === "route") {
                          setIp(event.target.value);
                        } else {
                          setTarget(event.target.value);
                        }
                      }}
                      placeholder={operation === "route" ? t.ipPlaceholder : t.targetPlaceholder}
                      autoComplete="off"
                    />
                  </label>
                  {operation === "ping" && (
                    <div className="numeric-grid two">
                      <label>
                        <span>{t.count}</span>
                        <input type="number" min="1" max="10" value={pingCount} onChange={(event) => setPingCount(event.target.value)} />
                      </label>
                      <label>
                        <span>{t.probeTimeout}</span>
                        <input type="number" min="1" max="10" value={pingTimeout} onChange={(event) => setPingTimeout(event.target.value)} />
                      </label>
                    </div>
                  )}
                  {operation === "traceroute" && (
                    <div className="numeric-grid">
                      <label>
                        <span>{t.maxHops}</span>
                        <input type="number" min="1" max="64" value={traceMaxHops} onChange={(event) => setTraceMaxHops(event.target.value)} />
                      </label>
                      <label>
                        <span>{t.waitSeconds}</span>
                        <input type="number" min="1" max="10" value={traceWait} onChange={(event) => setTraceWait(event.target.value)} />
                      </label>
                      <label>
                        <span>{t.traceQueries}</span>
                        <input type="number" min="1" max="5" value={traceQueries} onChange={(event) => setTraceQueries(event.target.value)} />
                      </label>
                    </div>
                  )}
                  <button className="run-button" type="submit" disabled={!canRun}>
                    {["queued", "running"].includes(queryStatus) ? <Loader2 className="spin" size={16} /> : <Play size={15} fill="currentColor" />}
                    {["queued", "running"].includes(queryStatus) ? t.running : t.run}
                  </button>
                  <span className={`query-state state-${queryStatus}`}>
                    <span />
                    {statusLabel}
                  </span>
                </form>

                {queryError && <div className="form-error">{queryError}</div>}
              </section>
            </>
          ) : (
            <section className="empty-panel">
              <Database size={22} />
              <strong>{isDemo ? t.noApiConfigured : t.noPublicNodes}</strong>
            </section>
          )}

          {(query || ["queued", "running", "failed"].includes(queryStatus)) && (
            <section className="result-panel">
              <div className="result-head">
                <div>
                  <Route size={18} />
                  <strong>{t.queryStatus}</strong>
                  <span className={`status-text state-${queryStatus}`}>{statusLabel}</span>
                </div>
                {result && (
                  <button className="text-icon-button" onClick={copyOutput}>
                    <Copy size={15} />
                    <span>{copied ? t.copied : t.copy}</span>
                  </button>
                )}
              </div>

              <div className="query-meta">
                <div><span>{t.queryId}</span><code>{query?.query_id || "—"}</code></div>
                <div><span>{t.operation}</span><code>{query?.operation || currentOperation.label}</code></div>
                <div><span>{t.duration}</span><code>{result?.duration_ms ? `${result.duration_ms}ms` : "—"}</code></div>
              </div>

              {result?.stdout && query?.operation === "bird.route_lookup" && <RouteVisual query={query} result={result} labels={t} />}

              <div className="terminal-panel">
                <div className="terminal-head">
                  <div>
                    <span className="terminal-dot red" />
                    <span className="terminal-dot yellow" />
                    <span className="terminal-dot green" />
                    <strong>{result?.command || currentOperation.label}</strong>
                  </div>
                  <Server size={15} />
                </div>
                <pre>{result?.stdout || result?.stderr || queryError || t.noOutput}</pre>
              </div>

              {result?.stderr && result.stdout && (
                <div className="stderr-block">
                  <span>{t.stderr}</span>
                  <pre>{result.stderr}</pre>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
      )}

      {loginOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="login-modal" onSubmit={submitLogin}>
            <button className="modal-close" type="button" onClick={() => setLoginOpen(false)} title="Close">
              <X size={17} />
            </button>
            <div className="login-icon">
              <Lock size={20} />
            </div>
            <h2>{t.loginTitle}</h2>
            <p>{t.loginHint}</p>
            <label>
              <span>{t.password}</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => {
                  setLoginPassword(event.target.value);
                  setLoginError("");
                }}
                placeholder={t.passwordPlaceholder}
                autoFocus
              />
            </label>
            {loginError && <div className="form-error">{loginError}</div>}
            <button className="save-button" type="submit">{t.login}</button>
          </form>
        </div>
      )}

      {originRoutesOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="origin-route-modal">
            <div className="origin-route-modal-head">
              <div>
                <span className="eyebrow">{t.originAsRoutes}</span>
                <h2>AS{originAsn || originRoutesQuery?.request?.asn || "—"}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => {
                  setOriginRoutesOpen(false);
                  setOriginRoutesError("");
                }}
                title={t.close}
              >
                <X size={17} />
              </button>
            </div>

            {["queued", "running"].includes(originRoutesStatus) && (
              <div className="origin-route-loading">
                <Loader2 className="spin" size={22} />
                <strong>{t.loadingRoutes}</strong>
                <span>{originRoutesStatusLabel}</span>
              </div>
            )}

            {originRoutesError && <div className="form-error origin-route-error">{originRoutesError}</div>}

            {!["queued", "running"].includes(originRoutesStatus) && originRoutesResult && (
              <div className="origin-route-body">
                {originRoutesResult.stdout && (
                  <RouteVisual
                    query={originRoutesQuery}
                    result={originRoutesResult}
                    labels={t}
                    title={`AS${originRoutesQuery?.request?.asn || originAsn}`}
                    allPreferred
                  />
                )}
                <div className="terminal-panel origin-route-raw">
                  <div className="terminal-head">
                    <div>
                      <span className="terminal-dot red" />
                      <span className="terminal-dot yellow" />
                      <span className="terminal-dot green" />
                      <strong>{originRoutesResult.command || t.originAsRoutes}</strong>
                    </div>
                    <Server size={15} />
                  </div>
                  <pre>{originRoutesResult.stdout || originRoutesResult.stderr || t.noOutput}</pre>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {protocolDetailLoading && (
        <div className="blocking-loader" role="status" aria-live="polite">
          <div className="blocking-loader-panel">
            <Loader2 className="spin" size={26} />
            <strong>{t.protocolDetailLoading}</strong>
            <span>{activeProtocolName}</span>
            <small>{protocolDetailStatusLabel}</small>
          </div>
        </div>
      )}
    </div>
  );
}

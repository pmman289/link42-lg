# Link42-LG 生产可用性审计报告

- **审计对象**：`D:/workspace/brainmaker_wp/temp/link42-lg`；clone HEAD `c54d407`（`Allow private network looking glass deployments`）。
- **审计日期**：2026-09-30；**审计方式**：仓库源码与部署文档核对，结合委托方提供的本机模拟上游、HTTP 接口及 Chrome 验证记录。以下“实测”仅指这些已提供的验证证据，不表示本报告另行接入真实生产主控或重跑压测。
- **交付边界**：仅提出修改建议与示例，不修改仓库源码；测试密码、Bearer Token、Cookie 值、临时截图均不收录。
- **结论级别**：**暂不建议以“全部生产场景已验证”准出**。基础安装、构建和主要模拟查询可运行；刷新协议必报离线、设置失败无反馈、上游异常变 500、分页丢节点、公开字段与协议隐藏语义，以及并发槽位公平/回收须先处理或明确接受风险。发布判定见第 7 节。

## 1. 范围、定位与证据标准

本仓库是 **Link42 第三方 Looking Glass API 的前后端展示与代理**：React/Vite 前端、FastAPI 后端、SQLite 保存 LG 配置；README“功能特性”“Docker 快速部署”“环境变量”均定义管理员可设置 API Base/Token、公开节点、节点显示名/图标和隐藏协议。**节点实体的创建、删除、更新、Agent/路由配置属于主控 Link42，不属于 LG**。本报告中的“增删改”仅指 LG 的配置新增/变更/撤销（公开勾选、覆盖名称/图标、黑名单、Token）及查询生命周期，不建议在 LG 凭空设计节点 CRUD。[`README.md`](link42-lg/README.md)；[`backend/main.py:67-74`](link42-lg/backend/main.py)；[`backend/main.py:846-897`](link42-lg/backend/main.py)。

证据分级：**实测成功/实测失败**为委托方已提供的本机执行记录；**静态风险**为按 HEAD 源码推断、尚无对应复现；**未覆盖**不推断通过。行号按 HEAD 原文件 1-based 计，链接指向本地仓库文件，不是永久 commit 锚点；建议修复时以函数与附近上下文定位。模拟 Link42 上游为 `127.0.0.1:18001`，LG 为 `127.0.0.1:18000`；模拟 schema 对照已查看的真实 Link42 约定：`deadline_at` 为 Unix 秒、提交 `POST` 返回 202 和 `Retry-After: 1`、查询异步且 60 秒截止、节点接口支持 cursor。**未连接真实生产主控**；第三方 ASN 外部网络和容器部署也未做生产验收。

## 2. 项目结构与端到端流程

| 环节 | 实现与边界 | 核对位置 |
|---|---|---|
| 构建/部署 | `npm ci` → Vite `dist`；Docker `node:22-alpine` 构建、`python:3.12-slim` 安装锁定的 Python 依赖，以 Uvicorn 提供 API/前端。镜像默认 root、无 HEALTHCHECK；README 已明确 root/持久化目录，属当前设计而非“未声明缺陷”。 | [`package.json`](link42-lg/package.json)、[`requirements.txt`](link42-lg/requirements.txt)、[`Dockerfile`](link42-lg/Dockerfile)、[`README.md`](link42-lg/README.md) |
| 管理配置（增/改/撤销） | 管理员登录获会话 → GET/PUT 设置；可保存 API Base/Token、公开节点集合、节点名/图标覆盖、隐藏协议名单；`clearApiToken` 后端已支持，前端未提供显式撤销入口。空 Token 输入代表保留原 Token（当来源未变）。 | [`main.py:798-886`](link42-lg/backend/main.py)、[`App.jsx:1341-1360,1468-1617`](link42-lg/src/App.jsx) |
| 节点读取 | LG 请求上游节点页、过滤公开节点、套用展示覆盖；公开响应剔除 `ips`，但当前保留 `raw_name`。管理页只列 LG 拉到的节点，并非节点 CRUD。 | [`main.py:543-557,889-897`](link42-lg/backend/main.py)、[`App.jsx:907-929,1519-1550`](link42-lg/src/App.jsx) |
| 查询与异步轮询 | route、来源 AS、协议列表/详情、ping、traceroute 走节点槽位 → 上游 POST 202 → LG 保存查询所属者 → 客户端按 Retry-After 轮询 → 终态释放槽位。公开非所属查询返回 404；协议列表输出过滤与详情拒绝已实现。 | [`main.py:585-663,900-1037`](link42-lg/backend/main.py)、[`App.jsx:1013-1267`](link42-lg/src/App.jsx) |
| ASN 丰富化/页面 | `/api/as/{asn}` 代理第三方名称数据；SPA 兜底路由提供 `index.html`。前端有中英/明暗主题、响应式节点栏和横向可滚动协议表。 | [`main.py:1040-1082`](link42-lg/backend/main.py)、[`App.jsx:646-709`](link42-lg/src/App.jsx)、[`styles.css:1104-1147,2416-2652`](link42-lg/src/styles.css) |

现有防护不可误报“缺失”：后端管理员鉴权、随机会话、HttpOnly/SameSite=Lax Cookie（Secure 随可信协议配置）、限流、请求体限制、安全响应头、host 及资源 ID 校验已存在；对公网生产仍需校验反代真实来源 IP 与 Cookie Secure。[`main.py:293-316,360-417,665-795`](link42-lg/backend/main.py)。私网/回环 API Base 和诊断内网目标为 README 显式支持的部署模式；不能仅因允许私网就定性为无条件 SSRF。若管理员账号受攻击或配置权限越界，管理员可选 API 地址带来风险，需结合允许主机、网络出口与 DNS 变化评估。

## 3. 验收事实矩阵（不要将模拟覆盖当生产保证）

| 类别 | 状态 | 已有证据与限制 |
|---|---|---|
| 构建与依赖 | **实测成功** | `npm ci`、`npm run build` 均通过；安装 FastAPI 后本地服务可跑。`npm audit` 报 **4 条 dev 构建链**告警（3 high、1 moderate：browserslist、nanoid、postcss、baseline-browser-mapping）；不能据此声称运行时已被利用，也不能忽略构建供应链更新。 |
| 鉴权/配置 | **实测成功** | 首次登录成功；匿名 GET 设置 401；设置增改、公开/取消公开、名称/图标覆盖、协议黑名单均通过；密码与模拟 Token 仅本机使用，不在本文呈现。 |
| 查询接口 | **模拟链路实测成功** | route/ping/traceroute、协议详情、来源 AS 的后端提交接口覆盖；路由、ping、traceroute 终态、点击 `peer_b` 的结构化 eBGP 详情，以及来源 AS 弹框最终路由可视化均在 Chrome 实际成功。来源 AS 首次检查仅等待 3.5 秒时尚未出现图表，继续等待至约 8 秒后出现；该等待不是功能失败。以上仍非真实生产主控验收。 |
| 权限/隐私 | **混合** | 匿名节点 `ips` 不返回，但 `raw_name` 泄漏内部原始命名（真实节点形如 `hkq-edge-01`，模拟形如 `hkg-edge-01`）；协议隐藏后列表不显示且直接查询详情 404，但路由 stdout 仍出现被隐藏的 `peer_hidden`。匿名无归属查询轮询 404 通过。 |
| 失败与公平性 | **实测失败/差异** | 上游查询 `status: failed` 和 `error.message` 正确返回，但前端不展示消息；一个访客占满同节点两个槽后另一访客 429；上游改为未监听的 localhost 端口时 `/api/nodes` 500 非结构化；错误 API Token 时公客接收上游 401 `invalid_token`。 |
| 边界/导航 | **实测失败/差异** | `/api/does-not-exist` 返回 200 HTML；首页无 Cache-Control；ASN 端点遇非 JSON 第三方响应 500，外网 ReadTimeout 偶发 500，`/api/as/0` 和 Unicode `²` 返回 200；`/api/nodes` 约第 61–65 次请求 429（与每分钟 60 次阈值一致，不能据此推断高并发容量）。 |
| 管理 host 锁 | **实测存在绕行** | 无 `LG_API_ALLOWED_HOSTS` 时直接换 host 得 400；先保存空 `apiBase`、再保存新 host 成功。`source_changed` 时旧 Token 会清空；**没有证据表明旧 Token 已被泄漏**。 |
| Chrome UI | **实测成功及失败** | 1440×900 和 375×812 均未见遮挡或页面横向滚动，长节点名截断符合当前设计，手机协议表可局部横向滚动；登录/设置正常。点击“刷新协议”必提示“节点离线，无法查询”；保存不可解析 API Base，UI 没错误反馈，Chrome pageerror 显示 `API Base host could not be resolved`。截图在系统临时目录，非交付物，不附链接。 |
| 未覆盖 | **不得判为通过** | 真实生产 Link42、Docker/Nginx/CDN 真实代理、多 worker/多副本、灾备恢复、生产级负载/长时运行、Token 轮换影响、实际移动端设备及无障碍。traceroute 和来源 AS 的最终浏览器视图已在模拟上游验证，不能外推到真实环境。仓库未见 CI/自动测试。 |

## 4. 优先级与逐项修复意见

优先级规则：**P0** 影响核心操作或既有公开策略/可用性、发布前应修/产品明确接受；**P1** 可预见竞态及错误体验，下一批；**P2** 治理及防御纵深。以下“静态”必须通过新增回归用例确认，不能当作已实测事故。参考片段表达变更意图，需按项目真实 JSON schema 和 FastAPI 类型适配。

### 4.1 P0：核心操作、故障响应和数据范围

1. **协议按钮事件误传（实测失败，前端所有在线节点）**：[`App.jsx:1046-1053,1193-1204,1903-1910`](link42-lg/src/App.jsx)。自动调用 `loadProtocols(activeNode)` 正常；按钮 `onClick={loadProtocols}` 把 MouseEvent 当 `nodeOverride`，其 `online` 缺失而误判离线。**最小补丁**：`onClick={() => loadProtocols(activeNode)}`；更稳妥将函数改 `async function loadProtocols(selectedNode)` 且仅接受显式 node，按钮/自动调用都传 node。回归：在线可查询、离线显示受限、重复点击 busy 时禁用；首次自动加载后手动刷新请求数量恰好 +1；无 MouseEvent 入参。

2. **保存错误丢失、失败态内容不显示（实测失败，管理员及所有查询访客）**：[`App.jsx:1341-1360,1466-1468,480-495`](link42-lg/src/App.jsx) 的提交没有 `try/catch`，导致未捕获 Promise 拒绝；[`App.jsx:1013-1044,1263-1267,2031,2075`](link42-lg/src/App.jsx) 轮询返回 failed 不抛错，渲染只考虑 `queryError`/stdout。示意：

   ```jsx
   const [settingsError, setSettingsError] = useState("");
   async function saveSettings(event) {
     event.preventDefault(); setSettingsError(""); setSettingsSaved(false);
     try {
       const { json } = await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
       // 成功后再更新 settings/draftSettings，token 输入清空；保留现有成功逻辑。
     } catch (error) { setSettingsError(error.message || "保存失败，请重试"); }
   }
   // form 内加 <p role="alert" className="form-error">{settingsError}</p>，并在提交期间禁用重复提交。
   // 查询展示优先级：
    const visibleError = queryError || (query?.status === "failed" ? query?.error?.message : "");
   ```

   不把服务端内部原始异常堆栈显示给访客；错误信息沿用结构化安全消息。协议详情/来源 AS 的 detached 轮询同样检查 `finalQuery.status` 和 `finalQuery.error?.message`，不将失败当作空输出。测试：不可解析 host 显示可读错误且 draft 不被清空、无 pageerror；failed 查询返回 200 时前端显示 `error.message`；401/429/502/504 显示区分后的提示。

3. **上游故障边界（实测 500；所有读取/提交）**：[`main.py:560-582`](link42-lg/backend/main.py) 每请求校验 DNS、创建 AsyncClient，网络异常未转换；成功非对象 JSON 也无法安全使用 `payload.get`。建议统一代理例程仅暴露稳定 `code/message`，记录受控服务端日志且**不输出 URL Token/上游敏感正文**：

   ```python
   try:
       response = await client.request(method, url, headers=headers, json=json_body)
   except httpx.TimeoutException as exc:
       raise HTTPException(504, detail={"code": "upstream_timeout", "message": "Link42 request timed out"}) from exc
   except httpx.RequestError as exc:
       raise HTTPException(502, detail={"code": "upstream_unavailable", "message": "Link42 is unavailable"}) from exc
   try:
       payload = response.json()
   except ValueError as exc:
       raise HTTPException(502, detail={"code": "invalid_upstream_response", "message": "Link42 returned invalid JSON"}) from exc
   if not isinstance(payload, dict):
       raise HTTPException(502, detail={"code": "invalid_upstream_response", "message": "Link42 returned an invalid object"})
   ```

   **兼容注记**：已有合法上游 4xx（尤其管理员可识别的 `invalid_token`）须先定义业务映射：匿名访客不应得到 Token 有效性细节，建议公共端映射为 `502 upstream_auth_failed`/通用配置故障，管理员侧保留安全诊断；不要盲改所有 401 语义。区分配置校验的 400（管理员输入/域名）与运行时不可达 502/504。测试连接拒绝、超时、HTML/数组/空 JSON、上游 401、合规的 202+Retry-After、上下游状态与日志脱敏。

4. **节点分页缺失（静态确定链路，>100 节点未实测）**：[`main.py:889-897`](link42-lg/backend/main.py) 只传 limit 而忽略 cursor；[`App.jsx:907-929`](link42-lg/src/App.jsx) 只读 `/api/nodes?limit=100`。后端加可选 `cursor: str | None = None`，经长度/字符白名单或安全 URL 编码并限制长度，使用 `urlencode({"limit": clamped, **({"cursor": cursor} if cursor else {})})` 上送；逐页过滤但保留上游 `next_cursor`，**不改变旧调用不传 cursor 的首屏响应**。前端循环读取 next_cursor，设置最大页数/节点上限与重复 cursor 检测，按 `node_ref` 去重，最后一次性 setNodes；失败时保留已有列表、提示部分加载或整体失败，明确产品选择。测试 101/501 条、跨页公开/非公开混排、空页有 cursor、重复 cursor、非法 cursor、分页限流；注意每页请求会触发 `/api/nodes` 每分钟 60 次限制。

5. **槽位占满与回收（跨访客 429 实测；终态无人轮询残留为静态风险）**：[`main.py:611-663,900-934,1018-1037`](link42-lg/backend/main.py)。当前同节点上限为 2，且在公开查询实际轮询到终态或截止清理时释放；上游 60 秒 deadline_at 是**秒**，[`main.py:646-652`](link42-lg/backend/main.py) 当前按秒使用正确，不能乘 1000。建议先定公平规则：全局节点 2 槽不变，增加每个有效 query-client 的**同节点在途限制**（如 1；管理员策略另定），在 SQLite `BEGIN IMMEDIATE` 的**同一事务**内按 `owner_hash` 和 node 查计数并插槽，避免并发越额；未获 cookie 的请求需先建立稳定客户端身份，见 4.2。队列满回复 429 和短 Retry-After，前端指导稍后重试，不要直接扩大节点并发以“解决”饥饿。上游查询可定期低频对账/采用可验证终态推送；不经对账时 deadline 保底回收：对有效 deadline 设置 60–90 秒本地上限，对异常 deadline 单独回退，并给允许的时钟偏差留余量；不能无条件提前终止上游合法查询。测试 A 两条/B 一条、公平性 B 在 A 一条时可占第二槽、终态被轮询/未轮询/超时/404/410 释放、并行插槽原子性、正常同节点双访客并发；对超时后的在途上游任务说明 LG 仅释放本地配额，不能假称已取消上游任务。

6. **公开字段与隐藏协议策略（隐私实测，需产品决策）**：[`main.py:543-557,505-539,976-989`](link42-lg/backend/main.py)。当产品承诺访客只看覆写名时，公开节点采用**显式字段白名单**（与实际 Link42 节点 schema 对齐：例如 `node_ref,name,icon,region,online,capabilities,last_seen_at`，逐个确认是否允许）而非只删除 `ips`；原始名仅管理员可见，审查 `node_ref` 或其他元数据是否本身透露敏感命名。协议黑名单当前**只保证协议列表及详情**；route stdout 暴露 `peer_hidden` 是实测事实。先请产品/安全负责人书面选定：(A) 黑名单仅隐藏“协议列表与详情”，文案清楚标注路由来源仍可见；或 (B) 全站不暴露协议标识，并在路由结构化字段、原始 stdout、失败输出及来源 AS 视图统一设计安全降级。**不能直接字符串替换 stdout**，否则破坏 BIRD 输出可读性/可观测性；若选 B，优先由上游提供脱敏结构化响应或禁用含敏感来源的公开原始路由，管理员保留完整输出。测试覆写名+raw_name、嵌套 IP 字段、隐藏 peer 在 route/stdout/detail、管理员与匿名差异。

7. **API host 锁的空值过渡（实测绕行，管理员配置权限）**：[`main.py:846-875`](link42-lg/backend/main.py)。当前仅 `api_base` 和 `current_api_base` 均非空才比较 host；先清空再设新 host 绕过“无白名单首次主机锁定”。设计持久化 `pinned_api_host`，首次成功配置时记录；清空 apiBase **不清锁**，换源要求运维明确配置 `LG_API_ALLOWED_HOSTS` 并完成 Token 重设或走有审计的迁移流程。旧数据库迁移时从已有非空 apiBase 回填，空 base 的历史实例需由运维明确确认而非自动随新请求重绑定。保留当前 `source_changed` 清 Token（[`main.py:866-875`](link42-lg/backend/main.py)），不要宣称已发生 Token 泄漏。测试新安装首次设置/清空/再设置、旧 DB 迁移、白名单迁移、Token 不随旧来源转发；这是加强管理员配置约束，安排维护窗口。

### 4.2 P1：竞态、操作完整性和反馈

1. **旧轮询覆盖新节点（静态风险）**：[`App.jsx:985-1011,1013-1044,1046-1204`](link42-lg/src/App.jsx)。切换节点/操作仅清状态，未取消计时和网络请求；旧轮询完成可覆盖新 query、协议、详情、来源 AS。对各查询通道采用 `useRef` 代数 + `AbortController`，切换节点/操作或关闭相关详情时递增代数并 abort；`await sleep` 前后及每个 `setState` 前检查 `generation === ref.current` 且 nodeRef/queryId 仍匹配。`pollDetachedQuery` 的 `onUpdate` 也必须受保护；不要仅 abort fetch 而遗漏 sleep 和提交响应。测试 A 的延迟响应晚于 B、连续切换三次、关闭弹窗后完成、组件卸载，最终只呈现最后一次有效操作。服务端已提交的异步任务不会因为 UI abort 自动取消，仍依靠槽位 deadline/对账。

2. **首次 cookie 并发竞态（静态风险，未实测）**：[`main.py:408-411,919-929`](link42-lg/backend/main.py) 在提交成功后才生成/设置 `lg_query_client`；[`App.jsx:1193-1204`](link42-lg/src/App.jsx) 自动加载协议可能与用户首次查询同时 POST，两个 response 各发不同 Set-Cookie，后到 cookie 可覆盖先前 query_id 所属者，轮询 404。建议 `/api/session` 在无合法 `lg_query_client` 时初始化并响应 Set-Cookie；前端 `loadSession()` 完成前禁用任何提交，既有合法 cookie **保持原值**，POST 保留懒创建兜底以兼容旧客户端。测试首次并发两 POST、响应反序、各自轮询均成功；已存在 cookie 不轮换、无归属轮询仍 404、管理员会话/访客隔离。

3. **隐藏项缺撤销入口、Token 缺清除按钮（静态确认）**：[`App.jsx:1519-1617`](link42-lg/src/App.jsx) 只遍历刚拉到的协议选项，已隐藏但过期/上游移除的名字无 checkbox；UI 应显示 `union(currentProtocolNames, hiddenProtocols)`，旧项标注“当前未发现”，可逐项取消、保存后回读验证。后端 `clearApiToken` 已存在（[`main.py:67-74,867-875`](link42-lg/backend/main.py)），前端新增需二次确认的“清除 Token”操作，PUT 显式传 `clearApiToken: true`，不用发送空字符串假装清除；保存后服务进入未配置状态应明示。测试协议离线/已移除仍能取消，Token 清除后 `apiTokenSet=false`、此前旧 Token 不被静默恢复。

4. **输入、复制与登录反馈（静态确认）**：[`App.jsx:459-465`](link42-lg/src/App.jsx) IPv6 正则接受语法错误的冒号串；前端使用明确 IPv6 解析库或与后端同等语义解析，服务端现用 `ipaddress.ip_address`，保留后端权威校验（[`main.py:77-86`](link42-lg/backend/main.py)）。[`App.jsx:1362-1368`](link42-lg/src/App.jsx) `navigator.clipboard?.writeText` 缺失仍提示已复制，应 `if (!navigator.clipboard?.writeText) { setCopyError(...); return; }` 并 try/catch；非 HTTPS/拒绝权限回归。登录 catch 把 429 一概写“密码错误”（[`App.jsx:1269-1284`](link42-lg/src/App.jsx)），由 `apiFetch` 传播 HTTP `status`、`Retry-After`，分别显示限流等待和真正 401，避免回显敏感诊断。

5. **ASN 稳定性与资源控制（非 JSON/ReadTimeout、0/² 实测）**：[`main.py:1040-1055`](link42-lg/backend/main.py) 用 Unicode `isdigit()` 而非 ASCII 严格解析，也未限制数值 1..4294967295；改 `re.fullmatch(r"(?:AS)?[0-9]{1,10}", asn, re.I)`、规范化成十进制数并校验范围。第三方返回非 JSON/非对象、非 2xx 或 `httpx.TimeoutException/RequestError` 时统一结构化 502/504（名称为附属功能，前端允许无名称回退）；后端设置正/负缓存 TTL、连接池、调用并发上限和可观测指标；[`App.jsx:652-673,700-709`](link42-lg/src/App.jsx) `Promise.all` 无界，失败永久缓存空串，改有限并发（如 4）、失败短 TTL 与可重试，成功长 TTL；避免把全局 `/api/as` 限流叠加至正常路由查询。测 `AS0`、`²`、最大/超界、非 JSON、429、超时、重复 ASN 大集合、失败恢复；第三方数据不作权威路由信息。

6. **路径/缓存/协议显示（静态+实测）**：[`main.py:1070-1082`](link42-lg/backend/main.py) SPA `/{path:path}` 吞没未知 `/api/*` 并返回 200 HTML；增加专属 `/api/{path:path}` 404 JSON，置于 SPA 兜底之前（注意保留既有 API 路由优先级）。[`main.py:781-794`](link42-lg/backend/main.py) `no-store` 仅覆盖 `/api/`，首页及 SPA fallback 补 `Cache-Control: no-store` 或经安全评估的 `no-cache`；带哈希的静态资源可采用长期 immutable 缓存，不盲目禁用全部缓存。[`App.jsx:550-562`](link42-lg/src/App.jsx) 协议时间字段若为单 token 时可能把首个 info 错当时间（**静态推断**），用有代表性的 BIRD 多版本输出样本区分 `YYYY-MM-DD HH:MM:SS`、单 token 和空值；不先宣称界面已错。[`styles.css:1104-1147`](link42-lg/src/styles.css) 表格已支持水平滚动，不列为手机显著布局缺陷；可增滚动提示、焦点可达、长名 title/aria-label，维持移动端不产生整页横向滚动。

### 4.3 P2：运维与工程治理（先评估兼容性）

- **数据库生命周期**：[`main.py:125-129,132-196,360-371,585-608`](link42-lg/backend/main.py) `with sqlite3.Connection` 提交/回滚事务但**不保证 close**；封装 `@contextmanager` 的 `connect_db()`，在 finally 显式 close，逐处替换，避免把正在迭代的 cursor 提前关掉。启动时会清过期记录，部分按请求清理，但不保证服务长期运行时 sessions、login_failures、query_access 全部持续回收；定期有界清理与 DB 文件大小/锁等待监控。新增 schema 迁移、SQLite 备份/恢复演练、写锁/多 worker 压测；不要直接删除现有 DB。
- **密钥与会话**：[`main.py:137-164,199-243,346-356`](link42-lg/backend/main.py) API Token 持久化在 SQLite 明文，管理员预览为前 10 + 尾 4；建议预览仅尾 4 或“已设置”，减少可见片段；备份/磁盘 ACL/容器卷加密和 Token 轮换流程优先。变更密钥存储方案、管理员会话失效策略前，评估旧 DB 数据迁移、回滚和现有会话兼容，勿把本机演示 Token 复制到报告或日志。
- **代理与部署**：[`README.md`](link42-lg/README.md) 的 `FORWARDED_ALLOW_IPS` 仅信任精确反代 IP/网段，不应 `*`；Nginx 传 `X-Forwarded-For`，仅可信代理生效，否则 `request.client.host`（[`main.py:399-401`](link42-lg/backend/main.py)）可能集中为代理 IP，访客及登录限流共享；反过来盲信用户自带头会被伪造。校验真实部署拓扑/覆盖率、HTTPS 与 `LG_COOKIE_SECURE`，对同一出口 NAT 的限流误伤设置告警。Docker 目前 root（README 明说）且无健康检查；在校验卷权限、SQLite 写入和代理可达后渐进改非 root、加轻量 liveness/readiness，readiness 应区分“LG 活着”和“上游可用”而不让外网暂断造成反复重启；上线前 staging 构建镜像验证。
- **供应链/测试**：依 `package-lock.json` 做受控 `npm audit --omit=dev` 对照，再评估 dev 构建链 4 条告警的修复版本及 Vite/plugin 兼容；不直接 `npm audit fix --force` 后发布。`requirements.txt` 固定 FastAPI 0.139.0、Starlette 1.3.1、Uvicorn 0.35.0、httpx 0.28.1；结合镜像扫描和许可证/更新节奏维护。建 CI：前端 lint/单测/build、Python 单测及 mock 上游契约、镜像构建/安全扫描；当前 `package.json` 仅 dev/backend/build/start/preview 脚本，仓库未见 CI 或测试文件。

## 5. 建议补丁拆分与可执行回归用例

按小 PR 分开，避免同一提交混合 UI、数据库迁移和代理语义：

| 批次 | 最小变更范围 | 必须新增的自动化断言（可用 FastAPI TestClient/httpx MockTransport + React 测试工具，均为建议，非声称已存在） |
|---|---|---|
| A：前端快修 | `src/App.jsx` 协议按钮、设置 catch、查询失败消息、登录/复制反馈 | 在线刷新产生 POST 且无离线提示；错误 API Base 的 400 显示且不清 draft；failed.error.message 可见；登录 429≠密码错、Clipboard 缺失≠复制成功。 |
| B：代理边界/分页 | `backend/main.py` 结构化 502/504、API 404、cursor、public 字段白名单（字段须产品确认）；前端全页读取 | mock 202 + Retry-After=1 + Unix 秒 deadline；DNS/连接失败与非 JSON；101/501 节点且跨页筛选；匿名无 raw_name/ips；未知 API 返回 404 JSON。 |
| C：并发/会话 | query client 在 session 初始化、槽位公平与截止保护、轮询代数/abort | 首次双 POST 响应乱序仍可轮询；不同访客同节点各得槽、公客隔离；无轮询终态回收；切换节点旧完成不污染当前状态。 |
| D：产品决策/运维 | 隐藏协议策略确定后落实、host pin 迁移、AS 缓存与限流、卷/反代/健康检查 | route stdout 策略与 UI 文案一致；清 apiBase 不解除锁；Token 不跨源沿用；AS 异常有界回退；原有 DB、反代和移动布局回归。 |

回归数据固定为不含真实凭证的合成节点：跨页 105 个、至少两访客与两节点、在线/离线、长显示名、含敏感 `raw_name` 与隐藏 `peer_hidden` 的 BIRD stdout、eBGP 详情不同格式、查询 `queued/running/succeeded/failed/expired`、异常 deadline（毫秒/过去/极远未来）；契约样本应对照 Link42 官方响应字段，不能把 mock 输出误当生产 schema 的全部。为上游提交故障、Cookie 并发与槽位竞态使用可控 barrier/延迟，不能只做顺序 happy path。

手动 Chrome 回归（1440×900、375×812）：访客首屏/地区/节点切换、协议自动加载及刷新、route 可视化、ping、traceroute **终态**、eBGP 详情、来源 AS 弹框 **直到可视化或明确失败**、设置成功/错误及撤销、浅色/深色/中英、键盘焦点与局部横向滚动；记录 HTTP 状态、完整轮询终态、对应匿名字段和性能，截图存受控测试系统而非本报告临时目录。

## 6. 发布前安全/兼容核查与回滚

1. **冻结产品语义**：由 LG/Link42 主控负责人确认“公开”字段、隐藏协议覆盖范围及实际上游 schema；测试使用非生产凭证。定义 Token 错误对匿名访客的安全文案。未确定黑名单含义时不得假称全站隐藏。
2. **优先发布批次 A、B**：CI 构建、mock 契约/接口测试通过；检查 cursor 为可选且旧客户端仍得到首屏；先在 staging 核对真实 Link42 异步 202/Retry-After/Unix 秒 deadline，观察错误率与响应时延，再小流量发布。P0 公共字段整改先验证不会丢掉前端必需字段。
3. **批次 C 单独灰度**：新 `/api/session` 只给缺少合法 cookie 的客户端创建标识，不轮换已有标识；旧前端 POST 懒生成仍能工作；槽位策略在灰度负载下验证同节点正常两访客并发与 429 公平性。改变 DB schema（host pin）前备份 SQLite 并演练回滚；数据库迁移一旦落地，旧镜像是否能读新 schema 先实测，必要时提供向后兼容迁移，而不是只回滚镜像。
4. **批次 D 与运营准入**：明确 `LG_API_ALLOWED_HOSTS`、反代可信来源、TLS 和备份权限；验证 Docker 容器/健康检查及原有数据；灰度观察上游 401/502/504、节点页数、槽位活跃时长/429 分布、匿名异常字段、前端未捕获拒绝、ASN 第三方失败与 Cache-Control。触发阈值由运维根据基线制定，出现匿名隐私回归应停止放量并回滚应用且评估缓存清除；Token/DB 泄露疑虑需轮换，不能仅回滚代码。

## 7. 生产放行判据

- **必须满足**：按钮和设置错误两个 Chrome 复现项消失；代理对网络/非 JSON 异常返回结构化 502/504 而非裸 500；>100 节点完整可达；两访客同节点资源公平与超时可回收；公开节点字段与黑名单行为有书面产品定义且匿名接口按定义验证；API host 清空绕行有明确修复或接受记录。
- **必须记录证据**：以真实 Link42 的只读/非破坏性测试环境核对节点 cursor、异步查询终态、deadline 与来源 AS 最终视图、traceroute 最终视图；检查 Token 轮换和代理部署；匿名/管理员双视角跑全套回归，测试不得创建或删除主控节点。
- **可后续推进但要有负责人/期限**：P1 轮询竞态、首次 cookie 并发、协议取消入口、ASN 弹性；P2 CI、健康检查、非 root、存储生命周期及构建供应链告警。若首发需接受 P1 风险，须按实际场景监控并书面授权，不能把静态风险写成“已修复”。

**最终审计判断**：本项目作为配置与查询型 LG 有可工作的基础链路，但当前证据仅支持“本机模拟场景部分可用、存在可复现缺陷与明确静态风险”，**不支持全量生产可用保证**。在 P0 修复/产品裁决、真实主控契约回归和部署演练完成前，建议保持有限流量或暂缓正式准出。

# Link42 Looking Glass 生产核查清单

本清单记录本轮安全整改的实现状态和验证边界。真实上线前仍需使用不含生产凭证的 staging API 做一次完整演练。

## P0

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 管理员密码不再使用默认值，启动时强制要求至少 8 位 | 已修复并验证 | `backend/main.py` 的 `load_admin_password()`；Docker 中缺失或空密码以非零状态退出 |
| Starlette 升级到不受报告漏洞影响的版本 | 已修复并验证 | `requirements.txt` 固定 `starlette==1.3.1`；Docker 构建通过 |
| 登录失败限流和退避 | 已修复并验证 | SQLite 记录失败次数；第 5 次失败后返回 429 和 `Retry-After` |
| 路由、诊断目标和协议名由后端校验 | 已修复并验证 | Pydantic/IP 地址、域名、资源 ID 和协议名校验；命令注入样例返回 422 |
| API Base 主机锁定，来源变化时不复用旧 Token | 已修复并验证 | `pinned_api_host` 持久化；清空地址后切换主机被拒绝；HTTP 仅记录启动警告，允许 DN42 私网 |
| 公开节点字段最小化，查询访问凭证隔离 | 已修复并验证 | 匿名节点白名单字段；查询绑定 `lg_query_client`；管理员和访客访问范围分离 |
| 代理上游网络、超时、非 JSON 和错误响应统一脱敏 | 已修复并验证 | 代理返回结构化 502/504；不把 Bearer Token 或上游正文写入日志 |
| 隐藏协议的公开语义 | 已修复并验证 | 采用全站策略 B：访客协议列表、详情和路由候选均移除黑名单协议；管理员保留完整结果 |

## P1

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 节点分页 | 已修复并验证 | 后端转发安全 cursor；前端最多加载 20 页并按 `node_ref` 去重 |
| 节点查询并发控制 | 已修复并验证 | 节点全局槽位、单访客同节点槽位和 90 秒本地回收；不同访客可公平使用剩余槽位 |
| 前端旧轮询结果覆盖新节点 | 已修复 | route、协议、详情、来源 AS 使用 generation + `AbortController`；同时取消等待计时和 fetch |
| 首次访客身份竞态 | 已修复 | `/api/session` 先发放稳定查询 cookie；提交接口保留懒创建兼容路径 |
| 协议黑名单撤销和 Token 清除 | 已修复 | 设置页展示当前未返回但已隐藏的协议，并提供清除 Token 操作 |
| ASN 查询资源控制 | 已修复并验证 | ASN 严格校验、后端正负缓存/共享连接/并发上限、前端最多 4 路并发和失败短缓存 |
| 协议列表时间字段解析 | 已修复 | `show protocols` 的单 token `Since` 与后续 Info 分开解析，并保留空值回退 |

## P2 与上线前确认

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| SQLite 连接、迁移和旧查询权限数据 | 已修复并验证 | 显式提交、回滚和关闭连接；保留并迁移旧 `query_owners` 数据；生命周期任务每 15 分钟清理过期记录 |
| 安全响应头和生产 API 文档 | 已修复并验证 | CSP、HSTS（HTTPS 请求）、X-Content-Type-Options 等；`/docs`、`/redoc`、`/openapi.json` 关闭 |
| liveness 健康检查 | 已修复并验证 | `/healthz` 和 Docker `HEALTHCHECK`；不依赖上游可用性，避免暂时故障反复重启 |
| 容器 root 运行 | 产品决策接受 | 按部署要求保留 root；宿主机卷权限仍需运维核对 |
| 私网、回环和 DN42 API 目标 | 产品决策接受 | 按需求允许；API Base 使用 HTTP 时启动日志告警，生产应通过可信网络和反向代理保护 Token |
| 反向代理转发头 | 待真实部署验证 | `FORWARDED_ALLOW_IPS` 必须设置为准确代理 IP/网段，禁止 `*` |
| API Token 存储与备份权限 | 待真实部署验证 | Token 仍保存在 SQLite；限制数据卷和备份权限，并制定轮换流程 |
| 前端依赖和持续集成 | 已补齐基础门禁 | `npm audit --omit=dev` 当前为 0；新增后端 unittest、前端构建、依赖审计和 Docker 构建 GitHub Actions；镜像扫描仍需平台配置 |

## 已执行验证

- `python3 -m py_compile backend/main.py`
- `npm ci`、`npm run build`、`git diff --check`
- `python -m unittest discover -s tests -v`
- Docker 多阶段镜像构建成功，Python 依赖安装和前端构建成功
- Docker 接口回归：健康检查、API 404、节点公开字段、查询轮询、ASN 查询、登录限流、请求体/参数校验、访客槽位公平性、API 主机锁和 HTTP 警告

真实上线前应在 staging 核对 Link42 的节点 cursor、异步查询终态、`deadline_at` 单位、错误结构以及反向代理的 HTTPS/Cookie 行为。

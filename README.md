# Link42 Looking Glass

Link42 Looking Glass 是一个面向 Link42 第三方 Looking Glass API 的前后端一体化 Web 应用。前端提供节点选择、路由查询、协议状态、协议详情和网络诊断界面。
演示站点：https://lg.pmman.tech

## 功能特性

- 后端代理 Link42 第三方 API，API Base 和 Token 保存在 SQLite 中。
- 管理员登录后可配置 API、Token、公开节点、节点显示名称、节点图标和协议隐藏列表。
- 公开视图会隐藏节点地址信息，只展示管理员允许公开的节点。
- 支持按地域筛选节点。
- 支持 BIRD route lookup。
- 支持 BIRD `show protocols` 和 `show protocol all <protocol>`。
- 支持 eBGP 协议详情结构化展示，非 eBGP 协议展示原始输出。
- 支持按来源 ASN 查询首选路由，并复用路由可视化组件展示。
- 支持 ping 和 traceroute。
- 单节点查询有后端并发限制，避免多访客打穿上游或节点 Agent。
- 支持中英文切换、亮色/暗色主题。

## 技术栈

- Frontend: React + Vite
- Backend: Python + FastAPI
- Storage: SQLite
- Container: Docker multi-stage build

## Docker 快速部署

部署本项目前请先部署Link42：https://github.com/pmman289/link42

推荐使用 Docker Compose 部署。镜像仓库：

```text
pmman/link42-lg
```

创建目录：

```bash
mkdir -p link42-lg/data link42-lg/config
cd link42-lg
```

创建 `docker-compose.yml`：

```yaml
services:
  link42-lg:
    image: pmman/link42-lg:latest
    container_name: link42-lg
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      LG_ADMIN_PASSWORD: "replace-with-a-long-random-password"
      LG_COOKIE_SECURE: "auto"
      LG_NODE_CONCURRENCY_LIMIT: "2"
      LG_DATA_DIR: "/app/data"
      LG_CONFIG_DIR: "/app/config"
      LG_DB_PATH: "/app/data/looking-glass.sqlite3"
    volumes:
      - ./data:/app/data
      - ./config:/app/config
```

启动：

```bash
docker compose up -d
```

访问：

```text
http://127.0.0.1:8000
```

首次部署后点击右上角登录，使用 `LG_ADMIN_PASSWORD` 设置的管理员密码进入管理页，然后配置：

- API 地址，例如 `https://link42.example.com` 或内网的 `http://172.20.0.10:8000`
- Looking Glass API Token
- 公开节点
- 节点名称、图标和公开协议隐藏列表

## Docker Run 示例

```bash
docker run -d \
  --name link42-lg \
  --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  -e LG_ADMIN_PASSWORD='replace-with-a-long-random-password' \
  -e LG_COOKIE_SECURE='auto' \
  -e LG_NODE_CONCURRENCY_LIMIT='2' \
  -v "$PWD/data:/app/data" \
  -v "$PWD/config:/app/config" \
  pmman/link42-lg:latest
```

## HTTPS 反向代理 / CDN

容器镜像默认使用：

```bash
uvicorn backend.main:app --proxy-headers
```

反向代理必须传递 `X-Forwarded-*` 头，否则框架在处理自动 slash redirect 或静态资源 redirect 时可能生成错误的 `http://` 地址。

镜像默认只信任来自 `127.0.0.1` 的转发头。反向代理不在同一网络命名空间时，通过 `FORWARDED_ALLOW_IPS` 设置反向代理的准确 IP 或专用容器网段，并确保 8000 端口不直接暴露到公网。例如 `FORWARDED_ALLOW_IPS=172.30.0.0/24`。不要设置为 `*`。

Nginx 示例：

```nginx
server {
    listen 443 ssl http2;
    server_name lg.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port 443;
    }
}
```

如使用 Cloudflare：

- SSL/TLS mode 使用 `Full` 或 `Full (strict)`。
- 不要使用 `Flexible`，否则 CDN 到源站使用 HTTP，而源站/反代又强制 HTTPS 时会产生重定向循环。
- `LG_COOKIE_SECURE=auto` 会根据可信代理传入的协议自动启用 Secure Cookie，也可强制设为 `true`。
- 如果源站反代也做 HTTP 到 HTTPS 跳转，确认 CDN 到源站也走 HTTPS。

## 持久化目录

容器内需要持久化：

```text
/app/data    SQLite 数据库目录
/app/config  配置文件目录
```

默认数据库：

```text
/app/data/looking-glass.sqlite3
```

容器默认以 root 用户运行，因此绑定宿主机目录时不需要额外调整为固定 UID/GID。

升级前建议备份数据库：

```bash
cp ./data/looking-glass.sqlite3 ./data/looking-glass.sqlite3.bak.$(date +%Y%m%d%H%M%S)
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LG_ADMIN_PASSWORD` | 无 | 必填；长度 8-256，缺失或不足 8 位时服务拒绝启动 |
| `LG_COOKIE_SECURE` | `auto` | 根据请求协议设置 Secure Cookie；可设为 `true` 或 `false` |
| `LG_MAX_REQUEST_BODY_BYTES` | `1048576` | API 请求体大小上限 |
| `LG_NODE_CONCURRENCY_LIMIT` | `2` | 单节点并发查询限制 |
| `LG_DATA_DIR` | `./data` | 数据目录，容器默认 `/app/data` |
| `LG_CONFIG_DIR` | `./config` | 配置目录，容器默认 `/app/config` |
| `LG_DB_PATH` | `$LG_DATA_DIR/looking-glass.sqlite3` | SQLite 数据库路径 |
| `LG_API_BASE` | 空 | 首次初始化数据库时写入的 API 地址 |
| `LG_API_TOKEN` | 空 | 首次初始化数据库时写入的 API Token |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Uvicorn 信任的反向代理 IP 或网段，逗号分隔 |

`LG_API_BASE` 和 `LG_API_TOKEN` 只在首次初始化数据库时作为默认值写入。数据库已经存在后，请在管理页修改配置。

API Base 支持 HTTP 和 HTTPS，也允许解析到私网、回环及 DN42 地址。使用 HTTP 时，应用会在启动和保存配置时输出明文传输警告，不会强制升级到 HTTPS。管理员可以直接在管理页更换 API 地址，无需配置域名白名单或重启服务。API 来源发生变化时，旧 Token 会自动清除，必须显式填写新 Token。

旧版本的 `LG_API_ALLOWED_HOSTS` 环境变量和数据库中保存的主机锁定值不再生效，无需删除数据库；部署配置中的旧环境变量可以移除。

保存 API Base 时仅校验地址格式，不要求 DNS 或上游服务当前可用。实际加载节点、执行查询时才连接 API；DNS/连接失败会显示上游不可用错误。

路由查询、ping 和 traceroute 均允许私网及 DN42 IPv4/IPv6 地址；ping 和 traceroute 同时允许内部域名。

## 本地开发

安装前端依赖：

```bash
npm ci
```

安装后端依赖：

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

开发模式：

```bash
npm run dev
export LG_ADMIN_PASSWORD='local-development-password'
npm run backend
```

生产构建：

```bash
npm run build
export LG_ADMIN_PASSWORD='local-development-password'
npm run start
```

## 构建 Docker 镜像

```bash
docker build -t pmman/link42-lg:local .
```

发布 Docker Hub 的完整流程见：

```text
docs/docker-hub-release.md
```

## 安全提示

当前发布版本为 `0.1.2`。前端构建依赖使用 Vite `8.3.5`，Python Web 栈使用 FastAPI `0.158.0`、Starlette `1.9.0` 和 Uvicorn `0.54.0`；npm audit 与 pip-audit 均通过。Docker 构建阶段使用 Node 24 Alpine，运行时使用 Python 3.12 slim。

- 必须设置强随机 `LG_ADMIN_PASSWORD`，未设置时应用不会启动。
- API Base 使用 HTTP 时 Token 会明文传输；公网部署应优先使用 HTTPS。管理员可配置任意合法 HTTP(S) API 地址，请保护管理员账号，并按需在部署侧限制出站访问。
- 使用 HTTPS 和反向代理时保持 `LG_COOKIE_SECURE=auto`，并准确配置 `FORWARDED_ALLOW_IPS`。
- API Token 只保存在后端 SQLite 中，浏览器不会直接访问 Link42 第三方 API。

## License

Apache License 2.0

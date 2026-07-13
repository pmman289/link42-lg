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
chown -R 10001:10001 link42-lg/data link42-lg/config
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
      LG_API_ALLOWED_HOSTS: "link42.example.com"
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

- API 地址，例如 `https://link42.example.com`
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
  -e LG_API_ALLOWED_HOSTS='link42.example.com' \
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

升级前建议备份数据库：

```bash
cp ./data/looking-glass.sqlite3 ./data/looking-glass.sqlite3.bak.$(date +%Y%m%d%H%M%S)
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LG_ADMIN_PASSWORD` | 无 | 必填；长度 12-256 且不能使用简单、重复的内容，缺失时服务拒绝启动 |
| `LG_COOKIE_SECURE` | `auto` | 根据请求协议设置 Secure Cookie；可设为 `true` 或 `false` |
| `LG_API_ALLOWED_HOSTS` | 空 | API Base 域名白名单，逗号分隔，支持 `*.example.com`；未配置时首次保存的域名会被锁定，之后不能在管理页换域名 |
| `LG_MAX_REQUEST_BODY_BYTES` | `1048576` | API 请求体大小上限 |
| `LG_NODE_CONCURRENCY_LIMIT` | `2` | 单节点并发查询限制 |
| `LG_DATA_DIR` | `./data` | 数据目录，容器默认 `/app/data` |
| `LG_CONFIG_DIR` | `./config` | 配置目录，容器默认 `/app/config` |
| `LG_DB_PATH` | `$LG_DATA_DIR/looking-glass.sqlite3` | SQLite 数据库路径 |
| `LG_API_BASE` | 空 | 首次初始化数据库时写入的 API 地址 |
| `LG_API_TOKEN` | 空 | 首次初始化数据库时写入的 API Token |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Uvicorn 信任的反向代理 IP 或网段，逗号分隔 |

`LG_API_BASE` 和 `LG_API_TOKEN` 只在首次初始化数据库时作为默认值写入。数据库已经存在后，请在管理页修改配置。

API Base 始终要求 HTTPS 且只能解析到公网地址。建议部署时显式设置 `LG_API_ALLOWED_HOSTS`；未设置时，已有数据库中的 API 域名或首次在管理页保存的域名会作为固定可信域名。API 来源发生变化时，旧 Token 会自动清除，必须显式填写新 Token。

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

- 必须设置强随机 `LG_ADMIN_PASSWORD`，未设置时应用不会启动。
- API Base 仅允许 HTTPS 且必须解析到公网地址；生产环境建议同时配置 `LG_API_ALLOWED_HOSTS`。
- 使用 HTTPS 和反向代理时保持 `LG_COOKIE_SECURE=auto`，并准确配置 `FORWARDED_ALLOW_IPS`。
- API Token 只保存在后端 SQLite 中，浏览器不会直接访问 Link42 第三方 API。

## License

Apache License 2.0

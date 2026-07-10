# Link42 Looking Glass

Link42 Looking Glass 是一个面向 Link42 第三方 Looking Glass API 的前后端一体化 Web 应用。前端提供节点选择、路由查询、协议状态、协议详情和网络诊断界面；后端使用 FastAPI 代理第三方 API，避免 API Token 暴露在浏览器中。

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
      - "8000:8000"
    environment:
      LG_ADMIN_PASSWORD: "change-me"
      LG_COOKIE_SECURE: "true"
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
  -p 8000:8000 \
  -e LG_ADMIN_PASSWORD='change-me' \
  -e LG_COOKIE_SECURE='true' \
  -e LG_NODE_CONCURRENCY_LIMIT='2' \
  -v "$PWD/data:/app/data" \
  -v "$PWD/config:/app/config" \
  pmman/link42-lg:latest
```

## HTTPS 反向代理 / CDN

容器镜像默认使用：

```bash
uvicorn backend.main:app --proxy-headers --forwarded-allow-ips='*'
```

反向代理必须传递 `X-Forwarded-*` 头，否则框架在处理自动 slash redirect 或静态资源 redirect 时可能生成错误的 `http://` 地址。

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
- HTTPS 生产环境建议设置 `LG_COOKIE_SECURE=true`。
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
| `LG_ADMIN_PASSWORD` | `link42` | 管理员登录密码，生产环境必须修改 |
| `LG_COOKIE_SECURE` | 空 | HTTPS 环境建议设置为 `true` |
| `LG_NODE_CONCURRENCY_LIMIT` | `2` | 单节点并发查询限制 |
| `LG_DATA_DIR` | `./data` | 数据目录，容器默认 `/app/data` |
| `LG_CONFIG_DIR` | `./config` | 配置目录，容器默认 `/app/config` |
| `LG_DB_PATH` | `$LG_DATA_DIR/looking-glass.sqlite3` | SQLite 数据库路径 |
| `LG_API_BASE` | 空 | 首次初始化数据库时写入的 API 地址 |
| `LG_API_TOKEN` | 空 | 首次初始化数据库时写入的 API Token |

`LG_API_BASE` 和 `LG_API_TOKEN` 只在首次初始化数据库时作为默认值写入。数据库已经存在后，请在管理页修改配置。

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
npm run backend
```

生产构建：

```bash
npm run build
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

- 不要把 `data/looking-glass.sqlite3` 提交到 Git 仓库。
- 生产环境务必修改 `LG_ADMIN_PASSWORD`。
- 使用 HTTPS 和反向代理时建议设置 `LG_COOKIE_SECURE=true`。
- API Token 只保存在后端 SQLite 中，浏览器不会直接访问 Link42 第三方 API。

## License

Apache License 2.0

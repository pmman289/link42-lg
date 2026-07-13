# Link42 Looking Glass Docker Hub 发布流程

本文供构建 agent 使用，目标镜像仓库为：

```text
pmman/link42-lg
```

## 1. 运行时目录

容器内需要暴露并持久化两个目录：

```text
/app/data    SQLite 数据库目录
/app/config  配置文件目录
```

默认数据库路径：

```text
/app/data/looking-glass.sqlite3
```

应用当前主要配置保存在 SQLite 中，管理员登录后可在 Web 管理页设置 API Base、Token、公开节点、节点名称、节点图标和协议隐藏列表。`/app/config` 作为部署侧配置目录保留，便于挂载 env 文件、反向代理配置或后续扩展。

支持的路径环境变量：

```text
LG_DATA_DIR=/app/data
LG_CONFIG_DIR=/app/config
LG_DB_PATH=/app/data/looking-glass.sqlite3
```

常用运行环境变量：

```text
LG_ADMIN_PASSWORD=replace-with-a-long-random-password
LG_COOKIE_SECURE=auto
LG_API_ALLOWED_HOSTS=link42.example.com
LG_NODE_CONCURRENCY_LIMIT=2
LG_API_BASE=https://link42.example.com
LG_API_TOKEN=l42lg_xxx_xxx
```

`LG_API_BASE` 和 `LG_API_TOKEN` 只在首次初始化数据库时写入默认设置；后续以管理页和 SQLite 中的配置为准。

`LG_API_ALLOWED_HOSTS` 用于固定 API Base 的可信域名，支持逗号分隔和 `*.example.com`。未设置时首次保存的 API 域名会被锁定，后续更换域名需要先配置白名单。API 来源变化时应用会清除旧 Token。

## 2. 构建前检查

在仓库根目录执行：

```bash
npm ci
npm run build
python -m py_compile backend/main.py
```

确认 Dockerfile 存在：

```bash
test -f Dockerfile
```

## 3. 登录 Docker Hub

```bash
docker login
```

如构建 agent 使用 token，推荐：

```bash
printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
```

## 4. 构建并推送

建议使用 git commit 短哈希作为不可变版本标签：

```bash
VERSION="$(git rev-parse --short HEAD)"
IMAGE="pmman/link42-lg"
```

单架构构建并推送：

```bash
docker build -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"
```

多架构构建并推送：

```bash
docker buildx create --use --name link42-lg-builder 2>/dev/null || docker buildx use link42-lg-builder
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  --push \
  .
```

## 5. 本地运行验收

```bash
mkdir -p "$PWD/runtime/data" "$PWD/runtime/config"
chown -R 10001:10001 "$PWD/runtime/data" "$PWD/runtime/config"
docker run --rm \
  --name link42-lg \
  -p 127.0.0.1:8000:8000 \
  -e LG_ADMIN_PASSWORD='replace-with-a-long-random-password' \
  -e LG_COOKIE_SECURE=false \
  -e LG_API_ALLOWED_HOSTS='link42.example.com' \
  -v "$PWD/runtime/data:/app/data" \
  -v "$PWD/runtime/config:/app/config" \
  pmman/link42-lg:latest
```

打开：

```text
http://127.0.0.1:8000
```

检查健康状态：

```bash
curl -fsS http://127.0.0.1:8000/api/session
```

## 6. Docker Compose 示例

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

启动 Compose 前创建挂载目录并设置容器用户权限：

```bash
mkdir -p data config
chown -R 10001:10001 data config
```

## 7. 升级

```bash
docker pull pmman/link42-lg:latest
docker compose up -d
```

升级前建议备份数据库：

```bash
cp ./data/looking-glass.sqlite3 ./data/looking-glass.sqlite3.bak.$(date +%Y%m%d%H%M%S)
```

## 8. HTTPS 反向代理 / CDN 注意事项

镜像默认使用以下 Uvicorn 参数运行，并只信任 `127.0.0.1` 的转发头：

```bash
--proxy-headers
```

反向代理位于其他容器或主机时，设置 `FORWARDED_ALLOW_IPS` 为代理的准确 IP 或专用网段，例如 `172.30.0.0/24`。应用端口必须只允许该反向代理访问，不能在信任容器网段的同时将端口直接暴露到公网。禁止使用 `FORWARDED_ALLOW_IPS=*`。

反向代理必须传递：

```text
Host
X-Real-IP
X-Forwarded-For
X-Forwarded-Host
X-Forwarded-Proto
X-Forwarded-Port
```

Nginx location 示例：

```nginx
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
```

Cloudflare 必须使用 `Full` 或 `Full (strict)` SSL/TLS 模式。不要使用 `Flexible`，否则 CDN 到源站为 HTTP，而源站/反代强制 HTTPS 时会出现重定向循环。

## 9. 回滚

使用发布时的不可变版本标签：

```bash
docker pull pmman/link42-lg:<VERSION>
docker compose up -d
```

Compose 中将镜像改为：

```yaml
image: pmman/link42-lg:<VERSION>
```

## 10. 发布核对清单

- `npm run build` 通过。
- `python -m py_compile backend/main.py` 通过。
- Docker 镜像成功推送 `pmman/link42-lg:<VERSION>`。
- Docker 镜像成功推送 `pmman/link42-lg:latest`。
- 运行时挂载了 `/app/data`。
- 运行时挂载了 `/app/config`。
- 已设置长度至少 12 位的强随机 `LG_ADMIN_PASSWORD`。
- 已将数据和配置目录权限设置为容器 UID/GID `10001:10001`。
- 生产环境已配置 `LG_API_ALLOWED_HOSTS`。
- 生产 HTTPS 环境保持 `LG_COOKIE_SECURE=auto` 或设置为 `true`。
- `FORWARDED_ALLOW_IPS` 只包含实际反向代理地址，且未使用 `*`。
- CDN 使用 Full 或 Full strict HTTPS 模式。

FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build


FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    LG_DATA_DIR=/app/data \
    LG_CONFIG_DIR=/app/config \
    FORWARDED_ALLOW_IPS=127.0.0.1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY --from=frontend-build /app/dist ./dist

RUN groupadd --gid 10001 link42 \
    && useradd --uid 10001 --gid link42 --no-create-home --shell /usr/sbin/nologin link42 \
    && mkdir -p /app/data /app/config \
    && chown -R link42:link42 /app

VOLUME ["/app/data", "/app/config"]
EXPOSE 8000

USER 10001:10001

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

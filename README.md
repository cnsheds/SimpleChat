# SimpleChat 客服系统

轻量级邀请制客服系统，包含用户端、客服端、Node.js 后端、SQLite、本地图片上传和 Socket.IO 实时聊天。

## 本地开发

```bash
npm install
Copy-Item .env.example .env
node server/scripts/create-agent.js --username admin --password admin123 --name "客服小王"
npm run dev:server
npm run dev:user
npm run dev:agent
```

- 用户端开发地址：`http://localhost:5173`
- 客服端开发地址：`http://localhost:5174/agent/`
- 后端地址：`http://localhost:3000`

邀请码由客服工作台生成，8 位字母数字组合，有效期 2 小时，仅保存在服务端内存中。

## 生产构建

```bash
docker compose --env-file .env up -d --build
```

用户端入口为 `/`，客服端入口为 `/agent/`。

Docker Compose 示例：

```yaml
services:
  app:
    image: ghcr.io/cnsheds/simplechat:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
      SITE_URL: ${SITE_URL}
      INVITE_TTL_MINUTES: ${INVITE_TTL_MINUTES:-120}
      MAX_FILE_SIZE: ${MAX_FILE_SIZE:-10485760}
      DEFAULT_ADMIN_USERNAME: ${DEFAULT_ADMIN_USERNAME:-}
      DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD:-}
      DEFAULT_ADMIN_NAME: ${DEFAULT_ADMIN_NAME:-}
    volumes:
      - /opt/simple_chat/data:/app/server/data
      - /opt/simple_chat/uploads:/app/server/uploads
```

首次启动时，如 `.env` 配置了以下变量，系统会在管理员不存在时自动创建默认管理员；如果账号已存在，重启不会重置密码。

```env
SITE_URL=https://chat.example.com
INVITE_TTL_MINUTES=120
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=yourpassword
DEFAULT_ADMIN_NAME=管理员
```

## GitHub Actions 镜像

推送到 `main` / `master` 或推送 `v*` tag 后，会自动构建并推送 Docker 镜像到 GHCR：

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:sha-<commit>
ghcr.io/<owner>/<repo>:v1.0.0
```

拉取示例：

```bash
docker pull ghcr.io/<owner>/<repo>:latest
```

如仓库或 Package 为私有，需要先登录：

```bash
echo <github-token> | docker login ghcr.io -u <github-username> --password-stdin
```

## 客服管理

管理员登录客服端后，点击右上角的用户图标进入客服管理，可以添加、编辑、禁用、启用和删除客服账号。已有会话记录的客服账号不能硬删除，请使用禁用。

创建第一个管理员仍使用脚本：

```bash
node server/scripts/create-agent.js --username admin --password admin123 --name "管理员" --admin true
```

Docker 容器启动时会自动执行：

```bash
node scripts/ensure-admin.js
node src/app.js
```

## 主机 Nginx HTTPS 反代

如需使用主机 Nginx 统一提供 HTTPS，建议 Docker 只暴露本机 `3000`：

主机 Nginx 示例，替换 `chat.example.com` 为实际域名：

```nginx
server {
    listen 80;
    server_name chat.example.com;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name chat.example.com;

    ssl_certificate /etc/letsencrypt/live/chat.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.example.com/privkey.pem;

    client_max_body_size 10m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

启用配置后检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

访问地址：

- 用户端：`https://chat.example.com/`
- 客服端：`https://chat.example.com/agent/`

## 邀请链接

在 `.env` 中配置网站公开地址：

```env
SITE_URL=https://chat.example.com
```

客服登录后点击右上角链接按钮生成邀请链接。用户通过该链接打开后，邀请码会自动显示在登录页。

邀请码为 8 位字母数字组合，有效期 2 小时，仅保存在服务端内存中。服务重启后，已生成的邀请码会失效。
有效期可通过 `.env` 配置，单位为分钟：

```env
INVITE_TTL_MINUTES=120
```

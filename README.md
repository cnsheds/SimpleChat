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

默认 `.env.example` 中的 TOTP secret 仅用于开发。查看当前邀请码：

```bash
node -e "import('otplib').then(({totp})=>{totp.options={step:7200,window:1,digits:6};console.log(totp.generate(process.env.TOTP_SECRET || 'JBSWY3DPEHPK3PXP'))})"
```

## 生产构建

```bash
docker compose --env-file .env up -d --build
docker compose exec app node scripts/create-agent.js --username admin --password yourpassword --name "客服小王"
```

用户端入口为 `/`，客服端入口为 `/agent/`。

## 客服管理

管理员登录客服端后，点击右上角的用户图标进入客服管理，可以添加、编辑、禁用、启用和删除客服账号。已有会话记录的客服账号不能硬删除，请使用禁用。

创建第一个管理员仍使用脚本：

```bash
node server/scripts/create-agent.js --username admin --password admin123 --name "管理员" --admin true
```

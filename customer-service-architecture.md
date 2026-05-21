# 客服系统技术架构文档

> 邀请制访问 · 实时聊天 · 图文传输 · 多客服管理

---

## 1. 项目概述

### 1.1 系统定位

一套轻量级内部客服系统，面向受邀用户提供实时在线咨询服务。用户通过共享 TOTP 滚动码验证身份后进入聊天，客服人员通过独立后台管理会话。

### 1.2 核心特性

- **邀请制访问**：共享 TOTP 滚动码（2小时周期），防止无关用户进入
- **持久化身份**：用户以手机号/昵称为唯一标识，历史记录跨会话保留
- **实时通信**：WebSocket 双向消息，支持文字和图片
- **多客服支持**：用户自选客服，客服独立账号管理
- **会话管理**：客服可结束会话、清空聊天记录

### 1.3 用户角色

| 角色 | 登录方式 | 主要功能 |
|------|----------|----------|
| 普通用户 | TOTP 滚动码 + 昵称/手机号 | 找客服聊天、发送图文 |
| 客服人员 | 账号 + 密码 | 接收消息、回复、管理会话 |
| 管理员 | 账号 + 密码 | 管理客服账号、查看所有会话 |

---

## 2. 技术选型

### 2.1 技术栈总览

```
┌─────────────────────────────────────────┐
│              前端（React）               │
│   用户端（移动端优先）  客服端（PC优先）  │
└──────────────┬──────────────────────────┘
               │ HTTP REST + WebSocket
┌──────────────▼──────────────────────────┐
│           后端（Node.js）                │
│  Express（REST API）+ Socket.IO（实时）  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           数据层                         │
│   SQLite（better-sqlite3）+ 本地文件存储  │
└─────────────────────────────────────────┘
```

### 2.2 选型依据

| 技术 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js 20 LTS | Socket.IO 原生生态，前后端语言统一 |
| Web 框架 | Express 4 | 轻量成熟，生态完整 |
| 实时通信 | Socket.IO 4 | 内置房间管理、断线重连、事件系统 |
| 数据库 | SQLite（better-sqlite3） | 零运维，文件即备份，小并发完全够用 |
| TOTP | otplib | 支持自定义 period，标准 RFC 6238 实现 |
| 图片上传 | Multer | Express 生态标准，配置简单 |
| 前端框架 | React 18 + Vite | 开发体验好，生态成熟 |
| 样式 | Tailwind CSS | 无需自写 CSS，移动端适配方便 |
| 容器化 | Docker + Docker Compose | 单文件部署，环境隔离 |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌──────────────────┐     ┌──────────────────┐
│    用户端浏览器    │     │   客服端浏览器    │
│  （移动端优先）   │     │   （PC 优先）     │
└────────┬─────────┘     └────────┬──────────┘
         │                        │
         │   HTTPS / WSS          │
         ▼                        ▼
┌────────────────────────────────────────────┐
│                  Nginx                      │
│  反向代理 + SSL 终止 + 静态文件服务          │
└────────────────────┬───────────────────────┘
                     │
┌────────────────────▼───────────────────────┐
│             Node.js 应用服务器              │
│                                            │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │  REST API   │    │   Socket.IO      │   │
│  │  /api/*     │    │   实时消息引擎    │   │
│  └──────┬──────┘    └────────┬─────────┘   │
│         │                    │             │
│  ┌──────▼────────────────────▼──────────┐  │
│  │           业务逻辑层                  │  │
│  │  Auth · Session · Message · Upload   │  │
│  └──────────────────┬───────────────────┘  │
└─────────────────────┼──────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌────────────────┐       ┌─────────────────┐
│  SQLite 数据库  │       │  本地文件存储    │
│  chat.db       │       │  /uploads/      │
└────────────────┘       └─────────────────┘
```

### 3.2 目录结构

```
/project
├── server/                    # 后端
│   ├── src/
│   │   ├── app.js             # Express 应用入口
│   │   ├── socket.js          # Socket.IO 事件处理
│   │   ├── routes/
│   │   │   ├── auth.js        # 认证接口
│   │   │   ├── sessions.js    # 会话管理
│   │   │   ├── messages.js    # 消息接口
│   │   │   └── upload.js      # 图片上传
│   │   ├── services/
│   │   │   ├── totp.js        # TOTP 生成与验证
│   │   │   ├── session.js     # 会话业务逻辑
│   │   │   └── message.js     # 消息业务逻辑
│   │   ├── db/
│   │   │   ├── index.js       # 数据库连接
│   │   │   └── schema.sql     # 数据库结构
│   │   └── middleware/
│   │       ├── auth.js        # JWT 鉴权中间件
│   │       └── upload.js      # 文件上传中间件
│   ├── uploads/               # 图片文件存储
│   ├── data/                  # SQLite 数据库文件
│   └── package.json
│
├── client-user/               # 用户端前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx      # TOTP 验证 + 昵称输入
│   │   │   ├── AgentList.jsx  # 选择客服
│   │   │   └── Chat.jsx       # 聊天界面
│   │   └── App.jsx
│   └── package.json
│
├── client-agent/              # 客服端前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx      # 账号密码登录
│   │   │   ├── Dashboard.jsx  # 会话列表总览
│   │   │   └── Chat.jsx       # 聊天界面
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml
├── Dockerfile
└── nginx.conf
```

---

## 4. 数据库设计

### 4.1 表结构

```sql
-- 客服账号
CREATE TABLE agents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,          -- bcrypt hash
    display_name TEXT NOT NULL,
    avatar_url  TEXT,
    is_online   INTEGER DEFAULT 0,     -- 0/1
    created_at  TEXT DEFAULT (datetime('now'))
);

-- 用户（手机号或昵称为唯一标识）
CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier  TEXT NOT NULL UNIQUE,  -- 手机号或昵称
    display_name TEXT NOT NULL,
    session_token TEXT,                -- 浏览器持久登录 token
    token_expires_at TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT
);

-- 聊天会话
CREATE TABLE sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    agent_id    INTEGER NOT NULL REFERENCES agents(id),
    status      TEXT DEFAULT 'active', -- active / closed
    created_at  TEXT DEFAULT (datetime('now')),
    closed_at   TEXT
);

-- 消息记录
CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id),
    sender_type TEXT NOT NULL,         -- 'user' / 'agent'
    sender_id   INTEGER NOT NULL,
    msg_type    TEXT NOT NULL,         -- 'text' / 'image'
    content     TEXT,                  -- 文字内容或图片 URL
    is_deleted  INTEGER DEFAULT 0,     -- 软删除
    created_at  TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_agent   ON sessions(agent_id);
CREATE INDEX idx_sessions_status  ON sessions(status);
```

### 4.2 数据关系

```
agents ──< sessions >── users
             │
             └──< messages
```

---

## 5. 认证设计

### 5.1 TOTP 配置

```
算法：HMAC-SHA1（RFC 6238 标准）
周期：7200 秒（2小时）
位数：6 位数字
密钥：服务器端唯一，存于环境变量
容差：允许前后各一个周期（防止临界时间登录失败）
```

otplib 配置示例：

```javascript
import { totp } from 'otplib';

totp.options = {
  step: 7200,       // 2小时周期
  window: 1,        // 前后各一个周期容差
  digits: 6,
};

// 生成当前有效码（供管理员查看/分发）
const currentCode = totp.generate(process.env.TOTP_SECRET);

// 验证用户输入
const isValid = totp.check(userInputCode, process.env.TOTP_SECRET);
```

### 5.2 用户登录流程

```
1. 用户输入 [TOTP码] + [手机号/昵称]
        │
        ▼
2. 服务端验证 TOTP 码
   ├── 无效 → 返回 401，拒绝登录
   └── 有效 → 继续
        │
        ▼
3. 查找 users 表中的 identifier
   ├── 存在 → 取出用户记录（历史记录保留）
   └── 不存在 → 创建新用户记录
        │
        ▼
4. 生成 session_token（UUID v4），写入 users 表
   设置过期时间（默认 30 天）
        │
        ▼
5. 返回 { token, user_id, display_name }
   前端存入 localStorage
```

### 5.3 持久登录（免重新输码）

```
用户下次访问
    │
    ▼
前端读取 localStorage 中的 token
    │
    ├── token 存在 → POST /api/auth/verify-token
    │       ├── 有效且未过期 → 直接进入，跳过 TOTP
    │       └── 无效/过期   → 跳回登录页
    │
    └── token 不存在 → 跳到登录页
```

### 5.4 客服登录流程

```
客服输入账号 + 密码
    │
    ▼
bcrypt 验证密码
    │
    ├── 失败 → 返回 401
    └── 成功 → 签发 JWT（有效期 8 小时）
               同时将 is_online = 1 写入数据库
               返回 { token, agent_id, display_name }
```

---

## 6. 实时通信设计

### 6.1 Socket.IO 房间模型

```
每个会话对应一个 Socket.IO 房间：room_id = "session:{session_id}"

用户连接后加入：    socket.join("session:42")
客服连接后加入：    socket.join("session:42")
                    socket.join("agent:{agent_id}")  // 接收新会话通知

消息广播：          io.to("session:42").emit("new_message", payload)
```

### 6.2 Socket 事件定义

**客户端 → 服务端：**

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `join_session` | `{ session_id, token }` | 加入聊天房间 |
| `send_message` | `{ session_id, content, msg_type }` | 发送消息 |
| `typing` | `{ session_id }` | 正在输入提示 |
| `agent_login` | `{ agent_id }` | 客服上线 |
| `agent_logout` | `{ agent_id }` | 客服下线 |

**服务端 → 客户端：**

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `new_message` | `{ id, sender_type, content, msg_type, created_at }` | 新消息 |
| `typing` | `{ sender_type }` | 对方正在输入 |
| `session_closed` | `{ session_id }` | 会话被结束 |
| `new_session` | `{ session_id, user }` | 新用户接入（通知客服） |
| `agent_status` | `{ agent_id, is_online }` | 客服在线状态变化 |

### 6.3 图片传输流程

```
用户选择图片
    │
    ▼
HTTP POST /api/upload（multipart/form-data）
    │   Multer 处理，限制 10MB，仅允许 jpg/png/gif/webp
    ▼
服务端保存到 /uploads/{date}/{uuid}.ext
    │
    ▼
返回 { url: "/uploads/2025-05/abc123.jpg" }
    │
    ▼
前端通过 Socket 发送：
{ msg_type: "image", content: "/uploads/2025-05/abc123.jpg" }
    │
    ▼
对方收到后渲染 <img src="..." />
```

> 图片走 HTTP 上传而非 Socket 二进制，稳定性更好，便于 Nginx 直接服务静态文件。

---

## 7. API 接口设计

### 7.1 认证接口

```
POST /api/auth/user-login
  Body: { totp_code, identifier, display_name }
  Return: { token, user_id, display_name, is_new_user }

POST /api/auth/verify-token
  Body: { token }
  Return: { valid, user_id, display_name }

POST /api/auth/agent-login
  Body: { username, password }
  Return: { token, agent_id, display_name }
```

### 7.2 会话接口

```
GET  /api/agents/online
  Return: [{ agent_id, display_name, avatar_url }]

POST /api/sessions
  Auth: User Token
  Body: { agent_id }
  Return: { session_id }

GET  /api/sessions/:id/messages
  Auth: User Token / Agent JWT
  Query: ?before=msg_id&limit=50
  Return: [{ id, sender_type, content, msg_type, created_at }]

POST /api/sessions/:id/close
  Auth: Agent JWT
  Return: { success }

DELETE /api/sessions/:id/messages
  Auth: Agent JWT
  说明: 软删除，is_deleted = 1
  Return: { success }

GET  /api/agent/sessions
  Auth: Agent JWT
  Query: ?status=active
  Return: [{ session_id, user, last_message, created_at }]
```

### 7.3 上传接口

```
POST /api/upload
  Auth: User Token / Agent JWT
  Body: multipart/form-data，字段名 file
  限制: 10MB，jpg/png/gif/webp
  Return: { url }
```

---

## 8. 前端设计

### 8.1 用户端页面流

```
/ (登录页)
├── 输入 TOTP 码 + 手机号/昵称
├── 验证通过 → 存 token 到 localStorage
└── /agents (选择客服)
    ├── 展示在线客服列表
    └── 点击客服 → 创建 session → /chat/:session_id
        └── (聊天界面)
            ├── 消息列表（文字/图片）
            ├── 文字输入框
            ├── 图片上传按钮
            └── Socket 实时连接
```

### 8.2 客服端页面流

```
/ (登录页)
└── /dashboard (会话列表)
    ├── 左侧：进行中会话列表（实时更新）
    ├── 右侧：当前会话聊天界面
    ├── 新会话进入时：桌面通知 + 列表高亮
    └── 会话操作菜单
        ├── 结束会话
        └── 清空记录
```

### 8.3 关键 UI 状态

| 状态 | 用户端显示 | 客服端显示 |
|------|-----------|-----------|
| 连接中 | 顶部 loading bar | 顶部 loading bar |
| 客服离线 | "当前客服不在线，消息已保留" | 会话标记为等待中 |
| 对方输入中 | "对方正在输入..." | "用户正在输入..." |
| 会话已结束 | "本次对话已结束" + 禁用输入 | 会话移入已结束列表 |

---

## 9. 部署架构

### 9.1 Docker Compose 配置

```yaml
version: '3.8'

services:
  app:
    build: .
    restart: always
    environment:
      - NODE_ENV=production
      - TOTP_SECRET=${TOTP_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
    volumes:
      - ./data:/app/data          # SQLite 数据库持久化
      - ./uploads:/app/uploads    # 图片持久化
    networks:
      - internal

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - internal

networks:
  internal:
    driver: bridge
```

### 9.2 Nginx 配置要点

```nginx
server {
    listen 443 ssl;

    # 静态文件直接服务，不走 Node
    location /uploads/ {
        alias /app/uploads/;
        expires 30d;
    }

    # WebSocket 代理（关键配置）
    location /socket.io/ {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # API 和其余请求
    location / {
        proxy_pass http://app:3000;
    }
}
```

### 9.3 环境变量清单

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `TOTP_SECRET` | TOTP 共享密钥（Base32，20字节以上）| `JBSWY3DPEHPK3PXP` |
| `JWT_SECRET` | JWT 签名密钥（随机长字符串）| `random-64-char-string` |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `production` |
| `MAX_FILE_SIZE` | 图片上传大小限制（字节）| `10485760` |

### 9.4 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核 |
| 内存 | 512 MB | 1 GB |
| 磁盘 | 10 GB | 50 GB（含图片） |
| 系统 | Ubuntu 22.04 | Ubuntu 22.04 |

---

## 10. 安全设计

### 10.1 暴力破解防护

系统针对两个登录入口分别设计防护策略，均使用内存计数器实现（无需 Redis），重启后自动清零。

#### 用户端 TOTP 暴力破解防护

TOTP 码只有 6 位数字（100万种可能），2小时周期内必须严格限制尝试次数。

**防护规则（按 IP 维度）：**

| 阶段 | 触发条件 | 处理方式 |
|------|----------|----------|
| 警告 | 同 IP 5分钟内失败 ≥ 3 次 | 正常返回 401，但开始计数 |
| 软锁定 | 同 IP 5分钟内失败 ≥ 5 次 | 锁定 15 分钟，返回 429 + 剩余时间 |
| 硬锁定 | 同 IP 1小时内失败 ≥ 10 次 | 锁定 2 小时，记录告警日志 |

**实现逻辑：**

```javascript
// 内存存储结构（Map）
// key: IP地址, value: { count, firstFailAt, lockedUntil }

const rateLimiter = {
  SOFT_LIMIT: 5,          // 5次触发软锁定
  HARD_LIMIT: 10,         // 10次触发硬锁定
  WINDOW_MS: 5 * 60000,   // 5分钟计数窗口
  SOFT_LOCK_MS: 15 * 60000,  // 软锁定 15 分钟
  HARD_LOCK_MS: 2 * 3600000, // 硬锁定 2 小时
};

function checkTotpRateLimit(ip) {
  const record = store.get(ip);
  const now = Date.now();

  // 检查是否在锁定期
  if (record?.lockedUntil && now < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - now) / 1000);
    return { blocked: true, remaining };
  }

  // 窗口外的记录重置
  if (record && now - record.firstFailAt > rateLimiter.WINDOW_MS) {
    store.delete(ip);
  }

  return { blocked: false };
}

function recordTotpFailure(ip) {
  const now = Date.now();
  const record = store.get(ip) || { count: 0, firstFailAt: now };
  record.count += 1;

  if (record.count >= rateLimiter.HARD_LIMIT) {
    record.lockedUntil = now + rateLimiter.HARD_LOCK_MS;
    logger.warn(`TOTP 硬锁定: IP=${ip}, 累计失败=${record.count}`);
  } else if (record.count >= rateLimiter.SOFT_LIMIT) {
    record.lockedUntil = now + rateLimiter.SOFT_LOCK_MS;
  }

  store.set(ip, record);
}

// 登录成功后清除该 IP 的失败记录
function clearTotpFailure(ip) {
  store.delete(ip);
}
```

**前端配合：**
- 收到 429 响应后，显示倒计时："请等待 XX 分钟后重试"
- 禁用登录按钮直到锁定结束，防止用户反复点击

#### 客服端账号密码暴力破解防护

客服账号相比 TOTP 更敏感，需要双维度防护（IP + 账号名）。

**防护规则：**

| 维度 | 触发条件 | 处理方式 |
|------|----------|----------|
| 按账号 | 同一账号失败 ≥ 5 次（10分钟内）| 账号锁定 30 分钟 |
| 按 IP | 同 IP 失败 ≥ 10 次（10分钟内）| IP 锁定 1 小时 |
| 按账号（严重）| 同一账号失败 ≥ 15 次（1小时内）| 账号锁定 24 小时，发告警 |

**实现说明：**

- IP 维度：防止单机枚举不同账号
- 账号维度：防止分布式 IP 集中攻击同一账号
- 两个维度同时命中才解除，避免单方面绕过

```javascript
// 响应时间恒定（防时序攻击）
// 账号不存在和密码错误返回完全相同的错误信息和响应时间
// 不透露"账号是否存在"

async function agentLogin(username, password, ip) {
  // 先检查 IP 和账号是否被锁定
  checkAgentRateLimit(ip, username); // 被锁定则直接 throw 429

  // 无论账号是否存在，都执行 bcrypt.compare（防时序攻击）
  const agent = await db.findAgent(username);
  const fakeHash = '$2b$12$invalidhashfortimingatk';
  const isValid = await bcrypt.compare(password, agent?.password ?? fakeHash);

  if (!agent || !isValid) {
    recordAgentFailure(ip, username);
    throw new Error('账号或密码错误'); // 故意不区分
  }

  clearAgentFailure(ip, username);
  return generateJWT(agent);
}
```

#### 锁定状态持久化

默认锁定状态存内存，服务重启后清零。如需重启后保持锁定，可选择写入 SQLite：

```sql
CREATE TABLE login_locks (
    key         TEXT PRIMARY KEY,  -- "ip:{ip}" 或 "agent:{username}"
    fail_count  INTEGER DEFAULT 0,
    first_fail_at TEXT,
    locked_until  TEXT
);
```

重启高危场景下建议启用此表，正常使用内存方案即可。

#### Nginx 层前置限速

在应用层之前，Nginx 做第一道拦截，减少无效请求打到 Node.js：

```nginx
# 定义限速区域（共享内存）
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;

# 应用到登录接口
location /api/auth/ {
    limit_req zone=login burst=5 nodelay;
    limit_req_status 429;
    proxy_pass http://app:3000;
}
```

> 双层防护：Nginx 按 IP 粗粒度限速 → Node.js 按业务逻辑精细控制。

### 10.2 认证安全

- TOTP 密钥仅存于服务器环境变量，不入库
- 用户 session_token 使用 UUID v4，存储时做 SHA-256 哈希
- 客服密码使用 bcrypt（cost factor 12）哈希
- JWT 有效期 8 小时，客服登出时前端清除 token
- 账号不存在与密码错误返回相同响应，不泄露账号是否存在

### 10.3 文件上传安全

- 验证 MIME type 和文件扩展名双重校验
- 文件重命名为 UUID，避免路径遍历
- 限制单文件 10MB
- 上传目录禁止执行权限

### 10.4 通信安全

- 生产环境强制 HTTPS/WSS
- Socket.IO 连接时验证 token，未认证连接立即断开
- 消息内容做 XSS 过滤（前端渲染时转义，不使用 dangerouslySetInnerHTML）

---

## 11. 开发路线图

### Phase 1 — 核心功能（预计 2 周）

- [ ] 数据库初始化脚本
- [ ] TOTP 验证 + 用户登录/注册接口
- [ ] 客服账号登录接口
- [ ] Socket.IO 实时消息收发
- [ ] 图片上传接口
- [ ] 用户端：登录 → 选客服 → 聊天
- [ ] 客服端：登录 → 会话列表 → 聊天
- [ ] Docker 容器化

### Phase 2 — 完善体验（预计 1 周）

- [ ] 正在输入提示
- [ ] 消息历史分页加载
- [ ] 客服在线/离线状态
- [ ] 会话结束 + 清空记录
- [ ] 桌面通知（新会话、新消息）
- [ ] 图片点击放大预览

### Phase 3 — 运维增强（按需）

- [ ] 管理后台（客服账号管理、查看所有会话）
- [ ] TOTP 当前码查看页（供管理员分发）
- [ ] 图片定期清理脚本
- [ ] 数据库定时备份脚本
- [ ] 消息搜索

---

## 12. 快速启动

```bash
# 1. 克隆项目
git clone <repo>
cd project

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 TOTP_SECRET 和 JWT_SECRET

# 3. 生成 TOTP_SECRET（在 Node.js 中执行）
node -e "const {authenticator} = require('otplib'); console.log(authenticator.generateSecret())"

# 4. 启动服务
docker compose up -d

# 5. 查看当前 TOTP 码（用于分发给用户）
docker compose exec app node -e "
const {totp} = require('otplib');
totp.options = { step: 7200 };
console.log('当前有效码：', totp.generate(process.env.TOTP_SECRET));
"

# 6. 创建第一个客服账号
docker compose exec app node scripts/create-agent.js --username admin --password yourpassword --name "客服小王"
```

---

*文档版本：v1.0 | 最后更新：2025-05*

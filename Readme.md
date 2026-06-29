# ZSTS CMS 内容管理系统

> 中沙商务服务门户网站内容管理系统，支持多页面内容管理、AI 内容生成、海报制作、微信公众号推送等功能。

---

## 目录

- [项目概述](#项目概述)
- [系统架构](#系统架构)
- [环境要求](#环境要求)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [API 接口](#api-接口)
- [生产部署](#生产部署)
- [常见问题](#常见问题)

---

## 项目概述

**ZSTS CMS** 是面向中沙商务服务门户的内容管理系统，提供以下核心能力：

| 功能模块 | 说明 |
|----------|------|
| 后台管理 | 用户管理、权限控制、操作日志 |
| 内容编辑 | 多页面内容配置（首页、签证、企业出海等） |
| AI 内容生成 | 文章生成、海报制作、URL 内容抓取 |
| 微信公众号 | 配置 AppID/AppSecret，推送草稿 |
| 实时预览 | 编辑内容后实时预览官网效果 |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  管理后台     │  │ AI内容生成    │  │  官网页面预览     │  │
│  │  /admin      │  │ /ai-content  │  │  /preview/*      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼───────────────────┼────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Go 后端 (cms-server-go)                    │
│                   端口: 3001                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/auth      认证（JWT）                           │   │
│  │  /api/users     用户管理                              │   │
│  │  /api/content   内容读写                              │   │
│  │  /api/logs      操作日志                              │   │
│  │  /api/ai-channels  AI渠道配置                         │   │
│  │  /api/wechat    微信公众号                            │   │
│  │  /ai-content/*  反向代理 → Next.js                    │   │
│  │  /preview/*     实时预览                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│                   ┌──────────┐                               │
│                   │  MySQL   │                               │
│                   └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
          │
          ▼ (反向代理 /ai-content/*)
┌─────────────────────────────────────────────────────────────┐
│              Next.js 前端 (ai-content-project)               │
│              端口: 5001                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/generate    AI内容生成（调用AI渠道）             │   │
│  │  /api/fetch-url   URL内容抓取                         │   │
│  │  /api/upload      文件上传                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| **后端** | Go 1.22 + Gin | RESTful API 服务 |
| **数据库** | MySQL 8.0 | 用户、权限、AI渠道、日志 |
| **前端** | Next.js 16 + React 19 + TypeScript | AI 内容生成模块 |
| **UI** | Radix UI + shadcn/ui + Tailwind CSS 4 | 组件库 |
| **管理后台** | 原生 HTML/CSS/JS (SPA) | 配置管理界面 |

---

## 环境要求

### 必需软件

| 软件 | 版本要求 | 用途 | 安装检查 |
|------|----------|------|----------|
| **Go** | >= 1.22 | 后端运行环境 | `go version` |
| **Node.js** | >= 20.x | 前端运行环境 | `node -v` |
| **pnpm** | >= 9.0.0 | 前端包管理器 | `pnpm -v` |
| **MySQL** | >= 8.0 | 数据存储 | `mysql --version` |

### 可选软件

| 软件 | 用途 |
|------|------|
| Nginx | 生产环境反向代理 |
| PM2 / systemd | 进程守护 |
| Git | 版本控制 |

---

## 项目结构

```
ZSTS-CMS-移交/
│
├── cms-server-go/              # ★ Go 后端服务
│   ├── main.go                 #   程序入口（Gin 引擎）
│   ├── .env                    #   环境变量配置
│   ├── go.mod                  #   Go 模块定义
│   ├── config/
│   │   └── config.go           #   配置加载
│   ├── db/
│   │   └── db.go               #   数据库初始化 + 建表
│   ├── handlers/
│   │   ├── preview.go          #   预览处理
│   │   ├── snapshot.go         #   页面快照
│   │   └── upload.go           #   文件上传
│   ├── middleware/
│   │   ├── auth.go             #   JWT 认证中间件
│   │   └── audit.go            #   操作日志中间件
│   ├── models/
│   │   └── models.go           #   数据模型
│   └── routes/
│       ├── auth.go             #   认证路由
│       ├── users.go            #   用户管理
│       ├── content.go          #   内容管理
│       ├── logs.go             #   操作日志
│       ├── ai_channels.go      #   AI 渠道配置
│       └── wechat.go           #   微信公众号
│
├── ai-content-project/         # ★ AI 内容生成前端
│   ├── .env.local              #   环境变量
│   ├── next.config.ts          #   Next.js 配置
│   ├── package.json            #   依赖清单
│   ├── tsconfig.json           #   TypeScript 配置
│   ├── scripts/
│   │   ├── dev.sh              #   开发启动脚本
│   │   ├── build.sh            #   构建脚本
│   │   └── start.sh            #   生产启动脚本
│   └── src/
│       ├── server.ts           #   自定义服务入口
│       ├── app/
│       │   ├── page.tsx        #   首页（AI 入口）
│       │   ├── create/         #   内容创建页
│       │   ├── article/        #   文章编辑器
│       │   ├── poster/         #   海报编辑器
│       │   ├── result/         #   结果展示
│       │   ├── logs/           #   AI 调用日志
│       │   └── api/            #   API 路由
│       │       ├── generate/   #     AI 内容生成
│       │       ├── fetch-url/  #     URL 抓取
│       │       └── upload/     #     文件上传
│       ├── components/
│       │   └── ui/             #   shadcn/ui 组件
│       └── lib/
│           ├── data.ts         #   常量数据
│           └── utils.ts        #   工具函数
│
├── admin/                      # 管理后台静态文件
│   ├── index.html              #   登录页
│   ├── dashboard.html          #   管理主界面
│   └── assets/js/
│       └── app.js              #   主应用逻辑
│
├── content/                    # 页面内容数据（JSON）
│   ├── global/                 #   全局配置（导航/页脚）
│   └── pages/                  #   各页面内容
├── images/                     # 静态图片资源
├── uploads/                    # 用户上传文件
└── local-cdn/                  # 本地 CDN 资源
```

---

## 快速开始

### 第一步：启动 MySQL

确保 MySQL 服务正在运行：

```bash
# 检查 MySQL 状态
mysql --version

# 如果使用本地 MySQL，默认配置：
# 主机: 127.0.0.1:3306
# 用户: root
# 密码: root
```

> 程序会自动创建数据库 `zsts_cms` 和所有数据表。

### 第二步：启动 Go 后端

```bash
# 进入后端目录
cd cms-server-go

# 安装 Go 依赖
go mod download

# （可选）修改配置
# vim .env

# 启动服务
go run .
```

启动成功后输出：
```
✅ ZSTS CMS 后端已启动 (Go/Gin)
   管理后台：http://localhost:3001/admin/
   API Base：http://localhost:3001/api/
```

### 第三步：启动 Next.js 前端

```bash
# 进入前端目录
cd ai-content-project

# 安装依赖（必须使用 pnpm）
pnpm install

# 启动开发服务器
pnpm dev
```

启动成功后：
- AI 内容生成：http://localhost:5001/ai-content/

### 第四步：访问系统

| 地址 | 功能 |
|------|------|
| http://localhost:3001/admin/ | 管理后台 |
| http://localhost:3001/ai-content/ | AI 内容生成（通过后端代理） |
| http://localhost:3001/ | 自动跳转到管理后台 |

### 默认管理员账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 超级管理员 |

> ⚠️ **首次登录后请立即修改默认密码！**

---

## 配置说明

### Go 后端配置（cms-server-go/.env）

```env
# 服务端口
PORT=3001

# JWT 密钥（生产环境必须修改为随机字符串）
JWT_SECRET=zsts-cms-super-secret-key-change-in-production-2026

# MySQL 配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=zsts_cms

# AI 内容生成服务地址（指向前端服务）
AI_CONTENT_URL=http://localhost:5001
```

### Next.js 前端配置（ai-content-project/.env.local）

```env
# 运行环境（DEV=开发模式，PROD=生产模式）
COZE_PROJECT_ENV=DEV

# 服务配置
HOSTNAME=localhost
PORT=5001

# Go 后端地址（用于获取 AI 渠道配置）
GO_BACKEND_URL=http://localhost:3001
```

### 端口说明

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Go 后端 | 3001 | CMS API + 管理后台 + 静态文件 |
| Next.js 前端 | 5001 | AI 内容生成服务 |

> **注意**：前端通过 `GO_BACKEND_URL` 访问后端获取 AI 渠道配置，后端通过 `AI_CONTENT_URL` 反向代理前端。请确保两个地址配置正确且互相可达。

---

## API 接口

### 认证接口 `/api/auth`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/login | 登录 | 否 |
| GET | /api/auth/me | 获取当前用户信息 | 是 |

**登录请求示例：**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**响应：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "super_admin",
    "permissions": ["global", "home", "about", ...]
  }
}
```

### 用户管理 `/api/users`（需要超级管理员权限）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 用户列表 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 重置密码 |
| PUT | /api/users/:id/permissions | 更新权限 |
| DELETE | /api/users/:id | 删除用户 |

### 内容管理 `/api/content`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/content/:pageKey | 读取内容 | 无 |
| PUT | /api/content/:pageKey | 保存内容 | 需要认证+权限 |

**pageKey 枚举值：**
- 全局配置：`nav`, `footer`, `consultation`
- 页面内容：`home`, `about`, `visa`, `saudi-visa`, `enterprise`, `transport`, `insurance`, `inspection`

### 操作日志 `/api/logs`（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/logs | 查询日志 |
| DELETE | /api/logs | 清空日志（仅超级管理员） |

**查询参数：** `page`, `limit`, `action`, `username`, `start_date`, `end_date`

### AI 渠道配置 `/api/ai-channels`（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ai-channels | 渠道列表 |
| POST | /api/ai-channels | 新建渠道（仅超级管理员） |
| PUT | /api/ai-channels/:id | 更新渠道（仅超级管理员） |
| PUT | /api/ai-channels/:id/set-default | 设为默认（仅超级管理员） |
| DELETE | /api/ai-channels/:id | 删除渠道（仅超级管理员） |

### 微信公众号 `/api/wechat`（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/wechat/config | 获取配置 |
| PUT | /api/wechat/config | 更新配置 |
| POST | /api/wechat/push-draft | 推送草稿 |

### 其他接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload | 图片上传（5MB限制） |
| GET | /api/page-snapshot/:pageKey | 从 HTML 抓取默认值 |

---

## 生产部署

### 方式一：直接运行

#### 1. 构建前端

```bash
cd ai-content-project

# 安装依赖
pnpm install

# 构建生产版本
pnpm build
```

构建产物：
- `.next/` - Next.js 构建文件
- `dist/server.js` - 服务端入口

#### 2. 构建后端

```bash
cd cms-server-go

# 编译为二进制
go build -o cms-server .
```

#### 3. 启动服务

```bash
# 终端 1：启动前端（生产模式）
cd ai-content-project
PORT=5001 COZE_PROJECT_ENV=PROD node dist/server.js

# 终端 2：启动后端
cd cms-server-go
PORT=3001 ./cms-server
```

### 方式二：PM2 进程守护

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd cms-server-go
pm2 start ./cms-server --name "cms-backend"

# 启动前端
cd ai-content-project
pm2 start dist/server.js --name "cms-frontend" \
  --env production \
  -- PORT=5001 COZE_PROJECT_ENV=PROD

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

**PM2 配置文件（ecosystem.config.js）：**

```javascript
module.exports = {
  apps: [
    {
      name: 'cms-backend',
      cwd: './cms-server-go',
      script: './cms-server',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'cms-frontend',
      cwd: './ai-content-project',
      script: 'dist/server.js',
      env: {
        PORT: 5001,
        COZE_PROJECT_ENV: 'PROD'
      }
    }
  ]
};
```

### 方式三：systemd 服务

#### 后端服务 `/etc/systemd/system/cms-backend.service`

```ini
[Unit]
Description=ZSTS CMS Backend (Go/Gin)
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/cms-server-go
ExecStart=/path/to/cms-server-go/cms-server
Restart=always
RestartSec=5
Environment=PORT=3001
Environment=JWT_SECRET=your-production-secret

[Install]
WantedBy=multi-user.target
```

#### 前端服务 `/etc/systemd/system/cms-frontend.service`

```ini
[Unit]
Description=ZSTS CMS Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/ai-content-project
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
Environment=PORT=5001
Environment=COZE_PROJECT_ENV=PROD
Environment=GO_BACKEND_URL=http://localhost:3001

[Install]
WantedBy=multi-user.target
```

#### 启用服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable cms-backend cms-frontend
sudo systemctl start cms-backend cms-frontend
sudo systemctl status cms-backend cms-frontend
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 管理后台 + API（Go 后端）
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 10M;
    }

    # AI 内容生成（Next.js 前端）
    location /ai-content {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 上传目录
    location /uploads {
        alias /path/to/project/uploads;
        expires 30d;
    }
}
```

---

## 数据库

### 数据表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户账号 |
| `page_permissions` | 页面编辑权限 |
| `audit_log` | 操作审计日志 |
| `ai_channels` | AI 渠道配置 |
| `wechat_config` | 微信公众号配置 |

### 自动初始化

后端首次启动时会自动：
1. 创建 `zsts_cms` 数据库（如不存在）
2. 创建所有数据表
3. 插入默认超级管理员账号

---

## AI 渠道配置

系统支持配置多个 AI 渠道（兼容 OpenAI API 格式），在管理后台「AI 渠道配置」中添加：

| 字段 | 说明 |
|------|------|
| 渠道名称 | 如"豆包"、"OpenAI" |
| API 地址 | 兼容 OpenAI 格式的 endpoint |
| API Key | 渠道密钥 |
| 模型列表 | 可用模型（JSON 数组） |
| 默认模型 | 默认使用的模型 |

配置完成后，AI 内容生成功能会自动使用该渠道。

---

## 常见问题

### 端口冲突

如果端口被占用，修改对应配置文件：
- 后端：`cms-server-go/.env` 中的 `PORT`
- 前端：`ai-content-project/.env.local` 中的 `PORT`

### AI 服务调用失败

1. 检查 Go 后端是否已启动（端口 3001）
2. 检查前端 `.env.local` 中的 `GO_BACKEND_URL` 是否指向正确的后端地址
3. 检查管理后台「AI 渠道配置」是否正确配置

### 前端构建失败

1. 确保使用 pnpm（不支持 npm/yarn）
2. 清除缓存重试：
   ```bash
   pnpm store prune
   rm -rf node_modules .next
   pnpm install
   ```
3. 检查 Node.js 版本 >= 20

### 数据库连接失败

1. 确认 MySQL 服务已启动
2. 检查 `cms-server-go/.env` 中的数据库配置
3. 确认 MySQL 用户有创建数据库和表的权限

### 管理后台无法访问

1. 确认 Go 后端已启动
2. 检查 `admin/` 目录是否存在于项目根目录
3. 访问 http://localhost:3001/admin/ （注意末尾斜杠）

---

## 生产环境检查清单

部署到生产环境前，请确认：

- [ ] 修改默认管理员密码（admin/admin123）
- [ ] 更换 JWT_SECRET 为随机字符串
- [ ] 配置正确的数据库密码
- [ ] 启用 HTTPS
- [ ] 配置进程守护（PM2 或 systemd）
- [ ] 配置 Nginx 反向代理
- [ ] 定期备份 MySQL 数据库
- [ ] 定期备份 uploads/ 目录
- [ ] 配置日志轮转（避免日志文件过大）

---

## 开发说明

### 前端开发

```bash
cd ai-content-project

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint

# 开发模式（热重载）
pnpm dev
```

### 后端开发

```bash
cd cms-server-go

# 运行（热重载需要 air）
go run .

# 构建
go build -o cms-server .

# 格式化代码
go fmt ./...
```

---

## 许可证

Private - 内部项目

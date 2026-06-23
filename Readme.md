# ZSTS CMS — 后端移交说明书

> 版本：v2.0 | 日期：2026-06-23 | 移交人：前端/AI 原型阶段

---

## 1. 项目概览

**项目名称**：ZSTS 中沙商务服务官网 CMS（Content Management System）

**系统定位**：中沙商务服务门户网站的配置式内容管理系统，支持多页面模块统一管理、AI 内容生成、视频/海报制作、全局配置编辑等功能。

**系统组成**：

| 子系统 | 说明 | 技术栈 |
|--------|------|--------|
| CMS 后端 | 配置式 CMS API 服务器 | Express.js + SQLite + JWT |
| CMS 管理后台 | 可视化配置管理界面 | 原生 HTML/CSS/JS（SPA） |
| AI 内容生成前端 | 文章/海报/视频 AI 生成 | Next.js 16 + React 19 + TypeScript |
| 静态官网页面 | 面向终端用户的 HTML 页面 | 静态 HTML（含 data-i18n 标记） |

**⚠️ 当前阶段说明**：本系统由 AI 辅助开发完成前端原型与 CMS 框架。后端数据库目前使用 SQLite（文件型数据库），管理后台使用原生 JavaScript 直接操作 DOM，前端页面通过 `data-i18n` 属性标记可编辑区域。**建议后端研发在接手后评估是否迁移到正式技术栈（如 MySQL/PostgreSQL + Vue/React 管理后台）**。

---

## 2. 目录结构

```
项目根目录/
├── business-core/                  # ★ 业务核心（主要交付物）
│   ├── cms-server/                 # CMS 后端服务
│   │   ├── .env                    #   环境变量（PORT, JWT_SECRET）
│   │   ├── app.js                  #   ★ 主入口（Express 服务器）
│   │   ├── package.json            #   依赖清单
│   │   ├── db/
│   │   │   ├── cms.db              #   SQLite 数据库文件
│   │   │   └── setup.js            #   ★ 数据库初始化脚本
│   │   ├── middleware/
│   │   │   ├── auth.js             #   ★ JWT 认证中间件
│   │   │   └── audit.js            #   操作日志中间件
│   │   ├── routes/
│   │   │   ├── auth.js             #   认证路由（登录/获取用户信息）
│   │   │   ├── users.js            #   用户管理路由（CRUD + 权限）
│   │   │   ├── content.js          #   内容读写路由（页面/全局配置）
│   │   │   ├── logs.js             #   操作日志查询路由
│   │   │   └── ai-channels.js      #   AI 渠道配置路由
│   │   └── *.js                    #   辅助脚本（字段提取/标签改进等）
│   ├── admin/                      # CMS 管理后台 SPA
│   │   ├── index.html              #   入口页（登录/注册）
│   │   ├── dashboard.html          #   ★ 管理后台主界面
│   │   └── assets/
│   │       └── js/
│   │           ├── app.js          #   ★ 主应用逻辑（~3000+ 行）
│   │           └── json-editor.js  #   JSON 可视化编辑器
│   ├── content/                    # 内容存储目录（JSON 文件）
│   │   ├── global/                 #   全局配置（nav/footer/consultation）
│   │   └── pages/                  #   各页面内容
│   └── uploads/                    # 上传文件存储
│       └── images/
│
├── ai-content-project/             # AI 内容生成模块（Next.js）
│   ├── .env.local                  #   环境变量
│   ├── next.config.ts              #   Next.js 配置（basePath: /ai-content）
│   ├── package.json                #   依赖清单（React 19, ffmpeg, html2canvas 等）
│   ├── tsconfig.json               #   TypeScript 配置
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          #   根布局
│       │   ├── page.tsx            #   首页（AI 内容生成入口）
│       │   ├── create/page.tsx     #   内容创建页（文章生成）
│       │   ├── article/page.tsx    #   文章预览编辑页
│       │   ├── poster/page.tsx     #   ★ 海报编辑器（含视频生成）
│       │   ├── result/page.tsx     #   结果展示页
│       │   ├── logs/page.tsx       #   AI 调用日志（前端记录）
│       │   └── api/                #   服务端 API 路由
│       │       ├── fetch/route.ts  #      代理 AI API 请求
│       │       └── image/route.ts  #      图片生成代理
│       ├── lib/
│       │   ├── data.ts             #   常量数据（模板/平台/BGM 等）
│       │   └── utils.ts            #   工具函数
│       ├── components/
│       │   ├── token-persister.tsx #   CMS token 持久化组件
│       │   └── ui/                 #   shadcn/ui 组件库（50+ 组件）
│       └── hooks/
│           └── use-mobile.ts
│
├── *.html                          # 静态官网页面（符号链接）
├── images/                         # 静态图片资源（符号链接）
├── local-cdn/                      # 本地 CDN 资源（符号链接）
└── content/                        # 旧版内容目录（闲置）
```

> 注意：根目录的 `.html` 文件和 `images/`、`local-cdn/` 可能是指向另一个工作区的符号链接。如果源码不在本目录，需要确认前端 HTML 文件的实际存放位置。

---

## 3. CMS 后端架构

### 3.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js | 需要 Node 18+ |
| 框架 | Express.js 4.18 | HTTP 服务器 |
| 数据库 | SQLite (better-sqlite3) | 文件型数据库，路径 `db/cms.db` |
| 认证 | JWT (jsonwebtoken) | 签名密钥在 `.env` 中配置，有效期 7 天 |
| 密码哈希 | bcrypt | 10 轮 salt |
| 文件上传 | Multer | 限制 5MB，支持 jpg/png/gif/webp/svg |
| 代理 | http-proxy-middleware | 将 `/ai-content/*` 代理到 Next.js 开发服务器 |

### 3.2 端口与服务

| 端口 | 服务 | 说明 |
|------|------|------|
| 3001 | CMS 后端 | Express 主服务 |
| 3000 | AI 内容生成前端 | Next.js 开发服务器（被 CMS 代理） |

### 3.3 数据库表结构

#### `users` — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| username | TEXT UNIQUE | 用户名 |
| password_hash | TEXT | bcrypt 哈希后的密码 |
| role | TEXT | `super_admin` 或 `editor` |
| created_at | TEXT | 创建时间（本地时间） |
| last_login | TEXT | 最后登录时间 |

#### `page_permissions` — 页面权限表

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | INTEGER | 外键 → users.id，级联删除 |
| page_key | TEXT | 页面标识（见下方枚举） |
| _(联合主键)_ | | (user_id, page_key) |

**page_key 枚举值**：
```
global, home, about, visa, saudi-visa, saudi-news,
enterprise, transport, insurance, inspection
```

#### `audit_log` — 操作日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| user_id | INTEGER | 用户ID（可为空） |
| username | TEXT | 用户名 |
| action | TEXT | 操作类型 |
| target | TEXT | 操作目标 |
| detail | TEXT | 详细信息 |
| timestamp | TEXT | 时间戳（本地时间） |

**常见 action 枚举**：
`login` / `create_user` / `delete_user` / `reset_password` / `update_permissions` / `update_page` / `update_global` / `create_ai_channel` / `update_ai_channel` / `delete_ai_channel` / `set_default_ai_channel` / `system_init`

#### `ai_channels` — AI 渠道配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| name | TEXT | 渠道名称 |
| api_url | TEXT | API 地址 |
| api_key | TEXT | API 密钥 |
| model_list | TEXT | 模型列表（JSON 数组） |
| is_default | INTEGER | 是否默认（0/1） |
| created_at | TEXT | 创建时间 |
| created_by | INTEGER | 创建者（外键 → users.id） |

### 3.4 默认账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | admin123 | super_admin | 全部页面 |

> ⚠️ **生产环境必须修改默认密码！** `.env` 中的 `JWT_SECRET` 也需要更换。

### 3.5 中间件

#### `auth.js` — 认证中间件

```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'zsts-cms-secret-change-in-production';

// requireAuth — 验证 JWT → 注入 req.user = { id, username, role }
// requireSuperAdmin — requireAuth + role === 'super_admin'
// requirePagePerm(pageKey) — 验证特定页面编辑权限
```

#### `audit.js` — 日志中间件

```javascript
// audit(req, action, target, detail) — 手动写入审计日志
// auditMiddleware — 自动记录所有 POST/PUT/DELETE 的成功响应
```

### 3.6 启动方式

```bash
cd business-core/cms-server
npm install
node app.js
# 输出: ✅ ZSTS CMS 后端已启动
#       管理后台：http://localhost:3001/admin/
#       API Base：http://localhost:3001/api/
```

---

## 4. API 接口文档

### 4.1 认证接口 — `/api/auth`

#### `POST /api/auth/login` — 登录

```
请求体: { username: string, password: string }
响应:   {
  token: string,           // JWT，有效期 7 天
  user: {
    id: number,
    username: string,
    role: "super_admin" | "editor",
    permissions: string[]  // 页面权限列表
  }
}
```

#### `GET /api/auth/me` — 获取当前用户信息

```
请求头: Authorization: Bearer <token>
响应:   { id, username, role, created_at, last_login, permissions }
```

### 4.2 用户管理接口 — `/api/users` （需要超级管理员）

#### `GET /api/users` — 用户列表

```
响应: [{ id, username, role, created_at, last_login, permissions }]
```

#### `POST /api/users` — 创建账号

```
请求体: { username: string, password: string, role?: string, permissions?: string[] }
响应:   { id, username, role }
错误:   409 用户名已存在
```

#### `PUT /api/users/:id` — 重置密码

```
请求体: { password: string }    // 至少 6 位
响应:   { message: "密码已重置" }
```

#### `PUT /api/users/:id/permissions` — 更新页面权限

```
请求体: { permissions: string[] }
响应:   { message: "权限已更新" }
```

#### `DELETE /api/users/:id` — 删除账号

```
限制: 不能删除自己
响应: { message: "账号已删除" }
```

### 4.3 内容管理接口 — `/api/content`

#### `GET /api/content/:pageKey` — 读取内容（无需认证）

```
参数 pageKey:
  - 全局配置: nav / footer / consultation
  - 页面内容: home / about / visa / saudi-visa / enterprise / transport / insurance / inspection

响应: JSON 对象（字段 → { zh: string, en: string } 或图片 URL 字符串）
```

#### `PUT /api/content/:pageKey` — 保存内容（需要认证+权限）

```
请求体: JSON 对象（与 GET 返回结构一致）
权限:   - 全局配置 (nav/footer/consultation): 仅超级管理员
        - 页面内容: 超级管理员或拥有该页面权限的编辑
响应:   { message: "全局配置已保存" } 或 { message: "页面内容已保存" }
错误:   403 无权限
```

### 4.4 操作日志接口 — `/api/logs` （需要认证）

#### `GET /api/logs` — 查询日志

```
查询参数:
  page       — 页码，默认 1
  limit      — 每页条数，默认 50
  action     — 按操作类型模糊筛选
  username   — 按用户名模糊筛选
  start_date — 起始日期 (YYYY-MM-DD)
  end_date   — 结束日期 (YYYY-MM-DD)

响应: { total: number, page: number, limit: number, rows: [...] }
```

#### `DELETE /api/logs` — 清空日志（仅超级管理员）

### 4.5 AI 渠道配置 — `/api/ai-channels` （需要认证）

#### `GET /api/ai-channels` — 渠道列表

```
响应: [{ id, name, api_url, api_key, model_list: string[], is_default, created_at, created_by }]
```

#### `POST /api/ai-channels` — 新建渠道（仅超级管理员）

```
请求体: { name: string, api_url: string, api_key?: string, model_list?: string[] }
```

#### `PUT /api/ai-channels/:id` — 更新渠道（仅超级管理员）

#### `PUT /api/ai-channels/:id/set-default` — 设为默认渠道（仅超级管理员）

#### `DELETE /api/ai-channels/:id` — 删除渠道（仅超级管理员）

### 4.6 其他接口

#### `POST /api/upload` — 图片上传（需要认证）

```
Content-Type: multipart/form-data
字段名: file
限制: 5MB, 支持 jpg/png/gif/webp/svg
响应: { url: "/uploads/images/img_xxx.png", filename: string, size: number }
```

#### `GET /api/page-snapshot/:pageKey` — 从 HTML 抓取 data-i18n 当前值

```
用于编辑器首次回显默认值（从静态 HTML 的 data-i18n 属性提取文本和图片 URL）
响应: { htmlFile: string, count: number, snapshot: { [key]: string|object } }
```

---

## 5. CMS 管理后台架构

### 5.1 技术方式

- **纯原生 HTML/CSS/JS SPA**，无框架依赖
- 所有 DOM 操作通过 `business-core/admin/assets/js/app.js` 的全局函数完成
- 路由通过 hash（`#page=xxx`）实现，由 `loadPage()` 函数分发

### 5.2 菜单结构（在 `dashboard.html` 中定义）

```
控制台          → 欢迎页 + 统计卡片
全局配置
  ├── 导航菜单  → 官网主导航链接配置
  ├── 页脚      → 公司信息 + 页脚快速导航模块（开关式）
  └── 咨询弹窗  → 微信二维码 + 客服电话
页面内容        → 各页面的 data-i18n 字段编辑（JSON 编辑器）
  ├── 首页
  ├── 沙特签证
  ├── 全球签证
  ├── 境外交通住宿
  ├── 境外保险
  ├── 企业出海
  ├── 企业考察
  ├── 沙特资讯
  └── 关于我们
账号管理        → 用户列表 + 新建/编辑/删除 + 页面权限配置
AI 渠道配置     → AI API 中转站管理
AI 内容生成     → iframe 嵌入 Next.js AI 生成前端
操作日志        → 审计日志查询 + 筛选
```

### 5.3 页面模块统一配置

所有 9 个页面模块在 `dashboard.html` 中的 `window.ALL_PAGE_MODULES` 定义：

```javascript
window.ALL_PAGE_MODULES = [
  { key:'home',         label:'首页',         icon:'⌂',  url:'index.html' },
  { key:'saudi-visa',   label:'沙特签证',      icon:'✈',  url:'saudi-visa.html' },
  { key:'visa',         label:'全球签证',      icon:'🌍', url:'visa.html' },
  { key:'transport',    label:'境外交通住宿',   icon:'🏨', url:'transport.html' },
  { key:'insurance',    label:'境外保险',      icon:'🛡',  url:'insurance.html' },
  { key:'enterprise',   label:'企业出海',      icon:'🚀', url:'enterprise.html' },
  { key:'inspection',   label:'企业考察',      icon:'🔍', url:'inspection.html' },
  { key:'saudi-news',   label:'沙特资讯',      icon:'📰', url:'news.html' },
  { key:'about',        label:'关于我们',      icon:'ℹ',  url:'about.html' },
];
```

**单数据源原则**：导航菜单、页脚模块、账号权限、页面编辑器路由全部从 `ALL_PAGE_MODULES` 动态生成，新增页面只需修改此数组。

### 5.4 AI 内容生成模块（iframe 嵌入）

管理后台通过 iframe 嵌入 Next.js AI 前端（`/ai-content?token=xxx`），CMS 将 JWT token 作为 URL 参数传递以完成认证。

AI 功能包括：
- **文章生成**：输入主题 → AI 生成中英文内容，支持多平台风格模板
- **海报生成**：多页海报排版 + 画廊预览 + 批量下载（PNG + WebM/MP4 视频）
- **视频格式**：浏览器端 ffmpeg.wasm 将 WebM 转码为 MP4（H.264 + AAC）
- **平台分享**：一键跳转小红书/视频号/抖音，自动复制标题+标签

---

## 6. AI 内容生成前端（ai-content-project）

### 6.1 页面路由

| 路由 | 功能 |
|------|------|
| `/ai-content` | 首页，AI 内容生成入口 |
| `/ai-content/create` | 内容创建，输入主题+参数 |
| `/ai-content/article` | 文章预览编辑（Markdown 渲染） |
| `/ai-content/poster` | 海报编辑器（含视频生成） |
| `/ai-content/result` | 结果展示 |
| `/ai-content/logs` | AI 调用日志 |
| `/ai-content/api/fetch` | 服务端 API 代理 |
| `/ai-content/api/image` | 图片生成代理 |

### 6.2 关键依赖

| 包名 | 用途 |
|------|------|
| next 16.1.1 | 框架 |
| react 19.2.3 | UI |
| tailwindcss v4 | 样式 |
| shadcn/ui | 组件库 |
| @ffmpeg/ffmpeg | 浏览器端视频转码 |
| html2canvas | 海报截图 |
| jszip | 打包下载 |
| react-markdown | Markdown 渲染 |
| zod | 表单验证 |

### 6.3 配置要点

- **basePath**: `/ai-content`（所有路由前缀）
- **代理**: 由 CMS 后端 `app.js` 将 `/ai-content/*` 代理到 `localhost:3000`
- **认证**: 支持三种方式（Authorization header / URL token / Cookie），在 `app.js` 的 `aiAuth()` 中间件中处理

### 6.4 启动方式

```bash
cd ai-content-project
pnpm install
pnpm dev
# 访问 http://localhost:3000/ai-content
```

---

## 7. 内容存储机制

### 7.1 内容文件结构

```
business-core/content/
├── global/
│   ├── nav.json            # 导航菜单配置
│   ├── footer.json          # 页脚配置（公司信息 + 快速导航模块）
│   └── consultation.json    # 咨询弹窗配置
└── pages/
    ├── home.json
    ├── about.json
    ├── visa.json
    ├── saudi-visa.json
    ├── enterprise.json
    ├── transport.json
    ├── insurance.json
    └── inspection.json
```

### 7.2 内容 JSON 格式

```json
{
  "hero.title": { "zh": "中沙商务服务专家", "en": "Sino-Saudi Business Service Expert" },
  "hero.subtitle": { "zh": "...", "en": "..." },
  "hero.bgImage": "/uploads/images/img_xxx.png",
  "section.about.title": { "zh": "...", "en": "..." }
}
```

- 文本字段：`{ zh: string, en: string }`
- 图片字段：直接存 `/uploads/images/xxx.png` 字符串
- key 命名：`模块.组件.属性` 层级结构（与静态 HTML 的 `data-i18n` 属性对应）

### 7.3 编辑器工作流

1. 管理员在管理后台选择页面 → 页面编辑器加载
2. 前端调用 `GET /api/page-snapshot/:pageKey` 获取 HTML 中的默认值
3. 前端调用 `GET /api/content/:pageKey` 获取已保存的 CMS 内容
4. 默认值与 CMS 内容合并，优先使用 CMS 值
5. 编辑完成后 → `PUT /api/content/:pageKey` 保存 + 触发操作日志

---

## 8. 预览模式

### 8.1 预览入口

通过 `/preview/index.html` 等 URL 访问，CMS 后端动态注入：
- `window.CMS_PREVIEW = 1` — 标记预览模式
- `window.CMS_PAGE_KEY = 'home'` — 当前页面标识
- `/preview-client-v4.js` — 预览客户端脚本（无反缓存）

### 8.2 HTML → pageKey 映射

```javascript
'index.html'      → 'home'
'about.html'      → 'about'
'visa.html'       → 'visa'
'saudi-visa.html' → 'saudi-visa'
'enterprise.html' → 'enterprise'
'transport.html'  → 'transport'
'insurance.html'  → 'insurance'
'inspection.html' → 'inspection'
```

---

## 9. 部署与运维

### 9.1 开发环境启动

```bash
# 终端 1：启动 CMS 后端
cd business-core/cms-server
npm install
node app.js          # 端口 3001

# 终端 2：启动 AI 前端
cd ai-content-project
pnpm install
pnpm dev             # 端口 3000

# 访问管理后台
open http://localhost:3001/admin/
```

### 9.2 生产环境注意事项

1. **修改默认密码**：admin/admin123 → 强密码
2. **更换 JWT_SECRET**：`.env` 中的 `JWT_SECRET` 必须更换为随机字符串
3. **数据库迁移**：SQLite → MySQL/PostgreSQL（高并发场景）
4. **HTTPS**：生产环境必须启用 HTTPS
5. **文件存储**：上传目录 `business-core/uploads/` 需要定期备份
6. **静态页面**：确认 HTML 文件的实际存放位置（当前根目录下是符号链接）
7. **日志清理**：`audit_log` 表会持续增长，建议定期归档

### 9.3 建议的后端改造方向

| 当前实现 | 建议改造 |
|----------|----------|
| SQLite 文件数据库 | MySQL/PostgreSQL + 连接池 |
| JSON 文件存储内容 | 结构化数据库表或 MongoDB |
| 原生 JS SPA 管理后台 | Vue 3 / React 管理后台框架 |
| Express 直接运行 | PM2/Docker 容器化 + Nginx 反向代理 |
| JWT 无状态认证 | 增加 refresh token 机制 |
| 静态 HTML 页面 | SSR/SSG 动态渲染 |

---

## 10. 附录：关键代码清单

### 后端核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `cms-server/app.js` | 314 | 主入口，路由挂载，AI 代理，预览注入 |
| `cms-server/db/setup.js` | 114 | 建表 + 默认数据 |
| `cms-server/middleware/auth.js` | 85 | JWT 验证 + 权限中间件 |
| `cms-server/middleware/audit.js` | 74 | 审计日志写入 |
| `cms-server/routes/auth.js` | 98 | 登录 + 会话恢复 |
| `cms-server/routes/users.js` | 153 | 用户 CRUD + 权限管理 |
| `cms-server/routes/content.js` | 103 | 页面内容读写 |
| `cms-server/routes/logs.js` | 58 | 日志查询 |
| `cms-server/routes/ai-channels.js` | 112 | AI 渠道管理 |

### 前端核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `admin/dashboard.html` | ~400 | 管理后台布局 + 菜单 + 模态框 |
| `admin/assets/js/app.js` | ~3000 | 主应用逻辑（路由/渲染/API） |
| `admin/assets/js/json-editor.js` | ~500 | JSON 可视化编辑器 |

---

## 11. 联系方式

如有疑问，请通过以下方式联系原开发团队（AI 辅助开发阶段）：

- 项目文档：参见 `ai-content-project/README.md`
- CMS 初始化信息：用户名 `admin` / 密码 `admin123`
- AI 调用日志：管理后台 → 操作日志 → 筛选「AI调用」类型

---

**文档结束。建议后端研发先通读 CMS 后端 app.js 和 db/setup.js，然后对照本说明书逐模块理解。**

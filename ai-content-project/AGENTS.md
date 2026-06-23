# AGENTS.md

## 项目概览

ZSTS 内容后台 — 签证业务的内容生产与分发中枢。支持 4 种内容输入方式、2 种生成类型（文章/海报）、海报可扩展生成视频、5 个分发渠道。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── page.tsx        # 首页 Dashboard（内容池总览）
│   │   ├── layout.tsx      # 全局 Layout
│   │   ├── globals.css     # 全局样式 + CSS 变量
│   │   ├── create/
│   │   │   └── page.tsx    # AI 创作助手（统一对话入口 + 文章/海报类型选择）
│   │   ├── article/
│   │   │   └── page.tsx    # 文章编辑器（标题/摘要/正文编辑 + 预览 + 分发）
│   │   ├── poster/
│   │   │   └── page.tsx    # 海报编辑器（封面图+内页模板 + 视频开关）
│   │   └── result/
│   │       └── page.tsx    # 生成结果页（预览 + 操作 + 分发）
│   ├── components/ui/      # shadcn/ui 组件库
│   └── lib/
│       ├── data.ts         # 模拟数据、类型定义、常量配置
│       └── utils.ts        # 工具函数 (cn)
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 内容池总览、统计、快捷创建入口 |
| `/create` | AI 创作助手 | 统一对话入口，输入提示词 + 文章/海报类型选择 |
| `/article?source=xxx&title=xxx` | 文章编辑器 | 标题/摘要/正文编辑 + Markdown 预览 + 分发 |
| `/poster?contentId=xxx` | 海报编辑器 | 封面图+内页模板编辑 + 视频开关 |
| `/result?contentId=xxx` | 生成结果 | 预览+下载+5渠道分发 |

## 包管理规范

**仅允许使用 pnpm**，严禁 npm/yarn。

## 开发规范

- TypeScript strict 模式，禁止隐式 any
- 组件必须标注类型，事件对象、回调参数需明确类型
- 客户端组件需 `'use client'` 指令
- Hydration 安全：禁止在 JSX 渲染中使用 Math.random()、Date.now() 等不纯函数
- 页面间通过 URL searchParams 传参（如 `?tab=ai`、`?contentId=1`）
- 使用 `Suspense` 包裹含 `useSearchParams` 的组件

## 设计规范

详见 DESIGN.md，核心要点：
- 主背景 #F5F5F7，卡片白色，主操作色 #1D4ED8
- 内容源标识色：链接蓝/文件紫/AI粉/粘贴橙
- 生成类型色：文章绿/海报紫/视频琥珀
- 单栏居中布局 max-w-3xl/5xl，海报编辑器双栏

# Friend Card V4 · 管理分发版

> 主人（管理员）创建个人卡片 → 生成专属链接 → 分享给访客 → 访客免登录填写表单 → 主人审核通过 → 双向查看资料。

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | React 19 + Vite 8 |
| 样式 | TailwindCSS 3 |
| 后端 | Supabase JS SDK v2（Auth + PostgreSQL + Storage） |
| 路由 | React Router v6 |
| 部署 | GitHub Pages |

## 目录结构

```
friend V4/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/supabase.js              # Supabase 客户端
│   ├── components/
│   │   ├── common/                  # 通用组件（Button/Input/Card/Modal/Toast 等）
│   │   ├── visitor/                 # 访客侧组件（LockHeader/VisitorForm/VisitorStatusView）
│   │   ├── owner/                   # 主人侧组件（ProfileEdit/LinkManage/VisitorList 等）
│   │   └── notification/            # 通知组件
│   ├── context/                     # AuthContext + ToastContext
│   ├── hooks/                       # useVisitor/useDraft
│   ├── pages/                       # 页面（Login/Dashboard/Notifications/VisitorPage/404）
│   ├── utils/                       # storage/imageCompress/validators/exportData
│   ├── styles/index.css             # Tailwind 入口 + 主题变量
│   ├── App.jsx                      # 路由配置
│   └── main.jsx                     # 应用入口
├── supabase/
│   ├── v4-lite-schema.sql           # 建表 + RLS + 索引 + RPC 函数
│   └── v4-storage.sql               # Storage Bucket + RLS
├── .env.example
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入 Supabase 配置：

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase 配置

#### 3.1 关闭邮箱验证
进入 Supabase 控制台 → Authentication → Providers → Email：
- 关闭 `Confirm email`

#### 3.2 执行数据库 SQL
进入 Supabase SQL Editor，依次执行：

1. `supabase/v4-lite-schema.sql` — 建表 + RLS + 索引 + RPC 函数
2. `supabase/v4-storage.sql` — 创建 Storage Bucket + RLS

#### 3.3 创建主人账号
方式一：通过 Supabase 控制台 Authentication → Users → Add user
方式二：通过注册接口（前端登录页可扩展）

#### 3.4 初始化主人档案
主人首次登录后，在 `/dashboard` 填写 7 项资料（昵称/性别/年龄/微信号/自我介绍/交友期许/照片），保存后将自动：
- 创建 profiles 记录
- 生成 8 位 link_id

## 本地启动

```bash
npm run dev
```

访问 http://localhost:5173

## 部署到 GitHub Pages

### 1. 修改 vite.config.js 的 base
若部署到 `https://用户名.github.io/仓库名/`，修改 `vite.config.js`：

```js
base: '/仓库名/'
```

### 2. 配置 HashRouter（推荐）

由于 GitHub Pages 不支持 SPA 路由刷新，已在 `main.jsx` 中使用 `BrowserRouter`。
若部署到 GitHub Pages 子路径，建议改为 `HashRouter`：

```jsx
// src/main.jsx
import { HashRouter } from 'react-router-dom';
// 将 <BrowserRouter> 替换为 <HashRouter>
```

### 3. 构建并部署

```bash
npm run deploy
```

该命令会执行 `vite build` 并通过 `gh-pages` 推送 `dist/` 到 `gh-pages` 分支。

## 功能清单

### 主人侧
- [x] 邮箱密码登录
- [x] 7 项资料编辑（昵称/性别/年龄/微信号/自我介绍/交友期许/照片）
- [x] 自动生成 8 位专属 link_id
- [x] 链接管理（复制/预览/关闭/开启）
- [x] 访客统计（总数/待审核/已通过/已拒绝）
- [x] 访客审核列表（状态筛选/昵称搜索/分页）
- [x] 同意/拒绝（含 allow_reapply 开关）/撤销权限
- [x] 通知中心（分类筛选/已读/全部已读/点击跳转）
- [x] 数据导出（CSV/JSON）
- [x] 清空访客（二次确认）
- [x] 注销账户（二次确认 + 输入"确认注销"）

### 访客侧
- [x] 免登录访问专属链接
- [x] 锁定页（展示公开信息：昵称/性别/年龄/自我介绍/交友期许）
- [x] 填写表单（6 项 + 照片，前端压缩至 1024px）
- [x] 草稿自动保存（7 天有效，恢复提示）
- [x] 状态视图（待审核/已通过/已拒绝/已撤销）
- [x] 异常视图（链接失效/链接无效/自己访问自己）
- [x] 通过后查看完整资料 + 复制微信号
- [x] 重新申请（已拒绝/已撤销状态）

## 安全策略

- **RLS 行级安全**：所有表启用 RLS，严格限制读写权限
- **参数校验**：前端 + 数据库双重校验（CHECK 约束）
- **二次确认**：敏感操作（清空访客/注销账户/关闭链接）均需 Modal 二次确认
- **照片压缩**：前端压缩至 1024px，限制 jpg/png/webp，单张 ≤5MB
- **访客身份**：UUID 存于 localStorage，无需注册

## 路由说明

| 路由 | 说明 | 权限 |
|---|---|---|
| `/login` | 主人登录 | 公开 |
| `/u/:linkId` | 访客页（状态分发） | 公开 |
| `/dashboard` | 主人后台 | 需登录 |
| `/notifications` | 通知中心 | 需登录 |
| `*` | 404 | 公开 |

## 文档

- 产品需求文档：`friend V4.md`
- UI 参考文件：`friend v4.html`
- 开发约束：`AGENTS.md.txt`

## 版本

- v4.0-lite
- 最后更新：2026-08-14

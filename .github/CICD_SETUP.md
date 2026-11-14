# CI/CD 配置指南

本项目使用以下部署方式：

- **前端**: Vercel（自动部署）
- **后端**: Railway（自动部署）

## 📁 工作流文件

| 文件     | 说明                           | 触发条件                |
| -------- | ------------------------------ | ----------------------- |
| `ci.yml` | 持续集成：代码检查、测试、构建 | Push/PR 到 main/develop |
| `style.yml` | 代码风格：ruff / prettier / mobile ESLint | Push/PR 到 main/develop，手动触发 |

## 🎨 代码风格检查

所有检查都走 `scripts/style.sh`，本地和 CI 结果一致。

| 项目 | 工具 | 配置 |
| ---- | ---- | ---- |
| 后端 `kolvex-backend-py` | `ruff check`（pyflakes + import 排序）+ `ruff format`（替代 black/isort） | `pyproject.toml`，版本锁在 `requirements-dev.txt` |
| Web `kolvex-frontend-web-nextjs` | Prettier（`printWidth: 100`）；ESLint + tsc 仍在 `ci.yml` | `.prettierrc.json` / `.prettierignore` |
| Mobile `kolvex-mobile` | Prettier（`printWidth: 80`）+ `expo lint` | `.prettierrc.json` |

```bash
scripts/style.sh check            # 检查相对 origin/main 改动过的文件（含未提交）
scripts/style.sh fix              # 自动修复同一批文件
scripts/style.sh fix web --all    # 整个项目格式化
scripts/style.sh check all --staged
git config core.hooksPath .githooks   # 可选：启用 pre-commit 钩子（只查已暂存文件）
```

**检查范围**：后端和 Web 历史代码未统一格式化，CI 目前只检查 PR 改动过的文件（`STYLE_SCOPE: changed`），改到哪个文件就要把那个文件格式化好。Mobile 已全量合规，CI 检查整个项目（`STYLE_SCOPE: all`）。某个项目做完一次全量格式化提交后，把 `style.yml` 里对应 job 的 `STYLE_SCOPE` 改成 `all`，并把该提交加入 `.git-blame-ignore-revs`。

**合并保护**：在 GitHub 分支保护里把 `Code Style` 和 `CI Success` 设为 required checks。

## 🚀 部署配置

### 前端 - Vercel

Vercel 会自动检测 Next.js 项目并部署。

#### 配置步骤

1. 在 [Vercel](https://vercel.com) 导入 GitHub 仓库
2. 设置 **Root Directory** 为 `kolvex-frontend-web-nextjs`
3. 配置环境变量：

| 环境变量                        | 说明                 |
| ------------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 项目 URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥    |
| `NEXT_PUBLIC_BACKEND_API_URL`   | Railway 后端 API URL |

#### Vercel 配置文件（可选）

如果需要自定义配置，可以在 `kolvex-frontend-web-nextjs/vercel.json` 中添加：

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

---

### 后端 - Railway

Railway 支持从 GitHub 自动部署。

#### 配置步骤

1. 在 [Railway](https://railway.app) 创建新项目
2. 连接 GitHub 仓库
3. 设置 **Root Directory** 为 `kolvex-backend-py`
4. 配置环境变量：

| 环境变量          | 说明                          |
| ----------------- | ----------------------------- |
| `SUPABASE_URL`    | Supabase 项目 URL             |
| `SUPABASE_KEY`    | Supabase 服务端密钥           |
| `SECRET_KEY`      | 应用密钥（用于 JWT）          |
| `ALLOWED_ORIGINS` | 允许的跨域来源（Vercel 域名） |
| `PORT`            | 端口号（Railway 会自动设置）  |

#### Railway 配置

Railway 会自动检测 Python 项目。确保 `kolvex-backend-py` 目录下有以下文件：

**`railway.json`**（可选，如果需要自定义）：

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**`Procfile`**（可选）：

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## 🔐 GitHub Secrets 配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置（用于 CI 构建验证）：

| Secret 名称                     | 说明                |
| ------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 公开 URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥   |
| `NEXT_PUBLIC_BACKEND_API_URL`   | 后端 API URL        |
| `SUPABASE_URL`                  | Supabase 项目 URL   |
| `SUPABASE_KEY`                  | Supabase 服务端密钥 |

---

## 📊 CI/CD 流程图

```
┌─────────────┐
│   Push/PR   │
│  to main    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     CI      │
│ (lint/test) │
└──────┬──────┘
       │
       ├───────────────────┐
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Vercel    │     │   Railway   │
│  (前端)     │     │   (后端)    │
│  自动部署   │     │   自动部署   │
└─────────────┘     └─────────────┘
```

---

## 🔗 连接前后端

### 1. 获取 Railway 后端 URL

从你的截图可以看到，后端 URL 类似：

```
https://kolvex-production.up.railway.app
```

### 2. 配置 Vercel 环境变量

在 Vercel 项目设置中，添加：

```
NEXT_PUBLIC_BACKEND_API_URL=https://kolvex-production.up.railway.app
```

### 3. 配置 Railway CORS

在 Railway 环境变量中，添加：

```
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app,https://your-custom-domain.com
```

---

## 🔧 常见问题

### 1. 前端调用后端 API 出现 CORS 错误

确保后端的 `ALLOWED_ORIGINS` 包含前端域名。

### 2. Railway 部署失败

检查：

- `requirements.txt` 是否完整
- Python 版本是否兼容
- 启动命令是否正确

### 3. Vercel 构建失败

检查：

- 环境变量是否正确配置
- Node.js 版本是否兼容
- 依赖是否都已安装

---

## 📝 更新日志

- **2024-12-18**: 简化 CI/CD 配置，适配 Vercel + Railway 部署方式

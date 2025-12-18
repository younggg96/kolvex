# CI/CD 配置指南

本文档说明如何配置 GitHub Actions CI/CD 流程。

## 📁 工作流文件

| 文件 | 说明 | 触发条件 |
|------|------|----------|
| `ci.yml` | 持续集成：代码检查、测试、构建 | Push/PR 到 main/develop |
| `docker-build.yml` | 构建 Docker 镜像并推送到 GHCR | Push 到 main 或打 tag |
| `deploy.yml` | 自动部署到服务器 | 手动触发或 Docker 构建完成后 |

## 🔐 需要配置的 Secrets

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置：

### 必需的 Secrets

#### 应用配置
| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase 服务端密钥 | `eyJhbGciOi...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 公开 URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGciOi...` |
| `NEXT_PUBLIC_API_URL` | 后端 API URL | `https://api.your-domain.com` |
| `SECRET_KEY` | 应用密钥（用于 JWT 等） | 随机字符串 |

#### 部署配置（Staging 环境）
| Secret 名称 | 说明 |
|------------|------|
| `STAGING_HOST` | 预发布服务器 IP/域名 |
| `STAGING_USER` | SSH 用户名 |
| `STAGING_SSH_KEY` | SSH 私钥 |
| `STAGING_SSH_PORT` | SSH 端口（可选，默认 22） |

#### 部署配置（Production 环境）
| Secret 名称 | 说明 |
|------------|------|
| `PRODUCTION_HOST` | 生产服务器 IP/域名 |
| `PRODUCTION_USER` | SSH 用户名 |
| `PRODUCTION_SSH_KEY` | SSH 私钥 |
| `PRODUCTION_SSH_PORT` | SSH 端口（可选，默认 22） |

#### 可选 Secrets
| Secret 名称 | 说明 |
|------------|------|
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook URL |
| `CODECOV_TOKEN` | Codecov 上传 Token |

### Environment Variables

在 **Settings → Environments** 中为 `staging` 和 `production` 环境配置：

| 变量名 | 说明 |
|--------|------|
| `STAGING_URL` / `PRODUCTION_URL` | 前端访问 URL |
| `STAGING_API_URL` / `PRODUCTION_API_URL` | 后端 API URL |
| `DEPLOY_PATH` | 服务器上的部署路径（默认 `/opt/kolvex`） |

## 🚀 部署流程

### 自动部署（推荐）

1. **提交代码到 `main` 分支**
2. **CI 工作流自动运行**：lint、test、build
3. **Docker 构建工作流自动运行**：构建并推送镜像到 GitHub Container Registry
4. **部署工作流自动触发**：部署到 Staging 环境

### 手动部署

1. 进入 **Actions → Deploy → Run workflow**
2. 选择目标环境（staging/production）
3. 点击 **Run workflow**

### 生产环境部署

生产环境部署需要手动触发，以确保安全：

1. 进入 **Actions → Deploy → Run workflow**
2. 选择 **production** 环境
3. 需要有 `production` 环境的审批权限

## 🖥️ 服务器配置

### 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 创建部署目录

```bash
sudo mkdir -p /opt/kolvex
sudo chown $USER:$USER /opt/kolvex
```

### 复制部署配置

```bash
cd /opt/kolvex
# 复制 docker-compose.deploy.yml 到服务器
# 创建 .env 文件并配置环境变量
```

### .env 示例

```env
# GitHub 仓库
GITHUB_REPOSITORY=your-username/kolvex

# 镜像标签（由 CI/CD 自动更新）
IMAGE_TAG=latest

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-service-key

# 应用
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=https://your-domain.com

# 日志
LOG_LEVEL=INFO
```

### 配置 Nginx（可选）

如果需要使用 Nginx 作为反向代理：

```bash
mkdir -p /opt/kolvex/nginx/conf.d
# 创建 nginx.conf 和 SSL 证书
```

## 📊 CI/CD 流程图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Push/PR   │────▶│     CI      │────▶│    Tests    │
│  to main    │     │   (lint)    │     │   Passed    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐            │
                    │   Docker    │◀───────────┘
                    │    Build    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            │            ▼
    ┌─────────────┐        │   ┌─────────────┐
    │   Staging   │        │   │ Production  │
    │   Deploy    │        │   │   Deploy    │
    │  (自动)     │        │   │  (手动)     │
    └─────────────┘        │   └─────────────┘
                           │
                           ▼
                  ┌─────────────┐
                  │    GHCR     │
                  │   (镜像)    │
                  └─────────────┘
```

## 🔧 常见问题

### 1. Docker 构建失败

检查：
- Dockerfile 语法是否正确
- 依赖是否都已列出
- 构建参数是否正确传递

### 2. 部署失败

检查：
- SSH 密钥是否正确配置
- 服务器防火墙设置
- Docker 是否已安装并运行
- 环境变量是否正确配置

### 3. 健康检查失败

检查：
- 应用是否正常启动
- 端口是否正确暴露
- 健康检查端点是否可访问

## 📝 更新日志

- **2024-12-17**: 初始化 CI/CD 配置
  - 添加 CI 工作流（lint、test、build）
  - 添加 Docker 构建工作流
  - 添加自动部署工作流
  - 添加 Dependabot 配置


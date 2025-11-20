# Kolvex 项目设置指南

## 📋 推送到 GitHub

### 1. 在 GitHub 上创建新仓库

访问 https://github.com/new 创建一个新的仓库，名称建议为 `kolvex`

**重要：** 不要初始化 README、.gitignore 或 LICENSE（因为我们已经有了）

### 2. 连接本地仓库到 GitHub

```bash
cd /Users/guanggengyang/Documents/GitHub/kolvex

# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/kolvex.git

# 或者使用 SSH（推荐）
git remote add origin git@github.com:YOUR_USERNAME/kolvex.git

# 推送到 GitHub
git push -u origin main
```

### 3. 验证推送

访问你的 GitHub 仓库页面，确认所有文件都已成功上传。

---

## 🚀 本地开发设置

### 前端设置

```bash
cd kolvex-frontend-web-nextjs

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的配置

# 启动开发服务器
npm run dev
```

前端访问地址：http://localhost:3000

### 后端设置

```bash
cd kolvex-backend-py

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或 Windows: .\venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 启动开发服务器
python main.py
```

后端访问地址：http://localhost:8000
API 文档：http://localhost:8000/docs

---

## 🔧 环境变量配置

### 前端环境变量 (.env.local)

需要配置 Supabase 和其他第三方服务的密钥。参考前端项目中的 `.env.example` 文件。

### 后端环境变量 (.env)

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/kolvex

# JWT 配置
SECRET_KEY=生成一个强密钥
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API 配置
API_VERSION=v1
DEBUG=True

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**生成强密钥：**

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 📦 数据库设置

### 安装 PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 创建数据库

```bash
# 连接到 PostgreSQL
psql -U postgres

# 创建数据库和用户
CREATE DATABASE kolvex;
CREATE USER kolvex_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE kolvex TO kolvex_user;

# 退出
\q
```

### 运行数据库迁移

```bash
cd kolvex-backend-py

# 初始化 Alembic（如果还没有）
alembic init alembic

# 创建迁移
alembic revision --autogenerate -m "Initial migration"

# 执行迁移
alembic upgrade head
```

---

## 🧪 运行测试

### 前端测试

```bash
cd kolvex-frontend-web-nextjs
npm test
```

### 后端测试

```bash
cd kolvex-backend-py
pytest
```

---

## 📚 额外资源

- [Next.js 文档](https://nextjs.org/docs)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Supabase 文档](https://supabase.com/docs)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

---

## 🐛 常见问题

### Q: 前端无法连接到后端？

**A:** 确保：
1. 后端服务器正在运行 (http://localhost:8000)
2. CORS 配置正确
3. 前端环境变量中的 API URL 正确

### Q: 数据库连接失败？

**A:** 检查：
1. PostgreSQL 服务是否正在运行
2. DATABASE_URL 配置是否正确
3. 数据库用户是否有正确的权限

### Q: 依赖安装失败？

**A:** 尝试：
1. 清除缓存：`npm cache clean --force` 或 `pip cache purge`
2. 删除 `node_modules` 或 `venv` 后重新安装
3. 确保 Node.js 和 Python 版本符合要求

---

## 📞 获取帮助

如果遇到问题，请：
1. 查看项目文档
2. 搜索已有的 GitHub Issues
3. 创建新的 Issue 描述你的问题

---

祝开发愉快！🎉


# 🚀 快速启动指南

## 最简单的方式（推荐）

### 方法一：使用 Makefile（推荐）

```bash
# 一键设置并启动（创建 .env + 启动 Docker 服务）
make setup

# 查看日志
make logs

# 停止服务
make down
```

### 方法二：使用启动脚本

```bash
# 运行启动脚本
./start.sh

# 根据提示选择启动模式
```

### 方法三：手动启动

```bash
# 1. 复制环境变量文件
cp .env.example .env

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f backend
```

## 验证服务

```bash
# 检查健康状态
curl http://localhost:8000/health

# 或使用 make 命令
make health

# 访问 API 文档
open http://localhost:8000/docs
```

## 常用命令

```bash
# 查看所有可用命令
make help

# 启动开发环境
make docker-dev

# 查看运行状态
make ps

# 查看日志
make logs

# 进入容器
make shell

# 停止服务
make down

# 清理所有（包括数据）
make clean
```

## 访问地址

- 🌐 API: http://localhost:8000
- 📖 Swagger 文档: http://localhost:8000/docs
- 📘 ReDoc 文档: http://localhost:8000/redoc
- ❤️ 健康检查: http://localhost:8000/health
- 🗄️ PostgreSQL: localhost:5432

## 下一步

1. ✅ 检查服务是否正常运行
2. 📝 查看 API 文档了解接口
3. 🚀 开始开发或准备部署
4. 📚 阅读 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解部署选项

## 故障排除

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :8000

# 或更改端口
# 编辑 docker-compose.yml 中的 ports 配置
```

### 数据库连接失败

```bash
# 查看数据库日志
make logs-db

# 重启服务
make down && make up
```

### 清理并重新开始

```bash
# 停止并删除所有容器和数据
make clean

# 重新启动
make setup
```

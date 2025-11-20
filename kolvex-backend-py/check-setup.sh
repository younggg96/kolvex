#!/bin/bash

# 环境检查脚本

echo "🔍 Kolvex Backend 环境检查"
echo "========================="
echo ""

# 检查 Python
echo "📌 检查 Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ $PYTHON_VERSION"
else
    echo "   ❌ Python 3 未安装"
fi

echo ""

# 检查 Docker
echo "📌 检查 Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "   ✅ $DOCKER_VERSION"
    
    # 检查 Docker 是否运行
    if docker info &> /dev/null; then
        echo "   ✅ Docker 守护进程正在运行"
    else
        echo "   ⚠️  Docker 已安装但未运行"
        echo "      请启动 Docker Desktop"
    fi
else
    echo "   ❌ Docker 未安装"
    echo "      访问 https://docs.docker.com/get-docker/"
fi

echo ""

# 检查 Docker Compose
echo "📌 检查 Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "   ✅ $COMPOSE_VERSION"
else
    echo "   ❌ Docker Compose 未安装"
fi

echo ""

# 检查环境变量文件
echo "📌 检查配置文件..."
if [ -f .env ]; then
    echo "   ✅ .env 文件存在"
else
    echo "   ⚠️  .env 文件不存在"
    echo "      运行: cp .env.example .env"
fi

if [ -f .env.example ]; then
    echo "   ✅ .env.example 文件存在"
else
    echo "   ❌ .env.example 文件不存在"
fi

echo ""

# 检查依赖文件
echo "📌 检查项目文件..."
if [ -f requirements.txt ]; then
    echo "   ✅ requirements.txt 存在"
else
    echo "   ❌ requirements.txt 不存在"
fi

if [ -f docker-compose.yml ]; then
    echo "   ✅ docker-compose.yml 存在"
else
    echo "   ❌ docker-compose.yml 不存在"
fi

if [ -f Dockerfile ]; then
    echo "   ✅ Dockerfile 存在"
else
    echo "   ❌ Dockerfile 不存在"
fi

echo ""

# 检查端口占用
echo "📌 检查端口占用..."
if lsof -i :8000 &> /dev/null; then
    echo "   ⚠️  端口 8000 已被占用"
    echo "      占用进程:"
    lsof -i :8000 | tail -n +2
else
    echo "   ✅ 端口 8000 可用"
fi

if lsof -i :5432 &> /dev/null; then
    echo "   ⚠️  端口 5432 已被占用（PostgreSQL）"
else
    echo "   ✅ 端口 5432 可用"
fi

echo ""
echo "========================="
echo "🎯 推荐的下一步："
echo ""

# 根据检查结果给出建议
DOCKER_OK=false
if command -v docker &> /dev/null && docker info &> /dev/null; then
    DOCKER_OK=true
fi

if [ "$DOCKER_OK" = true ]; then
    echo "✅ Docker 已就绪，推荐使用 Docker："
    echo "   $ make setup"
    echo "   或"
    echo "   $ ./start.sh"
    echo ""
    echo "📖 查看完整文档："
    echo "   $ cat QUICKSTART.md"
else
    echo "💡 Docker 未就绪，可以："
    echo ""
    echo "   选项 1: 启动 Docker 并使用容器"
    echo "   $ open -a Docker  # macOS"
    echo "   然后运行: make setup"
    echo ""
    echo "   选项 2: 使用本地 Python 环境"
    echo "   $ ./start-local.sh"
    echo ""
    echo "   选项 3: 安装 Docker"
    echo "   https://docs.docker.com/get-docker/"
fi

echo ""
echo "📚 更多帮助："
echo "   - 快速开始: cat QUICKSTART.md"
echo "   - 部署指南: cat DEPLOYMENT.md"
echo "   - 平台对比: cat PLATFORMS_COMPARISON.md"
echo ""


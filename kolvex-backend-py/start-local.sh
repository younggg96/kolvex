#!/bin/bash

# 本地开发环境启动脚本（不使用 Docker）

echo "🐍 Kolvex Backend - 本地开发模式"
echo "================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python 3"
    exit 1
fi

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    # 修改为使用 localhost
    sed -i.bak 's/@db:/@localhost:/g' .env
    rm .env.bak
    echo "✅ 已创建 .env 文件"
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 升级 pip
pip install --upgrade pip -q

# 安装依赖
echo "📥 安装依赖..."
pip install -r requirements.txt -q

echo ""
echo "⚠️  数据库提示："
echo "   本地模式需要 PostgreSQL 数据库"
echo ""
echo "   如果你有 Docker，可以只启动数据库："
echo "   $ docker-compose up -d db"
echo ""
echo "   或者安装本地 PostgreSQL："
echo "   macOS: brew install postgresql@15"
echo "   Ubuntu: sudo apt install postgresql"
echo ""

read -p "数据库已准备好？继续启动服务？(y/n): " continue

if [ "$continue" = "y" ] || [ "$continue" = "Y" ]; then
    echo ""
    echo "🚀 启动开发服务器..."
    echo "📍 API: http://localhost:8000"
    echo "📖 文档: http://localhost:8000/docs"
    echo ""
    python main.py
else
    echo "已取消启动"
    exit 1
fi


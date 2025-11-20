#!/bin/bash

# Kolvex Backend 快速启动脚本

echo "🚀 Kolvex Backend 启动脚本"
echo "=========================="

# 检查是否有 .env 文件
if [ ! -f .env ]; then
    echo "📝 未找到 .env 文件，从 .env.example 复制..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请根据需要修改配置"
fi

# 检查 Docker 是否安装和运行
DOCKER_AVAILABLE=false
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    if docker info &> /dev/null; then
        DOCKER_AVAILABLE=true
    else
        echo "⚠️  Docker 已安装但未运行"
        echo "请启动 Docker Desktop 或运行: sudo systemctl start docker"
    fi
else
    echo "⚠️  Docker 未安装"
fi

if [ "$DOCKER_AVAILABLE" = false ]; then
    echo ""
    echo "💡 你可以选择："
    echo "   1. 启动 Docker 后重新运行此脚本"
    echo "   2. 使用本地 Python 环境（需要单独运行 PostgreSQL）"
    echo ""
    read -p "是否使用本地 Python 环境启动？(y/n): " use_local
    
    if [ "$use_local" = "y" ] || [ "$use_local" = "Y" ]; then
        echo "🐍 使用本地 Python 环境..."
        
        # 检查虚拟环境
        if [ ! -d "venv" ]; then
            echo "📦 创建虚拟环境..."
            python3 -m venv venv
        fi
        
        echo "📥 安装依赖..."
        source venv/bin/activate
        pip install -r requirements.txt
        
        echo ""
        echo "⚠️  注意：你需要确保 PostgreSQL 数据库已运行"
        echo "   数据库连接信息请查看 .env 文件"
        echo ""
        echo "🚀 启动开发服务器..."
        python main.py
        exit 0
    else
        echo "退出脚本"
        exit 1
    fi
fi

echo ""
echo "选择启动方式："
echo "1) 开发环境 (docker-compose.yml)"
echo "2) 生产环境 (docker-compose.prod.yml)"
echo "3) 仅启动数据库"
read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo "🔨 启动开发环境..."
        docker-compose up -d
        ;;
    2)
        echo "🚢 启动生产环境..."
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    3)
        echo "🗄️ 仅启动数据库..."
        docker-compose up -d db
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "⏳ 等待服务启动..."
sleep 5

echo ""
echo "✅ 服务启动完成！"
echo ""
echo "📍 访问地址："
echo "   - API: http://localhost:8000"
echo "   - API 文档: http://localhost:8000/docs"
echo "   - 健康检查: http://localhost:8000/health"
echo ""
echo "📋 常用命令："
echo "   - 查看日志: docker-compose logs -f backend"
echo "   - 停止服务: docker-compose down"
echo "   - 重启服务: docker-compose restart"
echo ""


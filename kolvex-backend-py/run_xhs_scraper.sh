#!/bin/bash
# 小红书爬虫快速启动脚本

echo "🚀 小红书爬虫工具"
echo "==============================================="
echo ""

# 切换到项目目录
cd "$(dirname "$0")"

# 激活虚拟环境
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ 虚拟环境已激活"
else
    echo "❌ 未找到虚拟环境，请先创建: python -m venv venv"
    exit 1
fi

# 显示菜单
echo ""
echo "请选择操作："
echo "  1) 测试 Cookie 有效性"
echo "  2) 重新登录（扫码）"
echo "  3) 爬取默认关键词"
echo "  4) 爬取自定义关键词"
echo "  5) 查看数据统计"
echo "  0) 退出"
echo ""

read -p "请输入选项 (0-5): " choice

case $choice in
    1)
        echo ""
        echo "🧪 测试 Cookie..."
        python test_xhs_cookies.py
        ;;
    2)
        echo ""
        echo "🔑 启动登录模式..."
        python -m app.services.xiaohongshu --login
        ;;
    3)
        echo ""
        echo "🕷️ 开始爬取（默认关键词）..."
        python -m app.services.xiaohongshu --max-posts 20
        ;;
    4)
        echo ""
        read -p "请输入关键词（用空格分隔）: " keywords
        echo "🕷️ 开始爬取: $keywords"
        python -m app.services.xiaohongshu --max-posts 20 $keywords
        ;;
    5)
        echo ""
        echo "📊 数据库统计..."
        python -m app.services.xiaohongshu --stats
        ;;
    0)
        echo "👋 再见！"
        exit 0
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "✅ 完成！"


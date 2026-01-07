#!/bin/bash
# 快速测试自动同步功能

echo "🚀 测试自动同步持仓功能"
echo "================================"
echo ""

# 1. 检查调度器状态
echo "1️⃣  启动服务器并检查调度器..."
echo ""
echo "请在另一个终端运行:"
echo "  cd kolvex-backend-py"
echo "  python main.py"
echo ""
echo "查看日志中是否出现:"
echo "  ✅ 定时任务调度器已启动"
echo "  📅 [HOLDINGS] 早上同步下次执行时间: ..."
echo "  📅 [HOLDINGS] 晚上同步下次执行时间: ..."
echo ""
read -p "按回车继续..."

# 2. 测试同步逻辑
echo ""
echo "2️⃣  测试同步逻辑..."
cd kolvex-backend-py
python test_auto_sync.py

echo ""
echo "================================"
echo "✅ 测试完成！"
echo ""
echo "📝 下一步:"
echo "  1. 检查上面的测试输出，确认同步成功"
echo "  2. 查看服务器日志，确认定时任务已注册"
echo "  3. (可选) 使用 API 端点测试:"
echo ""
echo "     # 查看调度器状态"
echo "     curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       http://localhost:8000/api/v1/scheduler/status"
echo ""
echo "     # 手动触发同步"
echo "     curl -X POST -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       http://localhost:8000/api/v1/scheduler/sync-holdings/trigger"
echo ""






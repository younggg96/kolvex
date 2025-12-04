#!/bin/bash
# 启动 Kolvex Twitter MCP Server
# 使用方式: 
#   ./start-mcp.sh          # stdio 模式（默认，适合 Cursor MCP）
#   ./start-mcp.sh http     # HTTP 模式（适合远程调用）

set -e

echo "🚀 Starting Kolvex Twitter MCP Server..."

# 检查是否有虚拟环境
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# 根据参数决定启动模式
MODE="${1:-stdio}"

if [ "$MODE" = "http" ]; then
    # HTTP 模式
    export MCP_TRANSPORT="http"
    export MCP_HOST="${MCP_HOST:-0.0.0.0}"
    export MCP_PORT="${MCP_PORT:-8001}"
    echo "📡 Transport: HTTP"
    echo "🌐 Listening on: $MCP_HOST:$MCP_PORT"
    python -m app.mcp.twitter_mcp_server
else
    # stdio 模式（默认）
    export MCP_TRANSPORT="stdio"
    echo "📡 Transport: stdio"
    python -m app.mcp.twitter_mcp_server
fi


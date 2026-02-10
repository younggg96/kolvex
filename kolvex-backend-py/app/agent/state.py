"""
LangGraph State 定义
定义 Agent 系统的状态结构
"""

from typing import TypedDict, Annotated, Optional, Dict, Any, List
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    Agent 系统的全局状态

    Attributes:
        messages: 消息历史（LangGraph 自动合并）
        user_id: 当前用户 ID
        conversation_id: 当前对话 ID
        current_agent: 当前活跃的子 Agent 名称
        metadata: 额外元数据（如股票代码上下文等）
    """
    messages: Annotated[list, add_messages]
    user_id: str
    conversation_id: str
    current_agent: str
    metadata: Dict[str, Any]

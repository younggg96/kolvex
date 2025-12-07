"""
AI 服务工具函数
JSON 解析和提取工具
"""

import json
from typing import Optional, Dict, List


def extract_json_object(text: str) -> Optional[Dict]:
    """
    从文本中提取第一个有效的 JSON 对象
    处理模型可能在 JSON 前输出的废话

    Args:
        text: 模型原始输出

    Returns:
        Dict 或 None
    """
    if not text:
        return None

    # 查找 JSON 对象的起始位置
    json_start = text.find("{")
    if json_start < 0:
        return None

    # 从找到的位置开始，尝试找到匹配的结束括号
    brace_count = 0
    json_end = -1
    for i, char in enumerate(text[json_start:], start=json_start):
        if char == "{":
            brace_count += 1
        elif char == "}":
            brace_count -= 1
            if brace_count == 0:
                json_end = i + 1
                break

    if json_end > json_start:
        try:
            json_str = text[json_start:json_end]
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    return None


def extract_json_array(text: str) -> Optional[List]:
    """
    从文本中提取第一个有效的 JSON 数组

    Args:
        text: 模型原始输出

    Returns:
        List 或 None
    """
    if not text:
        return None

    # 查找 JSON 数组
    json_start = text.find("[")
    if json_start < 0:
        return None

    # 从找到的位置开始，尝试找到匹配的结束括号
    bracket_count = 0
    json_end = -1
    for i, char in enumerate(text[json_start:], start=json_start):
        if char == "[":
            bracket_count += 1
        elif char == "]":
            bracket_count -= 1
            if bracket_count == 0:
                json_end = i + 1
                break

    if json_end > json_start:
        try:
            json_str = text[json_start:json_end]
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

    return None


"""
工具函数
"""

import os
import json
import time
import random
from typing import List, Dict, Optional

from .config import COOKIES_FILE


def random_sleep(min_sec: float, max_sec: float, message: str = None) -> None:
    """
    随机延迟，模拟人类行为

    Args:
        min_sec: 最小延迟秒数
        max_sec: 最大延迟秒数
        message: 可选的提示信息
    """
    delay = random.uniform(min_sec, max_sec)
    if message:
        print(f"⏳ {message} (等待 {delay:.1f}s)")
    time.sleep(delay)


def load_cookies(cookies_file: str = None) -> Optional[List[Dict]]:
    """
    加载保存的 cookies

    Args:
        cookies_file: cookies 文件路径

    Returns:
        Optional[List[Dict]]: cookies 列表，如果文件不存在返回 None
    """
    if cookies_file is None:
        cookies_file = str(COOKIES_FILE)

    if os.path.exists(cookies_file):
        try:
            with open(cookies_file, "r") as f:
                cookies = json.load(f)
                print(f"🍪 已加载 cookies: {cookies_file}")
                return cookies
        except Exception as e:
            print(f"⚠️ 加载 cookies 失败: {e}")
    return None


def save_cookies(cookies: List[Dict], cookies_file: str = None) -> bool:
    """
    保存 cookies 到文件

    Args:
        cookies: cookies 列表
        cookies_file: 保存路径

    Returns:
        bool: 保存成功返回 True
    """
    if cookies_file is None:
        cookies_file = str(COOKIES_FILE)

    try:
        with open(cookies_file, "w") as f:
            json.dump(cookies, f, indent=2)
        print(f"🍪 Cookies 已保存到: {cookies_file}")
        return True
    except Exception as e:
        print(f"⚠️ 保存 cookies 失败: {e}")
        return False


def parse_metric(text: str) -> int:
    """
    解析数量文本，将 "1.5M", "10K", "5,302" 转换为纯整数

    Args:
        text: 包含数量的文本，如 "1.2M", "12.5K", "5,302"

    Returns:
        int: 解析出的数量
    """
    if not text:
        return 0
    try:
        import re

        # 清理文本
        text = text.strip().replace(",", "")

        # 匹配数字和后缀
        match = re.search(r"([\d.]+)\s*([KMB])?", text, re.IGNORECASE)
        if match:
            num_str = match.group(1)
            num = float(num_str)
            suffix = match.group(2)

            if suffix:
                suffix = suffix.upper()
                multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
                num *= multipliers.get(suffix, 1)

            return int(num)
    except Exception:
        pass
    return 0


# 保留旧函数名作为别名
_parse_count_text = parse_metric


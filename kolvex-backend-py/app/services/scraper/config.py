"""
Twitter 爬虫配置常量
"""

from pathlib import Path

# Cookies 文件路径
COOKIES_FILE = Path(__file__).parent.parent.parent / "x_cookies.json"

# 真实的 User-Agent 列表
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

# 默认爬虫配置
DEFAULT_MAX_POSTS_PER_USER = 10
DEFAULT_DELAY_BETWEEN_USERS = (5.0, 15.0)
DEFAULT_DELAY_DURING_SCROLL = (1.0, 3.0)
DEFAULT_MAX_SCROLLS = 10
DEFAULT_TWEET_MAX_AGE_DAYS = 7

# 超时配置 (毫秒)
PAGE_LOAD_TIMEOUT = 30000
ELEMENT_WAIT_TIMEOUT = 15000
NETWORK_IDLE_TIMEOUT = 5000
SETUP_LOGIN_TIMEOUT = 300  # 秒

# 浏览器配置
BROWSER_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
]

BROWSER_VIEWPORT = {"width": 1280, "height": 900}
BROWSER_LOCALE = "en-US"
BROWSER_TIMEZONE = "America/New_York"


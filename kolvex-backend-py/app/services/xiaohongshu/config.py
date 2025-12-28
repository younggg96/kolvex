"""
小红书爬虫配置常量
"""

from pathlib import Path

# Cookies 文件路径
COOKIES_FILE = Path(__file__).parent.parent.parent / "xhs_cookies.json"

# 真实的 User-Agent 列表
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

# 小红书搜索关键词预设
DEFAULT_KEYWORDS = [
    "美股",
    "美股投资",
    "美股分析",
    "NVDA",
    "英伟达",
    "特斯拉",
    "苹果股票",
    "纳斯达克",
    "标普500",
]

# 基础 URL
BASE_URL = "https://www.xiaohongshu.com"
SEARCH_URL = "https://www.xiaohongshu.com/search_result"

# 默认爬虫配置
DEFAULT_MAX_POSTS = 20  # 每次搜索最多爬取的帖子数量
DEFAULT_DELAY_BETWEEN_POSTS = (2.0, 5.0)  # 帖子间延迟范围 (min, max) 秒
DEFAULT_DELAY_DURING_SCROLL = (1.5, 3.5)  # 滚动时延迟范围 (min, max) 秒
DEFAULT_MAX_SCROLLS = 15  # 最大滚动次数
DEFAULT_POST_MAX_AGE_DAYS = 30  # 最大帖子年龄（天）

# 超时配置 (毫秒)
PAGE_LOAD_TIMEOUT = 30000
ELEMENT_WAIT_TIMEOUT = 15000
NETWORK_IDLE_TIMEOUT = 8000
SETUP_LOGIN_TIMEOUT = 300  # 秒

# 浏览器配置
BROWSER_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
]

BROWSER_VIEWPORT = {"width": 1440, "height": 900}
BROWSER_LOCALE = "zh-CN"
BROWSER_TIMEZONE = "Asia/Shanghai"

# 小红书 CSS 选择器 (2024/2025 新版页面结构)
SELECTORS = {
    # 搜索结果页面
    "note_card": "section.note-item",
    "note_link": "a.cover",
    "note_title": "a.title, .title",
    "note_author": ".author .name, .name-time-wrapper .name, .name",
    "note_author_avatar": "img.author-avatar",
    "note_likes": ".like-wrapper .count",
    "note_cover": "a.cover img",
    "note_time": ".time",
    
    # 笔记详情页面（弹窗模式）
    "detail_container": "#noteContainer, .note-container, .note-detail-mask",
    "detail_title": "#detail-title, #noteContainer .title",
    "detail_content": "#detail-desc .note-text, #detail-desc, .note-text",
    "detail_author": "#noteContainer .author .name, #noteContainer .username, #noteContainer .name",
    "detail_avatar": "#noteContainer .avatar-item, .author-wrapper img",
    "detail_likes": ".engage-bar-container .like-wrapper .count, .like-wrapper .count",
    "detail_collects": ".engage-bar-container .collect-wrapper .count, .collect-wrapper .count",
    "detail_comments": ".engage-bar-container .chat-wrapper .count, .comment-wrapper .count",
    "detail_images": ".swiper-slide .note-slider-img img, .swiper-slide .img-container img, .swiper-slide img",
    "detail_video": "#noteContainer video, .media-container video",
    "detail_tags": '#noteContainer a[href*="/search_result?keyword="], #noteContainer .tag',
    "detail_time": "#noteContainer .bottom-container span, #noteContainer .date, .publish-date",
    
    # 登录检测
    "login_button": '.login-btn, [class*="login"]',
    "logged_in_indicator": '.user-avatar, .user-info, [class*="user-menu"]',
    
    # 登录弹窗关闭按钮
    "login_popup_close": [
        '[class*="login"] [class*="close"]',
        '[class*="modal"] [class*="close"]',
        '[class*="dialog"] [class*="close"]',
        'div[class*="login"] svg',
        '[class*="icon-close"]',
        'button[aria-label="关闭"]',
        '.close-button',
    ],
}


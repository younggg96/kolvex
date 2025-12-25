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

# 小红书 CSS 选择器（可能需要根据实际页面结构调整）
SELECTORS = {
    # 搜索结果页面
    "note_card": 'section.note-item, [data-v-a264b01a].note-item, .note-item',
    "note_link": 'a.cover, a[href*="/explore/"], a[href*="/search_result/"]',
    "note_title": ".title, .note-title, span.title",
    "note_author": ".author-wrapper .name, .author .name, .user-name",
    "note_likes": '.like-wrapper .count, .like .count, .like-count, [class*="like"] span',
    "note_cover": ".cover img, img.cover, .note-cover img",
    
    # 笔记详情页面
    "detail_title": ".title, h1.title, .note-title",
    "detail_content": '#detail-desc .desc, .note-text, .content .desc, [class*="desc"]',
    "detail_author": ".user-info .name, .author .name, .user-name",
    "detail_avatar": ".user-info img, .author img, .avatar img",
    "detail_likes": '.like-wrapper .count, [class*="like"] .count',
    "detail_collects": '.collect-wrapper .count, [class*="collect"] .count',
    "detail_comments": '.comment-wrapper .count, [class*="comment"] .count',
    "detail_images": ".swiper-slide img, .carousel img, .image-container img",
    "detail_video": "video, .video-container video",
    "detail_tags": ".tag, .hashtag, #hash-tag span, a[href*='/search_result?keyword']",
    "detail_time": ".date, .time, .publish-date",
    
    # 登录检测
    "login_button": '.login-btn, [class*="login"]',
    "logged_in_indicator": '.user-avatar, .user-info, [class*="user-menu"]',
    
    # 登录弹窗关闭按钮
    "login_popup_close": [
        # 小红书登录弹窗关闭按钮选择器
        '[class*="login"] [class*="close"]',
        '[class*="modal"] [class*="close"]',
        '[class*="dialog"] [class*="close"]',
        'div[class*="login"] svg',
        '[class*="icon-close"]',
        'button[aria-label="关闭"]',
        '.close-button',
    ],
}


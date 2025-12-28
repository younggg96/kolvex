"""
小红书美股热帖爬虫模块

使用方式:
    # CLI 命令行
    python -m app.services.xiaohongshu --setup
    python -m app.services.xiaohongshu 美股 英伟达 特斯拉

    # Python 代码
    from app.services.xiaohongshu import XiaohongshuScraper

    scraper = XiaohongshuScraper(headless=True)
    scraper.scrape(['美股', '英伟达'])
"""

from .config import (
    COOKIES_FILE,
    USER_AGENTS,
    BASE_URL,
    SEARCH_URL,
    DEFAULT_KEYWORDS,
    DEFAULT_MAX_POSTS,
    DEFAULT_DELAY_BETWEEN_POSTS,
    DEFAULT_DELAY_DURING_SCROLL,
)

from .database import (
    get_supabase_client,
    compute_post_hash,
    post_exists,
    note_id_exists,
    insert_post,
    get_stats,
    get_recent_posts,
    # 图片处理
    download_image,
    upload_image_to_storage,
    process_and_upload_images,
)

from .extractors import (
    parse_count,
    parse_xhs_date,
    extract_note_id_from_url,
    extract_note_card,
    extract_note_detail,
    merge_note_data,
)

from .scraper import XiaohongshuScraper

from .cli import main


__all__ = [
    # Config
    "COOKIES_FILE",
    "USER_AGENTS",
    "BASE_URL",
    "SEARCH_URL",
    "DEFAULT_KEYWORDS",
    "DEFAULT_MAX_POSTS",
    "DEFAULT_DELAY_BETWEEN_POSTS",
    "DEFAULT_DELAY_DURING_SCROLL",
    # Database
    "get_supabase_client",
    "compute_post_hash",
    "post_exists",
    "note_id_exists",
    "insert_post",
    "get_stats",
    "get_recent_posts",
    # Image processing
    "download_image",
    "upload_image_to_storage",
    "process_and_upload_images",
    # Extractors
    "parse_count",
    "parse_xhs_date",
    "extract_note_id_from_url",
    "extract_note_card",
    "extract_note_detail",
    "merge_note_data",
    # Core
    "XiaohongshuScraper",
    # CLI
    "main",
]


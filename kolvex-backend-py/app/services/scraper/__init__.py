"""
Twitter 爬虫模块

使用方式:
    # CLI 命令行
    python -m app.services.scraper --setup
    python -m app.services.scraper elonmusk zerohedge

    # Python 代码
    from app.services.scraper import BatchKOLScraper

    scraper = BatchKOLScraper(headless=True)
    scraper.batch_scrape(['elonmusk', 'zerohedge'])
"""

from .config import (
    COOKIES_FILE,
    USER_AGENTS,
    DEFAULT_MAX_POSTS_PER_USER,
    DEFAULT_DELAY_BETWEEN_USERS,
    DEFAULT_DELAY_DURING_SCROLL,
)

from .database import (
    get_supabase_client,
    compute_tweet_hash,
    tweet_exists,
    insert_tweet,
    upsert_kol_profile,
    upsert_user_profile,  # 别名
    get_stats,
)

from .utils import (
    random_sleep,
    load_cookies,
    save_cookies,
    parse_metric,
)

from .extractors import (
    extract_user_profile,
    extract_tweet_text,
    extract_tweet_metadata,
)

from .scraper import BatchKOLScraper

from .migration import migrate_sqlite_to_supabase

from .cli import main


__all__ = [
    # Config
    "COOKIES_FILE",
    "USER_AGENTS",
    "DEFAULT_MAX_POSTS_PER_USER",
    "DEFAULT_DELAY_BETWEEN_USERS",
    "DEFAULT_DELAY_DURING_SCROLL",
    # Database
    "get_supabase_client",
    "compute_tweet_hash",
    "tweet_exists",
    "insert_tweet",
    "upsert_kol_profile",
    "upsert_user_profile",
    "get_stats",
    # Utils
    "random_sleep",
    "load_cookies",
    "save_cookies",
    "parse_metric",
    # Extractors
    "extract_user_profile",
    "extract_tweet_text",
    "extract_tweet_metadata",
    # Core
    "BatchKOLScraper",
    # Migration
    "migrate_sqlite_to_supabase",
    # CLI
    "main",
]


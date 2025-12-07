"""
CLI 命令行入口
"""

import argparse

from .scraper import BatchKOLScraper
from .database import get_supabase_client, get_stats
from .migration import migrate_sqlite_to_supabase


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description="美股 KOL 批量爬虫 (Supabase 版)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # Setup 模式 - 首次运行，手动登录保存 cookies
  python -m app.services.scraper --setup
  
  # Batch 模式 - 爬取指定用户
  python -m app.services.scraper elonmusk unusual_whales zerohedge
  
  # 使用有头模式（可见浏览器）
  python -m app.services.scraper --no-headless elonmusk
  
  # 查看数据库统计
  python -m app.services.scraper --stats
  
  # 从 SQLite 迁移数据到 Supabase
  python -m app.services.scraper --migrate kol_tweets.db
        """,
    )

    parser.add_argument(
        "--setup",
        action="store_true",
        help="Setup 模式: 打开浏览器手动登录并保存 cookies",
    )

    parser.add_argument("--stats", action="store_true", help="显示数据库统计信息")

    parser.add_argument(
        "--migrate",
        type=str,
        metavar="SQLITE_FILE",
        help="从 SQLite 文件迁移数据到 Supabase",
    )

    parser.add_argument(
        "usernames",
        nargs="*",
        help="要爬取的用户名列表",
    )

    parser.add_argument(
        "--max-posts",
        type=int,
        default=10,
        help="每个用户最多爬取的推文数量 (默认: 10)",
    )

    parser.add_argument(
        "--no-headless", action="store_true", help="使用有头模式（显示浏览器窗口）"
    )

    parser.add_argument("--cookies", type=str, default=None, help="Cookies 文件路径")

    args = parser.parse_args()

    # 迁移数据
    if args.migrate:
        print(f"\n📦 开始迁移 SQLite 数据到 Supabase...")
        migrate_sqlite_to_supabase(args.migrate)
        return

    # 显示统计
    if args.stats:
        supabase = get_supabase_client()
        if not supabase:
            print("❌ 无法连接 Supabase")
            return

        stats = get_stats(supabase)
        print("\n📊 Supabase 数据库统计:")
        print(f"  总推文数: {stats['total']}")
        print("\n📋 按用户统计:")
        for user, count in list(stats["by_user"].items())[:20]:
            print(f"  @{user}: {count}")
        return

    # 创建爬虫实例
    scraper = BatchKOLScraper(
        cookies_file=args.cookies,
        headless=not args.no_headless,
        max_posts_per_user=args.max_posts,
    )

    try:
        if args.setup:
            # Setup 模式
            scraper.setup_mode()
        elif args.usernames:
            # Batch 模式
            scraper.batch_scrape(usernames=args.usernames)
        else:
            print("❌ 请提供要爬取的用户名，或使用 --setup 进行登录设置")
            print(
                "   示例: python -m app.services.scraper elonmusk zerohedge"
            )

    finally:
        scraper.close()


if __name__ == "__main__":
    main()


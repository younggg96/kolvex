"""
CLI 命令行入口
"""

import argparse

from .scraper import XiaohongshuScraper
from .database import get_supabase_client, get_stats, get_recent_posts
from .config import DEFAULT_KEYWORDS


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(
        description="小红书美股热帖爬虫",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 登录模式 - 首次运行，手动扫码登录保存 cookies
  python -m app.services.xiaohongshu --login
  # 或者
  python -m app.services.xiaohongshu --setup
  
  # 爬取默认关键词（美股、NVDA 等）
  python -m app.services.xiaohongshu
  
  # 爬取自定义关键词
  python -m app.services.xiaohongshu 美股 英伟达 特斯拉
  
  # 使用有头模式（可见浏览器）
  python -m app.services.xiaohongshu --no-headless 美股
  
  # 不获取详情页（更快）
  python -m app.services.xiaohongshu --no-details 美股
  
  # 查看数据库统计
  python -m app.services.xiaohongshu --stats
  
  # 查看最近帖子
  python -m app.services.xiaohongshu --recent 10

操作流程:
  1. 首次使用，先运行 --login 进行登录
  2. 在浏览器中扫码登录
  3. 登录成功后程序会自动检测，如果没反应就按回车键
  4. 登录完成后就可以运行爬取命令了
        """,
    )

    parser.add_argument(
        "--setup", "--login",
        action="store_true",
        dest="setup",
        help="登录模式: 打开浏览器手动扫码登录并保存 cookies",
    )

    parser.add_argument(
        "--stats",
        action="store_true",
        help="显示数据库统计信息",
    )

    parser.add_argument(
        "--recent",
        type=int,
        metavar="N",
        help="显示最近 N 条帖子",
    )

    parser.add_argument(
        "keywords",
        nargs="*",
        help="要搜索的关键词列表（不提供则使用默认关键词）",
    )

    parser.add_argument(
        "--max-posts",
        type=int,
        default=20,
        help="每个关键词最多爬取的帖子数量 (默认: 20)",
    )

    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="使用有头模式（显示浏览器窗口）",
    )

    parser.add_argument(
        "--no-details",
        action="store_true",
        help="不获取详情页（更快但数据较少）",
    )

    parser.add_argument(
        "--cookies",
        type=str,
        default=None,
        help="Cookies 文件路径",
    )

    parser.add_argument(
        "--stock-only",
        action="store_true",
        help="仅显示股票相关帖子（用于 --recent）",
    )

    args = parser.parse_args()

    # 显示统计
    if args.stats:
        supabase = get_supabase_client()
        if not supabase:
            print("❌ 无法连接 Supabase")
            return

        stats = get_stats(supabase)
        print("\n📊 小红书帖子数据库统计:")
        print(f"  📝 总帖子数: {stats['total']}")
        print(f"  📈 股票相关: {stats.get('stock_related', 0)}")

        if stats.get("by_keyword"):
            print("\n📋 按关键词统计:")
            for kw, count in list(stats["by_keyword"].items())[:15]:
                print(f"  '{kw}': {count}")
        return

    # 显示最近帖子
    if args.recent:
        supabase = get_supabase_client()
        if not supabase:
            print("❌ 无法连接 Supabase")
            return

        posts = get_recent_posts(
            supabase,
            limit=args.recent,
            stock_related_only=args.stock_only,
        )
        print(f"\n📋 最近 {len(posts)} 条帖子:")
        print("=" * 60)

        for i, post in enumerate(posts, 1):
            title = post.get("title", "无标题")[:50]
            author = post.get("author_name", "未知")
            likes = post.get("like_count", 0)
            keyword = post.get("search_keyword", "")
            sentiment = post.get("ai_sentiment", "")
            tickers = post.get("ai_tickers", [])

            print(f"\n{i}. {title}")
            print(f"   👤 {author} | ❤️ {likes} | 🔍 {keyword}")

            if sentiment or tickers:
                ticker_str = ", ".join(tickers) if tickers else "无"
                print(f"   🤖 情绪: {sentiment or '未分析'} | 股票: {ticker_str}")

            if post.get("permalink"):
                print(f"   🔗 {post['permalink']}")

        return

    # 创建爬虫实例
    scraper = XiaohongshuScraper(
        cookies_file=args.cookies,
        headless=not args.no_headless,
        max_posts=args.max_posts,
        fetch_details=not args.no_details,
    )

    try:
        if args.setup:
            # Setup 模式
            scraper.setup_mode()
        else:
            # 爬取模式
            keywords = args.keywords if args.keywords else DEFAULT_KEYWORDS
            scraper.scrape(keywords=keywords)

    finally:
        scraper.close()


if __name__ == "__main__":
    main()


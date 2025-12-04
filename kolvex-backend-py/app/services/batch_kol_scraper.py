"""
美股 KOL 批量爬虫系统
使用 Playwright (sync_api) 抓取 X.com 上的美股 KOL 推文
并保存到 Supabase 数据库
"""

import time
import random
import hashlib
import json
import os
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Playwright 相关导入
try:
    from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    # 定义占位类型，避免类型注解错误
    Page = None
    Browser = None
    BrowserContext = None

# Supabase 相关导入
try:
    from supabase import create_client, Client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# ============================================================
# 配置常量
# ============================================================

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

# ============================================================
# 🎯 美股 KOL 列表 (按类别组织)
# ============================================================

KOL_LIST = {
    # --- 🚨 Must-Have News & Flow (速度最快的数据源) ---
    "news_flow": [
        ("unusual_whales", "Options flow & dark pool data"),
        ("DeItaone", "Walter Bloomberg - The fastest breaking news terminal"),
        ("FinancialJuice", "Real-time audio/text news"),
        ("zerohedge", "Macro/Geopolitics/Contrarian views"),
        ("FirstSquawk", "Real-time trading audio news squawk"),
    ],
    # --- 📉 Famous Big Short & Macro (宏观与空头) ---
    "short_macro": [
        ("BurryTracker", "Tracking Michael Burry's portfolio/deleted tweets"),
        ("HindenburgRes", "Most influential short seller - Market mover"),
        ("MuddyWatersRE", "Carson Block's short selling firm"),
        ("CitronResearch", "Andrew Left - Short seller"),
        ("MacroAlf", "Alfonso Peccatiello - Ex-PIMCO Macro Economist"),
        ("elerianm", "Mohamed A. El-Erian - Allianz Chief Economic Advisor"),
    ],
    # --- 📊 Charts & Data (硬核数据派) ---
    "charts_data": [
        ("charliebilello", "Top tier market charts & stats"),
        ("SJosephBurns", "Technical analysis education"),
        ("TrendSpider", "Automated technical analysis"),
        ("SpotGamma", "Options gamma exposure & volatility"),
        ("KobeissiLetter", "Global capital markets commentary"),
    ],
    # --- 🐂 Institutional & Mainstream (主流声音) ---
    "institutional": [
        ("JimCramer", "CNBC Host - often used as inverse indicator"),
        ("WSJmarkets", "Wall Street Journal Markets"),
        ("BloombergTV", "Global Finance News"),
        ("BillAckman", "Pershing Square - Activist Investor"),
    ],
    # --- 🦍 Retail Sentiment & Meme (散户风向标) ---
    "retail_meme": [
        ("StockTwits", "Community sentiment aggregation"),
        ("TheRoaringKitty", "Keith Gill - GME/Meme stock leader"),
        ("wallstreetbets", "Reddit WSB official handle"),
        ("QuiverQuant", "Tracking congressional trading & alternative data"),
    ],
}


def get_all_kols() -> List[Tuple[str, str]]:
    """获取所有 KOL 的 (username, description) 列表"""
    all_kols = []
    for category in KOL_LIST.values():
        all_kols.extend(category)
    return all_kols


# ============================================================
# Supabase 数据库操作
# ============================================================


def get_supabase_client() -> Optional[Client]:
    """
    获取 Supabase 客户端

    Returns:
        Optional[Client]: Supabase 客户端，如果未配置返回 None
    """
    if not SUPABASE_AVAILABLE:
        print("⚠️ Supabase 未安装，请运行: pip install supabase")
        return None

    # 从环境变量获取配置
    from dotenv import load_dotenv

    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print(
            "⚠️ Supabase 配置未找到，请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量"
        )
        return None

    return create_client(supabase_url, supabase_key)


def compute_tweet_hash(text: str, username: str) -> str:
    """
    计算推文的唯一哈希值

    Args:
        text: 推文文本
        username: 用户名

    Returns:
        str: SHA256 哈希值的前 16 位
    """
    content = f"{username}:{text}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def tweet_exists(client: Client, tweet_hash: str) -> bool:
    """
    检查推文是否已存在于数据库中

    Args:
        client: Supabase 客户端
        tweet_hash: 推文哈希值

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("kol_tweets")
            .select("id")
            .eq("tweet_hash", tweet_hash)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查推文是否存在失败: {e}")
        return False


def insert_tweet(
    client: Client, tweet_data: Dict, category: str = None, max_age_days: int = 7
) -> bool:
    """
    插入推文到 Supabase 数据库（如果不存在且不太旧）

    Args:
        client: Supabase 客户端
        tweet_data: 推文数据字典，包含:
            - username: 用户名
            - text: 推文文本
            - created_at: 创建时间
            - permalink: 推文链接
            - avatar_url: KOL 头像 URL
            - media_urls: 媒体 URL 列表
            - is_repost: 是否是转发
            - original_author: 原作者
            - reply_count, repost_count, like_count, bookmark_count, views_count
        category: KOL 类别
        max_age_days: 最大推文年龄（天），超过此天数的推文不会被插入

    Returns:
        bool: 插入成功返回 True，已存在/太旧/失败返回 False
    """

    # 检查推文时间，如果太旧就跳过
    created_at_str = tweet_data.get("created_at")
    if created_at_str:
        try:
            # 解析 ISO 格式时间
            if created_at_str.endswith("Z"):
                created_at_str = created_at_str[:-1] + "+00:00"
            tweet_time = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))

            # 如果是 naive datetime，假设为 UTC
            if tweet_time.tzinfo is None:
                tweet_time = tweet_time.replace(tzinfo=timezone.utc)

            cutoff_time = datetime.now(timezone.utc) - timedelta(days=max_age_days)

            if tweet_time < cutoff_time:
                print(
                    f"   ⏭️ 跳过旧推文 ({created_at_str[:10]}): {tweet_data['text'][:30]}..."
                )
                return False
        except Exception as e:
            # 解析失败就继续插入
            pass

    tweet_hash = compute_tweet_hash(tweet_data["text"], tweet_data["username"])

    if tweet_exists(client, tweet_hash):
        return False

    try:
        # 处理 media_urls - 转换为 JSON 字符串存储
        media_urls = tweet_data.get("media_urls", [])
        media_urls_json = json.dumps(media_urls) if media_urls else None

        data = {
            "username": tweet_data["username"],
            "tweet_text": tweet_data["text"],
            "tweet_hash": tweet_hash,
            "created_at": tweet_data.get("created_at"),
            "permalink": tweet_data.get("permalink"),
            # 新增字段
            "avatar_url": tweet_data.get("avatar_url"),
            "media_urls": media_urls_json,
            "is_repost": tweet_data.get("is_repost", False),
            "original_author": tweet_data.get("original_author"),
            # 互动数据
            "like_count": tweet_data.get("like_count", 0),
            "retweet_count": tweet_data.get("repost_count", 0),  # 兼容旧字段名
            "reply_count": tweet_data.get("reply_count", 0),
            "bookmark_count": tweet_data.get("bookmark_count", 0),
            "views_count": tweet_data.get("views_count", 0),
            # 元数据
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "category": category,
        }
        client.table("kol_tweets").insert(data).execute()
        return True
    except Exception as e:
        # 可能是唯一约束冲突（并发情况）
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False
        print(f"⚠️ 插入推文失败: {e}")
        return False


def upsert_kol_profile(
    client: Client, profile_data: Dict, category: str = None, description: str = None
) -> bool:
    """
    插入或更新 KOL profile 到 Supabase 的 kol_profiles 表

    Args:
        client: Supabase 客户端
        profile_data: 完整的 profile 数据字典
        category: KOL 类别
        description: KOL 描述（来自预定义列表）

    Returns:
        bool: 操作成功返回 True
    """
    try:
        data = {
            # 核心身份信息
            "username": profile_data["username"],
            "rest_id": profile_data.get("rest_id"),
            "display_name": profile_data.get("display_name"),
            # 认证状态
            "is_verified": profile_data.get("is_verified", False),
            "verification_type": profile_data.get("verification_type", "None"),
            # 影响力指标
            "followers_count": profile_data.get("followers_count", 0),
            "following_count": profile_data.get("following_count", 0),
            "posts_count": profile_data.get("posts_count", 0),
            # 时间信息
            "join_date": profile_data.get("join_date"),
            # 外部链接与位置
            "location": profile_data.get("location"),
            "website": profile_data.get("website"),
            "bio": profile_data.get("bio"),
            # 视觉素材
            "avatar_url": profile_data.get("avatar_url"),
            "banner_url": profile_data.get("banner_url"),
            # KOL 分类
            "category": category,
            "description": description,
            # 元数据
            "is_active": True,
            "updated_at": datetime.utcnow().isoformat(),
        }
        # 使用 upsert，如果 username 已存在则更新
        client.table("kol_profiles").upsert(data, on_conflict="username").execute()
        return True
    except Exception as e:
        print(f"⚠️ 保存 KOL profile 失败: {e}")
        return False


# 保留旧函数名作为别名，保持兼容性
upsert_user_profile = upsert_kol_profile


def get_stats(client: Client) -> Dict:
    """
    获取数据库统计信息

    Returns:
        Dict: 包含总数、各用户数量等统计信息
    """
    try:
        # 总推文数
        total_result = client.table("kol_tweets").select("id", count="exact").execute()
        total = total_result.count or 0

        # 各用户推文数
        user_result = (
            client.rpc("get_kol_tweet_counts_by_user", {}).execute() if False else None
        )  # RPC 可能不存在，fallback

        # 简单查询各用户推文数
        by_user = {}
        try:
            users_result = client.table("kol_tweets").select("username").execute()
            for row in users_result.data:
                username = row["username"]
                by_user[username] = by_user.get(username, 0) + 1
        except:
            pass

        # 各类别推文数
        by_category = {}
        try:
            cat_result = (
                client.table("kol_tweets")
                .select("category")
                .not_.is_("category", "null")
                .execute()
            )
            for row in cat_result.data:
                cat = row["category"]
                by_category[cat] = by_category.get(cat, 0) + 1
        except:
            pass

        return {
            "total": total,
            "by_user": dict(sorted(by_user.items(), key=lambda x: x[1], reverse=True)),
            "by_category": dict(
                sorted(by_category.items(), key=lambda x: x[1], reverse=True)
            ),
        }
    except Exception as e:
        print(f"⚠️ 获取统计信息失败: {e}")
        return {"total": 0, "by_user": {}, "by_category": {}}


# ============================================================
# 工具函数
# ============================================================


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


# ============================================================
# 推文提取函数
# ============================================================


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


def extract_user_profile(page) -> Dict:
    """
    从用户主页提取完整的 profile 信息

    提取字段：
    - 核心身份: username, rest_id, display_name
    - 认证状态: is_verified, verification_type (Blue/Gold/Grey/None)
    - 影响力指标: followers_count, following_count, posts_count
    - 时间信息: join_date
    - 外部链接: location, website, bio
    - 视觉素材: avatar_url, banner_url

    Args:
        page: Playwright 页面对象

    Returns:
        Dict: 包含完整用户 profile 信息的字典
    """
    profile = {
        # 核心身份信息
        "username": None,
        "rest_id": None,
        "display_name": None,
        # 认证状态
        "is_verified": False,
        "verification_type": "None",  # 'Blue', 'Gold', 'Grey', 'None'
        # 影响力指标
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        # 时间信息
        "join_date": None,
        # 外部链接与位置
        "location": None,
        "website": None,
        "bio": None,
        # 视觉素材
        "avatar_url": None,
        "banner_url": None,
    }

    try:
        # ========== 1. 提取用户名 (从 URL) ==========
        url = page.url
        if "//" in url:
            parts = url.split("/")
            for part in parts:
                if part and part not in [
                    "https:",
                    "http:",
                    "",
                    "x.com",
                    "twitter.com",
                ]:
                    profile["username"] = part.split("?")[0]
                    break

        # ========== 2. 提取 Rest ID (从 HTML) ==========
        try:
            # Rest ID 通常在某些元素的属性中
            # 尝试从页面内容中提取
            page_content = page.content()
            import re

            rest_id_match = re.search(r'"rest_id":"(\d+)"', page_content)
            if rest_id_match:
                profile["rest_id"] = rest_id_match.group(1)
        except Exception:
            pass

        # ========== 3. 提取头像 URL ==========
        try:
            avatar_selectors = [
                'img[src*="profile_images"]',
                '[data-testid="UserAvatar-Container-unknown"] img',
                'a[href*="photo"] img',
            ]
            for selector in avatar_selectors:
                avatar = page.query_selector(selector)
                if avatar:
                    src = avatar.get_attribute("src")
                    if src and "profile_images" in src:
                        # 获取更高分辨率的头像 (400x400)
                        profile["avatar_url"] = src.replace(
                            "_normal", "_400x400"
                        ).replace("_bigger", "_400x400")
                        break
        except Exception:
            pass

        # ========== 4. 提取背景图 URL ==========
        try:
            banner_selectors = [
                'img[src*="profile_banners"]',
                '[data-testid="UserProfileHeader_Items"] img[src*="banner"]',
                'a[href*="header_photo"] img',
            ]
            for selector in banner_selectors:
                banner = page.query_selector(selector)
                if banner:
                    src = banner.get_attribute("src")
                    if src and "profile_banners" in src:
                        profile["banner_url"] = src
                        break
            # 备用方案：从 CSS 背景图提取
            if not profile["banner_url"]:
                header = page.query_selector('[data-testid="UserProfileHeader_Items"]')
                if header:
                    style = header.evaluate(
                        "el => getComputedStyle(el).backgroundImage"
                    )
                    if style and "url(" in style:
                        import re

                        match = re.search(r'url\(["\']?(.*?)["\']?\)', style)
                        if match:
                            profile["banner_url"] = match.group(1)
        except Exception:
            pass

        # ========== 5. 提取显示名称 ==========
        try:
            name_selectors = [
                '[data-testid="UserName"] span span',
                '[data-testid="UserName"] > div > div > span',
                'h2[role="heading"] span',
            ]
            for selector in name_selectors:
                name_element = page.query_selector(selector)
                if name_element:
                    text = name_element.inner_text().strip()
                    if text and not text.startswith("@"):
                        profile["display_name"] = text
                        break
        except Exception:
            pass

        # ========== 6. 提取认证状态 ==========
        try:
            # 查找认证图标
            verified_selectors = [
                'svg[data-testid="icon-verified"]',
                '[data-testid="UserName"] svg[aria-label*="Verified"]',
                '[data-testid="UserName"] svg[aria-label*="verified"]',
            ]
            for selector in verified_selectors:
                verified_icon = page.query_selector(selector)
                if verified_icon:
                    profile["is_verified"] = True
                    # 获取认证类型（通过颜色判断）
                    try:
                        # 获取 SVG 的颜色
                        color = verified_icon.evaluate(
                            "el => getComputedStyle(el).color"
                        )
                        aria_label = verified_icon.get_attribute("aria-label") or ""

                        # 判断认证类型
                        if (
                            "gold" in color.lower()
                            or "rgb(255, 212, 0)" in color
                            or "affiliates" in aria_label.lower()
                        ):
                            profile["verification_type"] = "Gold"  # 企业/机构
                        elif (
                            "grey" in color.lower()
                            or "gray" in color.lower()
                            or "government" in aria_label.lower()
                        ):
                            profile["verification_type"] = "Grey"  # 政府
                        else:
                            profile["verification_type"] = "Blue"  # 个人/付费
                    except Exception:
                        profile["verification_type"] = "Blue"
                    break
        except Exception:
            pass

        # ========== 7. 提取 Bio ==========
        try:
            bio_element = page.query_selector('[data-testid="UserDescription"]')
            if bio_element:
                bio_text = bio_element.inner_text().strip()
                if bio_text:
                    profile["bio"] = bio_text[:1000]  # 限制长度
        except Exception:
            pass

        # ========== 8. 提取粉丝数 ==========
        try:
            followers_link = page.query_selector('a[href*="/verified_followers"]')
            if not followers_link:
                followers_link = page.query_selector('a[href*="/followers"]')
            if followers_link:
                text = followers_link.inner_text()
                profile["followers_count"] = parse_metric(text)
        except Exception:
            pass

        # ========== 9. 提取关注数 ==========
        try:
            following_link = page.query_selector('a[href*="/following"]')
            if following_link:
                text = following_link.inner_text()
                profile["following_count"] = parse_metric(text)
        except Exception:
            pass

        # ========== 10. 提取推文数 ==========
        try:
            # 推文数通常在 header 中显示，如 "156.9K posts"
            header_items = page.query_selector('[data-testid="UserName"]')
            if header_items:
                parent = header_items.evaluate(
                    "el => el.parentElement?.parentElement?.textContent"
                )
                if parent:
                    import re

                    posts_match = re.search(
                        r"([\d,.]+[KMB]?)\s*(?:posts?|tweets?)", parent, re.IGNORECASE
                    )
                    if posts_match:
                        profile["posts_count"] = parse_metric(posts_match.group(1))
            # 备用方案
            if profile["posts_count"] == 0:
                nav_items = page.query_selector_all("nav a span")
                for item in nav_items:
                    text = item.inner_text()
                    if "post" in text.lower() or "tweet" in text.lower():
                        profile["posts_count"] = parse_metric(text)
                        break
        except Exception:
            pass

        # ========== 11. 提取加入日期 ==========
        try:
            join_selectors = [
                '[data-testid="UserJoinDate"]',
                'span[data-testid="UserJoinDate"]',
            ]
            for selector in join_selectors:
                join_element = page.query_selector(selector)
                if join_element:
                    text = join_element.inner_text().strip()
                    # 提取 "Joined June 2014" 中的日期部分
                    if "Joined" in text:
                        profile["join_date"] = text.replace("Joined", "").strip()
                    else:
                        profile["join_date"] = text
                    break
        except Exception:
            pass

        # ========== 12. 提取位置 ==========
        try:
            location_selectors = [
                '[data-testid="UserLocation"]',
                '[data-testid="UserProfileHeader_Items"] span[data-testid="UserLocation"]',
            ]
            for selector in location_selectors:
                location_element = page.query_selector(selector)
                if location_element:
                    text = location_element.inner_text().strip()
                    if text:
                        profile["location"] = text
                        break
        except Exception:
            pass

        # ========== 13. 提取网站链接 ==========
        try:
            url_selectors = [
                '[data-testid="UserUrl"] a',
                '[data-testid="UserProfileHeader_Items"] a[href*="t.co"]',
                'a[data-testid="UserUrl"]',
            ]
            for selector in url_selectors:
                url_element = page.query_selector(selector)
                if url_element:
                    href = url_element.get_attribute("href")
                    text = url_element.inner_text().strip()
                    # 优先使用显示文本，因为 href 通常是 t.co 短链接
                    profile["website"] = text if text else href
                    break
        except Exception:
            pass

    except Exception as e:
        print(f"   ⚠️ 提取 profile 信息时出错: {e}")

    return profile


def extract_tweet_text(article) -> Optional[str]:
    """从 article 元素中提取推文文本（更宽容的版本）"""
    try:
        # 方法1: 使用 data-testid="tweetText"
        tweet_text_element = article.query_selector('[data-testid="tweetText"]')
        if tweet_text_element:
            text = tweet_text_element.inner_text().strip()
            if text:
                return text

        # 方法2: 查找带 lang 属性的 div
        lang_div = article.query_selector("div[lang]")
        if lang_div:
            text = lang_div.inner_text().strip()
            if text:
                return text

        # 方法3: 如果没有正文，检查是否有媒体内容 (图片/视频)
        media_photo = article.query_selector('[data-testid="tweetPhoto"]')
        media_video = article.query_selector('[data-testid="videoPlayer"]')
        media_card = article.query_selector('[data-testid="card.wrapper"]')

        if media_photo or media_video or media_card:
            # 尝试获取 alt 文本或描述
            img = article.query_selector("img[alt]")
            if img:
                alt = img.get_attribute("alt")
                if alt and alt != "Image":
                    return f"[媒体] {alt}"
            return "[媒体推文]"

        return None
    except Exception:
        return None


def extract_tweet_metadata(article) -> Dict:
    """
    从 article 元素中提取推文元数据

    提取字段：
    - created_at: 推文创建时间
    - permalink: 推文链接
    - avatar_url: KOL 头像 URL
    - media_urls: 图片/视频 URL 列表
    - is_repost: 是否是转发
    - original_author: 原作者（如果是转发）
    - reply_count, repost_count, like_count, bookmark_count, views_count
    """
    metadata = {
        "created_at": None,
        "permalink": None,
        "avatar_url": None,
        "media_urls": [],
        "is_repost": False,
        "original_author": None,
        "reply_count": 0,
        "repost_count": 0,
        "like_count": 0,
        "bookmark_count": 0,
        "views_count": 0,
    }

    try:
        # ========== 1. 提取时间 ==========
        time_element = article.query_selector("time")
        if time_element:
            metadata["created_at"] = time_element.get_attribute("datetime")

        # ========== 2. 提取链接 ==========
        link = article.query_selector('a[href*="/status/"]')
        if link:
            href = link.get_attribute("href")
            if href:
                metadata["permalink"] = (
                    f"https://x.com{href}" if href.startswith("/") else href
                )

        # ========== 3. 提取 KOL 头像 URL ==========
        # 推文内的头像在 article 内部的 img 元素，带有 profile_images
        try:
            # 方法1: 从推文头部的用户信息区域提取头像
            avatar_selectors = [
                '[data-testid="Tweet-User-Avatar"] img[src*="profile_images"]',
                'div[data-testid="Tweet-User-Avatar"] img',
                'a[role="link"] img[src*="profile_images"]',
            ]
            for selector in avatar_selectors:
                avatar_img = article.query_selector(selector)
                if avatar_img:
                    src = avatar_img.get_attribute("src")
                    if src and "profile_images" in src:
                        # 获取更高分辨率的头像
                        metadata["avatar_url"] = (
                            src.replace("_normal", "_400x400")
                            .replace("_bigger", "_400x400")
                            .replace("_mini", "_400x400")
                        )
                        break
        except Exception:
            pass

        # ========== 4. 检测是否是转发 (Repost) ==========
        try:
            # 转发会有 "reposted" 文字或特定的标识
            repost_indicators = [
                'span[data-testid="socialContext"]',  # 包含 "XXX reposted" 的区域
                'div[data-testid="socialContext"]',
            ]
            for selector in repost_indicators:
                social_context = article.query_selector(selector)
                if social_context:
                    text = social_context.inner_text().lower()
                    if "repost" in text or "retweeted" in text:
                        metadata["is_repost"] = True
                        # 尝试提取原作者
                        # 转发时，推文作者链接会指向原作者
                        author_link = article.query_selector(
                            'div[data-testid="User-Name"] a[href^="/"]'
                        )
                        if author_link:
                            href = author_link.get_attribute("href")
                            if href:
                                metadata["original_author"] = (
                                    href.lstrip("/").split("/")[0].split("?")[0]
                                )
                        break
        except Exception:
            pass

        # ========== 5. 提取媒体 URLs (图片和视频) ==========
        try:
            media_urls = []

            # 5a. 提取图片 URLs
            photo_elements = article.query_selector_all(
                '[data-testid="tweetPhoto"] img'
            )
            for photo in photo_elements:
                src = photo.get_attribute("src")
                if src and "profile_images" not in src and "emoji" not in src:
                    # 获取原图尺寸
                    # Twitter 图片 URL 格式: https://pbs.twimg.com/media/xxx?format=jpg&name=small
                    # 改为 name=large 或 name=orig 获取高清图
                    if "twimg.com/media" in src:
                        if "name=" in src:
                            src = src.split("name=")[0] + "name=large"
                        elif "?" not in src:
                            src = src + "?name=large"
                    media_urls.append({"type": "photo", "url": src})

            # 5b. 提取视频 URLs
            video_elements = article.query_selector_all(
                '[data-testid="videoPlayer"] video'
            )
            for video in video_elements:
                src = video.get_attribute("src")
                poster = video.get_attribute("poster")
                if src:
                    media_urls.append({"type": "video", "url": src, "poster": poster})
                elif poster:
                    # 如果没有直接的 video src，至少保存封面图
                    media_urls.append({"type": "video", "url": None, "poster": poster})

            # 5c. 如果没找到直接的视频源，尝试找视频封面
            if not any(m["type"] == "video" for m in media_urls):
                video_container = article.query_selector('[data-testid="videoPlayer"]')
                if video_container:
                    # 视频封面图
                    poster_img = video_container.query_selector(
                        'img[src*="ext_tw_video"]'
                    )
                    if poster_img:
                        poster_src = poster_img.get_attribute("src")
                        if poster_src:
                            media_urls.append(
                                {"type": "video", "url": None, "poster": poster_src}
                            )

            # 5d. 提取 GIF
            gif_elements = article.query_selector_all(
                '[data-testid="tweetPhoto"] video[poster*="tweet_video_thumb"]'
            )
            for gif in gif_elements:
                src = gif.get_attribute("src")
                poster = gif.get_attribute("poster")
                if src or poster:
                    media_urls.append({"type": "gif", "url": src, "poster": poster})

            # 5e. 提取卡片中的图片 (链接预览等)
            card_img = article.query_selector(
                '[data-testid="card.wrapper"] img[src*="twimg.com"]'
            )
            if card_img:
                src = card_img.get_attribute("src")
                if src and "profile_images" not in src:
                    media_urls.append({"type": "card", "url": src})

            metadata["media_urls"] = media_urls

        except Exception:
            pass

        # ========== 6. 提取互动数据 ==========
        def parse_aria_count(element) -> int:
            """从元素的 aria-label 解析数量"""
            try:
                if element:
                    aria_label = element.get_attribute("aria-label")
                    if aria_label:
                        import re

                        # 匹配各种格式: "123 replies", "1,234 Likes", "12.5K views"
                        match = re.search(r"([\d,.]+[KMB]?)", aria_label)
                        if match:
                            return parse_metric(match.group(1))
            except:
                pass
            return 0

        # 6a. Reply count
        reply_btn = article.query_selector('[data-testid="reply"]')
        metadata["reply_count"] = parse_aria_count(reply_btn)

        # 6b. Repost/Retweet count
        retweet_btn = article.query_selector('[data-testid="retweet"]')
        metadata["repost_count"] = parse_aria_count(retweet_btn)

        # 6c. Like count
        like_btn = article.query_selector('[data-testid="like"]')
        metadata["like_count"] = parse_aria_count(like_btn)

        # 6d. Bookmark count (可能没有显示)
        bookmark_btn = article.query_selector('[data-testid="bookmark"]')
        metadata["bookmark_count"] = parse_aria_count(bookmark_btn)

        # 6e. Views count - 通常在 analytics 链接或单独的区域
        try:
            # 方法1: 从 analytics 区域获取
            views_element = article.query_selector('a[href*="/analytics"] span')
            if views_element:
                views_text = views_element.inner_text()
                metadata["views_count"] = parse_metric(views_text)

            # 方法2: 从 aria-label 包含 "views" 的元素获取
            if metadata["views_count"] == 0:
                analytics_link = article.query_selector('a[href*="/analytics"]')
                if analytics_link:
                    aria = analytics_link.get_attribute("aria-label")
                    if aria and "view" in aria.lower():
                        import re

                        match = re.search(
                            r"([\d,.]+[KMB]?)\s*view", aria, re.IGNORECASE
                        )
                        if match:
                            metadata["views_count"] = parse_metric(match.group(1))
        except Exception:
            pass

    except Exception:
        pass

    return metadata


# ============================================================
# 核心爬虫类
# ============================================================


class BatchKOLScraper:
    """
    批量 KOL 爬虫类

    支持两种模式:
    1. Setup Mode: headless=False，用于手动登录并保存 cookies
    2. Batch Mode: 利用已保存的 cookies 进行批量爬取
    """

    def __init__(
        self,
        cookies_file: str = None,
        headless: bool = False,
        max_posts_per_user: int = 10,
        delay_between_users: Tuple[float, float] = (5.0, 15.0),
        delay_during_scroll: Tuple[float, float] = (1.0, 3.0),
    ):
        """
        初始化爬虫

        Args:
            cookies_file: cookies 文件路径
            headless: 是否使用无头模式
            max_posts_per_user: 每个用户最多爬取的推文数量
            delay_between_users: 用户间延迟范围 (min, max) 秒
            delay_during_scroll: 滚动时延迟范围 (min, max) 秒
        """
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError(
                "❌ Playwright 未安装。请运行:\n"
                "   pip install playwright\n"
                "   playwright install chromium"
            )

        self.cookies_file = str(cookies_file or COOKIES_FILE)
        self.headless = headless
        self.max_posts_per_user = max_posts_per_user
        self.delay_between_users = delay_between_users
        self.delay_during_scroll = delay_during_scroll

        # 统计信息
        self.stats = {
            "users_processed": 0,
            "users_failed": 0,
            "tweets_scraped": 0,
            "tweets_new": 0,
            "tweets_duplicate": 0,
        }

        # 初始化 Supabase 客户端
        self.supabase = get_supabase_client()
        if self.supabase:
            print("✅ Supabase 连接成功")
        else:
            print("⚠️ Supabase 未连接，将只打印推文而不保存")

    def setup_mode(self, timeout: int = 300) -> bool:
        """
        Setup 模式: 打开浏览器让用户手动登录

        Args:
            timeout: 等待登录的超时时间（秒）

        Returns:
            bool: 登录成功返回 True
        """
        print("\n" + "=" * 60)
        print("🔧 SETUP MODE - 请手动登录 X.com")
        print("=" * 60)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,  # Setup 模式必须有头
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ],
            )

            context = browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 900},
                locale="en-US",
                timezone_id="America/New_York",
            )

            page = context.new_page()
            self._add_stealth_scripts(page)

            try:
                print("📱 正在打开 X.com...")
                page.goto(
                    "https://x.com/login", wait_until="domcontentloaded", timeout=60000
                )

                print("\n" + "⚠️ " * 20)
                print("请在浏览器窗口中完成登录！")
                print(f"超时时间: {timeout} 秒")
                print("⚠️ " * 20 + "\n")

                # 等待用户完成登录（检测主页元素）
                try:
                    page.wait_for_selector(
                        '[data-testid="primaryColumn"]',
                        timeout=timeout * 1000,
                        state="visible",
                    )
                    print("✅ 检测到已登录！")

                    # 保存 cookies
                    cookies = context.cookies()
                    if save_cookies(cookies, self.cookies_file):
                        print("✅ Setup 完成！现在可以运行 Batch Mode 了。")
                        return True

                except Exception as e:
                    print(f"❌ 登录超时或失败: {e}")
                    return False

            finally:
                print("\n浏览器将在 3 秒后关闭...")
                time.sleep(3)
                browser.close()

        return False

    def _add_stealth_scripts(self, page: "Page") -> None:
        """添加反检测脚本"""
        page.add_init_script(
            """
            // 隐藏 webdriver 属性
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // 模拟真实的 plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // 模拟真实的 languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // 隐藏自动化痕迹
            window.chrome = { runtime: {} };
        """
        )

    def _scrape_single_user(
        self,
        page: "Page",
        username: str,
        category: str = None,
        description: str = None,
    ) -> List[Dict]:
        """
        爬取单个用户的推文和 profile 信息

        Args:
            page: Playwright 页面对象
            username: 用户名
            category: KOL 类别
            description: KOL 描述（来自预定义列表）

        Returns:
            List[Dict]: 爬取到的推文列表
        """
        clean_username = username.lstrip("@").strip()
        profile_url = f"https://x.com/{clean_username}"

        # 使用搜索 URL 并按时间排序（f=live 表示最新）
        # 不在搜索中限制时间，而是在 insert_tweet 时过滤旧推文
        # 这样可以确保搜索有结果，同时只保存最新的推文
        search_url = (
            f"https://x.com/search?q=from%3A{clean_username}&src=typed_query&f=live"
        )

        collected_tweets = []
        seen_texts: Set[str] = set()

        print(f"\n📍 正在访问 @{clean_username}...")

        try:
            # ========== 第一步：访问用户主页获取 Profile 信息 ==========
            page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            random_sleep(2, 4)

            # 检测是否成功加载用户页面
            try:
                page.wait_for_selector("article", timeout=15000, state="visible")
            except Exception:
                print(f"   ⚠️ 无法加载 @{clean_username} 的页面（可能不存在或被封禁）")
                return []

            # ========== 提取并保存 Profile 信息 ==========
            profile_data = extract_user_profile(page)
            profile_data["username"] = clean_username  # 确保用户名正确

            if self.supabase:
                if upsert_user_profile(
                    self.supabase, profile_data, category, description
                ):
                    self.stats["profiles_updated"] = (
                        self.stats.get("profiles_updated", 0) + 1
                    )
                    # 打印 profile 信息
                    display_name = profile_data.get("display_name", clean_username)
                    followers = profile_data.get("followers_count", 0)
                    following = profile_data.get("following_count", 0)
                    posts = profile_data.get("posts_count", 0)
                    verified = profile_data.get("verification_type", "None")

                    # 认证徽章
                    badge = ""
                    if verified == "Gold":
                        badge = "🏢"
                    elif verified == "Blue":
                        badge = "✓"
                    elif verified == "Grey":
                        badge = "🏛️"

                    print(f"   👤 {display_name} {badge}")
                    print(
                        f"      📊 粉丝: {followers:,} | 关注: {following:,} | 推文: {posts:,}"
                    )

                    # 额外信息
                    extras = []
                    if profile_data.get("avatar_url"):
                        extras.append("头像✓")
                    if profile_data.get("banner_url"):
                        extras.append("背景✓")
                    if profile_data.get("location"):
                        extras.append(f"📍{profile_data['location']}")
                    if profile_data.get("join_date"):
                        extras.append(f"📅{profile_data['join_date']}")
                    if profile_data.get("website"):
                        extras.append(f"🔗")

                    if extras:
                        print(f"      {' | '.join(extras)}")

            # ========== 第二步：跳转到搜索页面获取最新推文（按时间排序）==========
            print(f"   🔍 切换到最新推文视图 (搜索: from:{clean_username})...")
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            random_sleep(2, 4)

            # 等待搜索结果加载
            try:
                page.wait_for_selector("article", timeout=15000, state="visible")
            except Exception:
                # 截图保存，方便调试
                debug_path = f"debug_{clean_username}.png"
                try:
                    page.screenshot(path=debug_path)
                    print(f"   ⚠️ 搜索结果为空或加载失败，截图已保存: {debug_path}")
                except:
                    print(f"   ⚠️ 搜索结果为空或加载失败")

                # 检查是否有错误提示或需要验证
                page_content = page.content().lower()
                if "verify" in page_content or "captcha" in page_content:
                    print(f"   🔒 检测到验证码/人机验证，请重新运行 --setup 登录")
                elif "something went wrong" in page_content:
                    print(f"   ❌ 页面显示 'Something went wrong'，可能是账号问题")
                elif "log in" in page_content or "sign in" in page_content:
                    print(f"   🔑 需要登录，请删除 cookies 文件并重新运行 --setup")

                return []

            # 滚动和爬取最新推文
            scroll_count = 0
            max_scrolls = 10
            no_new_count = 0

            while (
                len(collected_tweets) < self.max_posts_per_user
                and scroll_count < max_scrolls
            ):
                scroll_count += 1

                articles = page.query_selector_all("article")
                new_in_batch = 0

                for article in articles:
                    if len(collected_tweets) >= self.max_posts_per_user:
                        break

                    text = extract_tweet_text(article)

                    if text and text not in seen_texts:
                        seen_texts.add(text)
                        metadata = extract_tweet_metadata(article)

                        tweet_data = {
                            "username": clean_username,
                            "text": text,
                            **metadata,
                        }

                        collected_tweets.append(tweet_data)
                        new_in_batch += 1

                        # 保存到 Supabase
                        if self.supabase:
                            if insert_tweet(self.supabase, tweet_data, category):
                                self.stats["tweets_new"] += 1
                                # 显示推文时间，方便确认是否是最新推文
                                created_at = metadata.get("created_at", "")
                                time_str = created_at[:16] if created_at else "未知时间"
                                print(
                                    f"   ✅ [{len(collected_tweets)}/{self.max_posts_per_user}] 🕐{time_str} | {text[:40]}..."
                                )
                            else:
                                self.stats["tweets_duplicate"] += 1
                                print(
                                    f"   📋 [{len(collected_tweets)}/{self.max_posts_per_user}] 已存在: {text[:40]}..."
                                )
                        else:
                            created_at = metadata.get("created_at", "")
                            time_str = created_at[:16] if created_at else "未知时间"
                            print(
                                f"   📝 [{len(collected_tweets)}/{self.max_posts_per_user}] 🕐{time_str} | {text[:40]}..."
                            )

                if new_in_batch == 0:
                    no_new_count += 1
                    if no_new_count >= 2:
                        break
                else:
                    no_new_count = 0

                if len(collected_tweets) >= self.max_posts_per_user:
                    break

                # 滚动页面
                page.evaluate(
                    """
                    window.scrollBy({
                        top: window.innerHeight * 0.8,
                        behavior: 'smooth'
                    });
                """
                )

                random_sleep(*self.delay_during_scroll)

                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except:
                    pass

            self.stats["tweets_scraped"] += len(collected_tweets)

            # 如果没有找到任何推文，截图调试
            if len(collected_tweets) == 0:
                debug_path = f"debug_empty_{clean_username}.png"
                try:
                    page.screenshot(path=debug_path)
                    print(f"   ⚠️ 未找到推文，截图已保存: {debug_path}")
                except:
                    pass
            else:
                print(
                    f"   📊 @{clean_username}: 爬取 {len(collected_tweets)} 条最新推文"
                )

        except Exception as e:
            print(f"   ❌ 爬取 @{clean_username} 失败: {e}")
            # 截图保存错误现场
            try:
                page.screenshot(path=f"error_{clean_username}.png")
                print(f"   📸 错误截图已保存: error_{clean_username}.png")
            except:
                pass
            self.stats["users_failed"] += 1

        return collected_tweets

    def batch_scrape(
        self,
        kol_list: List[Tuple[str, str]] = None,
        categories: List[str] = None,
    ) -> Dict:
        """
        批量爬取 KOL 推文

        Args:
            kol_list: 自定义 KOL 列表 [(username, description), ...]
                      如果为 None，使用默认的 KOL_LIST
            categories: 要爬取的类别列表，如 ["news_flow", "short_macro"]
                        如果为 None，爬取所有类别

        Returns:
            Dict: 统计信息
        """
        # 准备 KOL 列表
        if kol_list is not None:
            targets = [(username, None, desc) for username, desc in kol_list]
        else:
            targets = []
            for cat_name, cat_kols in KOL_LIST.items():
                if categories is None or cat_name in categories:
                    for username, desc in cat_kols:
                        targets.append((username, cat_name, desc))

        if not targets:
            print("❌ 没有要爬取的 KOL")
            return self.stats

        # 检查 cookies
        cookies = load_cookies(self.cookies_file)
        if cookies is None:
            print("\n❌ 未找到 cookies 文件！")
            print("请先运行 Setup Mode 进行登录:")
            print("   python -m app.services.batch_kol_scraper --setup")
            return self.stats

        print("\n" + "=" * 60)
        print(f"🚀 BATCH MODE - 开始批量爬取")
        print(f"📋 目标: {len(targets)} 个 KOL")
        print(f"📝 每用户最多: {self.max_posts_per_user} 条推文")
        print(f"💾 存储: {'Supabase' if self.supabase else '仅打印'}")
        print("=" * 60)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ],
            )

            context = browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 900},
                locale="en-US",
                timezone_id="America/New_York",
            )

            # 加载 cookies
            context.add_cookies(cookies)

            page = context.new_page()
            self._add_stealth_scripts(page)

            try:
                for i, (username, category, description) in enumerate(targets, 1):
                    print(f"\n[{i}/{len(targets)}] 🎯 @{username}")
                    if description:
                        print(f"   📝 {description}")

                    self._scrape_single_user(page, username, category, description)
                    self.stats["users_processed"] += 1

                    # 用户间延迟（最后一个用户不需要）
                    if i < len(targets):
                        random_sleep(
                            *self.delay_between_users, f"切换到下一个用户前等待"
                        )

            except KeyboardInterrupt:
                print("\n\n⚠️ 用户中断，正在保存数据...")

            except Exception as e:
                print(f"\n❌ 爬取过程出错: {e}")

            finally:
                # 更新 cookies（可能已刷新）
                try:
                    new_cookies = context.cookies()
                    save_cookies(new_cookies, self.cookies_file)
                except:
                    pass

                browser.close()

        # 打印最终统计
        self._print_final_stats()

        return self.stats

    def _print_final_stats(self) -> None:
        """打印最终统计信息"""
        print("\n" + "=" * 60)
        print("📊 爬取完成！统计信息:")
        print("=" * 60)
        print(f"  ✅ 处理用户: {self.stats['users_processed']}")
        print(f"  ❌ 失败用户: {self.stats['users_failed']}")
        print(f"  👤 更新 Profile: {self.stats.get('profiles_updated', 0)}")
        print(f"  📝 爬取推文: {self.stats['tweets_scraped']}")
        print(f"  🆕 新增推文: {self.stats['tweets_new']}")
        print(f"  📋 重复推文: {self.stats['tweets_duplicate']}")
        print("=" * 60)

        # 数据库统计
        if self.supabase:
            db_stats = get_stats(self.supabase)
            print(f"\n📦 Supabase 数据库总计: {db_stats['total']} 条推文")

            # 统计 kol_profiles 表数量
            try:
                profiles_result = (
                    self.supabase.table("kol_profiles")
                    .select("username, verification_type", count="exact")
                    .execute()
                )
                total_profiles = profiles_result.count or 0
                print(f"👤 KOL Profiles: {total_profiles} 个")

                # 按认证类型统计
                if profiles_result.data:
                    verified_counts = {}
                    for profile in profiles_result.data:
                        v_type = profile.get("verification_type") or "None"
                        verified_counts[v_type] = verified_counts.get(v_type, 0) + 1
                    if verified_counts and any(k != "None" for k in verified_counts):
                        badges = {"Gold": "🏢", "Blue": "✓", "Grey": "🏛️", "None": "○"}
                        parts = [
                            f"{badges.get(k, '')} {k}: {v}"
                            for k, v in verified_counts.items()
                        ]
                        print(f"   认证: {' | '.join(parts)}")
            except Exception:
                pass

            if db_stats["by_category"]:
                print("\n按类别统计:")
                for cat, count in db_stats["by_category"].items():
                    print(f"  - {cat}: {count} 条")

    def close(self) -> None:
        """关闭资源（保留接口兼容性）"""
        pass


# ============================================================
# 数据迁移工具
# ============================================================


def migrate_sqlite_to_supabase(sqlite_path: str) -> int:
    """
    将 SQLite 数据迁移到 Supabase

    Args:
        sqlite_path: SQLite 数据库文件路径

    Returns:
        int: 迁移的记录数
    """
    import sqlite3

    supabase = get_supabase_client()
    if not supabase:
        print("❌ 无法连接 Supabase")
        return 0

    if not os.path.exists(sqlite_path):
        print(f"❌ SQLite 文件不存在: {sqlite_path}")
        return 0

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tweets")
    rows = cursor.fetchall()

    migrated = 0
    for row in rows:
        try:
            data = {
                "username": row["username"],
                "tweet_text": row["tweet_text"],
                "tweet_hash": row["tweet_hash"],
                "created_at": row["created_at"],
                "permalink": row["permalink"],
                "like_count": row["like_count"] or 0,
                "retweet_count": row["retweet_count"] or 0,
                "reply_count": row["reply_count"] or 0,
                "scraped_at": row["scraped_at"],
                "category": row["category"],
            }
            supabase.table("kol_tweets").upsert(
                data, on_conflict="tweet_hash"
            ).execute()
            migrated += 1
            print(f"  ✅ 迁移: @{row['username']}: {row['tweet_text'][:30]}...")
        except Exception as e:
            print(f"  ⚠️ 跳过: {e}")

    conn.close()
    print(f"\n✅ 迁移完成: {migrated}/{len(rows)} 条记录")
    return migrated


# ============================================================
# CLI 入口点
# ============================================================


def main():
    """命令行入口"""
    import argparse

    parser = argparse.ArgumentParser(
        description="美股 KOL 批量爬虫 (Supabase 版)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # Setup 模式 - 首次运行，手动登录保存 cookies
  python -m app.services.batch_kol_scraper --setup
  
  # Batch 模式 - 批量爬取所有 KOL
  python -m app.services.batch_kol_scraper
  
  # 只爬取特定类别
  python -m app.services.batch_kol_scraper --categories news_flow short_macro
  
  # 使用有头模式（可见浏览器）
  python -m app.services.batch_kol_scraper --no-headless
  
  # 查看数据库统计
  python -m app.services.batch_kol_scraper --stats
  
  # 从 SQLite 迁移数据到 Supabase
  python -m app.services.batch_kol_scraper --migrate kol_tweets.db
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
        "--categories",
        nargs="+",
        choices=list(KOL_LIST.keys()),
        help="指定要爬取的 KOL 类别",
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
        if stats["by_category"]:
            print("\n📁 按类别统计:")
            for cat, count in stats["by_category"].items():
                print(f"  {cat}: {count}")
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
        else:
            # Batch 模式
            scraper.batch_scrape(categories=args.categories)

    finally:
        scraper.close()


if __name__ == "__main__":
    main()

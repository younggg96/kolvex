"""
小红书帖子数据库操作
"""

import os
import json
import hashlib
import requests
import time
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import uuid

# Supabase 相关导入
try:
    from supabase import create_client, Client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .config import DEFAULT_POST_MAX_AGE_DAYS

# ============================================================
# 图片下载和上传相关
# ============================================================

# 小红书图片下载请求头
XHS_IMAGE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.xiaohongshu.com/",
    "Origin": "https://www.xiaohongshu.com",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
}

# Supabase Storage bucket 名称
XHS_STORAGE_BUCKET = "xhs-images"


def download_image(url: str, timeout: int = 10) -> Optional[bytes]:
    """
    下载图片

    Args:
        url: 图片 URL
        timeout: 超时时间（秒）

    Returns:
        Optional[bytes]: 图片二进制数据，失败返回 None
    """
    if not url:
        return None

    try:
        response = requests.get(
            url,
            headers=XHS_IMAGE_HEADERS,
            timeout=timeout,
            allow_redirects=True,
        )
        if response.status_code == 200:
            return response.content
        else:
            print(f"      ⚠️ 图片下载失败 ({response.status_code}): {url[:60]}...")
            return None
    except Exception as e:
        print(f"      ⚠️ 图片下载异常: {e}")
        return None


def upload_image_to_storage(
    client: Client,
    image_data: bytes,
    note_id: str,
    image_index: int = 0,
    image_type: str = "image",
) -> Optional[str]:
    """
    上传图片到 Supabase Storage

    Args:
        client: Supabase 客户端
        image_data: 图片二进制数据
        note_id: 小红书笔记 ID
        image_index: 图片索引（同一帖子多张图片时区分）
        image_type: 图片类型 (image/cover/avatar/video_cover)

    Returns:
        Optional[str]: 上传成功返回公开 URL，失败返回 None
    """
    if not image_data:
        return None

    try:
        # 生成唯一文件名
        timestamp = int(time.time() * 1000)
        unique_id = uuid.uuid4().hex[:8]
        file_name = f"{note_id}_{image_type}_{image_index}_{timestamp}_{unique_id}.webp"
        file_path = f"posts/{file_name}"

        # 上传到 Storage
        response = client.storage.from_(XHS_STORAGE_BUCKET).upload(
            path=file_path,
            file=image_data,
            file_options={
                "cache-control": "31536000",  # 1 年缓存
                "upsert": "true",
                "content-type": "image/webp",
            },
        )

        # 获取公开 URL
        public_url = client.storage.from_(XHS_STORAGE_BUCKET).get_public_url(file_path)

        return public_url

    except Exception as e:
        error_msg = str(e)
        if "Bucket not found" in error_msg:
            print(f"      ⚠️ Storage bucket '{XHS_STORAGE_BUCKET}' 不存在，请先创建")
        else:
            print(f"      ⚠️ 图片上传失败: {e}")
        return None


def process_and_upload_images(
    client: Client,
    post_data: Dict,
) -> Dict:
    """
    处理帖子中的所有图片：下载并上传到 Supabase Storage

    Args:
        client: Supabase 客户端
        post_data: 帖子数据

    Returns:
        Dict: 更新后的帖子数据（图片 URL 已替换为 Supabase Storage URL）
    """
    note_id = post_data.get("note_id", "unknown")
    updated_data = post_data.copy()

    # 1. 处理封面图
    cover_url = post_data.get("cover_url")
    if cover_url and "xhscdn.com" in cover_url:
        print(f"      📥 下载封面图...")
        image_data = download_image(cover_url)
        if image_data:
            new_url = upload_image_to_storage(
                client, image_data, note_id, 0, "cover"
            )
            if new_url:
                updated_data["cover_url"] = new_url
                print(f"      ✅ 封面图已转存")

    # 2. 处理作者头像
    author_avatar = post_data.get("author_avatar")
    if author_avatar and "xhscdn.com" in author_avatar:
        print(f"      📥 下载作者头像...")
        image_data = download_image(author_avatar)
        if image_data:
            author_id = post_data.get("author_id", "unknown")
            new_url = upload_image_to_storage(
                client, image_data, f"avatar_{author_id}", 0, "avatar"
            )
            if new_url:
                updated_data["author_avatar"] = new_url
                print(f"      ✅ 作者头像已转存")

    # 3. 处理图片列表
    image_urls = post_data.get("image_urls", [])
    if image_urls:
        new_image_urls = []
        for i, img_url in enumerate(image_urls):
            if img_url and "xhscdn.com" in img_url:
                print(f"      📥 下载图片 {i+1}/{len(image_urls)}...")
                image_data = download_image(img_url)
                if image_data:
                    new_url = upload_image_to_storage(
                        client, image_data, note_id, i, "image"
                    )
                    if new_url:
                        new_image_urls.append(new_url)
                        print(f"      ✅ 图片 {i+1} 已转存")
                    else:
                        # 上传失败，保留原 URL（可能已过期）
                        new_image_urls.append(img_url)
                else:
                    new_image_urls.append(img_url)
            else:
                new_image_urls.append(img_url)

        updated_data["image_urls"] = new_image_urls

    return updated_data


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


def compute_post_hash(note_id: str, content: str) -> str:
    """
    计算帖子的唯一哈希值

    Args:
        note_id: 小红书笔记 ID
        content: 帖子内容

    Returns:
        str: SHA256 哈希值的前 16 位
    """
    unique_content = f"xhs:{note_id}:{content[:200]}"
    return hashlib.sha256(unique_content.encode()).hexdigest()[:16]


def post_exists(client: Client, post_hash: str) -> bool:
    """
    检查帖子是否已存在于数据库中

    Args:
        client: Supabase 客户端
        post_hash: 帖子哈希值

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("xhs_posts")
            .select("id")
            .eq("post_hash", post_hash)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查帖子是否存在失败: {e}")
        return False


def note_id_exists(client: Client, note_id: str) -> bool:
    """
    检查笔记 ID 是否已存在

    Args:
        client: Supabase 客户端
        note_id: 小红书笔记 ID

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("xhs_posts")
            .select("id")
            .eq("note_id", note_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查笔记 ID 是否存在失败: {e}")
        return False


def insert_post(
    client: Client,
    post_data: Dict,
    max_age_days: int = DEFAULT_POST_MAX_AGE_DAYS,
    enable_ai_analysis: bool = True,
    upload_images: bool = True,
) -> Tuple[bool, Optional[int]]:
    """
    插入帖子到 Supabase 数据库（如果不存在且不太旧），并进行 AI 分析

    Args:
        client: Supabase 客户端
        post_data: 帖子数据字典，包含:
            - note_id: 小红书笔记 ID
            - title: 标题
            - content: 帖子内容
            - author_name: 作者名称
            - author_id: 作者 ID
            - author_avatar: 作者头像 URL
            - cover_url: 封面图 URL
            - image_urls: 图片 URL 列表
            - video_url: 视频 URL（如果是视频笔记）
            - like_count: 点赞数
            - collect_count: 收藏数
            - comment_count: 评论数
            - share_count: 分享数
            - tags: 标签列表
            - note_type: 笔记类型（normal/video）
            - permalink: 帖子链接
            - created_at: 创建时间
        max_age_days: 最大帖子年龄（天），超过此天数的帖子不会被插入
        enable_ai_analysis: 是否启用 AI 分析（默认 True）
        upload_images: 是否下载并上传图片到 Supabase Storage（默认 True）

    Returns:
        Tuple[bool, Optional[int]]: (插入成功返回 True，帖子 ID 或 None)
    """
    note_id = post_data.get("note_id")
    
    # 检查笔记 ID 是否已存在（快速去重）
    if note_id and note_id_exists(client, note_id):
        return False, None
    
    # 检查帖子时间，如果太旧就跳过
    created_at_str = post_data.get("created_at")
    if created_at_str:
        try:
            # 解析时间
            if isinstance(created_at_str, str):
                if created_at_str.endswith("Z"):
                    created_at_str = created_at_str[:-1] + "+00:00"
                post_time = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            else:
                post_time = created_at_str

            # 如果是 naive datetime，假设为 UTC+8
            if post_time.tzinfo is None:
                post_time = post_time.replace(tzinfo=timezone(timedelta(hours=8)))

            cutoff_time = datetime.now(timezone.utc) - timedelta(days=max_age_days)

            if post_time < cutoff_time:
                print(
                    f"   ⏭️ 跳过旧帖子 ({str(created_at_str)[:10]}): {post_data.get('title', '')[:30]}..."
                )
                return False, None
        except Exception:
            # 解析失败就继续插入
            pass

    content = post_data.get("content", "") or post_data.get("title", "")
    post_hash = compute_post_hash(note_id or "", content)

    if post_exists(client, post_hash):
        return False, None

    # 🖼️ 下载并上传图片到 Supabase Storage（避免小红书链接过期）
    if upload_images:
        print(f"   🖼️ 正在转存图片到 Supabase Storage...")
        post_data = process_and_upload_images(client, post_data)

    # 进行 AI 分析（在插入前）
    ai_analysis = None
    if enable_ai_analysis:
        ai_analysis = _perform_ai_analysis(content, post_data.get("title", ""))

    try:
        # 处理列表字段 - 转换为 JSON
        image_urls = post_data.get("image_urls", [])
        image_urls_json = json.dumps(image_urls) if image_urls else None
        
        tags = post_data.get("tags", [])
        tags_json = json.dumps(tags) if tags else None

        # 辅助函数：安全截断字符串
        def safe_str(value, max_len: int) -> Optional[str]:
            if value is None:
                return None
            return str(value)[:max_len] if value else None

        data = {
            # 基础信息（按数据库字段长度截断）
            "note_id": safe_str(note_id, 64),
            "post_hash": post_hash,
            "title": post_data.get("title"),
            "content": content,
            "author_name": safe_str(post_data.get("author_name"), 255),
            "author_id": safe_str(post_data.get("author_id"), 64),
            "author_avatar": post_data.get("author_avatar"),
            "cover_url": post_data.get("cover_url"),
            "image_urls": image_urls_json,
            "video_url": post_data.get("video_url"),
            "note_type": safe_str(post_data.get("note_type", "normal"), 20),
            "permalink": post_data.get("permalink"),
            # 互动数据
            "like_count": post_data.get("like_count", 0),
            "collect_count": post_data.get("collect_count", 0),
            "comment_count": post_data.get("comment_count", 0),
            "share_count": post_data.get("share_count", 0),
            # 标签
            "tags": tags_json,
            # 搜索关键词
            "search_keyword": safe_str(post_data.get("search_keyword"), 100),
            # 时间
            "created_at": post_data.get("created_at"),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

        # 添加 AI 分析结果
        if ai_analysis:
            stock_related_data = ai_analysis.get("is_stock_related", {})
            trading_signal = ai_analysis.get("trading_signal")
            # 处理 trading_signal 可能是 dict 的情况
            if isinstance(trading_signal, dict):
                trading_signal = trading_signal.get("action")
            
            data.update(
                {
                    # 情感分析（VARCHAR(20)）
                    "ai_sentiment": safe_str(
                        ai_analysis.get("sentiment", {}).get("sentiment"), 20
                    ),
                    "ai_sentiment_confidence": ai_analysis.get("sentiment", {}).get(
                        "confidence"
                    ),
                    "ai_sentiment_reasoning": ai_analysis.get("sentiment", {}).get(
                        "reasoning"
                    ),
                    # 股票代码和标签 (JSONB)
                    "ai_tickers": ai_analysis.get("tickers", []),
                    "ai_tags": ai_analysis.get("tags", []),
                    # 摘要和投资信号（VARCHAR(20)）
                    "ai_summary": ai_analysis.get("summary"),
                    "ai_trading_signal": safe_str(trading_signal, 20),
                    # 股市相关性
                    "ai_is_stock_related": stock_related_data.get(
                        "is_stock_related", False
                    ),
                    "ai_stock_related_confidence": stock_related_data.get("confidence"),
                    "ai_stock_related_reason": stock_related_data.get("reason"),
                    # 元数据（VARCHAR(50)）
                    "ai_analyzed_at": ai_analysis.get("analyzed_at"),
                    "ai_model": safe_str(ai_analysis.get("model"), 50),
                }
            )

        result = client.table("xhs_posts").insert(data).execute()
        # 获取插入的帖子 ID
        post_id = result.data[0]["id"] if result.data else None
        return True, post_id
    except Exception as e:
        # 可能是唯一约束冲突（并发情况）
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        print(f"⚠️ 插入帖子失败: {e}")
        return False, None


# AI 分析器单例（避免重复创建）
_ai_analyzer = None


def _get_ai_analyzer():
    """获取 AI 分析器单例"""
    global _ai_analyzer
    if _ai_analyzer is None:
        try:
            from app.services.ai import TweetAnalyzerSync, OllamaClientSync

            client = OllamaClientSync()
            # 先检查 AI 服务是否可用
            if client.health_check():
                _ai_analyzer = TweetAnalyzerSync(client)
                print("🤖 AI 分析器已初始化")
            else:
                print("⚠️ AI 服务不可用，跳过 AI 分析")
                _ai_analyzer = False  # 标记为不可用
        except Exception as e:
            print(f"⚠️ AI 分析器初始化失败: {e}")
            _ai_analyzer = False
    return _ai_analyzer if _ai_analyzer else None


def _perform_ai_analysis(content: str, title: str = "") -> Optional[Dict]:
    """
    执行 AI 分析（同步）

    Args:
        content: 帖子内容
        title: 帖子标题

    Returns:
        Optional[Dict]: 分析结果，失败返回 None
    """
    analyzer = _get_ai_analyzer()
    if not analyzer:
        return None

    try:
        # 合并标题和内容进行分析
        full_text = f"{title}\n{content}" if title else content
        analysis = analyzer.basic_analysis(full_text)
        sentiment = analysis.get("sentiment", {}).get("sentiment", "neutral")
        tickers = analysis.get("tickers", [])
        print(f"   🤖 AI: {sentiment} | 股票: {tickers if tickers else '无'}")
        return analysis
    except Exception as e:
        print(f"   ⚠️ AI 分析失败: {e}")
        return None


def get_stats(client: Client) -> Dict:
    """
    获取数据库统计信息

    Returns:
        Dict: 包含总数、各关键词数量等统计信息
    """
    try:
        # 总帖子数
        total_result = client.table("xhs_posts").select("id", count="exact").execute()
        total = total_result.count or 0

        # 按搜索关键词统计
        by_keyword = {}
        try:
            result = client.table("xhs_posts").select("search_keyword").execute()
            for row in result.data:
                keyword = row.get("search_keyword") or "未知"
                by_keyword[keyword] = by_keyword.get(keyword, 0) + 1
        except Exception:
            pass

        # 按股票相关性统计
        stock_related_count = 0
        try:
            result = (
                client.table("xhs_posts")
                .select("id", count="exact")
                .eq("ai_is_stock_related", True)
                .execute()
            )
            stock_related_count = result.count or 0
        except Exception:
            pass

        return {
            "total": total,
            "by_keyword": dict(
                sorted(by_keyword.items(), key=lambda x: x[1], reverse=True)
            ),
            "stock_related": stock_related_count,
        }
    except Exception as e:
        print(f"⚠️ 获取统计信息失败: {e}")
        return {"total": 0, "by_keyword": {}, "stock_related": 0}


def get_recent_posts(
    client: Client,
    limit: int = 50,
    keyword: str = None,
    stock_related_only: bool = False,
) -> List[Dict]:
    """
    获取最近的帖子

    Args:
        client: Supabase 客户端
        limit: 返回数量限制
        keyword: 筛选关键词
        stock_related_only: 是否只返回股票相关帖子

    Returns:
        List[Dict]: 帖子列表
    """
    try:
        query = client.table("xhs_posts").select("*").order("scraped_at", desc=True)

        if keyword:
            query = query.eq("search_keyword", keyword)

        if stock_related_only:
            query = query.eq("ai_is_stock_related", True)

        result = query.limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"⚠️ 获取帖子失败: {e}")
        return []


# ============================================================
# KOL 相关数据库操作
# ============================================================


def kol_exists(client: Client, user_id: str) -> bool:
    """
    检查 KOL 是否已存在于数据库中

    Args:
        client: Supabase 客户端
        user_id: 小红书用户 ID

    Returns:
        bool: 如果存在返回 True
    """
    try:
        result = (
            client.table("xhs_kols")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception as e:
        print(f"⚠️ 检查 KOL 是否存在失败: {e}")
        return False


def upsert_kol(
    client: Client,
    kol_data: Dict,
    source_keyword: str = None,
    source_note_id: str = None,
) -> Tuple[bool, Optional[int]]:
    """
    插入或更新 KOL 信息到数据库

    Args:
        client: Supabase 客户端
        kol_data: KOL 数据字典
        source_keyword: 来源搜索关键词
        source_note_id: 来源笔记 ID

    Returns:
        Tuple[bool, Optional[int]]: (成功返回 True, KOL ID)
    """
    user_id = kol_data.get("user_id")
    if not user_id:
        print("⚠️ KOL 数据缺少 user_id")
        return False, None

    try:
        # 辅助函数：安全截断字符串
        def safe_str(value, max_len: int) -> Optional[str]:
            if value is None:
                return None
            return str(value)[:max_len] if value else None

        # 准备数据
        data = {
            "user_id": safe_str(user_id, 64),
            "nickname": safe_str(kol_data.get("nickname"), 255),
            "red_id": safe_str(kol_data.get("red_id"), 64),
            "avatar_url": kol_data.get("avatar_url"),
            "description": kol_data.get("description"),
            "location": safe_str(kol_data.get("location"), 100),
            "gender": safe_str(kol_data.get("gender"), 10),
            "is_verified": kol_data.get("is_verified", False),
            "verified_type": safe_str(kol_data.get("verified_type"), 50),
            "verified_info": kol_data.get("verified_info"),
            "followers_count": kol_data.get("followers_count", 0),
            "following_count": kol_data.get("following_count", 0),
            "likes_count": kol_data.get("likes_count", 0),
            "notes_count": kol_data.get("notes_count", 0),
            "collected_count": kol_data.get("collected_count", 0),
            "profile_url": kol_data.get("profile_url"),
            "tags": json.dumps(kol_data.get("tags", [])) if kol_data.get("tags") else None,
            "category": safe_str(kol_data.get("category"), 100),
            "source_keyword": safe_str(source_keyword, 100),
            "source_note_id": safe_str(source_note_id, 64),
        }

        # 检查是否已存在
        if kol_exists(client, user_id):
            # 更新现有记录
            result = (
                client.table("xhs_kols")
                .update(data)
                .eq("user_id", user_id)
                .execute()
            )
            kol_id = result.data[0]["id"] if result.data else None
            print(f"   ✅ 更新 KOL: {kol_data.get('nickname', user_id)}")
            return True, kol_id
        else:
            # 插入新记录
            data["scraped_at"] = datetime.now(timezone.utc).isoformat()
            result = client.table("xhs_kols").insert(data).execute()
            kol_id = result.data[0]["id"] if result.data else None
            print(f"   ✅ 新增 KOL: {kol_data.get('nickname', user_id)}")
            return True, kol_id

    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return False, None
        print(f"⚠️ 保存 KOL 失败: {e}")
        return False, None


def get_kol_by_user_id(client: Client, user_id: str) -> Optional[Dict]:
    """
    根据用户 ID 获取 KOL 信息

    Args:
        client: Supabase 客户端
        user_id: 小红书用户 ID

    Returns:
        Optional[Dict]: KOL 信息
    """
    try:
        result = (
            client.table("xhs_kols")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"⚠️ 获取 KOL 失败: {e}")
        return None


def get_top_kols(
    client: Client,
    limit: int = 20,
    category: str = None,
    min_followers: int = 0,
) -> List[Dict]:
    """
    获取粉丝数最多的 KOL

    Args:
        client: Supabase 客户端
        limit: 返回数量限制
        category: 分类筛选
        min_followers: 最小粉丝数

    Returns:
        List[Dict]: KOL 列表
    """
    try:
        query = (
            client.table("xhs_kols")
            .select("*")
            .gte("followers_count", min_followers)
            .order("followers_count", desc=True)
        )

        if category:
            query = query.eq("category", category)

        result = query.limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"⚠️ 获取 KOL 列表失败: {e}")
        return []


def get_kol_posts(
    client: Client,
    user_id: str,
    limit: int = 20,
) -> List[Dict]:
    """
    获取某个 KOL 的帖子

    Args:
        client: Supabase 客户端
        user_id: KOL 用户 ID
        limit: 返回数量限制

    Returns:
        List[Dict]: 帖子列表
    """
    try:
        result = (
            client.table("xhs_posts")
            .select("*")
            .eq("author_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"⚠️ 获取 KOL 帖子失败: {e}")
        return []


def get_kol_stats(client: Client) -> Dict:
    """
    获取 KOL 统计信息

    Returns:
        Dict: 统计信息
    """
    try:
        # 总 KOL 数
        total_result = client.table("xhs_kols").select("id", count="exact").execute()
        total = total_result.count or 0

        # 认证 KOL 数
        verified_result = (
            client.table("xhs_kols")
            .select("id", count="exact")
            .eq("is_verified", True)
            .execute()
        )
        verified = verified_result.count or 0

        # 按分类统计
        by_category = {}
        try:
            result = client.table("xhs_kols").select("category").execute()
            for row in result.data:
                cat = row.get("category") or "未分类"
                by_category[cat] = by_category.get(cat, 0) + 1
        except Exception:
            pass

        return {
            "total": total,
            "verified": verified,
            "by_category": dict(
                sorted(by_category.items(), key=lambda x: x[1], reverse=True)
            ),
        }
    except Exception as e:
        print(f"⚠️ 获取 KOL 统计失败: {e}")
        return {"total": 0, "verified": 0, "by_category": {}}


"""
小红书内容提取器
"""

import re
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin

# Playwright 类型导入
try:
    from playwright.sync_api import Page, ElementHandle

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Page = None
    ElementHandle = None

from .config import BASE_URL, SELECTORS


def extract_all_note_cards(page: "Page") -> List[Dict]:
    """
    一次性提取页面上所有笔记卡片（使用 JS 直接在浏览器执行，避免元素失效问题）
    
    Args:
        page: Playwright 页面对象
        
    Returns:
        List[Dict]: 所有卡片数据列表
    """
    try:
        cards_data = page.evaluate("""
            () => {
                const cards = document.querySelectorAll(
                    'section.note-item, .note-item, [class*="note-item"], a[href*="/explore/"]'
                );
                
                const results = [];
                
                cards.forEach((el) => {
                    try {
                        const result = {};
                        
                        // 提取链接
                        const link = el.tagName === 'A' ? el : el.querySelector('a');
                        if (link) {
                            result.href = link.getAttribute('href') || '';
                        }
                        
                        // 提取标题
                        const titleEl = el.querySelector('.title, .note-title, span.title, [class*="title"]');
                        if (titleEl) {
                            result.title = titleEl.innerText?.trim() || '';
                        }
                        
                        // 提取封面图
                        const img = el.querySelector('img');
                        if (img) {
                            result.cover_url = img.getAttribute('src') || img.getAttribute('data-src') || '';
                        }
                        
                        // 提取作者
                        const authorEl = el.querySelector('.author .name, .user-name, .author-wrapper .name, [class*="author"] [class*="name"]');
                        if (authorEl) {
                            result.author_name = authorEl.innerText?.trim() || '';
                        }
                        
                        // 提取点赞数
                        const likeEl = el.querySelector('[class*="like"] span, .like-count, .like .count, [class*="like"] [class*="count"]');
                        if (likeEl) {
                            result.like_text = likeEl.innerText?.trim() || '';
                        }
                        
                        // 判断是否是视频
                        const videoIcon = el.querySelector('[class*="video"], .video-icon, svg.video');
                        result.is_video = !!videoIcon;
                        
                        // 只添加有效的卡片
                        if (result.href) {
                            results.push(result);
                        }
                    } catch (e) {
                        // 忽略单个卡片错误
                    }
                });
                
                return results;
            }
        """)
        
        # 处理提取的数据
        processed = []
        for data in (cards_data or []):
            try:
                result = {}
                
                # 处理链接和笔记 ID
                href = data.get("href", "")
                if href:
                    result["permalink"] = urljoin(BASE_URL, href)
                    result["note_id"] = extract_note_id_from_url(href)
                
                # 其他字段
                if data.get("title"):
                    result["title"] = data["title"]
                if data.get("cover_url"):
                    result["cover_url"] = data["cover_url"]
                if data.get("author_name"):
                    result["author_name"] = data["author_name"]
                if data.get("like_text"):
                    result["like_count"] = parse_count(data["like_text"])
                
                result["note_type"] = "video" if data.get("is_video") else "normal"
                
                if result.get("note_id"):
                    processed.append(result)
                    
            except Exception:
                continue
                
        return processed
        
    except Exception as e:
        print(f"⚠️ 批量提取卡片失败: {e}")
        return []


def parse_count(text: str) -> int:
    """
    解析小红书的数量文本，如 "1.2万", "5432", "10万+"

    Args:
        text: 数量文本

    Returns:
        int: 解析出的数量
    """
    if not text:
        return 0
    try:
        text = text.strip().replace(",", "").replace("+", "")

        # 处理中文数量
        if "万" in text:
            num = float(text.replace("万", ""))
            return int(num * 10000)
        elif "亿" in text:
            num = float(text.replace("亿", ""))
            return int(num * 100000000)

        # 处理英文数量
        match = re.search(r"([\d.]+)\s*([KMB])?", text, re.IGNORECASE)
        if match:
            num = float(match.group(1))
            suffix = match.group(2)
            if suffix:
                suffix = suffix.upper()
                multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
                num *= multipliers.get(suffix, 1)
            return int(num)

        # 纯数字
        return int(float(text))
    except Exception:
        return 0


def parse_xhs_date(date_text: str) -> Optional[str]:
    """
    解析小红书的时间格式

    支持格式:
    - "2024-12-20"
    - "12-20" (当年)
    - "昨天 18:30"
    - "前天 10:00"
    - "3天前"
    - "2小时前"
    - "刚刚"
    - "12月20日"
    - "2024年12月20日"

    Args:
        date_text: 时间文本

    Returns:
        Optional[str]: ISO 格式时间字符串
    """
    if not date_text:
        return None

    date_text = date_text.strip()
    now = datetime.now(timezone(timedelta(hours=8)))  # 北京时间

    try:
        # 刚刚
        if "刚刚" in date_text:
            return now.isoformat()

        # X分钟前
        if "分钟前" in date_text:
            minutes = int(re.search(r"(\d+)", date_text).group(1))
            return (now - timedelta(minutes=minutes)).isoformat()

        # X小时前
        if "小时前" in date_text:
            hours = int(re.search(r"(\d+)", date_text).group(1))
            return (now - timedelta(hours=hours)).isoformat()

        # X天前
        if "天前" in date_text:
            days = int(re.search(r"(\d+)", date_text).group(1))
            return (now - timedelta(days=days)).isoformat()

        # 昨天
        if "昨天" in date_text:
            return (now - timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()

        # 前天
        if "前天" in date_text:
            return (now - timedelta(days=2)).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()

        # 完整日期格式: 2024-12-20 或 2024年12月20日
        full_date_match = re.search(
            r"(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?", date_text
        )
        if full_date_match:
            year, month, day = full_date_match.groups()
            return datetime(
                int(year),
                int(month),
                int(day),
                tzinfo=timezone(timedelta(hours=8)),
            ).isoformat()

        # 月日格式: 12-20 或 12月20日
        month_day_match = re.search(r"(\d{1,2})[-月](\d{1,2})日?", date_text)
        if month_day_match:
            month, day = month_day_match.groups()
            year = now.year
            # 如果月份大于当前月份，说明是去年
            if int(month) > now.month:
                year -= 1
            return datetime(
                year, int(month), int(day), tzinfo=timezone(timedelta(hours=8))
            ).isoformat()

        return None
    except Exception:
        return None


def extract_note_id_from_url(url: str) -> Optional[str]:
    """
    从 URL 中提取笔记 ID

    Args:
        url: 笔记 URL

    Returns:
        Optional[str]: 笔记 ID
    """
    if not url:
        return None

    # 匹配多种 URL 格式
    # https://www.xiaohongshu.com/explore/xxx
    # https://www.xiaohongshu.com/search_result/xxx
    # https://www.xiaohongshu.com/discovery/item/xxx
    patterns = [
        r"/explore/([a-zA-Z0-9]+)",
        r"/discovery/item/([a-zA-Z0-9]+)",
        r"/search_result/([a-zA-Z0-9]+)",
        r"note_id=([a-zA-Z0-9]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


def extract_note_card(card: "ElementHandle") -> Optional[Dict]:
    """
    从笔记卡片元素中提取信息（使用 evaluate 避免元素失效问题）

    Args:
        card: 笔记卡片 DOM 元素

    Returns:
        Optional[Dict]: 提取的信息，如果失败返回 None
    """
    if not card:
        return None

    try:
        # 使用 evaluate 在浏览器中直接执行 JS，避免元素句柄失效问题
        data = card.evaluate("""
            (el) => {
                const result = {};
                
                // 提取链接
                const link = el.querySelector('a');
                if (link) {
                    result.href = link.getAttribute('href') || '';
                }
                
                // 提取标题
                const titleEl = el.querySelector('.title, .note-title, span.title, [class*="title"]');
                if (titleEl) {
                    result.title = titleEl.innerText?.trim() || '';
                }
                
                // 提取封面图
                const img = el.querySelector('img');
                if (img) {
                    result.cover_url = img.getAttribute('src') || img.getAttribute('data-src') || '';
                }
                
                // 提取作者
                const authorEl = el.querySelector('.author .name, .user-name, .author-wrapper .name, [class*="author"] [class*="name"]');
                if (authorEl) {
                    result.author_name = authorEl.innerText?.trim() || '';
                }
                
                // 提取点赞数
                const likeEl = el.querySelector('[class*="like"] span, .like-count, .like .count, [class*="like"] [class*="count"]');
                if (likeEl) {
                    result.like_text = likeEl.innerText?.trim() || '';
                }
                
                // 判断是否是视频
                const videoIcon = el.querySelector('[class*="video"], .video-icon, svg.video');
                result.is_video = !!videoIcon;
                
                return result;
            }
        """)

        if not data:
            return None

        # 处理提取的数据
        result = {}

        # 处理链接和笔记 ID
        href = data.get("href", "")
        if href:
            result["permalink"] = urljoin(BASE_URL, href)
            result["note_id"] = extract_note_id_from_url(href)

        # 其他字段
        if data.get("title"):
            result["title"] = data["title"]
        if data.get("cover_url"):
            result["cover_url"] = data["cover_url"]
        if data.get("author_name"):
            result["author_name"] = data["author_name"]
        if data.get("like_text"):
            result["like_count"] = parse_count(data["like_text"])

        result["note_type"] = "video" if data.get("is_video") else "normal"

        return result if result.get("note_id") or result.get("title") else None

    except Exception as e:
        # 静默处理常见的元素失效错误
        error_str = str(e)
        if "Cannot find context" in error_str or "Target closed" in error_str:
            return None
        print(f"⚠️ 提取笔记卡片失败: {e}")
        return None


def extract_note_detail(page: "Page") -> Dict:
    """
    从笔记详情页面提取完整信息

    Args:
        page: Playwright 页面对象

    Returns:
        Dict: 提取的详细信息
    """
    data = {}

    try:
        # 等待内容加载
        page.wait_for_selector(".note-content, .content, #noteContainer", timeout=10000)
    except Exception:
        pass

    # 提取标题
    try:
        title_selectors = [
            "#detail-title",
            ".title",
            "h1.title",
            ".note-title",
            '[class*="title"]',
        ]
        for selector in title_selectors:
            el = page.query_selector(selector)
            if el:
                text = el.inner_text().strip()
                if text and len(text) > 2:
                    data["title"] = text
                    break
    except Exception:
        pass

    # 提取内容
    try:
        content_selectors = [
            "#detail-desc .desc",
            ".note-text",
            ".content .desc",
            '[class*="desc"]',
            ".note-content",
        ]
        for selector in content_selectors:
            el = page.query_selector(selector)
            if el:
                text = el.inner_text().strip()
                if text:
                    data["content"] = text
                    break
    except Exception:
        pass

    # 提取作者信息
    try:
        author_selectors = [".user-info .name", ".author .name", ".user-name", '[class*="nickname"]']
        for selector in author_selectors:
            el = page.query_selector(selector)
            if el:
                data["author_name"] = el.inner_text().strip()
                break
    except Exception:
        pass

    # 提取作者头像
    try:
        avatar_selectors = [".user-info img", ".author img", ".avatar img", '[class*="avatar"] img']
        for selector in avatar_selectors:
            el = page.query_selector(selector)
            if el:
                data["author_avatar"] = el.get_attribute("src")
                break
    except Exception:
        pass

    # 提取互动数据
    try:
        # 点赞
        like_selectors = ['.like-wrapper .count', '[class*="like"] .count', '[class*="like"] span']
        for selector in like_selectors:
            el = page.query_selector(selector)
            if el:
                data["like_count"] = parse_count(el.inner_text())
                break

        # 收藏
        collect_selectors = ['.collect-wrapper .count', '[class*="collect"] .count', '[class*="collect"] span']
        for selector in collect_selectors:
            el = page.query_selector(selector)
            if el:
                data["collect_count"] = parse_count(el.inner_text())
                break

        # 评论
        comment_selectors = ['.comment-wrapper .count', '[class*="comment"] .count', '[class*="chat"] .count']
        for selector in comment_selectors:
            el = page.query_selector(selector)
            if el:
                data["comment_count"] = parse_count(el.inner_text())
                break
    except Exception:
        pass

    # 提取图片 - 增强版，多种选择器尝试
    try:
        image_urls = []
        
        # 按优先级排序的图片选择器
        img_selectors = [
            # 轮播图/幻灯片
            ".swiper-slide img",
            ".carousel img",
            '[class*="swiper"] img',
            '[class*="slider"] img',
            # 图片容器
            ".image-container img",
            ".note-image img",
            ".note-content img",
            '[class*="image-box"] img',
            '[class*="img-container"] img',
            # 主图区域
            ".main-image img",
            ".media-container img",
            '[class*="media"] img',
            # 通用图片 (最后尝试)
            '.note-scroller img',
            '#noteContainer img',
            '[class*="note"] img:not(.avatar):not([class*="user"])',
        ]
        
        for selector in img_selectors:
            try:
                images = page.query_selector_all(selector)
                if images:
                    for img in images:
                        # 获取图片 URL（尝试多种属性）
                        src = (
                            img.get_attribute("src") 
                            or img.get_attribute("data-src")
                            or img.get_attribute("data-original")
                            or img.get_attribute("data-lazy-src")
                        )
                        
                        if not src:
                            continue
                            
                        # 过滤头像和小图标
                        if any(x in src.lower() for x in ["avatar", "user", "icon", "emoji", "logo"]):
                            continue
                            
                        # 过滤 base64 占位图
                        if src.startswith("data:"):
                            continue
                            
                        # 尝试获取高清版本
                        if "thumbnail" in src or "small" in src:
                            src = src.replace("thumbnail", "original").replace("small", "large")
                            
                        if src and src not in image_urls:
                            image_urls.append(src)
                            
                    # 找到图片就停止，避免重复
                    if image_urls:
                        break
            except Exception:
                continue
                
        # 如果上面没找到，尝试从背景图获取
        if not image_urls:
            try:
                bg_selectors = ['.swiper-slide', '[class*="slide"]', '.image-item']
                for selector in bg_selectors:
                    els = page.query_selector_all(selector)
                    for el in els:
                        style = el.get_attribute("style") or ""
                        bg_match = re.search(r'url\(["\']?([^"\']+)["\']?\)', style)
                        if bg_match:
                            src = bg_match.group(1)
                            if src and src not in image_urls and not src.startswith("data:"):
                                image_urls.append(src)
            except Exception:
                pass
                
        if image_urls:
            data["image_urls"] = image_urls
            
    except Exception:
        pass

    # 提取视频
    try:
        video = page.query_selector("video, video source")
        if video:
            data["video_url"] = video.get_attribute("src")
            data["note_type"] = "video"
    except Exception:
        pass

    # 提取标签
    try:
        tags = []
        tag_selectors = [".tag", ".hashtag", "#hash-tag span", 'a[href*="/search_result?keyword"]']
        for selector in tag_selectors:
            tag_els = page.query_selector_all(selector)
            if tag_els:
                for tag_el in tag_els:
                    tag_text = tag_el.inner_text().strip().lstrip("#")
                    if tag_text and tag_text not in tags:
                        tags.append(tag_text)
        if tags:
            data["tags"] = tags
    except Exception:
        pass

    # 提取发布时间
    try:
        time_selectors = [".date", ".time", ".publish-date", '[class*="time"]', '[class*="date"]']
        for selector in time_selectors:
            el = page.query_selector(selector)
            if el:
                time_text = el.inner_text().strip()
                parsed_time = parse_xhs_date(time_text)
                if parsed_time:
                    data["created_at"] = parsed_time
                    break
    except Exception:
        pass

    # 从 URL 提取笔记 ID
    try:
        current_url = page.url
        note_id = extract_note_id_from_url(current_url)
        if note_id:
            data["note_id"] = note_id
            data["permalink"] = current_url
    except Exception:
        pass

    return data


def merge_note_data(card_data: Dict, detail_data: Dict) -> Dict:
    """
    合并卡片数据和详情数据

    Args:
        card_data: 从卡片提取的数据
        detail_data: 从详情页提取的数据

    Returns:
        Dict: 合并后的完整数据
    """
    merged = {**card_data}

    for key, value in detail_data.items():
        # 详情页数据优先（通常更完整）
        if value and (key not in merged or not merged[key]):
            merged[key] = value
        # 对于某些字段，详情页数据更准确
        elif key in ["content", "image_urls", "tags", "like_count", "collect_count", "comment_count"]:
            if value:
                merged[key] = value

    return merged


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
        cards_data = page.evaluate(
            """
            () => {
                const cards = document.querySelectorAll('section.note-item');
                
                const results = [];
                
                cards.forEach((el) => {
                    try {
                        const result = {};
                        
                        // 提取链接 - 优先从 a.cover 获取
                        const coverLink = el.querySelector('a.cover');
                        if (coverLink) {
                            result.href = coverLink.getAttribute('href') || '';
                        } else {
                            const link = el.querySelector('a');
                            if (link) {
                                result.href = link.getAttribute('href') || '';
                            }
                        }
                        
                        // 提取标题 - 从 a.title 获取
                        const titleEl = el.querySelector('a.title, .title');
                        if (titleEl) {
                            result.title = titleEl.innerText?.trim() || '';
                        }
                        
                        // 提取封面图 - 从 a.cover img 获取
                        const coverImg = el.querySelector('a.cover img');
                        if (coverImg) {
                            result.cover_url = coverImg.getAttribute('src') || coverImg.getAttribute('data-src') || '';
                        }
                        
                        // 提取作者名 - 从 .name div 获取
                        const authorNameEl = el.querySelector('.author .name, .name-time-wrapper .name, .name');
                        if (authorNameEl) {
                            result.author_name = authorNameEl.innerText?.trim() || '';
                        }
                        
                        // 注意：作者头像不再从帖子卡片提取，统一从 xhs_kols 表获取
                        
                        // 提取发布时间
                        const timeEl = el.querySelector('.time');
                        if (timeEl) {
                            result.publish_time = timeEl.innerText?.trim() || '';
                        }
                        
                        // 提取点赞数 - 从 .like-wrapper .count 获取
                        const likeEl = el.querySelector('.like-wrapper .count, .count');
                        if (likeEl) {
                            result.like_text = likeEl.innerText?.trim() || '';
                        }
                        
                        // 判断是否是视频 - 检查视频图标
                        const videoIcon = el.querySelector('[class*="video-icon"], .play-icon, svg[class*="video"]');
                        result.is_video = !!videoIcon;
                        
                        // 只添加有效的卡片（必须有链接）
                        if (result.href) {
                            results.push(result);
                        }
                    } catch (e) {
                        // 忽略单个卡片错误
                    }
                });
                
                return results;
            }
        """
        )

        # 处理提取的数据
        processed = []
        for data in cards_data or []:
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
            return (
                (now - timedelta(days=1))
                .replace(hour=0, minute=0, second=0, microsecond=0)
                .isoformat()
            )

        # 前天
        if "前天" in date_text:
            return (
                (now - timedelta(days=2))
                .replace(hour=0, minute=0, second=0, microsecond=0)
                .isoformat()
            )

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
    适配 2024/2025 新版小红书页面结构

    Args:
        card: 笔记卡片 DOM 元素

    Returns:
        Optional[Dict]: 提取的信息，如果失败返回 None
    """
    if not card:
        return None

    try:
        # 使用 evaluate 在浏览器中直接执行 JS，避免元素句柄失效问题
        data = card.evaluate(
            """
            (el) => {
                const result = {};
                
                // 提取链接 - 优先从 a.cover 获取
                const coverLink = el.querySelector('a.cover');
                if (coverLink) {
                    result.href = coverLink.getAttribute('href') || '';
                } else {
                    const link = el.querySelector('a');
                    if (link) {
                        result.href = link.getAttribute('href') || '';
                    }
                }
                
                // 提取标题 - 从 a.title 获取
                const titleEl = el.querySelector('a.title, .title');
                if (titleEl) {
                    result.title = titleEl.innerText?.trim() || '';
                }
                
                // 提取封面图 - 从 a.cover img 获取
                const coverImg = el.querySelector('a.cover img');
                if (coverImg) {
                    result.cover_url = coverImg.getAttribute('src') || coverImg.getAttribute('data-src') || '';
                }
                
                // 提取作者名 - 从 .name div 获取
                const authorNameEl = el.querySelector('.author .name, .name-time-wrapper .name, .name');
                if (authorNameEl) {
                    result.author_name = authorNameEl.innerText?.trim() || '';
                }
                
                // 注意：作者头像不再从帖子卡片提取，统一从 xhs_kols 表获取
                
                // 提取发布时间
                const timeEl = el.querySelector('.time');
                if (timeEl) {
                    result.publish_time = timeEl.innerText?.trim() || '';
                }
                
                // 提取点赞数 - 从 .like-wrapper .count 获取
                const likeEl = el.querySelector('.like-wrapper .count, .count');
                if (likeEl) {
                    result.like_text = likeEl.innerText?.trim() || '';
                }
                
                // 判断是否是视频
                const videoIcon = el.querySelector('[class*="video-icon"], .play-icon, svg[class*="video"]');
                result.is_video = !!videoIcon;
                
                return result;
            }
        """
        )

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
    从笔记详情页面提取完整信息（2024/2025 新版小红书页面结构）

    Args:
        page: Playwright 页面对象

    Returns:
        Dict: 提取的详细信息
    """
    data = {}

    try:
        # 等待详情弹窗/页面加载
        page.wait_for_selector(
            "#noteContainer, .note-container, .note-detail-mask", timeout=10000
        )
    except Exception:
        pass

    # 提取标题 - 新版选择器
    try:
        title_selectors = [
            "#detail-title",
            "#noteContainer .title",
            ".note-container .title",
            "h1.title",
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

    # 提取正文内容 - 新版选择器
    try:
        content_selectors = [
            "#detail-desc .note-text",  # 最准确的选择器
            "#detail-desc",
            ".note-text",
            ".desc",
            "#noteContainer .content",
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

    # 提取作者信息 - 新版选择器
    try:
        author_selectors = [
            "#noteContainer .author .name",
            "#noteContainer .username",
            "#noteContainer .name",
            ".author-wrapper .name",
            ".info .name",
        ]
        for selector in author_selectors:
            el = page.query_selector(selector)
            if el:
                name = el.inner_text().strip()
                if name:
                    data["author_name"] = name
                    break
    except Exception:
        pass

    # 注意：作者头像不再从帖子详情页提取，统一从 xhs_kols 表获取

    # 提取作者 ID（从作者链接中提取）- 关键！用于爬取 KOL 资料
    try:
        author_id = page.evaluate(
            """
            () => {
                // 尝试从作者链接中提取用户 ID
                const authorLinkSelectors = [
                    '#noteContainer .author-wrapper a[href*="/user/profile/"]',
                    '#noteContainer .author a[href*="/user/profile/"]',
                    '.author-wrapper a[href*="/user/profile/"]',
                    '.user-info a[href*="/user/profile/"]',
                    'a[href*="/user/profile/"]',
                ];
                
                for (const selector of authorLinkSelectors) {
                    const link = document.querySelector(selector);
                    if (link) {
                        const href = link.getAttribute('href') || '';
                        const match = href.match(/\\/user\\/profile\\/([a-zA-Z0-9]+)/);
                        if (match) {
                            return match[1];
                        }
                    }
                }
                return null;
            }
        """
        )
        if author_id:
            data["author_id"] = author_id
    except Exception:
        pass

    # 提取互动数据 - 新版选择器
    try:
        # 点赞数
        like_selectors = [
            ".engage-bar-container .like-wrapper .count",
            "#noteContainer .like-wrapper .count",
            ".like-wrapper .count",
        ]
        for selector in like_selectors:
            el = page.query_selector(selector)
            if el:
                data["like_count"] = parse_count(el.inner_text())
                break

        # 收藏数
        collect_selectors = [
            ".engage-bar-container .collect-wrapper .count",
            "#noteContainer .collect-wrapper .count",
            ".collect-wrapper .count",
        ]
        for selector in collect_selectors:
            el = page.query_selector(selector)
            if el:
                data["collect_count"] = parse_count(el.inner_text())
                break

        # 评论数
        comment_selectors = [
            ".engage-bar-container .chat-wrapper .count",
            "#noteContainer .chat-wrapper .count",
            ".comment-wrapper .count",
        ]
        for selector in comment_selectors:
            el = page.query_selector(selector)
            if el:
                data["comment_count"] = parse_count(el.inner_text())
                break
    except Exception:
        pass

    # 提取图片 - 新版小红书图片轮播选择器
    try:
        image_urls = []

        # 新版小红书图片选择器（按优先级排序）
        img_selectors = [
            # 轮播图中的图片（最常见）
            ".swiper-slide .note-slider-img img",
            ".swiper-slide .img-container img",
            ".swiper-slide img",
            # xhs slider 容器
            ".xhs-slider-container img",
            # 媒体容器
            ".media-container img",
            "#noteContainer .img-container img",
            # 通用图片
            "#noteContainer img",
            ".note-container img",
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
                        )

                        if not src:
                            continue

                        # 过滤头像、图标、静态资源
                        skip_keywords = [
                            "avatar",
                            "user",
                            "icon",
                            "emoji",
                            "logo",
                            "picasso-static",
                        ]
                        if any(x in src.lower() for x in skip_keywords):
                            continue

                        # 过滤 base64 占位图
                        if src.startswith("data:"):
                            continue

                        # 只保留小红书图片CDN的图片
                        if "xhscdn.com" in src or "xiaohongshu.com" in src:
                            if src not in image_urls:
                                image_urls.append(src)

                    # 找到有效图片就停止
                    if image_urls:
                        break
            except Exception:
                continue

        # 去重并保存
        if image_urls:
            # 去除重复图片（swiper可能有重复的slide）
            unique_urls = list(dict.fromkeys(image_urls))
            data["image_urls"] = unique_urls

    except Exception:
        pass

    # 提取视频
    try:
        video = page.query_selector(
            "#noteContainer video, .media-container video, video source"
        )
        if video:
            src = video.get_attribute("src")
            if src:
                data["video_url"] = src
                data["note_type"] = "video"
    except Exception:
        pass

    # 提取标签 - 新版选择器
    try:
        tags = []
        tag_selectors = [
            '#noteContainer a[href*="/search_result?keyword="]',
            "#noteContainer .tag",
            ".note-text a.tag",
            'a.tag[href*="keyword"]',
        ]
        for selector in tag_selectors:
            tag_els = page.query_selector_all(selector)
            if tag_els:
                for tag_el in tag_els:
                    tag_text = tag_el.inner_text().strip()
                    # 清理标签文本
                    if tag_text.startswith("#"):
                        tag_text = tag_text[1:]
                    if tag_text and tag_text not in tags and len(tag_text) < 50:
                        tags.append(tag_text)
        if tags:
            data["tags"] = tags
    except Exception:
        pass

    # 提取发布时间 - 新版选择器
    try:
        time_selectors = [
            "#noteContainer .bottom-container span",
            "#noteContainer .date",
            ".publish-date",
            ".bottom-container .date",
        ]
        for selector in time_selectors:
            el = page.query_selector(selector)
            if el:
                time_text = el.inner_text().strip()
                if time_text:
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
        elif key in [
            "content",
            "image_urls",
            "tags",
            "like_count",
            "collect_count",
            "comment_count",
        ]:
            if value:
                merged[key] = value

    return merged


def extract_kol_profile(page: "Page") -> Dict:
    """
    从KOL个人主页提取资料信息
    
    注意：此函数专门用于提取主页上的 KOL 信息，
    使用精确选择器避免匹配到登录用户的信息。

    Args:
        page: Playwright 页面对象（已导航到KOL主页）

    Returns:
        Dict: KOL资料信息
    """
    data = {}

    try:
        # 等待主页内容区域加载（排除侧边栏和导航）
        page.wait_for_selector(
            "#userPageContainer, .user-page, .user-profile-container, [class*='user-page']", 
            timeout=10000
        )
    except Exception:
        pass

    # 使用 JavaScript 一次性提取所有信息
    # 重点：使用精确的选择器路径，只从主页内容区域提取，排除侧边栏/导航栏
    try:
        profile_data = page.evaluate(
            """
            () => {
                const result = {};
                
                // ========== 核心：确定用户主页的主容器 ==========
                // 小红书用户主页的主容器选择器（按优先级尝试）
                const mainContainerSelectors = [
                    '#userPageContainer',
                    '.user-page',
                    '.user-profile-container',
                    '[class*="user-page"]',
                    'main',
                    '.main-content',
                ];
                
                let mainContainer = null;
                for (const selector of mainContainerSelectors) {
                    mainContainer = document.querySelector(selector);
                    if (mainContainer) break;
                }
                
                // 如果找不到主容器，回退到 body 但排除侧边栏
                if (!mainContainer) {
                    mainContainer = document.body;
                }
                
                // ========== 1. 用户 ID（从 URL 提取，最可靠） ==========
                const urlMatch = window.location.pathname.match(/\\/user\\/profile\\/([a-zA-Z0-9]+)/);
                if (urlMatch) {
                    result.user_id = urlMatch[1];
                }
                
                // ========== 2. 提取昵称（从主内容区域） ==========
                // 小红书主页昵称选择器（精确匹配主页用户信息区域）
                const nicknameSelectors = [
                    '#userPageContainer .user-name',
                    '#userPageContainer .user-nickname',
                    '.user-page .user-name',
                    '.info-part .user-name',
                    '.user-info-box .user-name',
                    '.basic-info .nickname',
                    // 排除侧边栏：不使用 .side-bar 下的选择器
                ];
                
                for (const selector of nicknameSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText?.trim()) {
                        result.nickname = el.innerText.trim();
                        break;
                    }
                }
                
                // 备用方案：在主容器中查找
                if (!result.nickname && mainContainer) {
                    const nicknameEl = mainContainer.querySelector('.user-name, .nickname');
                    if (nicknameEl && nicknameEl.innerText?.trim()) {
                        // 验证不是侧边栏元素
                        const isInSidebar = nicknameEl.closest('.side-bar, .sidebar, .nav');
                        if (!isInSidebar) {
                            result.nickname = nicknameEl.innerText.trim();
                        }
                    }
                }
                
                // ========== 3. 提取小红书号 ==========
                const redIdSelectors = [
                    '#userPageContainer .user-redId',
                    '#userPageContainer .red-id',
                    '.user-page .user-redId',
                    '.info-part .user-redId',
                    '[class*="redId"]',
                ];
                
                for (const selector of redIdSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const text = el.innerText?.trim() || '';
                        const match = text.match(/小红书号[：:]\s*([a-zA-Z0-9_]+)/);
                        if (match) {
                            result.red_id = match[1];
                        } else if (text) {
                            result.red_id = text.replace(/小红书号[：:]?\s*/i, '').trim();
                        }
                        if (result.red_id) break;
                    }
                }
                
                // ========== 4. 提取头像（主页大头像，不是侧边栏小头像） ==========
                const avatarSelectors = [
                    '#userPageContainer .avatar img',
                    '#userPageContainer .user-avatar img',
                    '.user-page .avatar img',
                    '.info-part .avatar img',
                    '.avatar-wrapper img',
                ];
                
                for (const selector of avatarSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const src = el.getAttribute('src') || el.getAttribute('data-src');
                        if (src && !src.includes('default')) {
                            result.avatar_url = src;
                            break;
                        }
                    }
                }
                
                // ========== 5. 提取个人简介 ==========
                const descSelectors = [
                    '#userPageContainer .user-desc',
                    '#userPageContainer .desc',
                    '.user-page .user-desc',
                    '.info-part .user-desc',
                    '.basic-info .desc',
                ];
                
                for (const selector of descSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText?.trim()) {
                        result.description = el.innerText.trim();
                        break;
                    }
                }
                
                // ========== 6. 提取位置 ==========
                const locationSelectors = [
                    '#userPageContainer .location',
                    '.user-page .location',
                    '.info-part .location',
                    '.ip-container',
                ];
                
                for (const selector of locationSelectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText?.trim()) {
                        result.location = el.innerText.trim().replace(/^IP属地[：:]\s*/i, '');
                        break;
                    }
                }
                
                // ========== 7. 提取性别 ==========
                const genderEl = mainContainer?.querySelector('.gender, [class*="gender"]');
                if (genderEl) {
                    const genderClass = genderEl.className || '';
                    if (genderClass.includes('female') || genderEl.innerText?.includes('女')) {
                        result.gender = 'female';
                    } else if (genderClass.includes('male') || genderEl.innerText?.includes('男')) {
                        result.gender = 'male';
                    }
                }
                
                // ========== 8. 提取认证信息 ==========
                const verifySelectors = [
                    '#userPageContainer .verified-icon',
                    '#userPageContainer [class*="verify"]',
                    '.user-page .verified-icon',
                    '.info-part .official-icon',
                ];
                
                for (const selector of verifySelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        result.is_verified = true;
                        const verifyText = el.getAttribute('title') || el.innerText || '';
                        result.verified_info = verifyText.trim();
                        break;
                    }
                }
                
                // ========== 9. 提取数据统计（核心：粉丝、关注、获赞） ==========
                // 小红书主页统计数据通常在 .data-info 或类似容器中
                const statsContainerSelectors = [
                    '#userPageContainer .data-info',
                    '#userPageContainer .info-data',
                    '#userPageContainer .count-container',
                    '.user-page .data-info',
                    '.info-part .data',
                    '.user-interactions',
                ];
                
                let statsContainer = null;
                for (const selector of statsContainerSelectors) {
                    statsContainer = document.querySelector(selector);
                    if (statsContainer) break;
                }
                
                if (statsContainer) {
                    // 查找所有统计项
                    const items = statsContainer.querySelectorAll('.data-item, .count-item, span, div');
                    items.forEach(el => {
                        const text = el.innerText || '';
                        // 使用正则提取数字
                        const numMatch = text.match(/([\\d,.]+[万亿KMBkmb]?)/);
                        const num = numMatch ? numMatch[1] : '';
                        
                        if (text.includes('粉丝') && num) {
                            result.followers_text = num;
                        } else if (text.includes('关注') && num) {
                            result.following_text = num;
                        } else if ((text.includes('获赞') || text.includes('赞与收藏')) && num) {
                            result.likes_text = num;
                        }
                    });
                }
                
                // 备用方案：直接搜索页面上的统计文本
                if (!result.followers_text) {
                    const allText = mainContainer ? mainContainer.innerText : document.body.innerText;
                    
                    // 粉丝
                    const followersMatch = allText.match(/([\\d,.]+[万亿KMBkmb]?)\\s*粉丝/);
                    if (followersMatch) {
                        result.followers_text = followersMatch[1];
                    }
                    
                    // 关注
                    const followingMatch = allText.match(/([\\d,.]+[万亿KMBkmb]?)\\s*关注/);
                    if (followingMatch) {
                        result.following_text = followingMatch[1];
                    }
                    
                    // 获赞与收藏
                    const likesMatch = allText.match(/([\\d,.]+[万亿KMBkmb]?)\\s*(?:获赞|赞与收藏)/);
                    if (likesMatch) {
                        result.likes_text = likesMatch[1];
                    }
                }
                
                // ========== 10. 提取标签 ==========
                const tagContainer = mainContainer?.querySelector('.user-tags, .tag-list, .tags');
                if (tagContainer) {
                    const tags = [];
                    tagContainer.querySelectorAll('.tag, .tag-item, span').forEach(el => {
                        const text = el.innerText?.trim();
                        if (text && text.length < 20 && !tags.includes(text)) {
                            tags.push(text);
                        }
                    });
                    if (tags.length > 0) {
                        result.tags = tags;
                    }
                }
                
                return result;
            }
        """
        )

        if profile_data:
            data = profile_data

            # 解析数量文本
            if data.get("followers_text"):
                data["followers_count"] = parse_count(data.pop("followers_text"))
            if data.get("following_text"):
                data["following_count"] = parse_count(data.pop("following_text"))
            if data.get("likes_text"):
                data["likes_count"] = parse_count(data.pop("likes_text"))

    except Exception as e:
        print(f"⚠️ 提取 KOL 资料失败: {e}")
        import traceback
        traceback.print_exc()

    # 从 URL 提取用户 ID（备用方案）
    if not data.get("user_id"):
        try:
            current_url = page.url
            match = re.search(r"/user/profile/([a-zA-Z0-9]+)", current_url)
            if match:
                data["user_id"] = match.group(1)
        except Exception:
            pass

    # 设置主页 URL
    if data.get("user_id"):
        data["profile_url"] = (
            f"https://www.xiaohongshu.com/user/profile/{data['user_id']}"
        )
    
    # 调试：打印提取到的数据
    print(f"      📋 提取到 KOL 数据: user_id={data.get('user_id')}, nickname={data.get('nickname')}, followers={data.get('followers_count')}")

    return data


def extract_kol_recent_notes(page: "Page", limit: int = 10) -> List[Dict]:
    """
    从KOL主页提取最近的笔记列表

    Args:
        page: Playwright 页面对象（已导航到KOL主页）
        limit: 最多提取的笔记数量

    Returns:
        List[Dict]: 笔记列表
    """
    notes = []

    try:
        # 等待笔记列表加载
        page.wait_for_selector(
            ".note-item, .feeds-container section, [class*='note']", timeout=10000
        )
    except Exception:
        pass

    try:
        notes_data = page.evaluate(
            f"""
            () => {{
                const limit = {limit};
                const notes = [];
                
                // 尝试多种选择器
                const noteEls = document.querySelectorAll('section.note-item, .feeds-container section, .note-list section');
                
                for (let i = 0; i < Math.min(noteEls.length, limit); i++) {{
                    const el = noteEls[i];
                    const note = {{}};
                    
                    // 提取链接
                    const link = el.querySelector('a.cover, a[href*="/explore/"]');
                    if (link) {{
                        note.href = link.getAttribute('href') || '';
                    }}
                    
                    // 提取标题
                    const titleEl = el.querySelector('a.title, .title, .desc');
                    if (titleEl) {{
                        note.title = titleEl.innerText?.trim() || '';
                    }}
                    
                    // 提取封面图
                    const coverImg = el.querySelector('a.cover img, img');
                    if (coverImg) {{
                        note.cover_url = coverImg.getAttribute('src') || coverImg.getAttribute('data-src') || '';
                    }}
                    
                    // 提取点赞数
                    const likeEl = el.querySelector('.like-wrapper .count, .count');
                    if (likeEl) {{
                        note.like_text = likeEl.innerText?.trim() || '';
                    }}
                    
                    // 判断是否视频
                    const videoIcon = el.querySelector('[class*="video"], .play-icon');
                    note.is_video = !!videoIcon;
                    
                    if (note.href) {{
                        notes.push(note);
                    }}
                }}
                
                return notes;
            }}
        """
        )

        # 处理提取的数据
        for note_data in notes_data or []:
            try:
                note = {}

                href = note_data.get("href", "")
                if href:
                    note["permalink"] = urljoin(BASE_URL, href)
                    note["note_id"] = extract_note_id_from_url(href)

                if note_data.get("title"):
                    note["title"] = note_data["title"]
                if note_data.get("cover_url"):
                    note["cover_url"] = note_data["cover_url"]
                if note_data.get("like_text"):
                    note["like_count"] = parse_count(note_data["like_text"])

                note["note_type"] = "video" if note_data.get("is_video") else "normal"

                if note.get("note_id"):
                    notes.append(note)

            except Exception:
                continue

    except Exception as e:
        print(f"⚠️ 提取 KOL 最近笔记失败: {e}")

    return notes


def extract_author_id_from_note(page: "Page") -> Optional[str]:
    """
    从笔记详情页提取作者用户ID

    Args:
        page: Playwright 页面对象

    Returns:
        Optional[str]: 作者用户ID
    """
    try:
        author_id = page.evaluate(
            """
            () => {
                // 尝试从作者链接中提取
                const authorLink = document.querySelector('.author-wrapper a, .user-info a, a[href*="/user/profile/"]');
                if (authorLink) {
                    const href = authorLink.getAttribute('href') || '';
                    const match = href.match(/\\/user\\/profile\\/([a-zA-Z0-9]+)/);
                    if (match) {
                        return match[1];
                    }
                }
                return null;
            }
        """
        )
        return author_id
    except Exception:
        return None

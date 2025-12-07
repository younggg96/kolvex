"""
推文和 Profile 提取函数
"""

import re
from typing import Dict, Optional

from .utils import parse_metric


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
            page_content = page.content()
            rest_id_match = re.search(r'"rest_id":"(\d+)"', page_content)
            if rest_id_match:
                profile["rest_id"] = rest_id_match.group(1)
        except Exception:
            pass

        # ========== 3. 提取头像 URL ==========
        try:
            username = profile.get("username", "").lower()
            avatar_selectors = [
                f'[data-testid="UserAvatar-Container-{username}"] img',
                'a[href$="/photo"] img[src*="profile_images"]',
                '[data-testid="primaryColumn"] img[src*="profile_images"]',
                '[data-testid="UserProfileHeader_Items"] img[src*="profile_images"]',
            ]

            for selector in avatar_selectors:
                avatar = page.query_selector(selector)
                if avatar:
                    src = avatar.get_attribute("src")
                    if src and "profile_images" in src:
                        profile["avatar_url"] = src.replace(
                            "_normal", "_400x400"
                        ).replace("_bigger", "_400x400")
                        break

            if not profile["avatar_url"]:
                page_content = page.content()
                avatar_match = re.search(
                    r'"profile_image_url_https":"(https://pbs\.twimg\.com/profile_images/[^"]+)"',
                    page_content,
                )
                if avatar_match:
                    avatar_url = avatar_match.group(1).replace("_normal", "_400x400")
                    profile["avatar_url"] = avatar_url
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
            if not profile["banner_url"]:
                header = page.query_selector('[data-testid="UserProfileHeader_Items"]')
                if header:
                    style = header.evaluate(
                        "el => getComputedStyle(el).backgroundImage"
                    )
                    if style and "url(" in style:
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
            verified_selectors = [
                'svg[data-testid="icon-verified"]',
                '[data-testid="UserName"] svg[aria-label*="Verified"]',
                '[data-testid="UserName"] svg[aria-label*="verified"]',
            ]
            for selector in verified_selectors:
                verified_icon = page.query_selector(selector)
                if verified_icon:
                    profile["is_verified"] = True
                    try:
                        color = verified_icon.evaluate(
                            "el => getComputedStyle(el).color"
                        )
                        aria_label = verified_icon.get_attribute("aria-label") or ""

                        if (
                            "gold" in color.lower()
                            or "rgb(255, 212, 0)" in color
                            or "affiliates" in aria_label.lower()
                        ):
                            profile["verification_type"] = "Gold"
                        elif (
                            "grey" in color.lower()
                            or "gray" in color.lower()
                            or "government" in aria_label.lower()
                        ):
                            profile["verification_type"] = "Grey"
                        else:
                            profile["verification_type"] = "Blue"
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
                    profile["bio"] = bio_text[:1000]
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
            posts_div = page.evaluate(
                """
                () => {
                    const h2 = document.querySelector('h2[role="heading"]');
                    if (h2) {
                        const sibling = h2.nextElementSibling;
                        if (sibling && sibling.textContent.toLowerCase().includes('post')) {
                            return sibling.textContent.trim();
                        }
                    }
                    return null;
                }
            """
            )
            if posts_div:
                posts_match = re.search(
                    r"([\d,.]+[KMB]?)\s*(?:posts?|tweets?)", posts_div, re.IGNORECASE
                )
                if posts_match:
                    profile["posts_count"] = parse_metric(posts_match.group(1))

                header_items = page.query_selector('[data-testid="UserName"]')
                if header_items:
                    parent = header_items.evaluate(
                        "el => el.closest('div[class*=\"r-1habvwh\"]')?.textContent"
                    )
                    if parent:
                        posts_match = re.search(
                            r"([\d,.]+[KMB]?)\s*(?:posts?|tweets?)",
                            parent,
                            re.IGNORECASE,
                        )
                        if posts_match:
                            profile["posts_count"] = parse_metric(posts_match.group(1))
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
        try:
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
            repost_indicators = [
                'span[data-testid="socialContext"]',
                'div[data-testid="socialContext"]',
            ]
            for selector in repost_indicators:
                social_context = article.query_selector(selector)
                if social_context:
                    text = social_context.inner_text().lower()
                    if "repost" in text or "retweeted" in text:
                        metadata["is_repost"] = True
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
                    media_urls.append({"type": "video", "url": None, "poster": poster})

            # 5c. 如果没找到直接的视频源，尝试找视频封面
            if not any(m["type"] == "video" for m in media_urls):
                video_container = article.query_selector('[data-testid="videoPlayer"]')
                if video_container:
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
                        match = re.search(r"([\d,.]+[KMB]?)", aria_label)
                        if match:
                            return parse_metric(match.group(1))
            except Exception:
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

        # 6e. Views count
        try:
            views_element = article.query_selector('a[href*="/analytics"] span')
            if views_element:
                views_text = views_element.inner_text()
                metadata["views_count"] = parse_metric(views_text)

            if metadata["views_count"] == 0:
                analytics_link = article.query_selector('a[href*="/analytics"]')
                if analytics_link:
                    aria = analytics_link.get_attribute("aria-label")
                    if aria and "view" in aria.lower():
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


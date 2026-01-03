#!/usr/bin/env python3
"""
测试小红书 cookies 是否有效

使用方式：
    python test_xhs_cookies.py
"""

import json
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("❌ 请先安装 playwright: pip install playwright")
    print("   然后运行: playwright install chromium")
    sys.exit(1)


def load_cookies(cookies_file: str):
    """加载 cookies 文件"""
    if Path(cookies_file).exists():
        with open(cookies_file, "r") as f:
            return json.load(f)
    return None


def test_cookies():
    """测试 cookies 是否有效"""
    # cookies 文件路径
    cookies_file = Path(__file__).parent / "app" / "xhs_cookies.json"
    
    print("=" * 60)
    print("🧪 测试小红书 Cookies 有效性")
    print("=" * 60)
    
    # 加载 cookies
    cookies = load_cookies(str(cookies_file))
    if not cookies:
        print(f"❌ 未找到 cookies 文件: {cookies_file}")
        print("\n请先运行登录命令:")
        print("   python -m app.services.xiaohongshu --login")
        return False
    
    print(f"\n✅ 已加载 {len(cookies)} 个 cookies")
    
    # 打印关键 cookies
    print("\n📋 关键 Cookies:")
    key_cookies = ["web_session", "a1", "webId"]
    for cookie in cookies:
        name = cookie.get("name")
        if name in key_cookies:
            value = cookie.get("value", "")[:20] + "..." if len(cookie.get("value", "")) > 20 else cookie.get("value", "")
            expires = cookie.get("expires", -1)
            print(f"   • {name}: {value}")
            if expires > 0:
                from datetime import datetime
                expire_date = datetime.fromtimestamp(expires)
                print(f"     过期时间: {expire_date}")
    
    # 启动浏览器测试
    print("\n🚀 启动浏览器测试...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # 显示浏览器，便于观察
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ]
        )
        
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )
        
        # 添加 cookies
        context.add_cookies(cookies)
        
        page = context.new_page()
        
        # 测试 1: 访问首页
        print("\n📍 测试 1: 访问小红书首页...")
        try:
            page.goto("https://www.xiaohongshu.com", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            
            # 检查是否登录
            is_logged_in = page.evaluate("""
                () => {
                    // 检查登录状态
                    const hasUserInfo = document.querySelector('.user-avatar, .user-info, [class*="user-menu"]');
                    const hasLoginButton = document.querySelector('.login-btn, [class*="login-button"]');
                    const bodyText = document.body.innerText;
                    
                    return {
                        hasUserInfo: !!hasUserInfo,
                        hasLoginButton: !!hasLoginButton,
                        needLogin: bodyText.includes('登录') && bodyText.includes('扫码'),
                    };
                }
            """)
            
            if is_logged_in.get("hasUserInfo"):
                print("   ✅ 首页: 已登录")
            elif is_logged_in.get("needLogin"):
                print("   ❌ 首页: 需要登录")
            else:
                print("   ⚠️ 首页: 状态不明")
            
        except Exception as e:
            print(f"   ❌ 访问首页失败: {e}")
        
        # 测试 2: 访问搜索页面
        print("\n📍 测试 2: 访问搜索页面...")
        try:
            search_url = "https://www.xiaohongshu.com/search_result?keyword=美股&source=unknown"
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            
            # 检查搜索页面状态
            search_status = page.evaluate("""
                () => {
                    const bodyText = document.body.innerText;
                    const hasNotes = document.querySelectorAll('section.note-item, .note-item').length > 0;
                    const hasLoginPopup = document.querySelector('[class*="login-modal"], [class*="login-popup"]');
                    
                    return {
                        hasNotes: hasNotes,
                        hasLoginPopup: !!hasLoginPopup && hasLoginPopup.offsetParent !== null,
                        needLogin: bodyText.includes('登录后查看'),
                    };
                }
            """)
            
            if search_status.get("hasNotes"):
                print("   ✅ 搜索页: 可以看到搜索结果")
            elif search_status.get("hasLoginPopup") or search_status.get("needLogin"):
                print("   ❌ 搜索页: 需要登录（弹窗或提示）")
                page.screenshot(path="debug_search_login_required.png")
                print("   📸 已保存截图: debug_search_login_required.png")
            else:
                print("   ⚠️ 搜索页: 状态不明")
            
        except Exception as e:
            print(f"   ❌ 访问搜索页失败: {e}")
        
        print("\n⏳ 浏览器将在 10 秒后关闭，请观察页面状态...")
        page.wait_for_timeout(10000)
        
        browser.close()
    
    print("\n" + "=" * 60)
    print("✅ 测试完成")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    test_cookies()


#!/usr/bin/env python3
"""Local Playwright collector for Kolvex's CNN Fear & Greed Index.

Opens https://www.cnn.com/markets/fear-and-greed in a real browser, captures the chart
JSON the page itself loads (``production.dataviz.cnn.io/index/fearandgreed/graphdata``)
and posts it unchanged to the Kolvex backend, which validates it and upserts one row
per day. CNN refuses plain HTTP clients, so the request has to come from the page.

Run once (``./start.sh``) or let ``./install_worker.sh`` schedule it with launchd.
Exits non-zero when nothing was captured or the backend rejected the data, so the
launchd log shows every failure; nothing is written on failure.

Configuration comes from the environment or ``.env.worker`` next to this file:
KOLVEX_API_URL (backend origin, without /api/v1) and KOLVEX_WORKER_TOKEN (same value
as the backend's FEAR_GREED_WORKER_TOKEN). Optional: FEAR_GREED_BROWSER_CHANNEL
(default ``chrome`` = the installed Google Chrome; empty = Playwright's Chromium) and
FEAR_GREED_HEADLESS (default ``true``).
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PAGE_URL = 'https://www.cnn.com/markets/fear-and-greed'
DATA_MARKER = 'production.dataviz.cnn.io/index/fearandgreed/graphdata'
ROOT = Path(__file__).parent
PAGE_TIMEOUT_MS = 60_000


def log(message):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), message, file=sys.stderr, flush=True)


def load_config(require_backend=True):
    values = {}
    env_file = ROOT / '.env.worker'
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"\'')

    def get(key, default=''):
        return os.environ.get(key, values.get(key, default))

    config = {
        'url': get('KOLVEX_API_URL').rstrip('/'),
        'token': get('KOLVEX_WORKER_TOKEN'),
        'channel': get('FEAR_GREED_BROWSER_CHANNEL', 'chrome'),
        'headless': get('FEAR_GREED_HEADLESS', 'true').lower() != 'false',
    }
    if require_backend and (not config['url'] or not config['token']):
        raise SystemExit('请在 .env.worker 里填写 KOLVEX_API_URL 和 KOLVEX_WORKER_TOKEN')
    return config


def capture(channel, headless):
    """Return the chart JSON the CNN page requests, or raise RuntimeError."""
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(channel=channel or None, headless=headless)
        except PlaywrightError:
            if not channel:
                raise
            log(f'找不到浏览器 {channel}，改用 Playwright 自带的 Chromium')
            browser = playwright.chromium.launch(headless=headless)
        try:
            page = browser.new_context(locale='en-US', timezone_id='America/New_York').new_page()
            with page.expect_response(
                lambda response: DATA_MARKER in response.url and response.request.method == 'GET',
                timeout=PAGE_TIMEOUT_MS,
            ) as captured:
                page.goto(PAGE_URL, wait_until='domcontentloaded', timeout=PAGE_TIMEOUT_MS)
            response = captured.value
            if not response.ok:
                raise RuntimeError(f'CNN 数据请求返回 HTTP {response.status}')
            return response.json()
        except PlaywrightError as error:
            raise RuntimeError(f'没有抓到 CNN 数据：{error}') from error
        finally:
            browser.close()


def post(config, payload):
    request = Request(
        config['url'] + '/api/v1/fear-greed/worker/cnn',
        data=json.dumps(payload).encode(),
        method='POST',
        headers={'Content-Type': 'application/json', 'X-Worker-Token': config['token']},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        detail = error.read().decode(errors='replace')[:300]
        raise RuntimeError(f'后端拒绝（HTTP {error.code}）：{detail}') from error
    except URLError as error:
        raise RuntimeError(f'连不上后端：{error.reason}') from error


def main():
    parser = argparse.ArgumentParser(description='抓取 CNN 恐慌与贪婪指数并同步到 Kolvex')
    parser.add_argument('--dry-run', action='store_true', help='只抓取并打印摘要，不发送到后端')
    args = parser.parse_args()
    config = load_config(require_backend=not args.dry_run)

    try:
        payload = capture(config['channel'], config['headless'])
        if args.dry_run:
            current = payload.get('fear_and_greed', {})
            points = payload.get('fear_and_greed_historical', {}).get('data', [])
            log(f"抓取成功：当前 {current.get('score')}（{current.get('rating')}，"
                f"{current.get('timestamp')}），历史 {len(points)} 个点；未发送")
            return
        result = post(config, payload)
    except RuntimeError as error:
        log(f'失败：{error}')
        sys.exit(1)
    log(f"已同步 {result['count']} 天（{result['first_date']} 至 {result['last_date']}），"
        f"最新 {result['latest_score']}")


if __name__ == '__main__':
    main()

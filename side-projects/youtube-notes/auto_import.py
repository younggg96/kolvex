#!/usr/bin/env python3
"""Local worker for Kolvex's automatic YouTube opinion import.

Polls the Kolvex backend once a minute. When a run is waiting (an admin clicked
"run now", or the daily scheduled time has passed) it:

1. lists the website's untracked videos (same as ``./start.sh batch untracked``),
2. fetches their transcripts locally (same as ``batch run --transcript-only``),
3. posts each transcript to the backend, which analyzes it with DeepSeek and
   imports the opinions. The DeepSeek key stays on the backend.

Configuration comes from the environment or ``.env.worker`` next to this file:
KOLVEX_API_URL (backend origin, e.g. https://api.example.com) and
KOLVEX_WORKER_TOKEN (same value as the backend's YOUTUBE_IMPORT_WORKER_TOKEN).
"""
import argparse
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from batch import discover_untracked, run_batch
from pipeline import DEFAULT_MODEL

ROOT = Path(__file__).parent
MANIFEST = ROOT / 'batches/kolvex-untracked.json'
OUTPUT = ROOT / 'output'
VERSION = '1'
POLL_SECONDS = 60
HEARTBEAT_SECONDS = 60


class RunGone(Exception):
    """The backend no longer considers this run active (finished, failed as stale, or deleted)."""


def log(message):
    print(time.strftime('%Y-%m-%d %H:%M:%S'), message, file=sys.stderr, flush=True)


def load_config():
    env_file = ROOT / '.env.worker'
    values = {}
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"\'')
    for key in ('YTDLP_COOKIES_FROM_BROWSER', 'YTDLP_COOKIES'):
        if values.get(key) and not os.environ.get(key):
            os.environ[key] = values[key]  # Read by pipeline.ytdlp for YouTube sign-in.
    url = os.environ.get('KOLVEX_API_URL') or values.get('KOLVEX_API_URL')
    token = os.environ.get('KOLVEX_WORKER_TOKEN') or values.get('KOLVEX_WORKER_TOKEN')
    if not url or not token:
        raise SystemExit('缺少 KOLVEX_API_URL 或 KOLVEX_WORKER_TOKEN，请写入 .env.worker（参考 .env.worker.example）。')
    return url.rstrip('/'), token


class Client:
    def __init__(self, base_url, token):
        self.base = base_url + '/api/v1/youtube-auto-import/worker/'
        self.token = token

    def post(self, path, body, timeout=60):
        request = Request(self.base + path, data=json.dumps(body, ensure_ascii=False).encode(), method='POST',
                          headers={'Content-Type': 'application/json', 'X-Worker-Token': self.token,
                                   'User-Agent': 'Kolvex-youtube-worker/' + VERSION})
        try:
            with urlopen(request, timeout=timeout) as response:
                return json.loads(response.read() or b'{}')
        except HTTPError as error:
            detail = ''
            try:
                detail = json.loads(error.read()).get('detail', '')
            except Exception:
                pass
            if error.code in (404, 409) and path.startswith('runs/'):
                raise RunGone(detail or str(error.code)) from error
            raise RuntimeError(f'Kolvex 接口 {path} 返回 {error.code} {detail}'.strip()) from error


def transcript_text(output_dir):
    folder = Path(output_dir or '/nonexistent')
    data = folder / 'transcript.json'
    if data.is_file():
        payload = json.loads(data.read_text())
        segments = payload.get('segments') or []
        text = '\n'.join(item.get('text', '').strip() for item in segments if item.get('text'))
        if text.strip():
            return text, payload
    for name in ('zh.txt', 'original.txt'):
        if (folder / name).is_file():
            text = (folder / name).read_text().strip()
            if text:
                return text, {}
    return '', {}


def manifest_progress():
    try:
        videos = json.loads(MANIFEST.read_text()).get('videos', [])
    except Exception:
        return 0, 0, None
    done = sum(item.get('status') in ('done', 'error') for item in videos)
    current = next((item.get('title') for item in videos if item.get('status') == 'running'), None)
    return done, len(videos), current


def process(client, run):
    run_id = run['id']
    imported = {item['video_id'] for item in run.get('videos') or [] if item.get('status') == 'imported'}
    state = {'stage': 'discover', 'done': 0, 'total': 0, 'current': None}
    stop = threading.Event()

    def beat():
        while not stop.wait(HEARTBEAT_SECONDS):
            if state['stage'] == 'transcribe':
                state['done'], state['total'], state['current'] = manifest_progress()
            try:
                client.post(f'runs/{run_id}/heartbeat', {k: (v[:300] if isinstance(v, str) else v) for k, v in state.items()})
            except RunGone:
                stop.set()
            except Exception as error:
                log(f'心跳失败：{error}')

    threading.Thread(target=beat, daemon=True).start()
    try:
        log(f'开始运行 {run_id}（{run.get("trigger")}）')
        manifest = discover_untracked(MANIFEST)
        log(f'网站未追踪视频 {len(manifest["videos"])} 个')
        state.update(stage='transcribe', total=len(manifest['videos']))
        client.post(f'runs/{run_id}/heartbeat', state)
        if manifest['videos']:
            # Retry earlier failures too: a daily run should pick up videos that failed yesterday.
            manifest, _ = run_batch(MANIFEST, OUTPUT, DEFAULT_MODEL, transcript_only=True, retry_failed=True)
        failures = []
        pending = [item for item in manifest['videos'] if item['id'] not in imported]
        state.update(stage='analyze', done=0, total=len(pending), current=None)
        client.post(f'runs/{run_id}/heartbeat', state)
        for index, item in enumerate(pending):
            text, meta = transcript_text(item.get('output_dir')) if item.get('status') == 'done' else ('', {})
            if not text:
                failures.append({'video_id': item['id'], 'title': item.get('title'), 'channel_title': item.get('channel'),
                                 'error': (item.get('error') or '没有可用字幕')[:500]})
                continue
            state.update(done=index, current=item.get('title'))
            body = {
                'video_id': item['id'], 'title': item.get('title') or meta.get('title') or item['id'],
                'published_at': item['published_at'], 'channel_id': item['channel_id'],
                'channel_title': item.get('channel') or meta.get('channel') or item['channel_id'],
                'channel_handle': meta.get('channel_handle'), 'channel_url': item.get('channel_url') or meta.get('channel_url'),
                'transcript': text,
            }
            # DeepSeek reasoning on a long transcript can take several minutes.
            result = client.post(f'runs/{run_id}/videos', body, timeout=900)
            log(f'{item["id"]} {result.get("status")} {result.get("tickers") or result.get("error") or ""}')
        stop.set()
        client.post(f'runs/{run_id}/finish', {'transcript_failures': failures})
        log(f'运行 {run_id} 结束')
    except RunGone as gone:
        log(f'运行 {run_id} 已在后台结束：{gone}')
    except Exception as error:
        log(f'运行 {run_id} 失败：{error}')
        try:
            client.post(f'runs/{run_id}/finish', {'error': str(error)[:1000]})
        except Exception as report:
            log(f'无法上报失败：{report}')
    finally:
        stop.set()


def main(argv=None):
    parser = argparse.ArgumentParser(description='Kolvex YouTube 自动导入本地 worker')
    parser.add_argument('--once', action='store_true', help='只检查一次，有任务就执行，然后退出')
    args = parser.parse_args(argv)
    client = Client(*load_config())
    hostname = socket.gethostname()
    log('worker 已启动' + ('（单次）' if args.once else f'，每 {POLL_SECONDS} 秒检查一次'))
    while True:
        try:
            run = client.post('claim', {'hostname': hostname, 'version': VERSION}).get('run')
            if run:
                process(client, run)
                continue  # Check again right away in case another run was queued meanwhile.
        except (URLError, RuntimeError, OSError) as error:
            log(f'无法连接 Kolvex：{error}')
        if args.once:
            return 0
        time.sleep(POLL_SECONDS)


if __name__ == '__main__':
    sys.exit(main())

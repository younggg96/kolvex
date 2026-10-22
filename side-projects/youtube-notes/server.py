"""Optional single-user localhost API with durable background jobs."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import threading
from urllib.parse import urlparse
import uuid

from pipeline import DEFAULT_MODEL, atomic_json, export, normalize_url, ollama, run_job

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('YOUTUBE_NOTES_DATA', str(ROOT / 'data'))).resolve()
LOCK = threading.RLock()
POOL = ThreadPoolExecutor(max_workers=1)


def read_job(folder):
    return json.loads((folder / 'job.json').read_text())


def update_job(folder, **changes):
    with LOCK:
        job = read_job(folder)
        job.update(changes)
        atomic_json(folder / 'job.json', job)


def process(folder):
    try:
        update_job(folder, status='running')
        run_job(read_job(folder), folder, lambda **kw: update_job(folder, **kw))
    except Exception as error:
        update_job(folder, status='error', message=str(error), stage='error')
    finally:
        # Keep textual results, discard bulky audio and intermediate captions.
        for path in folder.iterdir():
            if path.name not in ('job.json', 'result.json') and path.is_file():
                path.unlink(missing_ok=True)


def health():
    installed = []
    ollama_error = None
    try:
        installed = [m['name'] for m in ollama('/api/tags', timeout=3).get('models', [])]
    except Exception:
        ollama_error = 'Ollama 未启动。请运行 ollama serve。'
    return {'yt_dlp': importlib.util.find_spec('yt_dlp') is not None,
            'ffmpeg': bool(shutil.which('ffmpeg')),
            'mlx_whisper': importlib.util.find_spec('mlx_whisper') is not None,
            'models': installed, 'default_model': DEFAULT_MODEL, 'ollama_error': ollama_error}


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body, content_type='application/json; charset=utf-8', filename=None):
        if not isinstance(body, bytes):
            body = (body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; frame-ancestors 'none'")
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(body)

    def trusted(self):
        # Reject DNS rebinding and cross-site requests to a local service.
        host = self.headers.get('Host', '')
        allowed = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
        if host not in allowed:
            return False
        origin = self.headers.get('Origin')
        return not origin or origin in {f'http://{h}' for h in allowed}

    def do_GET(self):
        if not self.trusted():
            return self.send(403, {'error': '仅允许本机页面访问。'})
        path = urlparse(self.path).path
        try:
            if path == '/api/health':
                return self.send(200, health())
            if path == '/api/jobs':
                with LOCK:
                    jobs = [read_job(p.parent) for p in DATA.glob('*/job.json')]
                return self.send(200, sorted(jobs, key=lambda j: j['created_at'], reverse=True))
            match = re.fullmatch(r'/api/jobs/([a-f0-9]{32})(?:/(result|download)/(original\.(?:srt|vtt|txt)|zh\.(?:srt|vtt|txt)|transcript\.json|summary\.md))?', path)
            if match:
                job_id, action, name = match.groups()
                folder = DATA / job_id
                if not action:
                    return self.send(200, read_job(folder))
                result = json.loads((folder / 'result.json').read_text())
                if action == 'result':
                    return self.send(200, result)
                if name == 'transcript.json':
                    return self.send(200, result, filename=name)
                if name == 'summary.md':
                    if not result.get('summary'):
                        return self.send(409, {'error': '摘要尚未生成。'})
                    summary = result['summary']
                    text = f'# {result["title"]}\n\n{summary["overview"]}\n\n' + '\n'.join('- ' + p for p in summary['key_points'])
                else:
                    chinese = name.startswith('zh.')
                    if chinese and not all('zh' in s for s in result['segments']):
                        return self.send(409, {'error': '中文字幕尚未全部生成，可以先下载原文。'})
                    text = export(result['segments'], name.rsplit('.', 1)[1], chinese)
                return self.send(200, text, 'text/plain; charset=utf-8', name)
            if re.fullmatch(r'/api/jobs/[a-f0-9]{32}/result', path):
                return self.send(200, json.loads((DATA / path.split('/')[3] / 'result.json').read_text()))
            return self.send(404, {'error': '未找到内容。'})
        except FileNotFoundError:
            return self.send(404, {'error': '结果尚未生成或任务不存在。'})
        except Exception:
            return self.send(500, {'error': '读取失败，请刷新后重试。'})

    def do_POST(self):
        if not self.trusted():
            return self.send(403, {'error': '仅允许本机页面访问。'})
        if self.path != '/api/jobs':
            return self.send(404, {'error': '未找到接口。'})
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 4096:
                return self.send(400, {'error': '请求体为空或过长。'})
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError('请求体必须是 JSON 对象。')
            url = normalize_url(body.get('url', ''))
            model = body.get('model', DEFAULT_MODEL)
            state = health()
            if not state['yt_dlp']:
                return self.send(503, {'error': '缺少 yt-dlp，请先运行安装步骤。'})
            if state['ollama_error'] or model not in state['models']:
                return self.send(503, {'error': state['ollama_error'] or f'请先运行 ollama pull {DEFAULT_MODEL}，再刷新环境检查。'})
            with LOCK:
                jobs = [read_job(p.parent) for p in DATA.glob('*/job.json')]
                if any(j['status'] in ('queued', 'running') for j in jobs):
                    return self.send(409, {'error': '已有任务正在处理，请等待完成后再提交。'})
                job = {'id': uuid.uuid4().hex, 'url': url, 'model': model, 'status': 'queued',
                       'stage': 'queued', 'message': '等待处理…', 'has_result': False,
                       'created_at': datetime.now(timezone.utc).isoformat(), 'metadata': {}, 'warnings': []}
                folder = DATA / job['id']
                folder.mkdir(parents=True)
                atomic_json(folder / 'job.json', job)
                POOL.submit(process, folder)
            return self.send(202, job)
        except (ValueError, TypeError):
            return self.send(400, {'error': '请输入有效的单个 YouTube 视频链接和模型。'})
        except Exception:
            return self.send(500, {'error': '创建任务失败，请稍后重试。'})

    def log_message(self, *_args):
        pass


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    for file in DATA.glob('*/job.json'):
        job = read_job(file.parent)
        if job['status'] in ('queued', 'running'):
            update_job(file.parent, status='error', stage='error', message='服务上次退出时任务中断，已有结果已保留。请重新提交链接。')
    port = int(os.environ.get('PORT', '8765'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'听记 API 已启动：http://127.0.0.1:{port}/api/health', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务已停止。正在进行的任务可能需要等待当前步骤退出。')
    finally:
        server.server_close()
        POOL.shutdown(wait=False, cancel_futures=True)


if __name__ == '__main__':
    main()

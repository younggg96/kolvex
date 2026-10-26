#!/usr/bin/env python3
"""CLI: YouTube URL -> local transcript, Chinese captions and summary."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import uuid

from pipeline import (DEFAULT_MODEL, atomic_json, export, fetch_transcript,
                      normalize_url, ollama, run_job)


def check_environment(model=DEFAULT_MODEL, transcript_only=False):
    state = {'yt_dlp': importlib.util.find_spec('yt_dlp') is not None,
             'ffmpeg': bool(shutil.which('ffmpeg')),
             'mlx_whisper': importlib.util.find_spec('mlx_whisper') is not None,
             'models': [], 'ollama_error': None}
    try:
        state['models'] = [m['name'] for m in ollama('/api/tags', timeout=3).get('models', [])]
    except Exception:
        state['ollama_error'] = 'Ollama 未启动，请运行 ollama serve。'
    state['ready'] = state['yt_dlp'] and (transcript_only or model in state['models'])
    return state


def require_environment(model, transcript_only=False):
    state = check_environment(model, transcript_only)
    if not state['yt_dlp']:
        raise RuntimeError('缺少 yt-dlp，请先运行 ./setup.sh。')
    if not transcript_only:
        if state['ollama_error']:
            raise RuntimeError(state['ollama_error'])
        if model not in state['models']:
            raise RuntimeError(f'未安装模型 {model}。请先运行 ollama pull {model}。')


def export_files(folder):
    path = folder / 'result.json'
    if not path.exists():
        return
    result = json.loads(path.read_text())
    segments = result['segments']
    atomic_json(folder / 'transcript.json', result)
    for extension in ('srt', 'vtt', 'txt'):
        (folder / f'original.{extension}').write_text(export(segments, extension, False))
        if segments and all('zh' in s for s in segments):
            (folder / f'zh.{extension}').write_text(export(segments, extension))
    if result.get('summary'):
        summary = result['summary']
        (folder / 'summary.md').write_text(f'# {result["title"]}\n\n{summary["overview"]}\n\n' + '\n'.join('- ' + p for p in summary['key_points']) + '\n')


def process_video(url, output_root, model=DEFAULT_MODEL, transcript_only=False, on_progress=None):
    url = normalize_url(url)
    video_id = url.rsplit('=', 1)[1]
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')
    folder = Path(output_root).resolve() / video_id / f'{stamp}-{uuid.uuid4().hex[:8]}'
    folder.mkdir(parents=True)
    job = {'url': url, 'model': model, 'status': 'running', 'transcript_only': transcript_only}
    def update(**changes):
        job.update(changes)
        atomic_json(folder / 'job.json', job)
        if 'message' in changes:
            print(changes['message'], file=sys.stderr, flush=True)
        if on_progress:
            on_progress(folder, job)
    try:
        update(message='开始处理视频…')
        if transcript_only:
            metadata, language, segments, source, warnings = fetch_transcript(url, folder, update)
            atomic_json(folder / 'result.json', {'id': metadata.get('id'), 'title': metadata['title'], 'url': url,
                        'channel': metadata.get('channel'), 'channel_id': metadata.get('channel_id'),
                        'channel_url': metadata.get('channel_url'), 'channel_handle': metadata.get('uploader_id'),
                        'published_at': metadata.get('published_at'),
                        'language': language, 'duration': metadata['duration'], 'source': source,
                        'segments': segments, 'summary': None})
            update(status='done', stage='done', message='原文字幕已生成。', warnings=warnings)
        else:
            run_job(job, folder, update)
    except BaseException as error:
        update(status='error', message=str(error) or '任务被中断。')
        raise
    finally:
        export_files(folder)
        for path in folder.iterdir():
            if path.name.startswith(('audio.', 'captions.')) or path.name == 'whisper.json':
                path.unlink(missing_ok=True)
    return folder


def main(argv=None):
    parser = argparse.ArgumentParser(description='YouTube → 中文字幕 + 中文摘要（本地处理，无前端）')
    parser.add_argument('url', nargs='?', help='单个 YouTube 视频链接')
    parser.add_argument('--model', default=DEFAULT_MODEL, help='已安装的 Ollama 模型')
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'output', help='结果保存根目录')
    parser.add_argument('--transcript-only', action='store_true', help='只获取原文字幕/转写，不调用语言模型')
    parser.add_argument('--check', action='store_true', help='检查本地环境')
    args = parser.parse_args(argv)
    if args.check:
        state = check_environment(args.model, args.transcript_only)
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return 0 if state['ready'] else 1
    if not args.url:
        parser.error('请传入视频链接，或使用 --check。')
    try:
        normalize_url(args.url)
        require_environment(args.model, args.transcript_only)
        folder = process_video(args.url, args.output, args.model, args.transcript_only)
        print(f'结果已保存：{folder}')
        return 0
    except (Exception, KeyboardInterrupt) as error:
        print(f'处理失败：{error or "已中断"}\n已获取的内容保留在 {args.output.resolve()}。', file=sys.stderr)
        return 130 if isinstance(error, KeyboardInterrupt) else 1


if __name__ == '__main__':
    sys.exit(main())

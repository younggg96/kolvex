#!/usr/bin/env python3
"""Combine saved YouTube jobs and captions without calling a language model."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path, PurePosixPath
import sys
from zipfile import ZipFile, BadZipFile

from pipeline import atomic_json

ROOT = Path(__file__).parent


def combine(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.exists():
        raise ValueError('输入路径不存在。')
    if output == source or output.name in {'job.json', 'transcript.json', 'manifest.json', 'result.json'}:
        raise ValueError('输出路径不能覆盖原始任务或字幕文件。')
    archive = ZipFile(source) if source.suffix.lower() == '.zip' else None
    try:
        if archive:
            names = archive.namelist()
            manifests = [name for name in names if PurePosixPath(name).name == 'manifest.json']
            if len(manifests) != 1:
                raise ValueError('ZIP 中需要恰好一个 manifest.json。')
            manifest_name = manifests[0]
            base = str(PurePosixPath(manifest_name).parent)
            base = '' if base == '.' else base + '/'

            def read(relative):
                name = base + relative
                if name not in names:
                    return None
                if archive.getinfo(name).file_size > 50_000_000:
                    raise ValueError(f'文件过大：{name}')
                return archive.read(name).decode('utf-8-sig')

            manifest = json.loads(archive.read(manifest_name))
        else:
            if source.is_file():
                manifest_path = source
                base = source.parent
            else:
                manifests = list(source.glob('manifest.json')) + list(source.glob('*/manifest.json'))
                if len(manifests) > 1:
                    raise ValueError('发现多个 manifest.json，请指定一个批次。')
                manifest_path = manifests[0] if manifests else None
                base = manifest_path.parent if manifest_path else source

            def read(relative):
                path = base / relative
                return path.read_text(encoding='utf-8-sig') if path.is_file() else None

            manifest = json.loads(manifest_path.read_text()) if manifest_path else None

        items = []
        if manifest is not None:
            videos = manifest.get('videos')
            if not isinstance(videos, list):
                raise ValueError('manifest.json 缺少 videos 数组。')
            for video in videos:
                video_id = video.get('id')
                if not isinstance(video_id, str) or len(video_id) != 11 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-' for c in video_id):
                    raise ValueError('清单包含无效的视频 ID。')
                relative = f'videos/{video_id}'
                # Exported batches contain portable files. A live batch points
                # to its existing output directory instead.
                folder = Path(video.get('output_dir', '')) if not archive else None

                def video_read(name):
                    value = read(f'{relative}/{name}')
                    if value is None and folder and str(folder) != '.':
                        path = folder / name if folder.is_absolute() else base / folder / name
                        if path.is_file():
                            value = path.read_text(encoding='utf-8-sig')
                    return value

                job_text = video_read('job.json')
                metadata_text = read(f'metadata/{video_id}.json')
                transcript_text = video_read('transcript.json')
                transcript = json.loads(transcript_text) if transcript_text is not None else {}
                # The archived manifest is the original task record when no
                # separate job.json was packaged; retain it without inventing fields.
                job = json.loads(job_text) if job_text is not None else dict(video)
                if metadata_text is not None:
                    job['metadata'] = json.loads(metadata_text)
                elif 'metadata' not in job:
                    job['metadata'] = {key: transcript[key] for key in (
                        'id', 'title', 'channel', 'channel_id', 'channel_url', 'published_at', 'duration')
                        if transcript.get(key) is not None}
                zh = video_read('zh.txt')
                missing = [] if zh is not None else ['zh.txt']
                # Chinese source captions need no AI translation. Keep their
                # original wording when a separate zh.txt was not exported.
                if zh is None and str(transcript.get('language', '')).startswith('zh'):
                    zh = video_read('original.txt')
                item = {'task_directory': relative, 'job': job, 'zh': zh, 'missing_files': missing}
                if zh is None:
                    original = video_read('original.txt')
                    if original is not None:
                        item['original'] = original
                items.append(item)
        else:
            if not source.is_dir():
                raise ValueError('请输入输出目录、批次清单或批次 ZIP。')
            for job_path in sorted(source.rglob('job.json')):
                folder = job_path.parent
                zh_path = folder / 'zh.txt'
                items.append({'task_directory': folder.relative_to(source).as_posix(),
                              'job': json.loads(job_path.read_text()),
                              'zh': zh_path.read_text() if zh_path.is_file() else None,
                              'missing_files': [] if zh_path.is_file() else ['zh.txt']})
        if not items:
            raise ValueError('没有找到视频任务数据。')
        payload = {'generated_at': datetime.now(timezone.utc).isoformat(),
                   'source_directory': str(source), 'task_count': len(items),
                   'with_zh_count': sum(item['zh'] is not None for item in items), 'items': items}
        output.parent.mkdir(parents=True, exist_ok=True)
        atomic_json(output, payload)
        return payload
    finally:
        if archive:
            archive.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description='整合视频任务和字幕为 JSON，不调用模型')
    parser.add_argument('source', type=Path, nargs='?', default=ROOT / 'output',
                        help='输出目录、manifest.json 或批次 ZIP')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/combined_jobs_zh.json')
    args = parser.parse_args(argv)
    try:
        result = combine(args.source, args.output)
        print(f'已整合 {result["task_count"]} 个任务，{result["with_zh_count"]} 个含中文字幕。')
        print(f'文件：{args.output.resolve()}')
        return 0
    except (OSError, ValueError, KeyError, BadZipFile) as error:
        print(f'整合失败：{error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

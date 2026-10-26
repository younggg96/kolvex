#!/usr/bin/env python3
"""Discover creator videos into an auditable manifest, then process/resume it."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime, timezone
import fcntl
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from pipeline import DEFAULT_MODEL, MAX_DURATION, atomic_json, normalize_url, ytdlp
from youtube_transcribe import process_video, require_environment

ROOT = Path(__file__).parent


def kolvex_public_json(endpoint):
    request = Request('https://kolvex.app/api/youtube-opinions/' + endpoint,
                      headers={'Accept': 'application/json', 'User-Agent': 'Tingji-local-batch/1.0'})
    with urlopen(request, timeout=45) as response:
        raw = response.read(5_000_001)
    if len(raw) > 5_000_000:
        raise ValueError('Kolvex 返回数据过大，未更新清单。')
    return json.loads(raw)


def discover_untracked(manifest_path):
    """Replace the active selection with the website's latest missing uploads only."""
    report = kolvex_public_json('coverage')
    if not isinstance(report, dict) or report.get('status') != 'available' or not isinstance(report.get('creators'), list):
        raise ValueError('无法确认网站未追踪视频，未更新清单；请稍后重试。')
    dashboard = kolvex_public_json('dashboard?limit=1')
    if not isinstance(dashboard, dict) or not isinstance(dashboard.get('creators'), list):
        raise ValueError('无法读取博主身份，未更新清单。')
    creators = {item['channel_id']: item for item in dashboard['creators'] if isinstance(item, dict) and isinstance(item.get('channel_id'), str)}
    selection, warnings = {}, []
    for coverage in report['creators']:
        if not isinstance(coverage, dict) or not isinstance(coverage.get('channel_id'), str):
            raise ValueError('视频覆盖数据格式错误，未更新清单。')
        identity = coverage['channel_id']
        if coverage.get('status') != 'available':
            raise ValueError(f'无法确认博主 {identity} 的未追踪视频，未更新清单。')
        videos = coverage.get('untracked')
        if not isinstance(videos, list):
            raise ValueError('未追踪视频列表格式错误，未更新清单。')
        if coverage.get('truncated'):
            warnings.append(f'{identity} 的查询范围被截断；本批次只包含接口已确认的未追踪视频。')
        creator = creators.get(identity, {})
        for video in videos:
            if not isinstance(video, dict) or not isinstance(video.get('video_id'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video['video_id']):
                raise ValueError('未追踪视频 ID 格式错误，未更新清单。')
            published = video.get('published_at')
            if not isinstance(published, str):
                raise ValueError('未追踪视频缺少发布时间，未更新清单。')
            instant = datetime.fromisoformat(published.replace('Z', '+00:00'))
            if instant.tzinfo is None:
                raise ValueError('视频发布时间缺少时区，未更新清单。')
            cutoff = coverage.get('since')
            if not isinstance(cutoff, str):
                raise ValueError('博主缺少上次追踪时间，未更新清单。')
            previous = datetime.fromisoformat(cutoff.replace('Z', '+00:00'))
            if previous.tzinfo is None or instant <= previous:
                raise ValueError('接口包含非最新的未追踪视频，未更新清单。')
            video_id = video['video_id']
            selection.setdefault(video_id, {
                'id': video_id, 'url': normalize_url('https://www.youtube.com/watch?v=' + video_id),
                'title': video.get('title') or video_id, 'channel': creator.get('channel_title') or identity,
                'channel_id': identity, 'channel_url': creator.get('channel_url'),
                'published_at': instant.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'upload_date': None, 'duration': None, 'status': 'pending', 'attempts': 0,
            })
    path = Path(manifest_path).resolve()
    with manifest_lock(path):
        old = json.loads(path.read_text()) if path.exists() else {}
        if old and old.get('source') != 'kolvex_untracked':
            raise ValueError('此路径已有其他类型的批次，请为未追踪视频选择新的 --output 路径。')
        known = {item['id']: item for item in old.get('videos', [])}
        videos = []
        for video_id, item in selection.items():
            # Keep resumable local work only for IDs still missing on the website.
            videos.append(known.get(video_id, {}) | item | {
                key: known[video_id][key] for key in ('status', 'attempts', 'mode', 'output_dir', 'stage', 'error')
                if video_id in known and key in known[video_id]
            })
        videos.sort(key=lambda item: item['published_at'], reverse=True)
        manifest = {'version': 1, 'source': 'kolvex_untracked', 'updated_at': datetime.now(timezone.utc).isoformat(),
                    'videos': videos, 'latest_matches': [item['id'] for item in videos], 'discovery_errors': [], 'warnings': warnings}
        atomic_json(path, manifest)
    return manifest


def channel_url(value):
    value = value.strip()
    if value.startswith('@'):
        value = 'https://www.youtube.com/' + value
    parsed = urlparse(value)
    if parsed.scheme != 'https' or parsed.hostname not in ('youtube.com', 'www.youtube.com', 'm.youtube.com') or parsed.username or parsed.password:
        raise ValueError('频道需要使用 @账号或 https://www.youtube.com/@账号 格式。')
    parts = parsed.path.strip('/').split('/')
    if parts[-1] in ('videos', 'shorts', 'streams'):
        parts.pop()
    valid = len(parts) == 1 and re.fullmatch(r'@[\w.\-\u0080-\uffff]+', parts[0])
    valid = valid or (len(parts) == 2 and parts[0] in ('channel', 'c', 'user') and re.fullmatch(r'[\w.\-\u0080-\uffff]+', parts[1]))
    if not valid:
        raise ValueError('请输入博主频道链接，不是单个视频或搜索页链接。')
    return 'https://www.youtube.com/' + '/'.join(parts) + '/videos'


def parse_date(value):
    if not isinstance(value, str):
        raise ValueError('日期应为 YYYY-MM-DD。')
    return date.fromisoformat(value)


@contextmanager
def manifest_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_suffix(path.suffix + '.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('该批次正在另一个进程中处理，请等待完成。')
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def validate_config(config):
    if not isinstance(config, dict):
        raise ValueError('配置必须是 JSON 对象。')
    defaults = {'channels': [], 'keywords': [], 'exclude_keywords': [], 'since': None,
                'until': None, 'limit': 10, 'scan_limit': 50}
    config = defaults | config
    for field in ('channels', 'keywords', 'exclude_keywords'):
        if not isinstance(config[field], list) or not all(isinstance(v, str) and v.strip() for v in config[field]):
            raise ValueError(f'{field} 必须是非空字符串数组。')
    if not config['channels']:
        raise ValueError('至少提供一个频道：--channel @账号 或配置文件中的 channels。')
    if len(config['channels']) > 100:
        raise ValueError('单次最多支持 100 个频道。')
    for field in ('limit', 'scan_limit'):
        if type(config[field]) is not int or not 1 <= config[field] <= 500:
            raise ValueError(f'{field} 必须是 1–500 的整数。')
    if config['limit'] > config['scan_limit']:
        raise ValueError('limit 不能超过 scan_limit。')
    for field in ('since', 'until'):
        if config[field]:
            parse_date(config[field])
    if config['since'] and config['until'] and config['since'] > config['until']:
        raise ValueError('since 不能晚于 until。')
    config['channels'] = list(dict.fromkeys(channel_url(c) for c in config['channels']))
    return config


def matches_title(title, config):
    title = title.casefold()
    return (not config['keywords'] or any(k.casefold() in title for k in config['keywords'])) and not any(k.casefold() in title for k in config['exclude_keywords'])


def discover(config, manifest_path):
    config = validate_config(config)
    manifest_path = Path(manifest_path).resolve()
    with manifest_lock(manifest_path):
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version': 1, 'videos': [], 'discovery_errors': []}
        known = {item['id']: item for item in manifest['videos']}
        found = []
        errors = []
        for channel in config['channels']:
            print(f'检查频道：{channel}', file=sys.stderr, flush=True)
            try:
                payload = json.loads(ytdlp('--flat-playlist', '--dump-single-json', '--skip-download',
                                          '--playlist-end', str(config['scan_limit']), channel, playlist=True, timeout=300))
                count = 0
                for entry in payload.get('entries', []):
                    if count >= config['limit']:
                        break
                    title = entry.get('title', '')
                    if not matches_title(title, config) or entry.get('live_status') in ('is_live', 'is_upcoming'):
                        continue
                    video_id = entry.get('id', '')
                    if not re.fullmatch(r'[\w-]{11}', video_id, flags=re.ASCII):
                        continue
                    url = normalize_url('https://www.youtube.com/watch?v=' + video_id)
                    uploaded = entry.get('upload_date')
                    duration = entry.get('duration')
                    # Flat channel extraction may omit upload dates. Resolve exact
                    # metadata before filtering, never silently treat unknown dates as a match.
                    if (config['since'] or config['until']) and not uploaded:
                        try:
                            details = json.loads(ytdlp('--dump-single-json', '--skip-download', url))
                            uploaded, duration = details.get('upload_date'), details.get('duration')
                        except Exception as error:
                            errors.append({'channel': channel, 'url': url, 'error': str(error)})
                            continue
                    if config['since'] or config['until']:
                        if not uploaded:
                            errors.append({'channel': channel, 'url': url, 'error': '无法获取上传日期，未纳入筛选结果。'})
                            continue
                        day = datetime.strptime(uploaded, '%Y%m%d').date().isoformat()
                        if config['since'] and day < config['since'] or config['until'] and day > config['until']:
                            continue
                    if duration and duration > MAX_DURATION:
                        continue
                    count += 1
                    item = known.get(video_id)
                    if item is None:
                        published = entry.get('timestamp')
                        item = {'id': video_id, 'url': url, 'title': title, 'channel': payload.get('channel') or payload.get('title') or channel,
                                'channel_id': payload.get('channel_id'), 'channel_url': payload.get('channel_url') or channel,
                                'published_at': datetime.fromtimestamp(published, timezone.utc).isoformat().replace('+00:00', 'Z') if isinstance(published, (int, float)) else None,
                                'upload_date': uploaded, 'duration': duration, 'status': 'pending', 'attempts': 0}
                        known[video_id] = item
                        manifest['videos'].append(item)
                    found.append(video_id)
                print(f'  匹配 {count} 个视频（仅扫描最近 {config["scan_limit"]} 条上传）', file=sys.stderr)
            except Exception as error:
                errors.append({'channel': channel, 'error': str(error)})
        manifest.update(config=config, updated_at=datetime.now(timezone.utc).isoformat(), discovery_errors=errors,
                        latest_matches=list(dict.fromkeys(found)))
        atomic_json(manifest_path, manifest)
    return manifest


def run_batch(manifest_path, output, model, transcript_only=False, retry_failed=False):
    manifest_path = Path(manifest_path).resolve()
    if json.loads(manifest_path.read_text()).get('source') == 'kolvex_untracked':
        # Fail closed if the website cannot be checked; never silently run an old selection.
        discover_untracked(manifest_path)
    with manifest_lock(manifest_path):
        manifest = json.loads(manifest_path.read_text())
        if not manifest['videos']:
            return manifest, 0
        require_environment(model, transcript_only)
        failed = 0
        for index, item in enumerate(manifest['videos']):
            mode = 'transcript' if transcript_only else 'chinese_notes'
            # A completed transcript-only job does not satisfy a later full run.
            result_file = Path(item.get('output_dir', '/nonexistent')) / 'transcript.json'
            complete = item['status'] == 'done' and item.get('mode') == mode and result_file.is_file()
            if complete or item['status'] == 'error' and not retry_failed:
                if item['status'] == 'error':
                    failed += 1
                continue
            item.update(status='running', mode=mode, attempts=item.get('attempts', 0) + 1, error=None)
            atomic_json(manifest_path, manifest)
            print(f'\n[{index + 1}/{len(manifest["videos"])}] {item["title"]}', file=sys.stderr, flush=True)
            def progress(folder, job):
                item['output_dir'] = str(folder)
                item['stage'] = job.get('stage')
                metadata = job.get('metadata', {})
                for source, target in (('title', 'title'), ('channel', 'channel'), ('channel_id', 'channel_id'),
                                       ('channel_url', 'channel_url'), ('published_at', 'published_at')):
                    if metadata.get(source):
                        item[target] = metadata[source]
                atomic_json(manifest_path, manifest)
            try:
                folder = process_video(item['url'], output, model, transcript_only, progress)
                item.update(status='done', output_dir=str(folder))
            except KeyboardInterrupt:
                item.update(status='error', error='用户中断，可使用 --retry-failed 重试。')
                atomic_json(manifest_path, manifest)
                raise
            except Exception as error:
                item.update(status='error', error=str(error))
                failed += 1
                print(f'失败，继续下一个：{error}', file=sys.stderr)
            atomic_json(manifest_path, manifest)
        return manifest, failed


def main(argv=None):
    parser = argparse.ArgumentParser(description='批量发现博主视频，并生成本地中文字幕与摘要')
    commands = parser.add_subparsers(dest='command', required=True)
    scan = commands.add_parser('discover', help='发现视频，保存清单；不下载音频、不调用 AI')
    scan.add_argument('--config', type=Path, help='JSON 配置文件')
    scan.add_argument('--channel', action='append', help='@账号或频道链接，可重复传入')
    scan.add_argument('--keyword', action='append', help='标题包含的关键词，任一匹配；可重复')
    scan.add_argument('--exclude-keyword', action='append', help='标题排除关键词；可重复')
    scan.add_argument('--since', help='最早上传日期 YYYY-MM-DD（含）')
    scan.add_argument('--until', help='最晚上传日期 YYYY-MM-DD（含）')
    scan.add_argument('--limit', type=int, help='每个频道最多匹配条数，默认 10')
    scan.add_argument('--scan-limit', type=int, help='每频道扫描最近上传数，默认 50，最多 500')
    scan.add_argument('--output', type=Path, default=ROOT / 'batches/latest.json', help='保存清单路径；重复发现时按视频 ID 合并')
    missing = commands.add_parser('untracked', help='只读取 Kolvex 标记的最新未追踪视频，不扫描频道、不下载音频')
    missing.add_argument('--output', type=Path, default=ROOT / 'batches/kolvex-untracked.json')
    run = commands.add_parser('run', help='批量处理清单；跳过已完成项，失败项继续后续任务')
    run.add_argument('manifest', type=Path)
    run.add_argument('--output', type=Path, default=ROOT / 'output')
    run.add_argument('--model', default=DEFAULT_MODEL)
    run.add_argument('--transcript-only', action='store_true')
    run.add_argument('--retry-failed', action='store_true')
    args = parser.parse_args(argv)
    try:
        if args.command == 'discover':
            config = json.loads(args.config.read_text()) if args.config else {}
            for key, value in [('channels', args.channel), ('keywords', args.keyword), ('exclude_keywords', args.exclude_keyword),
                               ('since', args.since), ('until', args.until), ('limit', args.limit), ('scan_limit', args.scan_limit)]:
                if value is not None:
                    config[key] = value
            manifest = discover(config, args.output)
            print(f'本次匹配 {len(manifest["latest_matches"])} 个，清单累计 {len(manifest["videos"])} 个视频。\n清单：{args.output.resolve()}')
            if manifest['discovery_errors']:
                print(f'有 {len(manifest["discovery_errors"])} 项发现错误，详情已写入清单。', file=sys.stderr)
                return 1
        elif args.command == 'untracked':
            manifest = discover_untracked(args.output)
            print(f'最新未追踪视频 {len(manifest["videos"])} 个：')
            for item in manifest['videos']:
                print(f'  {item["channel"]} · {item["title"]}\n    {item["url"]}')
            for warning in manifest['warnings']:
                print(warning, file=sys.stderr)
            print(f'清单：{args.output.resolve()}')
        else:
            manifest, failed = run_batch(args.manifest, args.output, args.model, args.transcript_only, args.retry_failed)
            done = sum(item['status'] == 'done' for item in manifest['videos'])
            print(f'完成 {done}/{len(manifest["videos"])}，失败 {failed}。\n清单：{args.manifest.resolve()}')
            return 1 if failed else 0
        return 0
    except (Exception, KeyboardInterrupt) as error:
        print(f'批量操作未完成：{error or "已中断"}', file=sys.stderr)
        return 130 if isinstance(error, KeyboardInterrupt) else 1


if __name__ == '__main__':
    sys.exit(main())

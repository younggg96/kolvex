#!/usr/bin/env python3
"""Read the public Kolvex creator catalog into a local batch configuration."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from batch import validate_config
from pipeline import atomic_json

DEFAULT_SOURCE = 'https://kolvex.app/dashboard/youtube-opinions?tab=creators'


def configuration_from_dashboard(payload, source=DEFAULT_SOURCE, limit=5, scan_limit=20):
    creators = payload.get('creators') if isinstance(payload, dict) else None
    if not isinstance(creators, list) or not creators:
        raise ValueError('Kolvex 未返回可读取的博主名单，未覆盖现有配置。')
    channels, identities = [], []
    for creator in creators:
        if not isinstance(creator, dict):
            raise ValueError('博主数据格式错误，未覆盖现有配置。')
        channel = creator.get('channel_url')
        if not channel:
            identity = creator.get('channel_id', '')
            channel = f'https://www.youtube.com/channel/{identity}' if identity.startswith('UC') else creator.get('channel_handle')
        if not channel:
            raise ValueError(f'博主 {creator.get("channel_title", "未知")} 缺少频道链接。')
        channels.append(channel)
        identities.append({key: creator.get(key) for key in ('channel_id', 'channel_title', 'channel_handle', 'channel_url')})
    config = validate_config({'channels': channels, 'keywords': [], 'exclude_keywords': [], 'limit': limit, 'scan_limit': scan_limit})
    config['_source'] = source
    config['_synced_at'] = datetime.now(timezone.utc).isoformat()
    config['_creators'] = identities
    return config


def sync(output, source=DEFAULT_SOURCE, limit=5, scan_limit=20):
    parsed = urlparse(source)
    if parsed.scheme != 'https' or parsed.hostname != 'kolvex.app' or parsed.username or parsed.password:
        raise ValueError('来源必须是 https://kolvex.app 的页面。')
    # The public dashboard uses the same creator aggregation as the admin list;
    # limit affects the latest-opinion list, not the creator catalog.
    endpoint = 'https://kolvex.app/api/youtube-opinions/dashboard?limit=1'
    request = Request(endpoint, headers={'Accept': 'application/json', 'User-Agent': 'Tingji-local-batch/1.0'})
    with urlopen(request, timeout=30) as response:
        payload = json.load(response)
    config = configuration_from_dashboard(payload, source, limit, scan_limit)
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    atomic_json(output, config)
    return config


def main(argv=None):
    parser = argparse.ArgumentParser(description='从 Kolvex 公开接口同步博主名单，无需登录或数据库密钥')
    parser.add_argument('--source', default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'channels.kolvex.json')
    parser.add_argument('--limit', type=int, default=5)
    parser.add_argument('--scan-limit', type=int, default=20)
    args = parser.parse_args(argv)
    try:
        config = sync(args.output, args.source, args.limit, args.scan_limit)
        print(f'已同步 {len(config["channels"])} 位博主：')
        for creator in config['_creators']:
            print(f'  {creator["channel_title"]} · {creator.get("channel_handle") or creator.get("channel_id")}')
        print(f'配置：{args.output.resolve()}')
        return 0
    except Exception as error:
        print(f'同步失败：{error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

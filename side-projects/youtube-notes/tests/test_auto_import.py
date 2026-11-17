import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import auto_import  # noqa: E402


class FakeClient:
    def __init__(self, gone_on=None):
        self.calls = []
        self.gone_on = gone_on

    def post(self, path, body, timeout=60):
        self.calls.append((path, body))
        if self.gone_on and path.endswith(self.gone_on):
            raise auto_import.RunGone('run_not_running')
        if path.endswith('/videos'):
            return {'status': 'imported', 'tickers': ['NVDA']}
        return {}


def video(video_id, status='done', output_dir=None, **extra):
    return {'id': video_id, 'title': '标题' + video_id, 'channel': '老A聊美股', 'channel_id': 'UC' + 'a' * 22,
            'channel_url': None, 'published_at': '2026-11-16T21:48:02Z', 'status': status,
            'output_dir': output_dir, **extra}


class ProcessTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        folder = Path(self.tmp.name) / 'job'
        folder.mkdir()
        (folder / 'transcript.json').write_text(json.dumps({
            'channel_handle': '@acestockpicks', 'segments': [{'text': '英伟达我继续看多'}, {'text': '目标价两百'}]}))
        self.folder = str(folder)

    def run_process(self, videos, run=None, client=None):
        client = client or FakeClient()
        manifest = {'videos': videos}
        with patch.object(auto_import, 'discover_untracked', return_value=manifest), \
             patch.object(auto_import, 'run_batch', return_value=(manifest, 0)) as batch:
            auto_import.process(client, run or {'id': 'r1', 'trigger': 'manual', 'videos': []})
        return client, batch

    def test_posts_transcripts_and_reports_failures(self):
        client, batch = self.run_process([
            video('aaaaaaaaaaa', output_dir=self.folder),
            video('bbbbbbbbbbb', status='error', error='HTTP 429'),
        ])
        batch.assert_called_once()
        self.assertTrue(batch.call_args.kwargs['transcript_only'])
        uploads = [body for path, body in client.calls if path.endswith('/videos')]
        self.assertEqual(len(uploads), 1)
        self.assertEqual(uploads[0]['transcript'], '英伟达我继续看多\n目标价两百')
        self.assertEqual(uploads[0]['channel_handle'], '@acestockpicks')
        path, finish = client.calls[-1]
        self.assertEqual(path, 'runs/r1/finish')
        self.assertEqual(finish['transcript_failures'][0]['video_id'], 'bbbbbbbbbbb')
        self.assertIn('429', finish['transcript_failures'][0]['error'])

    def test_unfinished_live_stream_is_not_reported_as_failure(self):
        client, _ = self.run_process([video('aaaaaaaaaaa', status='waiting', error='直播尚未结束')])
        self.assertEqual(client.calls[-1], ('runs/r1/finish', {'transcript_failures': []}))

    def test_resumed_run_skips_already_imported_videos(self):
        client, _ = self.run_process(
            [video('aaaaaaaaaaa', output_dir=self.folder)],
            run={'id': 'r1', 'videos': [{'video_id': 'aaaaaaaaaaa', 'status': 'imported'}]},
        )
        self.assertFalse([path for path, _ in client.calls if path.endswith('/videos')])

    def test_no_untracked_videos_skips_transcription(self):
        client, batch = self.run_process([])
        batch.assert_not_called()
        self.assertEqual(client.calls[-1], ('runs/r1/finish', {'transcript_failures': []}))

    def test_discovery_failure_is_reported(self):
        client = FakeClient()
        with patch.object(auto_import, 'discover_untracked', side_effect=ValueError('无法确认网站未追踪视频')):
            auto_import.process(client, {'id': 'r1', 'videos': []})
        self.assertEqual(client.calls[-1][0], 'runs/r1/finish')
        self.assertIn('无法确认', client.calls[-1][1]['error'])

    def test_stops_quietly_when_backend_ended_run(self):
        client, _ = self.run_process([video('aaaaaaaaaaa', output_dir=self.folder)], client=FakeClient(gone_on='/videos'))
        self.assertFalse([path for path, _ in client.calls if path.endswith('/finish')])


class CookieTests(unittest.TestCase):
    def test_cookie_args_follow_environment(self):
        import pipeline
        with patch.dict('os.environ', {'YTDLP_COOKIES_FROM_BROWSER': '', 'YTDLP_COOKIES': ''}):
            self.assertEqual(pipeline.cookie_args(), [])
        with patch.dict('os.environ', {'YTDLP_COOKIES_FROM_BROWSER': 'chrome'}):
            self.assertEqual(pipeline.cookie_args(), ['--cookies-from-browser', 'chrome', '--sleep-requests', '1.5'])
        with patch.dict('os.environ', {'YTDLP_COOKIES_FROM_BROWSER': '', 'YTDLP_COOKIES': '/tmp/c.txt'}):
            self.assertEqual(pipeline.cookie_args(), ['--cookies', '/tmp/c.txt', '--sleep-requests', '1.5'])


if __name__ == '__main__':
    unittest.main()

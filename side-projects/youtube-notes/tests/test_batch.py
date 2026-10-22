import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import batch as b
import youtube_transcribe as cli


class BatchTests(unittest.TestCase):
    def test_channels_and_config_validation(self):
        self.assertEqual(b.channel_url('@TED'), 'https://www.youtube.com/@TED/videos')
        for value in ['https://evil.test/@TED', 'https://youtube.com/watch?v=abcdefghijk']:
            with self.assertRaises(ValueError): b.channel_url(value)
        for config in [{'channels': []}, {'channels': ['@TED'], 'limit': -1}, {'channels': ['@TED'], 'since': 'yesterday'}, {'channels': ['@TED'], 'keywords': 'AI'}]:
            with self.assertRaises(ValueError): b.validate_config(config)

    def test_discovery_filters_dates_and_preserves_existing_status(self):
        entries = [{'id': 'abcdefghijk', 'title': 'AI future', 'duration': 40},
                   {'id': 'lmnopqrstuv', 'title': 'AI old', 'upload_date': '20200101'},
                   {'id': '12345678901', 'title': 'AI sponsor'}, {'id': '12345678902', 'title': 'Cooking'}]
        def download(*args, **kwargs):
            return json.dumps({'title': 'Channel', 'entries': entries}) if '--flat-playlist' in args else json.dumps({'upload_date': '20261020', 'duration': 40})
        config = {'channels': ['@TED', '@TEDTalks'], 'keywords': ['ai'], 'exclude_keywords': ['sponsor'], 'since': '2026-10-01'}
        with tempfile.TemporaryDirectory() as temp, patch.object(b, 'ytdlp', side_effect=download):
            path = Path(temp) / 'batch.json'
            first = b.discover(config, path)
            self.assertEqual(len(first['videos']), 1)
            first['videos'][0]['status'] = 'done'
            b.atomic_json(path, first)
            second = b.discover(config, path)
            self.assertEqual(len(second['videos']), 1)
            self.assertEqual(second['videos'][0]['status'], 'done')
            self.assertEqual(second['latest_matches'], ['abcdefghijk'])
            self.assertFalse(second['discovery_errors'])

    def test_discovery_records_channel_failure_and_continues(self):
        def download(*args, **kwargs):
            if '@Broken' in args[-1]: raise RuntimeError('offline')
            return json.dumps({'entries': [{'id': 'abcdefghijk', 'title': 'Test'}]})
        with tempfile.TemporaryDirectory() as temp, patch.object(b, 'ytdlp', side_effect=download):
            result = b.discover({'channels': ['@Broken', '@TED']}, Path(temp) / 'batch.json')
            self.assertEqual(len(result['videos']), 1)
            self.assertEqual(len(result['discovery_errors']), 1)

    def test_batch_skips_done_continues_after_failure_and_retries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            done = root / 'done'
            done.mkdir()
            (done / 'transcript.json').write_text('{}')
            videos = [{'id': 'abcdefghijk', 'url': 'url1', 'title': 'Done', 'status': 'done', 'mode': 'chinese_notes', 'output_dir': str(done)},
                      {'id': 'lmnopqrstuv', 'url': 'url2', 'title': 'Broken', 'status': 'pending'},
                      {'id': '12345678901', 'url': 'url3', 'title': 'Next', 'status': 'pending'}]
            path = root / 'batch.json'
            b.atomic_json(path, {'videos': videos})
            with patch.object(b, 'require_environment'), patch.object(b, 'process_video', side_effect=[RuntimeError('fail'), done]) as process:
                first, failed = b.run_batch(path, root, 'test')
                self.assertEqual(process.call_count, 2)
                self.assertEqual(failed, 1)
                self.assertEqual([v['status'] for v in first['videos']], ['done', 'error', 'done'])
            with patch.object(b, 'require_environment'), patch.object(b, 'process_video', return_value=done) as process:
                second, failed = b.run_batch(path, root, 'test', retry_failed=True)
                self.assertEqual(process.call_count, 1)
                self.assertEqual(failed, 0)

    def test_transcript_completion_does_not_skip_full_processing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'transcript.json').write_text('{}')
            path = root / 'batch.json'
            b.atomic_json(path, {'videos': [{'id': 'abcdefghijk', 'url': 'url', 'title': 'Test', 'status': 'done', 'mode': 'transcript', 'output_dir': str(root)}]})
            with patch.object(b, 'require_environment'), patch.object(b, 'process_video', return_value=root) as process:
                b.run_batch(path, root, 'test')
                self.assertEqual(process.call_count, 1)

    def test_cli_exports_partial_results_on_summary_failure(self):
        def fake_run(job, folder, update):
            b.atomic_json(folder / 'result.json', {'title': 'Test', 'segments': [{'start': 0, 'end': 1, 'text': 'hello', 'zh': '你好'}], 'summary': None})
            raise RuntimeError('summary offline')
        with tempfile.TemporaryDirectory() as temp, patch.object(cli, 'run_job', side_effect=fake_run):
            with self.assertRaises(RuntimeError): cli.process_video('https://youtu.be/abcdefghijk', Path(temp), 'test')
            folders = list(Path(temp).glob('*/*'))
            self.assertIn('你好', (folders[0] / 'zh.srt').read_text())
            self.assertTrue((folders[0] / 'transcript.json').exists())
            self.assertFalse((folders[0] / 'summary.md').exists())

if __name__ == '__main__': unittest.main()

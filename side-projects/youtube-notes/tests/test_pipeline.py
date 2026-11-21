import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pipeline as p


class PipelineTests(unittest.TestCase):
    def test_urls_and_ssrf_boundary(self):
        expected = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        for value in ['https://youtu.be/dQw4w9WgXcQ?t=3', expected + '&list=x',
                      'https://youtube.com/shorts/dQw4w9WgXcQ']:
            self.assertEqual(p.normalize_url(value), expected)
        for value in ['http://127.0.0.1/test', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
                      'file:///etc/passwd', 'https://evil@youtube.com/watch?v=dQw4w9WgXcQ',
                      'https://youtube.com/playlist?list=abc', 'https://youtu.be/not-valid', None]:
            with self.assertRaises(ValueError):
                p.normalize_url(value)

    def test_json3_removes_overlapping_rolling_captions_only(self):
        events = [
            {'tStartMs': 0, 'dDurationMs': 3000, 'segs': [{'utf8': 'Hello &amp; welcome'}]},
            {'tStartMs': 1000, 'dDurationMs': 3000, 'segs': [{'utf8': 'welcome to the talk'}]},
            {'tStartMs': 5000, 'dDurationMs': 1000, 'segs': [{'utf8': 'Hello &amp; welcome'}]},
            {'tStartMs': 6000, 'segs': [{'utf8': '\n'}]}]
        segments = p.parse_json3({'events': events})
        self.assertEqual([s['text'] for s in segments], ['Hello & welcome', 'to the talk', 'Hello & welcome'])
        self.assertEqual(segments[1]['start'], 1)

    def test_exact_repeats_extend_end_time(self):
        segments = p.parse_json3({'events': [{'tStartMs': n, 'dDurationMs': 2000, 'segs': [{'utf8': '你好'}]} for n in [0, 1000]]})
        self.assertEqual(segments, [{'start': 0, 'end': 3, 'text': '你好'}])

    def test_exports_rounding_and_source_selection(self):
        segments = [{'start': 59.9999, 'end': 62.125, 'text': 'Hello', 'zh': '你好'}]
        self.assertEqual(p.timestamp(59.9999), '00:01:00,000')
        self.assertIn('00:01:00,000 --> 00:01:02,125\n你好', p.export(segments, 'srt'))
        self.assertTrue(p.export(segments, 'vtt').startswith('WEBVTT\n\n'))
        self.assertIn('00:01:02.125', p.export(segments, 'vtt'))
        self.assertEqual(p.export(segments, 'txt', False), 'Hello\n')

    def test_batching_preserves_all_segments(self):
        segments = [{'text': str(i) * 50} for i in range(101)]
        chunks = list(p.batches(segments, max_chars=300, max_items=4))
        self.assertEqual([s for chunk in chunks for s in chunk], segments)
        self.assertTrue(all(len(chunk) <= 4 for chunk in chunks))

    def test_caption_ranking_prefers_original_chinese_manual(self):
        formats = [{'ext': 'json3', 'url': 'https://example.test'}]
        info = {'language': 'en', 'subtitles': {'en': formats, 'zh-Hans': formats}, 'automatic_captions': {'zh-Hans': formats}}
        candidates = p.caption_candidates(info)
        self.assertEqual(candidates[0][-2:], ('zh-Hans', 'manual'))
        self.assertEqual(candidates[1][-2:], ('zh-Hans', 'auto'))

    def test_scheduled_or_running_live_stream_is_not_ready_rather_than_failed(self):
        failed = p.subprocess.CompletedProcess([], 1, '', 'ERROR: [youtube] abc: This live event will begin in 18 hours.')
        with patch.object(p.subprocess, 'run', return_value=failed), self.assertRaises(p.VideoNotReady):
            p.ytdlp('--dump-single-json', 'url')
        blocked = p.subprocess.CompletedProcess([], 1, '', 'ERROR: [youtube] abc: Sign in to confirm you’re not a bot.')
        with patch.object(p.subprocess, 'run', return_value=blocked), self.assertRaises(RuntimeError):
            p.ytdlp('--dump-single-json', 'url')
        with tempfile.TemporaryDirectory() as temp, patch.object(p, 'ytdlp', return_value=json.dumps({'live_status': 'is_live', 'duration': 0})), \
             self.assertRaises(p.VideoNotReady):
            p.fetch_transcript('url', Path(temp), lambda **_: None)

    def test_audio_403_retries_once_with_fallback_clients(self):
        forbidden = RuntimeError('YouTube 获取失败：ERROR: unable to download video data: HTTP Error 403: Forbidden')
        with tempfile.TemporaryDirectory() as temp, patch.object(p, 'ytdlp', side_effect=[forbidden, '']) as fake:
            (Path(temp) / 'audio.webm.part').write_text('partial')
            p.download_audio('url', Path(temp), timeout=10)
            self.assertEqual(fake.call_count, 2)
            self.assertNotIn('--extractor-args', fake.call_args_list[0].args)
            self.assertIn(f'youtube:player_client={p.FALLBACK_AUDIO_CLIENTS}', fake.call_args_list[1].args)
            self.assertFalse((Path(temp) / 'audio.webm.part').exists())
        with tempfile.TemporaryDirectory() as temp, patch.object(p, 'ytdlp', side_effect=[forbidden, forbidden]), \
             self.assertRaises(RuntimeError):
            p.download_audio('url', Path(temp), timeout=10)
        with tempfile.TemporaryDirectory() as temp, patch.object(p, 'ytdlp', side_effect=RuntimeError('Sign in to confirm')) as fake, \
             self.assertRaises(RuntimeError):
            p.download_audio('url', Path(temp), timeout=10)
        self.assertEqual(fake.call_count, 1)

    def test_translation_mismatch_fails_without_fabrication(self):
        segments = [{'start': 0, 'end': 2, 'text': 'Hello'}]
        with patch.object(p, 'generate', return_value={'translations': []}):
            with self.assertRaises(RuntimeError):
                p.translate(segments, 'en', 'test', lambda **kw: None, lambda s: None)

    def test_complete_pipeline_using_mocked_youtube_and_ollama(self):
        segments = [{'start': 0, 'end': 3, 'text': 'Hello world.'}]
        calls = []
        def fake_generate(model, instruction, data, schema):
            if 'translations' in schema.get('properties', {}):
                return {'translations': ['你好，世界。']}
            return {'overview': '一段问候。', 'key_points': ['向世界问好。']}
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            metadata = {'id': 'abcdefghijk', 'title': 'Test', 'duration': 3, 'channel': 'Creator',
                        'channel_id': 'UC_TEST', 'channel_url': 'https://www.youtube.com/@creator',
                        'uploader_id': '@creator', 'published_at': '2026-10-22T17:22:21Z'}
            with patch.object(p, 'fetch_transcript', return_value=(metadata, 'en', segments, 'manual_captions', [])), patch.object(p, 'generate', side_effect=fake_generate):
                p.run_job({'url': 'https://youtu.be/dQw4w9WgXcQ', 'model': 'test'}, folder, lambda **kw: calls.append(kw))
            result = json.loads((folder / 'result.json').read_text())
            self.assertEqual(result['segments'][0]['zh'], '你好，世界。')
            self.assertEqual(result['summary']['overview'], '一段问候。')
            self.assertEqual(result['channel_id'], 'UC_TEST')
            self.assertEqual(result['published_at'], '2026-10-22T17:22:21Z')
            self.assertEqual(calls[-1]['status'], 'done')

    def test_failed_summary_preserves_completed_chinese_subtitles(self):
        segments = [{'start': 0, 'end': 3, 'text': '你好'}]
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            with patch.object(p, 'fetch_transcript', return_value=({'title': 'Test', 'duration': 3}, 'zh', segments, 'auto_captions', [])), patch.object(p, 'summary', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError):
                    p.run_job({'url': 'url', 'model': 'test'}, folder, lambda **kw: None)
            result = json.loads((folder / 'result.json').read_text())
            self.assertEqual(result['segments'][0]['zh'], '你好')
            self.assertIsNone(result['summary'])

    def test_hierarchical_summary_reduction(self):
        segments = [{'text': 'a' * 1000} for _ in range(150)]
        with patch.object(p, 'generate', return_value={'overview': '概览', 'key_points': ['要点']}) as generate:
            result = p.summary(segments, 'test', lambda **kw: None)
            self.assertGreater(generate.call_count, 15)
            self.assertEqual(result['overview'], '概览')


if __name__ == '__main__':
    unittest.main()

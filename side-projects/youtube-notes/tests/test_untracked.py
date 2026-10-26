import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import batch


def report(ids=('abcdefghijk', 'lmnopqrstuv')):
    return {'status': 'available', 'creators': [{
        'channel_id': 'creator', 'status': 'available', 'since': '2026-10-23T00:00:00Z',
        'untracked': [{'video_id': value, 'title': value, 'published_at': f'2026-10-{24 + index}T00:00:00Z'} for index, value in enumerate(ids)],
    }]}


CATALOGUE = {'creators': [{'channel_id': 'creator', 'channel_title': '博主', 'channel_url': 'https://www.youtube.com/@creator'}]}


class UntrackedTests(unittest.TestCase):
    def test_only_confirmed_missing_videos_newest_first_without_channel_scan(self):
        payload = report()
        payload['creators'][0]['untracked'].append(copy.deepcopy(payload['creators'][0]['untracked'][0]))
        with tempfile.TemporaryDirectory() as directory, patch.object(batch, 'kolvex_public_json', side_effect=[payload, CATALOGUE]), patch.object(batch, 'ytdlp') as scan:
            result = batch.discover_untracked(Path(directory) / 'missing.json')
            self.assertEqual([item['id'] for item in result['videos']], ['lmnopqrstuv', 'abcdefghijk'])
            self.assertEqual(result['videos'][0]['channel'], '博主')
            scan.assert_not_called()

    def test_snapshot_drops_newly_imported_videos_and_preserves_remaining_local_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.json'
            with patch.object(batch, 'kolvex_public_json', side_effect=[report(), CATALOGUE]):
                first = batch.discover_untracked(path)
            first['videos'][0].update(status='done', mode='transcript', output_dir='/saved', attempts=1)
            batch.atomic_json(path, first)
            remaining = report(('lmnopqrstuv',))
            with patch.object(batch, 'kolvex_public_json', side_effect=[remaining, CATALOGUE]):
                result = batch.discover_untracked(path)
            self.assertEqual(len(result['videos']), 1)
            self.assertEqual(result['videos'][0]['status'], 'done')
            self.assertEqual(result['videos'][0]['output_dir'], '/saved')

    def test_failed_coverage_does_not_overwrite_the_saved_selection_or_start_processing(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.json'
            batch.atomic_json(path, {'source': 'kolvex_untracked', 'videos': []})
            original = path.read_bytes()
            with patch.object(batch, 'kolvex_public_json', return_value={'status': 'unavailable'}), patch.object(batch, 'process_video') as process:
                with self.assertRaises(ValueError):
                    batch.run_batch(path, Path(directory), 'test', transcript_only=True)
                process.assert_not_called()
            self.assertEqual(path.read_bytes(), original)

    def test_invalid_ids_missing_dates_or_older_uploads_are_rejected(self):
        for changes in [{'video_id': '../bad'}, {'published_at': None}, {'published_at': '2020-01-01T00:00:00Z'}, {'published_at': '2026-10-24T00:00:00'}]:
            payload = report(('abcdefghijk',))
            payload['creators'][0]['untracked'][0].update(changes)
            with tempfile.TemporaryDirectory() as directory, patch.object(batch, 'kolvex_public_json', side_effect=[payload, CATALOGUE]):
                path = Path(directory) / 'missing.json'
                with self.assertRaises(ValueError):
                    batch.discover_untracked(path)
                self.assertFalse(path.exists())

    def test_unavailable_creator_is_not_silently_reported_as_zero_missing(self):
        payload = report()
        payload['creators'][0]['status'] = 'unavailable'
        with tempfile.TemporaryDirectory() as directory, patch.object(batch, 'kolvex_public_json', side_effect=[payload, CATALOGUE]):
            with self.assertRaises(ValueError):
                batch.discover_untracked(Path(directory) / 'missing.json')

    def test_run_rechecks_website_and_does_not_process_video_imported_since_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.json'
            batch.atomic_json(path, {'source': 'kolvex_untracked', 'videos': [{'id': 'abcdefghijk', 'status': 'pending'}]})
            with patch.object(batch, 'kolvex_public_json', side_effect=[report(()), CATALOGUE]), patch.object(batch, 'process_video') as process, patch.object(batch, 'require_environment') as environment:
                result, failed = batch.run_batch(path, Path(directory), 'test', transcript_only=True)
                self.assertEqual(result['videos'], [])
                self.assertEqual(failed, 0)
                process.assert_not_called()
                environment.assert_not_called()

    def test_untracked_mode_cannot_replace_a_normal_discovery_manifest(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(batch, 'kolvex_public_json', side_effect=[report(), CATALOGUE]):
            path = Path(directory) / 'normal.json'
            path.write_text(json.dumps({'version': 1, 'videos': []}))
            original = path.read_bytes()
            with self.assertRaises(ValueError):
                batch.discover_untracked(path)
            self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()

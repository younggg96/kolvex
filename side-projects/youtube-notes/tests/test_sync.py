from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sync_kolvex import configuration_from_dashboard

class SyncTests(unittest.TestCase):
    def test_imports_channel_identity_and_deduplicates(self):
        creator = {'channel_title': 'Test', 'channel_id': 'UCabc', 'channel_handle': '@test'}
        config = configuration_from_dashboard({'creators': [creator, creator]})
        self.assertEqual(config['channels'], ['https://www.youtube.com/channel/UCabc/videos'])
        self.assertEqual(config['limit'], 5)
        self.assertEqual(config['keywords'], [])

    def test_rejects_empty_or_invalid_catalog(self):
        for payload in [{}, {'creators': []}, {'creators': [{}]}, {'creators': [None]}, {'creators': [{'channel_url': 'https://evil.test'}]}]:
            with self.assertRaises(ValueError): configuration_from_dashboard(payload)

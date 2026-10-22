import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server as s


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = patch.object(s, 'DATA', Path(self.temp.name))
        self.data.start()
        self.http = s.ThreadingHTTPServer(('127.0.0.1', 0), s.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.http.server_port}'

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.data.stop()
        self.temp.cleanup()

    def request(self, path, body=None, headers=None):
        request = Request(self.url + path, data=json.dumps(body).encode() if body is not None else None,
                          headers=headers or {})
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, response.read()
        except HTTPError as error:
            try:
                return error.code, error.read()
            finally:
                error.close()

    def test_create_poll_result_exports_and_single_active_job(self):
        fake_health = {'yt_dlp': True, 'models': ['test'], 'ollama_error': None}
        with patch.object(s, 'health', return_value=fake_health), patch.object(s.POOL, 'submit'):
            status, data = self.request('/api/jobs', {'url': 'https://youtu.be/dQw4w9WgXcQ', 'model': 'test'})
            self.assertEqual(status, 202)
            job = json.loads(data)
            self.assertEqual(self.request('/api/jobs', {'url': job['url'], 'model': 'test'})[0], 409)
        self.assertEqual(self.request('/api/jobs/' + job['id'])[0], 200)
        folder = s.DATA / job['id']
        s.atomic_json(folder / 'result.json', {'title': '测试', 'segments': [{'start': 0, 'end': 1, 'text': 'hi'}], 'summary': None})
        self.assertEqual(self.request(f'/api/jobs/{job["id"]}/result')[0], 200)
        self.assertEqual(self.request(f'/api/jobs/{job["id"]}/download/zh.srt')[0], 409)
        self.assertEqual(self.request(f'/api/jobs/{job["id"]}/download/summary.md')[0], 409)
        self.assertEqual(self.request(f'/api/jobs/{job["id"]}/download/original.srt')[0], 200)
        self.assertEqual(self.request(f'/api/jobs/{job["id"]}/download/transcript.json')[0], 200)

    def test_rejects_cross_site_host_and_path_traversal(self):
        self.assertEqual(self.request('/api/jobs', {}, {'Origin': 'https://evil.test'})[0], 403)
        self.assertEqual(self.request('/api/jobs', headers={'Host': 'evil.test'})[0], 403)
        self.assertEqual(self.request('/../server.py')[0], 404)
        self.assertEqual(self.request('/api/jobs/../../server.py')[0], 404)
        self.assertEqual(self.request('/api/jobs', [])[0], 400)

    def test_no_frontend_and_missing_results(self):
        status, body = self.request('/')
        self.assertEqual(status, 404)
        self.assertEqual(self.request('/api/jobs/' + 'a' * 32 + '/result')[0], 404)
        self.assertEqual(self.request('/api/jobs/not-an-id')[0], 404)


if __name__ == '__main__':
    unittest.main()

"""Check local media serving without using or publishing any real recordings."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import unittest

spec = importlib.util.spec_from_file_location('solo_preview', Path(__file__).with_name('preview-solo-book.py'))
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)

class MediaServingTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.directory = TemporaryDirectory()
  preview.NARRATION_ROOT = Path(cls.directory.name)
  (preview.NARRATION_ROOT / preview.NARRATIONS[3]).write_bytes(b'0123456789')
  cls.server = preview.ThreadingHTTPServer(('127.0.0.1', 0), preview.Handler)
  cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
  cls.thread.start()
  cls.url = f'http://127.0.0.1:{cls.server.server_port}/__review_media__/session-3.m4a'
 @classmethod
 def tearDownClass(cls):
  cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.directory.cleanup()
 def test_partial_range(self):
  with urlopen(Request(self.url, headers={'Range': 'bytes=2-5'})) as response:
   self.assertEqual(response.status, 206)
   self.assertEqual(response.headers['Content-Range'], 'bytes 2-5/10')
   self.assertEqual(response.read(), b'2345')
 def test_suffix_range(self):
  with urlopen(Request(self.url, headers={'Range': 'bytes=-3'})) as response:
   self.assertEqual(response.read(), b'789')
 def test_out_of_bounds(self):
  with self.assertRaises(HTTPError) as failure:
   urlopen(Request(self.url, headers={'Range': 'bytes=20-30'}))
  self.assertEqual(failure.exception.code, 416)
  self.assertEqual(failure.exception.headers['Content-Range'], 'bytes */10')
 def test_metadata_and_no_service_connections(self):
  with urlopen(Request(self.url, method='HEAD')) as response:
   self.assertEqual(response.headers['Content-Length'], '10')
   self.assertEqual(response.headers['Content-Type'], 'audio/mp4')
   self.assertIn("connect-src 'none'", response.headers['Content-Security-Policy'])
   self.assertEqual(response.read(), b'')

if __name__ == '__main__': unittest.main()

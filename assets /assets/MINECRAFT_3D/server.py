#!/usr/bin/env python3
# Local dev server: disable caching so each refresh loads latest js/textures
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet mode

if __name__ == '__main__':
    print(f'Redstone World running at http://localhost:{PORT}  (Ctrl+C to stop)')
    ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()

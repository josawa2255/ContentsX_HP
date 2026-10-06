#!/usr/bin/env python3
"""Local static preview with extensionless .html URLs, like the existing site.

Run: python3 tools/preview-extensions.py --port 8769
Then run the two tests/verify_*extensions / verify_tablabo_oauth scripts.
"""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path):
        resolved = super().translate_path(path)
        if not Path(resolved).exists() and Path(resolved + ".html").is_file():
            return resolved + ".html"
        return resolved


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8769)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler) as server:
        print(f"Preview: http://127.0.0.1:{args.port}/extensions/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

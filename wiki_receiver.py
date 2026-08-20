#!/usr/bin/env python3
"""
Wiki dump receiver for the GrepBot userscript.

Listens on http://127.0.0.1:8765/ and accepts wiki pages posted from a
Tampermonkey userscript. Each POST writes one .txt file to
/home/j/Documents/Documents/DeV/grepbot/wiki_corpus/.

Endpoints
=========
  GET  /                    -> status (JSON): count, last saved, started
  POST /page   body=<json>  -> save one page
                              {"title": "...", "wikitext": "...", "pageid": 123}
                              filename: <safe_title>.txt
  POST /shutdown            -> exit (handy for testing)
  GET  /wiki_corpus/...     -> serve back any saved file (debug aid)

Run:  python3 /home/j/Documents/Documents/DeV/grepbot/wiki_receiver.py
Stop: Ctrl-C, or POST /shutdown.
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# ---------- config ----------
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8765
TARGET_DIR = "/home/j/Documents/Documents/DeV/grepbot/wiki_corpus"
LOG_PREFIX = "[wiki-receiver]"
# ----------------------------

# mutable state (protected by a lock)
_state_lock = threading.Lock()
_state: dict = {
    "started": datetime.now().isoformat(timespec="seconds"),
    "received": 0,
    "saved": 0,
    "skipped": 0,
    "errors": 0,
    "last_title": None,
    "last_at": None,
    "titles_seen": set(),  # type: set[str]
}
_seen_lock = threading.Lock()


def safe_filename(title: str) -> str:
    """Map a wiki page title to a filename-safe slug. Preserves uniqueness."""
    # Replace path separators and reserved chars
    s = re.sub(r"[\\/:*?\"<>|]+", "_", title)
    # Collapse whitespace and strip
    s = re.sub(r"\s+", " ", s).strip().strip(".")
    if not s:
        s = "_unnamed"
    # Bound length — keep extension room
    if len(s) > 200:
        s = s[:200]
    return s + ".txt"


def save_page(title: str, wikitext: str, pageid: int | None) -> dict:
    """Persist one page. Returns dict with status and filename."""
    fname = safe_filename(title)

    # Disambiguate if filename collision with different content (defensive — titles are usually unique)
    final_path = os.path.join(TARGET_DIR, fname)
    with _seen_lock:
        if fname in _state["titles_seen"]:
            # title already saved — overwrite by title (idempotent). Skip if duplicate post.
            _state["skipped"] += 1
            return {"status": "duplicate", "filename": fname}
        _state["titles_seen"].add(fname)

    try:
        # Header: title + pageid + timestamp, then the wikitext verbatim.
        header = (
            f"# Grepolis Wiki — {title}\n"
            f"# pageid: {pageid if pageid is not None else 'n/a'}\n"
            f"# fetched: {datetime.now().isoformat(timespec='seconds')}\n"
            f"# source: https://wiki.en.grepolis.com/wiki/{title.replace(' ', '_')}\n"
            f"# {'-' * 60}\n\n"
        )
        body = wikitext if wikitext is not None else ""
        with open(final_path, "w", encoding="utf-8") as f:
            f.write(header)
            f.write(body)
            if not body.endswith("\n"):
                f.write("\n")
        size = os.path.getsize(final_path)
        with _state_lock:
            _state["saved"] += 1
            _state["last_title"] = title
            _state["last_at"] = datetime.now().isoformat(timespec="seconds")
        print(f"{LOG_PREFIX} saved {fname} ({size} bytes)", flush=True)
        return {"status": "saved", "filename": fname, "size": size}
    except OSError as e:
        with _state_lock:
            _state["errors"] += 1
        print(f"{LOG_PREFIX} ERROR saving {fname}: {e}", flush=True)
        return {"status": "error", "filename": fname, "error": str(e)}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # quieter than default; userscript errors get printed, not access spam
        msg = (args[0] if args else "") or ""
        if " 5" in msg or " 4" in msg:
            sys.stderr.write(f"{LOG_PREFIX} {self.address_string()} {format % args}\n")

    # ---- GETs ----
    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/status"):
            with _state_lock:
                payload = {
                    "started": _state["started"],
                    "received": _state["received"],
                    "saved": _state["saved"],
                    "skipped": _state["skipped"],
                    "errors": _state["errors"],
                    "last_title": _state["last_title"],
                    "last_at": _state["last_at"],
                    "unique_titles": len(_state["titles_seen"]),
                    "target_dir": TARGET_DIR,
                }
            data = json.dumps(payload, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
            return
        # serve a file for debugging
        rel = path.lstrip("/")
        if rel.startswith("wiki_corpus/"):
            local = os.path.join("/home/j/Documents/Documents/DeV/grepbot", rel)
            if os.path.isfile(local):
                with open(local, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"not found\n")

    # ---- POSTs ----
    def do_POST(self):
        global _server_ref
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b""
        with _state_lock:
            _state["received"] += 1

        if path == "/shutdown":
            data = json.dumps({"status": "shutting_down"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            server = _server_ref
            if server is not None:
                threading.Thread(target=server.shutdown, daemon=True).start()
            return

        if path != "/page":
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"unknown endpoint\n")
            return

        try:
            payload = json.loads(raw.decode("utf-8"))
            title = payload.get("title")
            wikitext = payload.get("wikitext", "")
            pageid = payload.get("pageid")
            if not title or not isinstance(title, str):
                raise ValueError("missing or invalid 'title'")
            result = save_page(title, wikitext, pageid)
            data = json.dumps(result).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            with _state_lock:
                _state["errors"] += 1
            err = json.dumps({"status": "error", "error": str(e)}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(err)

    def do_OPTIONS(self):
        # CORS preflight for cross-origin posts (userscript + page origin)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()


_server_ref: ThreadingHTTPServer | None = None


def main():
    os.makedirs(TARGET_DIR, exist_ok=True)
    global _server_ref
    httpd = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    _server_ref = httpd
    print(f"{LOG_PREFIX} listening on http://{LISTEN_HOST}:{LISTEN_PORT}/", flush=True)
    print(f"{LOG_PREFIX} writing to {TARGET_DIR}/", flush=True)
    print(f"{LOG_PREFIX} status: GET {LISTEN_HOST}:{LISTEN_PORT}/  |  stop: Ctrl-C or POST /shutdown", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n{LOG_PREFIX} shutting down", flush=True)
    finally:
        with _state_lock:
            print(
                f"{LOG_PREFIX} final: received={_state['received']} "
                f"saved={_state['saved']} skipped={_state['skipped']} errors={_state['errors']}",
                flush=True,
            )


if __name__ == "__main__":
    main()

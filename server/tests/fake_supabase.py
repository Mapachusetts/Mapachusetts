"""A tiny in-memory fake of the Supabase endpoints the assistant service uses.

Only for tests. Supports:
  GET    /auth/v1/user                  token -> user mapping (anon key required)
  GET    /rest/v1/protest_reports       eq./gte. filters, select, order (service key)
  POST   /rest/v1/protest_reports       insert, honors select + Prefer
  DELETE /rest/v1/protest_reports       eq. filters
  POST   /rest/v1/rpc/bump_usage        atomic counter, -1 when over the limit
"""

import json
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

ANON_KEY = "fake-anon-key"
SERVICE_KEY = "fake-service-role-key"

ALLOWED_INSERT_COLUMNS = {
    "user_id", "lat", "lng", "intensity", "summary", "description_private",
    "status", "created_at", "expires_at",
}


class FakeSupabase:
    def __init__(self):
        self.users = {}  # token -> user id
        self.reports = []  # list of dict rows (all columns, as in the table)
        self.usage = {}  # (user, day, kind) -> count
        self.auth_calls = 0
        self.fail_rest = False  # make REST endpoints return 500
        self.requests = []  # (method, path) for assertions
        self._lock = threading.Lock()
        self.httpd = None
        self.thread = None

    # -- lifecycle ----------------------------------------------------------
    def start(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                return

            def _json(self, status, payload):
                body = b"" if payload is None else json.dumps(payload).encode()
                self.send_response(status)
                if status != 204:
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if body:
                    self.wfile.write(body)

            def _body(self):
                n = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(n) if n else b""
                return json.loads(raw.decode()) if raw else None

            def _is_service(self):
                return (
                    self.headers.get("apikey") == SERVICE_KEY
                    and self.headers.get("Authorization") == "Bearer " + SERVICE_KEY
                )

            def _handle(self):
                parts = urlsplit(self.path)
                query = {k: v[0] for k, v in parse_qs(parts.query).items()}
                with fake._lock:
                    fake.requests.append((self.command, parts.path))
                    body = self._body() if self.command in ("POST", "PATCH") else None
                    if parts.path == "/auth/v1/user" and self.command == "GET":
                        fake.auth_calls += 1
                        auth = self.headers.get("Authorization", "")
                        token = auth[7:] if auth.startswith("Bearer ") else ""
                        if self.headers.get("apikey") != ANON_KEY or token not in fake.users:
                            return self._json(401, {"msg": "invalid JWT"})
                        return self._json(200, {"id": fake.users[token], "email": "x@example.com"})

                    if not self._is_service():
                        return self._json(401, {"message": "bad service key"})
                    if fake.fail_rest and parts.path.startswith("/rest/"):
                        return self._json(500, {"message": "boom"})

                    if parts.path == "/rest/v1/rpc/bump_usage" and self.command == "POST":
                        key = (body["p_user"], datetime.now(timezone.utc).date().isoformat(), body["p_kind"])
                        current = fake.usage.get(key, 0)
                        if current >= body["p_limit"]:
                            return self._json(200, -1)
                        fake.usage[key] = current + 1
                        return self._json(200, current + 1)

                    if parts.path == "/rest/v1/protest_reports":
                        return self._reports(query, body)
                    return self._json(404, {"message": "no route"})

            def _match(self, row, query):
                for col, cond in query.items():
                    if col in ("select", "order", "limit"):
                        continue
                    op, _, val = cond.partition(".")
                    if op == "eq" and str(row.get(col)) != val:
                        return False
                    if op == "gte" and not str(row.get(col)) >= val:
                        return False
                return True

            def _project(self, row, query):
                cols = query.get("select")
                if not cols or cols == "*":
                    return dict(row)
                return {c: row.get(c) for c in cols.split(",")}

            def _reports(self, query, body):
                if self.command == "GET":
                    rows = [self._project(r, query) for r in fake.reports if self._match(r, query)]
                    return self._json(200, rows)
                if self.command == "DELETE":
                    keep = [r for r in fake.reports if not self._match(r, query)]
                    fake.reports[:] = keep
                    return self._json(204, None)
                if self.command == "POST":
                    if not isinstance(body, dict) or not set(body) <= ALLOWED_INSERT_COLUMNS:
                        return self._json(400, {"message": "unknown column"})
                    if not (1 <= body.get("intensity", 0) <= 4):
                        return self._json(400, {"message": "intensity check"})
                    if body.get("summary") is not None and len(body["summary"]) > 400:
                        return self._json(400, {"message": "summary check"})
                    if len(body.get("description_private") or "") > 600:
                        return self._json(400, {"message": "description check"})
                    row = {"id": str(uuid.uuid4()), "status": "visible", "flag_count": 0}
                    row.update(body)
                    fake.reports.append(row)
                    if "return=representation" in self.headers.get("Prefer", ""):
                        return self._json(201, [self._project(row, query)])
                    return self._json(201, None)
                return self._json(405, {"message": "nope"})

            do_GET = do_POST = do_DELETE = do_PATCH = _handle

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.httpd.daemon_threads = True
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self

    @property
    def url(self):
        return "http://127.0.0.1:%d" % self.httpd.server_address[1]

    def stop(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()

    # -- helpers for tests --------------------------------------------------
    def add_user(self, token, user_id=None):
        user_id = user_id or str(uuid.uuid4())
        self.users[token] = user_id
        return user_id

# Mapachusetts assistant service

A small, stdlib-only Python service (Python 3.9+) behind the signed-in features of the Massachusetts pilot:

- `POST /v1/ask`: nonpartisan answers about politics and voting.
- `POST /v1/reports`: a signed-in user reports a protest where they are standing. The free text is summarized by AI, and only the neutral summary appears as a map pin for other signed-in users.
- `DELETE /v1/reports/<id>`: a user removes their own report.

AI calls go through Kiro CLI headless mode (`kiro-cli chat --no-interactive "<prompt>"` with `KIRO_API_KEY` set). There is no hosted Kiro REST API and no unofficial gateway is used. The service never passes `--trust-all-tools` or `--trust-tools`, so the CLI cannot run tools.

## Files

| File | Purpose |
| --- | --- |
| `assistant.py` | The service (`python3 server/assistant.py`). Importable; logic works without sockets. |
| `check_kiro.py` | One-time operator smoke test for the Kiro CLI on the host. |
| `tests/` | `fake_kiro.py` (stand-in CLI), `fake_supabase.py` (in-memory Supabase), `test_assistant.py`. |
| `../supabase/accounts.sql` | Tables, RLS, column privileges and triggers. |

## Configuration

All settings are environment variables. You can also point `SERVER_ENV_FILE` at a `.env`-style file; real environment variables win over the file. Values are never logged.

| Name | Default | Meaning |
| --- | --- | --- |
| `SUPABASE_URL` | required | Project URL (must be `https://` in production mode). |
| `SUPABASE_ANON_KEY` | required | Used only to verify user tokens. |
| `SUPABASE_SERVICE_ROLE_KEY` | required | Writes reports and usage counters. Server only. |
| `KIRO_API_KEY` | required | Kiro API key used by the CLI. |
| `KIRO_CLI_PATH` | `kiro-cli` | CLI executable. |
| `KIRO_CLI_ARGS` | `chat --no-interactive` | Arguments placed before the prompt. |
| `SERVER_ENV` | `production` | `production` refuses to start with missing required settings (it prints names only). `development` starts anyway with limited features. |
| `SERVER_ENV_FILE` | none | Optional env file to load. |
| `PORT` / `BIND` | `8787` / `127.0.0.1` | Listen address. Keep loopback and put HTTPS in front. |
| `ALLOWED_ORIGINS` | none | Comma list of browser origins allowed by CORS. Empty means no CORS headers. |
| `ASK_PER_DAY` | `30` | Questions per user per UTC day. |
| `REPORTS_PER_DAY` / `REPORTS_PER_HOUR` | `10` / `3` | Report limits per user. |
| `GLOBAL_AI_PER_DAY` | `500` | AI calls per UTC day for the whole process (in memory; resets on restart). |
| `MAX_CONCURRENT_AI` | `3` | Simultaneous Kiro CLI processes. |
| `AI_TIMEOUT_S` | `60` | Hard timeout per CLI run; the process group is killed. |
| `PILOT_BBOX` | `41.18,42.89,-73.55,-69.85` | `min_lat,max_lat,min_lng,max_lng`. A coarse rectangle, so it also covers slivers of neighboring states. |
| `MIN_REPORT_ACCURACY_M` | `200` | Reports whose client-reported accuracy is worse than this are rejected. |
| `REPORT_TTL_HOURS` | `6` | How long a pin stays visible. |
| `TRUST_PROXY` | `false` | Use the last `X-Forwarded-For` entry (added by your own proxy) as the client IP for the failed-sign-in throttle. Leave off if the service is directly exposed. |

## API contract

All `/v1` routes need `Authorization: Bearer <Supabase access token>`. Bodies are JSON (`Content-Type: application/json`, max 16 KB). Errors look like `{ "error": "<code>", "message": "<plain English>" }`; 429 and some 503s add `retryAfterSeconds` and a `Retry-After` header.

- `GET /health` returns `{ "ok": true, "ai": "configured" | "missing" }`. No auth.
- `POST /v1/ask` with `{ question (1..500), place?: { name?, state?, layers?: [{ kind, name }] }, context? (<=3000) }` returns 200 `{ answer, disclaimer, remaining }`.
- `POST /v1/reports` with `{ lat, lng, accuracyM, intensity (1..4), description (1..600) }` returns 201 `{ report: { id, lat, lng, intensity, summary, createdAt, expiresAt } }`. `summary` starts with `Reported by a user: ` or is `null` when the AI was unavailable. Intensity: 1 peaceful, 2 tense, 3 disruptive, 4 unsafe.
- `DELETE /v1/reports/<uuid>` returns 204 for your own report, otherwise 404.

Error codes: 400 `invalid_json`, `invalid_request`; 401 `unauthorized`; 403 `origin_not_allowed` (preflight); 404 `not_found`; 405 `method_not_allowed`; 409 `duplicate_report`; 411 `length_required`; 413 `payload_too_large`; 415 `unsupported_media_type`; 422 `outside_pilot_area`, `low_accuracy`, `contains_personal_info`, `not_publishable`; 429 `rate_limited`; 500 `internal_error`; 503 `ai_unavailable`, `busy`, `capacity_reached`, `service_unavailable`.

Map clients read pins directly from Supabase as a signed-in user, selecting only the granted columns:
`select=id,lat,lng,intensity,summary,created_at,expires_at` (a `select *` is rejected by design).

## Run locally with the fakes

No Supabase project or Kiro account is needed:

```sh
python3 -m unittest discover -s server/tests -v
```

The tests start `fake_supabase.py` and the service on ephemeral ports and use `fake_kiro.py` in place of `kiro-cli`. The fakes check behavior (what the CLI received, what was stored), not real model quality.

To run the service by hand against the real thing, set the variables above (for a quick look, `SERVER_ENV=development`) and run `python3 server/assistant.py`. Then run the smoke test once on the host:

```sh
KIRO_API_KEY=... python3 server/check_kiro.py
```

It prints PASS or FAIL, the exit code and the first 200 characters of output. It also reminds you that the key comes from Kiro account settings and that usage is billed to that account.

## Apply the database changes

1. Run `supabase/schema.sql` first if you have not already.
2. In the Supabase dashboard open SQL Editor, paste `supabase/accounts.sql` and run it. It is idempotent.
3. Check as a signed-in user (not the service role) that `select id,lat,lng,intensity,summary from protest_reports` works and that selecting `user_id` or `description_private` fails. Check that an anonymous request gets nothing.
4. Schedule the purge (see the comments in the SQL file).

## Deploy

Use any host that can run Python 3.9+ and has `kiro-cli` installed with `KIRO_API_KEY` available: a small VM or a container. This does not fit Vercel or other serverless platforms, because each request shells out to the CLI and the service keeps in-memory caches and limits.

- Run it under a process manager (systemd, a container restart policy), as an unprivileged user, with `SERVER_ENV=production`.
- Keep `BIND=127.0.0.1` and terminate HTTPS in a reverse proxy (Caddy, nginx, a cloud load balancer). Set `TRUST_PROXY=true` only when exactly one proxy of yours sits in front.
- Set `ALLOWED_ORIGINS` to the site's exact origin(s).
- Run one process. The global AI cap and sign-in cache are per process.
- Store secrets in the host's secret manager or a root-only env file referenced by `SERVER_ENV_FILE`. Never commit them.

## Kiro billing and terms

The owner of `KIRO_API_KEY` pays for every call, in that account's credits. Limits (`ASK_PER_DAY`, `REPORTS_PER_DAY`, `GLOBAL_AI_PER_DAY`, `MAX_CONCURRENT_AI`) bound the spend, but they are not a billing guarantee. Before launch, the key owner should confirm that Kiro's terms allow serving public users through headless mode, and should watch the credit balance.

## Security model

- The service-role key exists only in this process. Browsers get the anon key and their own access token.
- Every `/v1` call verifies the token with Supabase (`/auth/v1/user`); successful checks are cached for about 60 seconds. Repeated failed checks from one IP are throttled.
- RLS is on for all new tables. Clients can only read visible, unexpired reports, and only the columns `id, lat, lng, intensity, summary, created_at, expires_at`. `user_id` and `description_private` are not readable by any client role. Anonymous users get nothing. Clients have no insert, update or delete rights on reports.
- Raw descriptions are private: the service never returns them, and the public pin carries only the AI summary.
- Before the AI sees a description, a local filter rejects emails, phone numbers, plate-like text after words such as "plate" or "tag", and street addresses. The summary is scrubbed again after the AI (URLs, handles, control characters, personal data), and the AI may refuse to publish.
- Prompts put the rules first and wrap user text in delimited blocks with `<` and `>` escaped. Prompt injection is reduced, not eliminated; the rules also tell the model to ignore instructions in user text.
- The CLI runs in an empty temp directory with only `PATH`, `HOME` and `KIRO_API_KEY` in its environment, no tool permissions, and a hard timeout. The prompt is passed in argv (the CLI offers no other channel), so it can be seen in the host's process list; keep the host single-purpose.
- Pins expire after `REPORT_TTL_HOURS`. Users can delete their reports, and three flags from distinct users hide a report automatically. Daily and hourly limits, a duplicate check (250 m / 30 minutes) and a global AI cap limit abuse.
- Logs hold method, route, status, duration and a short hash of the user id. No bodies, prompts, outputs, tokens or keys.

## What to monitor

- Kiro credit balance and the count of `ai_unavailable`, `busy` and `capacity_reached` responses.
- 5xx rates and `service_unavailable` (Supabase reachability).
- Reports stored with `summary is null` (AI failures), and the flag rate (`flag_count`, hidden reports).
- Growth of `protest_reports` and `assistant_usage`, and that the purge job runs.
- Process restarts: the global AI cap resets when the process restarts.

## Privacy: what is stored per report

- Location rounded to 3 decimals (about 110 m).
- Intensity (1 to 4).
- The AI summary (or nothing if the AI was unavailable).
- The reporter's raw text, kept private for moderation until the purge deletes the row.
- The reporting user's id.
- Timestamps (created, expires) and a flag count and status.

Usage counters (`assistant_usage`) store the user id, day, kind and a count. Questions asked via `/v1/ask` are sent to Kiro but are not stored by this service.

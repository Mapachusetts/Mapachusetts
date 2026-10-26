#!/usr/bin/env python3
"""Operator smoke test for the Kiro CLI integration. Run it once per host.

    KIRO_API_KEY=... python3 server/check_kiro.py

It uses the same run_kiro() as the service (empty temp dir, minimal
environment, no tool permissions, hard timeout) with a harmless prompt, then
prints PASS or FAIL, the exit code and the first 200 characters of output.
Exit status is 0 on PASS and 1 on FAIL.

Honors the same settings as the service: KIRO_API_KEY, KIRO_CLI_PATH,
KIRO_CLI_ARGS, AI_TIMEOUT_S and SERVER_ENV_FILE.
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import assistant  # noqa: E402

PROMPT = "Reply with exactly the word OK."

REMINDER = (
    "Reminder: KIRO_API_KEY comes from your Kiro account settings, and every "
    "call this service makes is billed to that account's credits. Confirm "
    "Kiro's terms allow serving public users before launch."
)


def main() -> int:
    env = dict(os.environ)
    env_file = env.get("SERVER_ENV_FILE", "").strip()
    if env_file and os.path.isfile(env_file):
        assistant.load_env_file(env_file, env)
    try:
        cfg = assistant.Config.from_env(env)
    except assistant.ConfigError as exc:
        print("FAIL: configuration error: %s" % exc)
        print(REMINDER)
        return 1

    returncode = None
    output = ""
    ok = False
    detail = ""
    try:
        output = assistant.run_kiro(PROMPT, cfg)
        returncode = 0
        ok = re.search(r"\bok\b", output, re.IGNORECASE) is not None
        if not ok:
            detail = "the CLI ran but did not reply with OK"
    except assistant.KiroError as exc:
        returncode = exc.returncode
        output = exc.output
        detail = "%s: %s" % (type(exc).__name__, exc)

    print("PASS" if ok else "FAIL")
    if detail:
        print("detail: " + detail)
    print("exit code: %s" % ("n/a" if returncode is None else returncode))
    print("output (first 200 chars): " + output[:200].replace("\n", " "))
    print()
    print(REMINDER)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Stand-in for `kiro-cli` used only by tests. Not the real thing.

Reads the prompt from the last argv item and behaves according to markers the
tests put in the user text. Every invocation is appended as one JSON line to
`fake_kiro_calls.jsonl` next to this script (tests copy the script into a temp
directory first), so tests can assert on exactly what the CLI received.

Markers (summarizer prompts):
  [[FAKE_PROSE]]    prose around an embedded JSON object
  [[FAKE_GARBAGE]]  output with no JSON at all
  [[FAKE_SLEEP]]    sleeps far past any test timeout
  [[FAKE_FAIL]]     exits non-zero
  [[FAKE_NOTPUB]]   {"publishable": false}
  [[FAKE_URLS]]     summary containing URLs and @handles
  [[FAKE_BADTYPES]] JSON with wrong types
  (none)            a good JSON summary
Ask prompts return a short answer wrapped in ANSI color codes.
"""

import json
import os
import sys
import time


def main() -> int:
    argv = sys.argv[1:]
    prompt = argv[-1] if argv else ""
    record = {
        "argv": argv,
        "prompt": prompt,
        "cwd": os.getcwd(),
        "cwd_listing": sorted(os.listdir(".")),
        "env_keys": sorted(os.environ.keys()),
        "home": os.environ.get("HOME"),
        "has_key": bool(os.environ.get("KIRO_API_KEY")),
    }
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fake_kiro_calls.jsonl")
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")

    if prompt.strip() == "Reply with exactly the word OK.":
        sys.stdout.write("OK\n")
        return 0

    if "TASK: ASK" in prompt:
        sys.stdout.write("\x1b[32mThis is a fake nonpartisan answer. I am not sure about dates.\x1b[0m\n")
        return 0

    # Only look at the user's block so rule text can never trigger a marker.
    start = prompt.find("<report_text>")
    user_part = prompt[start:] if start != -1 else prompt

    if "[[FAKE_SLEEP]]" in user_part:
        time.sleep(60)
        return 0
    if "[[FAKE_FAIL]]" in user_part:
        sys.stderr.write("boom\n")
        return 3
    if "[[FAKE_GARBAGE]]" in user_part:
        sys.stdout.write("I cannot help with that, sorry {not json\n")
        return 0
    if "[[FAKE_NOTPUB]]" in user_part:
        sys.stdout.write(json.dumps({"summary": None, "publishable": False, "reason": "no facts"}))
        return 0
    if "[[FAKE_BADTYPES]]" in user_part:
        sys.stdout.write(json.dumps({"summary": 42, "publishable": "yes", "reason": None}))
        return 0
    if "[[FAKE_URLS]]" in user_part:
        sys.stdout.write(
            json.dumps(
                {
                    "summary": "About 50 people gather outside the library, see https://evil.example/x "
                    "and follow @someone or www.foo.com for more.",
                    "publishable": True,
                    "reason": "ok",
                }
            )
        )
        return 0
    good = {
        "summary": "Roughly 100 people are gathered near the State House holding signs.",
        "publishable": True,
        "reason": "ok",
    }
    if "[[FAKE_PROSE]]" in user_part:
        sys.stdout.write("\x1b[1mSure! Here is the result:\x1b[0m\n```json\n" + json.dumps(good) + "\n```\nHope that helps.\n")
        return 0
    sys.stdout.write(json.dumps(good))
    return 0


if __name__ == "__main__":
    sys.exit(main())

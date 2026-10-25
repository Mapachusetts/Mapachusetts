#!/usr/bin/env python3
"""
Work out which 2026 races people are looking at right now, and pick a
geographically diverse set of them for the front page.

"Trending" here means: how many times each race's Wikipedia article was viewed
in the last few days (Wikimedia Pageviews API, public, no key). It is a proxy
for public attention, not a measure of importance or closeness.

  data/trending.generated.js   <- written by this script (pure ES module)

Run it as often as you like (daily is ideal; see README for a GitHub Actions
example). The site hides the "trending" label if the file gets old.

  python3 scripts/export_trending.py

Method
  1. Read the race pages from data/nominees.generated.js (U.S. Senate and
     Governor races, about 70 pages).
  2. For each page get daily views for the last 7 full days.
  3. attention = views in the last 3 days.   surge = last-3-day average divided
     by the average of the 4 days before that (a spike marker, only reported
     when the earlier average is at least 200 views a day so tiny pages cannot
     fake a surge).
  4. Score each STATE by the attention of all its listed races, then fill the
     front-page slots round-robin by Census region (Northeast, Midwest, South,
     West) so no region is left out, then by overall rank.

Python 3.9 standard library only.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOMINEES = ROOT / "data" / "nominees.generated.js"
OUT = ROOT / "data" / "trending.generated.js"
UA = "mapachusetts-civic/1.0 (https://github.com/Mapachusetts/Mapachusetts)"
SLOTS = 6
RECENT_DAYS = 3
BASELINE_DAYS = 4
MIN_BASELINE_PER_DAY = 200

REGIONS = {
    "Northeast": "CT ME MA NH RI VT NJ NY PA",
    "Midwest": "IL IN MI OH WI IA KS MN MO NE ND SD",
    "South": "DE FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX DC",
    "West": "AZ CO ID MT NV NM UT WY AK CA HI OR WA",
}
REGION_OF = {}
for _region, _states in REGIONS.items():
    for _s in _states.split():
        REGION_OF[_s] = _region


def load_race_pages():
    """(race id, state, office, wikipedia title) for every Senate/Governor race."""
    text = NOMINEES.read_text(encoding="utf-8")
    body = text[text.index("export const NOMINEES = ") + len("export const NOMINEES = "):].rstrip().rstrip(";")
    races = json.loads(body)
    out = []
    for rid, race in races.items():
        if race["office"] not in ("senate", "governor"):
            continue
        m = re.search(r"/wiki/(.+)$", race.get("source") or "")
        if not m:
            continue
        out.append((rid, race["state"], race["office"], urllib.parse.unquote(m.group(1))))
    return out


def daily_views(title, start, end):
    t = urllib.parse.quote(title, safe="")
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/"
           "all-access/user/%s/daily/%s/%s" % (t, start.strftime("%Y%m%d"), end.strftime("%Y%m%d")))
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return [item["views"] for item in data.get("items", [])]
        except Exception:
            time.sleep(1.0 * (attempt + 1))
    return None


def main():
    pages = load_race_pages()
    end = date.today() - timedelta(days=1)  # the last full UTC day
    start = end - timedelta(days=RECENT_DAYS + BASELINE_DAYS - 1)
    print("Race pages: %d | window: %s .. %s" % (len(pages), start, end))

    races = []
    failed = []
    for rid, state, office, title in pages:
        views = daily_views(title, start, end)
        time.sleep(0.05)
        if not views or len(views) < RECENT_DAYS + BASELINE_DAYS:
            failed.append(rid)
            continue
        recent = views[-RECENT_DAYS:]
        base = views[:-RECENT_DAYS]
        attention = sum(recent)
        base_avg = sum(base) / float(len(base))
        surge = None
        if base_avg >= MIN_BASELINE_PER_DAY:
            surge = round((sum(recent) / float(len(recent))) / base_avg, 1)
        races.append({"id": rid, "state": state, "office": office,
                      "attention": attention, "surge": surge})

    # Score states by their races, keep each state's top race as its headline.
    by_state = {}
    for r in races:
        s = by_state.setdefault(r["state"], {"state": r["state"], "attention": 0, "races": []})
        s["attention"] += r["attention"]
        s["races"].append(r)
    for s in by_state.values():
        s["races"].sort(key=lambda r: r["attention"], reverse=True)
        s["region"] = REGION_OF.get(s["state"], "South")
    ranked = sorted(by_state.values(), key=lambda s: s["attention"], reverse=True)

    # Round-robin by region (best state of each region first), then by rank.
    picked = []
    best_by_region = {}
    for s in ranked:
        best_by_region.setdefault(s["region"], []).append(s)
    layer = 0
    while len(picked) < SLOTS and any(len(v) > layer for v in best_by_region.values()):
        for region in ("Northeast", "Midwest", "South", "West"):
            lst = best_by_region.get(region, [])
            if len(lst) > layer and len(picked) < SLOTS:
                picked.append(lst[layer])
        layer += 1
    # Within a layer, show the most-viewed first.
    picked.sort(key=lambda s: s["attention"], reverse=True)

    featured = []
    for s in picked:
        head = s["races"][0]
        featured.append({
            "state": s["state"],
            "region": s["region"],
            "raceId": head["id"],
            "office": head["office"],
            "attention": s["attention"],
            "surge": head["surge"],
        })

    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "windowStart": str(start),
        "windowEnd": str(end),
        "method": "Wikipedia page views of 2026 U.S. Senate and governor race articles, last %d days. "
                  "A proxy for public attention, not for importance or competitiveness." % RECENT_DAYS,
        "racesRanked": len(races),
    }
    text = (
        "// GENERATED by scripts/export_trending.py. DO NOT EDIT BY HAND.\n"
        "export const TRENDING_META = " + json.dumps(meta, indent=2) + ";\n"
        "export const TRENDING = " + json.dumps(featured, indent=2) + ";\n"
    )
    OUT.write_text(text, encoding="utf-8")

    print("Ranked %d races (%d failed: %s)" % (len(races), len(failed), failed[:5]))
    print("Top 8 states by attention:")
    for s in ranked[:8]:
        print("   %-2s %-9s %8d  headline %s" % (s["state"], s["region"], s["attention"], s["races"][0]["id"]))
    print("Featured (diverse by region):")
    for f in featured:
        print("   %-2s %-9s %-8s attention=%-7d surge=%s" % (f["state"], f["region"], f["office"], f["attention"], f["surge"]))
    print("wrote %s" % OUT.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())

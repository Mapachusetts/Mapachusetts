#!/usr/bin/env python3
"""
Export REAL upcoming public meetings (city council, committees, boards) from
the Legistar Web API for the civic globe UI.

Legistar (https://webapi.legistar.com/v1/<client>/events) is the agenda
system many U.S. cities use. For the clients listed in CITIES below the API is
publicly readable without a token. This script pulls every event from today
through today + 45 days, drops cancelled / postponed / empty-body events,
attaches each city's Census GEOID (looked up and point-in-polygon verified
against Census TIGERweb) and writes ONE plain ES module the static site can
import:

    data/events.generated.js

Run it (Python 3.9+, standard library only, no API keys):

    python3 scripts/export_events.py            # normal run
    python3 scripts/export_events.py --refresh  # ignore the GEOID cache

It is safe to re-run any time (idempotent apart from the generatedAt stamp).
Nothing in the generated file is edited by hand. Network responses for the
Census lookups are cached under /tmp/export_events_cache/.

HOW TO ADD A CITY
    1. Find a Legistar client name (the <client> in https://<client>.legistar.com).
    2. Confirm it works without a token:
         https://webapi.legistar.com/v1/<client>/events?$top=1
    3. Add ONE entry to the CITIES table below:
         ("client", lng, lat, "Expected Census name")
       lng/lat is the city center. The script resolves the state FIPS/USPS,
       the Census Place GEOID (7 digits) and, for New England / Mid-Atlantic
       style strong-MCD states (CT ME MA MI MN NH NJ NY PA RI VT WI), the
       County Subdivision GEOID (10 digits) itself, and prints a verification
       line. A city whose GEOID cannot be verified (name mismatch or no
       TIGERweb answer) is reported and left out of the output.
    4. Re-run this script.

GEOID rules: in strong-MCD states `geoid` is the 10-digit County Subdivision
GEOID and `placeGeoid` the 7-digit Place GEOID (they can differ). Everywhere
else `geoid` equals the 7-digit Place GEOID.
"""
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "events.generated.js"
CACHE_DIR = Path("/tmp/export_events_cache")

WINDOW_DAYS = 45
TIMEOUT = 25
USER_AGENT = "mapachusetts-civic-events/1.0 (hackathon; public data)"
LEGISTAR = "https://webapi.legistar.com/v1/%s/events"
TIGER = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
         "tigerWMS_Current/MapServer/%d/query")
LAYER_PLACE = 28
LAYER_COUSUB = 22

# (legistar client, center lng, center lat, expected Census BASENAME)
# Probed 2026-10-24: all of these returned a valid JSON array without a token.
CITIES = [
    # Northeast
    ("boston", -71.0589, 42.3601, "Boston"),
    ("pittsburgh", -79.9959, 40.4406, "Pittsburgh"),
    ("alexandria", -77.0469, 38.8048, "Alexandria"),
    ("baltimore", -76.6122, 39.2904, "Baltimore"),
    ("hampton", -76.3452, 37.0299, "Hampton"),
    # Midwest
    ("stpaul", -93.0900, 44.9537, "St. Paul"),
    ("madison", -89.4012, 43.0731, "Madison"),
    ("milwaukee", -87.9065, 43.0389, "Milwaukee"),
    ("columbus", -82.9988, 39.9612, "Columbus"),
    ("toledo", -83.5379, 41.6528, "Toledo"),
    ("naperville", -88.1535, 41.7508, "Naperville"),
    ("aurora-il", -88.3201, 41.7606, "Aurora"),
    # South
    ("louisville", -85.7585, 38.2527, "Louisville"),
    ("corpuschristi", -97.3964, 27.8006, "Corpus Christi"),
    # West
    ("seattle", -122.3321, 47.6062, "Seattle"),
    ("bellevue", -122.2015, 47.6101, "Bellevue"),
    ("oakland", -122.2712, 37.8044, "Oakland"),
    ("sanjose", -121.8863, 37.3382, "San Jose"),
    ("mountainview", -122.0838, 37.3861, "Mountain View"),
    ("sacramento", -121.4944, 38.5816, "Sacramento"),
    ("stockton", -121.2908, 37.9577, "Stockton"),
    ("fresno", -119.7871, 36.7378, "Fresno"),
    ("denver", -104.9903, 39.7392, "Denver"),
    ("phoenix", -112.0740, 33.4484, "Phoenix"),
    ("mesa", -111.8315, 33.4152, "Mesa"),
]

STRONG_MCD_STATES = {"CT", "ME", "MA", "MI", "MN", "NH", "NJ", "NY", "PA", "RI", "VT", "WI"}

FIPS_TO_USPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
}

CANCEL_RE = re.compile(r"cancel|postpone", re.I)
HEARING_RE = re.compile(r"hearing", re.I)
# Bodies that are placeholders / retired / not real public meetings.
SKIP_BODY_RE = re.compile(r"miscellaneous agendas|\(ended|\btest\b|do not use", re.I)
TIME_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?\s*$")


# --------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------
def http_json(url, retries=2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (400, 401, 403, 404, 500):  # permanent for Legistar
                break
        except Exception as exc:  # network blips, timeouts, bad JSON
            last = exc
        time.sleep(1.5 * (attempt + 1))
    raise last


# --------------------------------------------------------------------------
# Census GEOID resolution (TIGERweb point-in-polygon)
# --------------------------------------------------------------------------
def tiger_point(layer, lng, lat, refresh):
    """Return the attributes dict of the feature containing the point, or None."""
    params = {
        "geometry": "%s,%s" % (lng, lat),
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "GEOID,NAME,BASENAME,STATE",
        "returnGeometry": "false",
        "f": "json",
    }
    url = TIGER % layer + "?" + urllib.parse.urlencode(params)
    cache_file = CACHE_DIR / (hashlib.md5(url.encode("utf-8")).hexdigest() + ".json")
    if not refresh and cache_file.exists():
        data = json.loads(cache_file.read_text())
    else:
        data = http_json(url, retries=3)
        if "features" in data:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(data))
    feats = data.get("features") or []
    return feats[0]["attributes"] if feats else None


def norm_name(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def resolve_geo(client, lng, lat, expect, refresh):
    """Resolve + verify Census identifiers for a city center.

    Returns (geo dict or None, human readable verification string)."""
    try:
        place = tiger_point(LAYER_PLACE, lng, lat, refresh)
        cousub = tiger_point(LAYER_COUSUB, lng, lat, refresh)
    except Exception as exc:
        return None, "TIGERweb error: %s" % exc
    ref = place or cousub
    if not ref:
        return None, "TIGERweb returned no place or county subdivision"
    state_fips = ref["STATE"]
    state = FIPS_TO_USPS.get(state_fips)
    if not state:
        return None, "unknown state FIPS %s" % state_fips
    strong = state in STRONG_MCD_STATES
    primary = cousub if strong else place
    if not primary:
        return None, "no %s at center (state %s)" % (
            "county subdivision" if strong else "incorporated place", state)
    name_ok = norm_name(primary["BASENAME"]) == norm_name(expect)
    layer_label = "cousub" if strong else "place"
    verif = "%s '%s' (%s %s)" % (
        "OK" if name_ok else "MISMATCH vs '%s'" % expect,
        primary["NAME"], layer_label, primary["GEOID"])
    if not name_ok:
        return None, verif
    geo = {
        "city": primary["BASENAME"],
        "state": state,
        "stateFips": state_fips,
        "geoid": primary["GEOID"],
        "placeGeoid": place["GEOID"] if place else None,
        "tigerName": primary["NAME"],
    }
    return geo, verif


# --------------------------------------------------------------------------
# Legistar events
# --------------------------------------------------------------------------
def fetch_events(client, start, end):
    """Page through /events for [start, end) until an empty page."""
    flt = "EventDate ge datetime'%s' and EventDate lt datetime'%s'" % (
        start.isoformat(), end.isoformat())
    page, skip, rows = 500, 0, []
    while True:
        q = urllib.parse.urlencode(
            {"$filter": flt, "$orderby": "EventDate", "$top": page, "$skip": skip},
            quote_via=urllib.parse.quote)
        batch = http_json((LEGISTAR % client) + "?" + q)
        if not isinstance(batch, list):
            raise ValueError("not a JSON array")
        if not batch:
            break
        rows.extend(batch)
        skip += len(batch)
        if skip > 20000:  # safety valve
            break
    return rows


def clean_text(s):
    return re.sub(r"\s+", " ", s or "").strip()


def build_start(event_date, event_time):
    """Return (ISO local start string, allDay)."""
    day = (event_date or "")[:10]
    m = TIME_RE.match(event_time or "")
    if not m:
        return day + "T00:00:00", True
    hour, minute, ap = int(m.group(1)), int(m.group(2)), m.group(3).lower()
    if hour < 1 or hour > 12 or minute > 59:
        return day + "T00:00:00", True
    hour = hour % 12 + (12 if ap == "p" else 0)
    return "%sT%02d:%02d:00" % (day, hour, minute), False


def convert_events(client, geo, rows):
    """Turn raw Legistar rows into site events. Returns (events, stats)."""
    stats = {"cancelled": 0, "nobody": 0, "skipbody": 0, "dup": 0, "baddate": 0}
    out, seen_ids, seen_keys = [], set(), set()
    source = "%s City Council (Legistar)" % geo["city"]
    for r in rows:
        title = clean_text(r.get("EventBodyName"))
        if not title:
            stats["nobody"] += 1
            continue
        if SKIP_BODY_RE.search(title):
            stats["skipbody"] += 1
            continue
        comment = clean_text(r.get("EventComment"))
        status = clean_text(r.get("EventAgendaStatusName"))
        if CANCEL_RE.search(status) or CANCEL_RE.search(comment):
            stats["cancelled"] += 1
            continue
        if not re.match(r"^\d{4}-\d{2}-\d{2}", r.get("EventDate") or ""):
            stats["baddate"] += 1
            continue
        start, all_day = build_start(r.get("EventDate"), r.get("EventTime"))
        venue = clean_text(r.get("EventLocation"))
        ev_id = "legistar:%s:%s" % (client, r.get("EventId"))
        key = (title.lower(), start, venue.lower())
        if ev_id in seen_ids or key in seen_keys:
            stats["dup"] += 1
            continue
        seen_ids.add(ev_id)
        seen_keys.add(key)
        ev = {
            "id": ev_id,
            "city": geo["city"],
            "geoid": geo["geoid"],
            "state": geo["state"],
            "kind": "city",
            "type": "hearing" if (HEARING_RE.search(title) or HEARING_RE.search(comment)) else "meeting",
            "title": title,
            "start": start,
        }
        if all_day:
            ev["allDay"] = True
        ev["venue"] = venue
        ev["url"] = clean_text(r.get("EventInSiteURL")) or None
        ev["agendaUrl"] = clean_text(r.get("EventAgendaFile")) or None
        ev["cancelled"] = False
        ev["source"] = source
        out.append(ev)
    return out, stats


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def process_city(entry, start, end, refresh):
    client, lng, lat, expect = entry
    res = {"client": client, "lng": lng, "lat": lat, "expect": expect,
           "geo": None, "verif": "", "events": [], "raw": 0, "stats": {}, "error": None}
    geo, verif = resolve_geo(client, lng, lat, expect, refresh)
    res["geo"], res["verif"] = geo, verif
    try:
        rows = fetch_events(client, start, end)
    except Exception as exc:
        res["error"] = "Legistar: %s" % exc
        return res
    res["raw"] = len(rows)
    if geo:
        res["events"], res["stats"] = convert_events(client, geo, rows)
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description="Export Legistar meetings to data/events.generated.js")
    ap.add_argument("--refresh", action="store_true", help="ignore cached Census lookups")
    ap.add_argument("--out", default=str(OUT_PATH), help="output path")
    args = ap.parse_args(argv)

    today = date.today()
    start, end = today, today + timedelta(days=WINDOW_DAYS + 1)  # through +45 days inclusive
    print("Window: %s .. %s (%d days), %d candidate cities"
          % (start, end - timedelta(days=1), WINDOW_DAYS, len(CITIES)))

    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(lambda e: process_city(e, start, end, args.refresh), CITIES))

    kept, skipped, all_events, seen_ids = [], [], [], set()
    for res in results:
        label = res["client"]
        if res["error"]:
            skipped.append((label, res["error"]))
            continue
        if not res["geo"]:
            skipped.append((label, "GEOID not verified: " + res["verif"]))
            continue
        evs = [e for e in res["events"] if e["id"] not in seen_ids]
        seen_ids.update(e["id"] for e in evs)
        if not evs:
            skipped.append((label, "0 usable events (raw %d)" % res["raw"]))
            continue
        geo = res["geo"]
        kept.append({
            "client": res["client"],
            "city": geo["city"],
            "state": geo["state"],
            "geoid": geo["geoid"],
            "placeGeoid": geo["placeGeoid"],
            "center": [res["lng"], res["lat"]],
            "events": len(evs),
        })
        all_events.extend(evs)
        print("[%-13s] raw=%-3d kept=%-3d dropped=%s | TIGERweb %s"
              % (label, res["raw"], len(evs), res["stats"], res["verif"]))
        for e in evs[:2]:
            print("      e.g. %s | %s | %s | %s" % (e["start"], e["title"][:50], e["type"], e["venue"][:45]))

    all_events.sort(key=lambda e: (e["start"], e["city"], e["title"]))
    kept.sort(key=lambda c: c["city"])

    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "windowDays": WINDOW_DAYS,
        "cities": kept,
        "counts": {"cities": len(kept), "events": len(all_events)},
    }
    text = (
        "// GENERATED by scripts/export_events.py. DO NOT EDIT BY HAND.\n"
        "export const EVENTS_META = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n"
        "export const EVENTS = " + json.dumps(all_events, indent=2, ensure_ascii=False) + ";\n"
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(out)

    print("\n=== SUMMARY ===")
    print("Cities kept: %d | events: %d | file: %s (%d bytes)"
          % (len(kept), len(all_events), out, len(text.encode("utf-8"))))
    for c in kept:
        print("  %-16s %-2s geoid=%-10s place=%-8s events=%d"
              % (c["city"], c["state"], c["geoid"], c["placeGeoid"], c["events"]))
    for label, why in skipped:
        print("  SKIPPED %-14s %s" % (label, why))
    return 0


if __name__ == "__main__":
    sys.exit(main())

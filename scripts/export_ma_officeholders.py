#!/usr/bin/env python3
"""
export_ma_officeholders.py: who CURRENTLY HOLDS Massachusetts offices below the
national level, whether or not the seat is on the ballot this year.

Writes data/officeholders.ma.generated.js (pure ES module):

    export const OFFICEHOLDERS_META = { generatedAt, asOf, sources, counts, notes };
    export const OFFICEHOLDERS = [ { id, layer, match, office, name, party, ... } ];

Every holder is keyed to a jurisdiction the app already shows in its "stack"
(data/census.js identifyStack), so the UI can look the person up by `layer`
and `match` without any extra geocoding.

NOT INCLUDED (another export owns them): President, Vice President, U.S.
Senators and ALL governors (including Maura Healey). Towns (select boards,
town administrators, city councils, school committees) are also not included.

SCOPE
  1. Statewide: Lieutenant Governor, Attorney General, Secretary of the
     Commonwealth, Treasurer and Receiver-General, State Auditor.
  2. State Senate (40) and State House (160).
  3. U.S. House (9).
  4. County: elected Sheriffs (all 14 counties) and District Attorneys (11
     districts, one entry per COUNTY covered, 14 entries).
  5. Mayors of Massachusetts cities that have one (curated table below).

HOW THE APP IDENTIFIES PLACES (observed with live TIGERweb queries)
  The script calls the same Census layers as data/census.js:
      Counties                      geoid "25025"        (5 digits)
      120th Congressional Districts geoid "2508"         name "Congressional District 8"
      2026 State Legislative - Upper geoid "25D25"       name "Third Suffolk District"
      2026 State Legislative - Lower geoid "25125"       name "3rd Suffolk District"
      County Subdivisions (cities)  geoid "2502507000"   name "Boston city" (BASENAME "Boston")
  For Massachusetts the app puts the COUNTY SUBDIVISION in the stack for a
  city (id "city:2502507000", name "Boston", type "City"), because
  doIdentify() keeps the subdivision record when the incorporated place has the
  same name. This script re-implements that rule and checks, with live point
  lookups, that Boston, Medford and Springfield resolve to the geoids it emits.

SOURCES AND METHOD
  * Legislature: malegislature.gov API (194th General Court, 2025-2026) gives
    member, district, party, email, leadership. It also lists members who have
    left (resigned, died or lost a special election), so two members can share
    a district. The CURRENT member is the one whose Open States role is open
    (no end_date). Open States people repo (CC0), data/ma/legislature.
  * Statewide: Open States data/ma/executive, cross-checked with the 2026
    ballot listing.
  * U.S. House: unitedstates.github.io/congress-legislators (current).
  * Sheriffs and District Attorneys: winners and ballot party from the
    Secretary of the Commonwealth's PD43+ results (electionstats.state.ma.us,
    2022 general election), then checked against mass.gov, county sites and
    news for resignations and appointments since (curated table SHERIFFS / DAS).
  * Mayors: curated table MAYORS, built from Open States, Wikipedia, each
    city's official site and November 2025 election results. A mayor is
    included only with an official city source plus one other source, or two
    independent sources. Wikipedia infoboxes are re-fetched on every run and
    compared with the table (see cross_check_mayors).
  * District name matching: Census and legislature name the same district
    differently ("3rd Suffolk" vs "3rd Suffolk District", "Third Suffolk",
    "Hampden-Hampshire-Worcester" vs "Hampden, Hampshire and Worcester").
    normalize_district() canonicalises both sides and the run fails unless
    every one of the 200 seats maps to exactly one Census district and every
    Census district gets exactly one member.

CHECKS (printed as a verification summary; non-zero exit on failure)
  * every legislator matches exactly one Census district, and vice versa
  * every county, congressional district and city geoid exists in the Census lists
  * live stack lookups for Boston, Medford and Springfield agree with `match`
  * no duplicate ids; counts per category

NETWORK
  Uses curl (system) for every request, because macOS Python 3.9's TLS stack
  cannot talk to some state servers. Responses are cached under
  /tmp/mapachusetts-ma-officeholders-cache/ ; pass --refresh to bypass the cache.
  Requires Python 3.9 standard library only. No API keys.

Usage:
  python3 scripts/export_ma_officeholders.py [--refresh] [--people-dir /tmp/oh-people]
  The Open States checkout is created on demand:
    git clone --depth 1 --filter=blob:none --sparse https://github.com/openstates/people.git /tmp/oh-people
    git -C /tmp/oh-people sparse-checkout set data/ma
"""

import argparse
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

AS_OF = "2026-10-24"
ELECTION_DAY = "2026-11-03"
GENERAL_COURT = 194
CACHE_DIR = Path("/tmp/mapachusetts-ma-officeholders-cache")
ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "officeholders.ma.generated.js"
UA = "Mozilla/5.0 (mapachusetts-officeholders/1.0; civic data export)"
# Some hosts (bioguide.congress.gov, mass.gov) answer 403 to unknown agents but serve images to browsers.
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/120.0 Safari/537.36")

TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer"
# Layer ids are resolved by NAME at runtime, like data/census.js. These are fallbacks.
LAYER_PATTERNS = {
    "counties": (82, r"^Counties$"),
    "congress": (54, r"^\d+(st|nd|rd|th) Congressional Districts$"),
    "senate": (56, r"State Legislative Districts - Upper$"),
    "house": (58, r"State Legislative Districts - Lower$"),
    "places": (28, r"^Incorporated Places$"),
    "subdivisions": (22, r"^County Subdivisions$"),
}

REFRESH = False


# ----------------------------------------------------------------------------
# Fetching with a /tmp cache (curl, because Python 3.9's TLS fails on some hosts)
# ----------------------------------------------------------------------------

def fetch(url, binary=False, headers=None, timeout=90, cache=True):
    """GET a URL via curl. Cached on disk; --refresh bypasses the cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()
    path = CACHE_DIR / ("http-" + key)
    if cache and not REFRESH and path.exists():
        data = path.read_bytes()
    else:
        cmd = ["curl", "-s", "-L", "-m", str(timeout), "-A", UA, "-f"]
        for k, v in (headers or {}).items():
            cmd += ["-H", "%s: %s" % (k, v)]
        cmd.append(url)
        last = None
        for attempt in range(3):
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0:
                data = res.stdout
                break
            last = res.returncode
            time.sleep(2 * (attempt + 1))  # e.g. HTTP 429 from Wikipedia
        else:
            raise RuntimeError("curl failed (%s) for %s" % (last, url))
        if cache:
            path.write_bytes(data)
    return data if binary else data.decode("utf-8", "replace")


def is_cached(url):
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()
    return (not REFRESH) and (CACHE_DIR / ("http-" + key)).exists()


def fetch_json(url, **kw):
    return json.loads(fetch(url, **kw))


def head_ok(url, want_type=None):
    """True if a HEAD/GET of the URL returns 200 with the wanted content type.
    Cached per URL (result only)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(("head:" + url).encode("utf-8")).hexdigest()
    path = CACHE_DIR / ("head-" + key)
    if not REFRESH and path.exists():
        return path.read_text() == "1"
    res = subprocess.run(
        ["curl", "-s", "-L", "-m", "40", "-A", BROWSER_UA, "-o", "/dev/null", "-r", "0-1023",
         "-w", "%{http_code} %{content_type}", url],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out = res.stdout.decode("utf-8", "replace").strip()
    code, _, ctype = out.partition(" ")
    ok = code in ("200", "206") and (want_type is None or ctype.lower().startswith(want_type))
    path.write_text("1" if ok else "0")
    return ok


# ----------------------------------------------------------------------------
# Minimal YAML reader (enough for the Open States people files)
# ----------------------------------------------------------------------------

def _scalar(s):
    s = s.strip()
    if s == "" or s in ("~", "null"):
        return None
    if s[0] == "'" and s[-1] == "'" and len(s) >= 2:
        return s[1:-1].replace("''", "'")
    if s[0] == '"' and s[-1] == '"' and len(s) >= 2:
        return bytes(s[1:-1], "utf-8").decode("unicode_escape") if "\\" in s else s[1:-1]
    if s in ("true", "True"):
        return True
    if s in ("false", "False"):
        return False
    return s  # dates and numbers stay strings; callers only need strings


_KEY_RE = re.compile(r"""^("[^"]*"|'[^']*'|[^\s'"\-\[{#][^:]*?|-[^\s:][^:]*?):(\s+(.*))?$""")


def parse_yaml(text):
    toks = []
    for raw in text.split("\n"):
        if not raw.strip() or raw.lstrip().startswith("#") or raw.strip() == "---":
            continue
        body = raw.lstrip(" ")
        toks.append([len(raw) - len(body), body.rstrip()])
    val, _ = _parse_node(toks, 0, toks[0][0] if toks else 0)
    return val


def _split_kv(body):
    m = _KEY_RE.match(body)
    if not m:
        return None
    key = m.group(1)
    if key[0] in "\"'":
        key = key[1:-1]
    return key.strip(), (m.group(3) or "")


def _parse_node(toks, i, indent):
    body = toks[i][1]
    if body == "-" or body.startswith("- "):
        return _parse_list(toks, i, indent)
    return _parse_map(toks, i, indent)


def _parse_map(toks, i, indent):
    out = {}
    while i < len(toks) and toks[i][0] == indent and not (toks[i][1] == "-" or toks[i][1].startswith("- ")):
        kv = _split_kv(toks[i][1])
        if kv is None:
            raise ValueError("bad yaml line: %r" % toks[i][1])
        key, rest = kv
        if rest in ("", ">-", ">", "|", "|-"):
            nxt = toks[i + 1] if i + 1 < len(toks) else None
            if rest in ("", ) and nxt and (nxt[0] > indent or (nxt[0] == indent and (nxt[1] == "-" or nxt[1].startswith("- ")))):
                val, i = _parse_node(toks, i + 1, nxt[0])
            elif rest != "" and nxt and nxt[0] > indent:
                parts = []
                j = i + 1
                while j < len(toks) and toks[j][0] > indent:
                    parts.append(toks[j][1])
                    j += 1
                val, i = " ".join(parts), j
            else:
                val, i = None, i + 1
        else:
            val, i = _scalar(rest), i + 1
            # plain multi-line scalar continuation
            while i < len(toks) and toks[i][0] > indent:
                val = (val or "") + " " + toks[i][1]
                i += 1
        out[key] = val
    return out, i


def _parse_list(toks, i, indent):
    out = []
    while i < len(toks) and toks[i][0] == indent and (toks[i][1] == "-" or toks[i][1].startswith("- ")):
        rest = toks[i][1][1:].lstrip(" ")
        if rest == "":
            if i + 1 < len(toks) and toks[i + 1][0] > indent:
                val, i = _parse_node(toks, i + 1, toks[i + 1][0])
            else:
                val, i = None, i + 1
        elif _split_kv(rest) is not None and not rest.startswith(("'", '"')):
            child = indent + (len(toks[i][1]) - len(rest))
            toks[i] = [child, rest]
            val, i = _parse_map(toks, i, child)
        else:
            val, i = _scalar(rest), i + 1
        out.append(val)
    return out, i


def load_people(dirpath):
    """Parse every YAML file in an Open States people directory."""
    people = []
    for p in sorted(Path(dirpath).glob("*.yml")):
        d = parse_yaml(p.read_text(encoding="utf-8"))
        d["_file"] = p.name
        people.append(d)
    return people


def ensure_people_repo(people_dir):
    if (Path(people_dir) / "data" / "ma" / "legislature").is_dir():
        return
    print("Cloning Open States people repo (sparse) into %s ..." % people_dir)
    subprocess.run(["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse",
                    "https://github.com/openstates/people.git", str(people_dir)], check=True)
    subprocess.run(["git", "-C", str(people_dir), "sparse-checkout", "set", "data/ma"], check=True)


# ----------------------------------------------------------------------------
# Census (TIGERweb): the same layers data/census.js queries
# ----------------------------------------------------------------------------

_layer_ids = None


def layer_id(key):
    global _layer_ids
    if _layer_ids is None:
        svc = fetch_json(TIGER + "?f=json")
        _layer_ids = {}
        for k, (fallback, pat) in LAYER_PATTERNS.items():
            hit = [l for l in svc.get("layers", []) if re.search(pat, l["name"]) and not l["name"].endswith("Labels")]
            _layer_ids[k] = hit[0]["id"] if hit else fallback
    return _layer_ids[key]


def census_query(key, where=None, point=None, fields="*"):
    params = {"f": "json", "outSR": "4326", "outFields": fields, "returnGeometry": "false",
              "resultRecordCount": "2000"}
    if where:
        params["where"] = where
        params["orderByFields"] = "GEOID"
    if point:
        params.update({"geometry": "%s,%s" % point, "geometryType": "esriGeometryPoint",
                       "inSR": "4326", "spatialRel": "esriSpatialRelIntersects"})
    url = "%s/%d/query?%s" % (TIGER, layer_id(key), urllib.parse.urlencode(params))
    d = fetch_json(url)
    if d.get("error"):
        raise RuntimeError("Census error: %s" % d["error"])
    if d.get("exceededTransferLimit"):
        raise RuntimeError("Census list truncated for " + key)
    return [f["attributes"] for f in d.get("features", [])]


def census_lists():
    """Everything the app could show for Massachusetts, from live TIGERweb."""
    where = "STATE='25'"
    return {
        "counties": census_query("counties", where),
        "congress": census_query("congress", where),
        "senate": census_query("senate", where),
        "house": [a for a in census_query("house", where) if not a["GEOID"].endswith("ZZZ")],
        "places": census_query("places", where),
        "subs": [a for a in census_query("subdivisions", where) if a.get("FUNCSTAT") != "S"],
    }


def split_municipal_name(a):
    """Same as splitMunicipalName in data/census.js."""
    full, base = str(a.get("NAME") or ""), str(a.get("BASENAME") or a.get("NAME") or "")
    rest = full[len(base):].strip() if full.startswith(base) else ""
    return base, (rest[:1].upper() + rest[1:]) if rest else ""


def ordinal(n):
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return "%d%s" % (n, suffix)


def congress_labels(district):
    """districtLabel() in data/census.js for Massachusetts."""
    n = int(district)
    return {"short": "MA-%d" % n, "name": "U.S. House: MA-%d (%s District)" % (n, ordinal(n))}


def stack_city_entry(point, census):
    """Re-implementation of the city part of doIdentify() for a strong-MCD state."""
    places = census_query("places", point=point)
    subs = [a for a in census_query("subdivisions", point=point) if a.get("FUNCSTAT") != "S"]
    found = []
    if places:
        n, t = split_municipal_name(places[0])
        found.append({"a": places[0], "name": n, "type": t})
    if subs:
        n, t = split_municipal_name(subs[0])
        same = [c for c in found if c["name"].lower() == n.lower()]
        if same:
            same[0]["a"] = subs[0]
        else:
            found.append({"a": subs[0], "name": n, "type": t})
    return [{"id": "city:" + c["a"]["GEOID"], "name": c["name"], "type": c["type"], "geoid": c["a"]["GEOID"]}
            for c in found]


def city_entry_for(census, base_name):
    """The stack entry the app produces for a Massachusetts city named base_name,
    derived from the Census lists (same merge rule as doIdentify)."""
    subs = [a for a in census["subs"] if a["BASENAME"].lower() == base_name.lower()]
    if len(subs) != 1:
        return None
    s = subs[0]
    return {"geoid": s["GEOID"], "name": s["BASENAME"], "type": split_municipal_name(s)[1]}


# ----------------------------------------------------------------------------
# District-name normalisation (legislature <-> Census)
# ----------------------------------------------------------------------------

_ORD_WORDS = {
    "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th", "fifth": "5th",
    "sixth": "6th", "seventh": "7th", "eighth": "8th", "ninth": "9th", "tenth": "10th",
    "eleventh": "11th", "twelfth": "12th", "thirteenth": "13th", "fourteenth": "14th",
    "fifteenth": "15th", "sixteenth": "16th", "seventeenth": "17th", "eighteenth": "18th",
    "nineteenth": "19th", "twentieth": "20th",
}


def normalize_district(name):
    """Ordered token tuple: lowercase, 'District' dropped, ordinal words to digits,
    'and', commas and hyphens treated as separators."""
    s = name.lower().replace("district", " ")
    s = re.sub(r"[,\-/&]", " ", s)
    toks = [t for t in s.split() if t != "and"]
    return tuple(_ORD_WORDS.get(t, t) for t in toks)


def build_district_index(census_rows):
    """Map normalized name -> Census row, plus a looser order-insensitive map used
    only when the ordered lookup fails and the set is unambiguous."""
    ordered, loose = {}, {}
    for a in census_rows:
        k = normalize_district(a["BASENAME"])
        if k in ordered:
            raise RuntimeError("ambiguous Census district name: %s" % a["BASENAME"])
        ordered[k] = a
    by_set = {}
    for k, a in ordered.items():
        by_set.setdefault(frozenset(k), []).append(a)
    for s, rows in by_set.items():
        if len(rows) == 1:
            loose[s] = rows[0]
    return ordered, loose


def match_district(name, index):
    ordered, loose = index
    k = normalize_district(name)
    if k in ordered:
        return ordered[k], "exact"
    row = loose.get(frozenset(k))
    if row is not None and len(k) == len(normalize_district(row["BASENAME"])):
        return row, "reordered"
    return None, None


# ----------------------------------------------------------------------------
# Legislature
# ----------------------------------------------------------------------------

PARTY_MAP = {"democrat": "Democratic", "democratic": "Democratic", "republican": "Republican",
             "unenrolled": "Unenrolled", "independent": "Independent"}
LEG_TERM_END = "2027-01-06"      # 194th General Court ends the day before the 195th convenes (first Wed of Jan 2027)
LEG_TERM_START = "2025-01-01"    # 194th General Court convened Wednesday Jan 1 2025


def clean_party(p):
    if not p:
        return None
    return PARTY_MAP.get(p.strip().lower(), p.strip())


def name_key(name):
    """Accent-insensitive last name, for matching the same person across sources
    ("Bill Driscoll" / "William J. Driscoll, Jr." / "Homar Gomez" / "Homar G\u00f3mez")."""
    n = unicodedata.normalize("NFKD", name or "")
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"\b(Jr|Sr|II|III|IV)\b\.?", "", n, flags=re.I)
    n = re.sub(r"[^A-Za-z' ]", " ", n)
    parts = n.split()
    return parts[-1].lower().replace("'", "") if parts else ""


def fetch_malegislature_members():
    lst = fetch_json("https://malegislature.gov/api/GeneralCourts/%d/LegislativeMembers" % GENERAL_COURT,
                     headers={"Accept": "application/json"})
    def one(m):
        code = m["MemberCode"]
        url = "https://malegislature.gov/api/GeneralCourts/%d/LegislativeMembers/%s" % (
            GENERAL_COURT, urllib.parse.quote(code))
        # Detail responses are large (bill lists): keep only the light fields on disk.
        light = CACHE_DIR / ("member-%d-%s.json" % (GENERAL_COURT, hashlib.sha1(code.encode()).hexdigest()[:10]))
        if not REFRESH and light.exists():
            return json.loads(light.read_text())
        d = fetch_json(url, headers={"Accept": "application/json"}, cache=False)
        keep = {k: d.get(k) for k in ("Name", "GeneralCourtNumber", "LeadershipPosition", "Branch", "MemberCode",
                                       "District", "Party", "EmailAddress", "RoomNumber", "PhoneNumber")}
        light.write_text(json.dumps(keep))
        return keep
    with ThreadPoolExecutor(6) as ex:
        return list(ex.map(one, lst))


def current_os_role(person, role_types=("upper", "lower")):
    """Open role (no end_date, or an end_date after AS_OF) of a legislator."""
    best = None
    for r in person.get("roles") or []:
        if r.get("type") not in role_types or "state:ma/" not in (r.get("jurisdiction") or "") + "/":
            continue
        end = r.get("end_date")
        if end and end <= AS_OF:
            continue
        if best is None or (r.get("start_date") or "") > (best.get("start_date") or ""):
            best = r
    return best


def build_legislators(census, people_dir, problems, notes):
    """Return holder dicts for state senate and house, and info for notes."""
    mem = [m for m in fetch_malegislature_members() if m.get("Branch") in ("House", "Senate")]
    os_people = load_people(Path(people_dir) / "data" / "ma" / "legislature")
    os_retired = load_people(Path(people_dir) / "data" / "ma" / "retired")

    # Open States: current members by (type, district)
    os_cur = {}
    for p in os_people:
        r = current_os_role(p)
        if r:
            os_cur.setdefault((r["type"], r["district"]), []).append((p, r))
    # Departures since the 194th convened (Open States 'retired' + legislature with ended roles)
    departed = []
    for p in os_people + os_retired:
        for r in p.get("roles") or []:
            if r.get("type") in ("upper", "lower") and r.get("end_date") and r["end_date"] >= LEG_TERM_START \
                    and r["end_date"] <= AS_OF and "state:ma/" in (r.get("jurisdiction") or "") + "/":
                if r["end_date"] not in ("2025-01-01",) and not (current_os_role(p) and
                                                                current_os_role(p)["district"] == r["district"]):
                    departed.append((p["name"], r["type"], r["district"], r["end_date"]))

    idx = {"upper": build_district_index(census["senate"]), "lower": build_district_index(census["house"])}
    holders, unmatched, used = [], [], {}
    by_branch = {"upper": [], "lower": []}

    for (typ, dist), lst in sorted(os_cur.items()):
        if len(lst) > 1:
            problems.append("Open States has %d open roles for %s %s: %s" % (
                len(lst), typ, dist, ", ".join(p["name"] for p, _ in lst)))
            continue
        person, role = lst[0]
        row, how = match_district(dist, idx[typ])
        if row is None:
            unmatched.append((typ, dist, person["name"]))
            continue
        if row["GEOID"] in used:
            problems.append("Census district %s claimed twice (%s, %s)" % (row["NAME"], used[row["GEOID"]], person["name"]))
            continue
        used[row["GEOID"]] = person["name"]
        by_branch[typ].append((person, role, row, how))

    # Pair each with the malegislature record (official) by Census district.
    mem_idx = {"upper": {}, "lower": {}}
    for m in mem:
        typ = "upper" if m["Branch"] == "Senate" else "lower"
        row, how = match_district(m["District"], idx[typ])
        if row is None:
            unmatched.append((typ, "malegislature:" + m["District"], m["Name"]))
            continue
        mem_idx[typ].setdefault(row["GEOID"], []).append(m)

    disagreements = []
    for typ, layer, office in (("upper", "senate", "State Senator"), ("lower", "house", "State Representative")):
        for person, role, row, how in by_branch[typ]:
            cands = mem_idx[typ].get(row["GEOID"], [])
            mm = [m for m in cands if name_key(m["Name"]) == name_key(person["name"])]
            if len(mm) != 1:
                disagreements.append("%s: Open States current member %s vs malegislature.gov candidates %s" % (
                    row["NAME"], person["name"], [m["Name"] for m in cands]))
                continue
            m = mm[0]
            if len(cands) > 1:
                others = [c["Name"] for c in cands if c is not m]
                notes_replaced = "replaced %s" % ", ".join(others)
                disagreements.append("INFO %s: malegislature.gov lists %s and %s; %s is current (Open States open role, started %s)" % (
                    row["NAME"], m["Name"], ", ".join(others), m["Name"], role.get("start_date")))
            else:
                notes_replaced = None
            osp = clean_party((person.get("party") or [{}])[0].get("name"))
            mp = clean_party(m.get("Party"))
            if osp and mp and osp != mp:
                disagreements.append("%s: party differs (Open States %s, malegislature.gov %s); using malegislature.gov" % (
                    m["Name"], osp, mp))
            code = m["MemberCode"]
            start = role.get("start_date") or LEG_TERM_START
            term_start = start if start >= LEG_TERM_START else LEG_TERM_START
            lead = m.get("LeadershipPosition")
            note = None
            if lead and lead in ("Speaker of the House", "President of the Senate", "Speaker Pro Tempore",
                                 "President Pro Tempore", "Majority Leader", "Minority Leader", "Senate Majority Whip"):
                note = lead
            elif lead:
                note = lead
            # Photo candidates (verified to load later, in parallel): Open States' image,
            # then the profile-photo URL pattern malegislature.gov uses.
            cands_img = []
            img = person.get("image")
            if img and img.startswith("https://malegislature.gov/"):
                cands_img.append(img)
            cands_img.append("https://malegislature.gov/Legislators/Profile/170/%s.jpg" % urllib.parse.quote(code))
            holders.append({
                "id": ("ma-senate:" if layer == "senate" else "ma-house:") + _slug(row["BASENAME"]),
                "layer": layer,
                "match": {"state": "MA", "name": row["NAME"], "geoid": row["GEOID"]},
                "office": office,
                "name": _pretty_name(m["Name"]),
                "party": mp or osp,
                "termStart": term_start,
                "termEnd": LEG_TERM_END,
                "nextElection": ELECTION_DAY,
                "onBallot2026": True,
                "photo": None,
                "_photo_candidates": cands_img,
                "url": "https://malegislature.gov/Legislators/Profile/%s" % urllib.parse.quote(code),
                "email": (m.get("EmailAddress") or "").strip().lower() or None,
                "sources": [
                    "https://malegislature.gov/api/GeneralCourts/%d/LegislativeMembers/%s" % (GENERAL_COURT, urllib.parse.quote(code)),
                    "https://github.com/openstates/people/blob/main/data/ma/legislature/%s" % person["_file"],
                ],
                "note": note,
                "_district": row["GEOID"],
            })

    # Census districts without a holder = vacancies
    vacant = []
    for typ, layer, rows in (("upper", "senate", census["senate"]), ("lower", "house", census["house"])):
        have = {h["match"]["geoid"] for h in holders if h["layer"] == layer}
        for r in rows:
            if r["GEOID"] not in have:
                vacant.append((layer, r["NAME"], r["GEOID"]))
    return holders, unmatched, vacant, disagreements, sorted(set(departed)), len(mem), os_cur


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _pretty_name(s):
    return re.sub(r"\s+", " ", s).strip()


# ----------------------------------------------------------------------------
# Statewide, U.S. House
# ----------------------------------------------------------------------------

STATEWIDE_SPEC = [
    # (file prefix, office, id, role type in Open States, official url)
    ("Kimberly-Driscoll", "Lieutenant Governor", "ma-statewide:lieutenant-governor", "lt_governor",
     "https://www.mass.gov/person/kim-driscoll-lieutenant-governor"),
    ("Andrea-Campbell", "Attorney General", "ma-statewide:attorney-general", "attorney general",
     "https://www.mass.gov/orgs/office-of-the-attorney-general"),
    ("William-Galvin", "Secretary of the Commonwealth", "ma-statewide:secretary-of-the-commonwealth",
     "chief election officer", "https://www.sec.state.ma.us"),
    ("Deborah-B-Goldberg", "Treasurer and Receiver-General", "ma-statewide:treasurer",
     "treasurer", "https://www.mass.gov/orgs/office-of-state-treasurer-and-receiver-general-deborah-b-goldberg"),
    ("Diana-DiZoglio", "State Auditor", "ma-statewide:state-auditor", None,
     "https://www.mass.gov/orgs/office-of-the-state-auditor"),
]


def build_statewide(people_dir, problems):
    out = []
    exec_dir = Path(people_dir) / "data" / "ma" / "executive"
    files = {p.name: p for p in exec_dir.glob("*.yml")}
    for prefix, office, hid, rtype, url in STATEWIDE_SPEC:
        f = [n for n in files if n.startswith(prefix + "-")]
        if len(f) != 1:
            problems.append("statewide: expected one Open States file for %s, found %s" % (prefix, f))
            continue
        d = parse_yaml(files[f[0]].read_text(encoding="utf-8"))
        roles = d.get("roles") or []
        cands = [r for r in roles if (r.get("jurisdiction") or "").endswith("state:ma/government")
                 and (r.get("type") == rtype if rtype else r.get("type") not in ("lower", "upper"))
                 and (not r.get("end_date") or r["end_date"] > AS_OF)]
        if len(cands) != 1:
            problems.append("statewide: %s has %d open Open States roles" % (office, len(cands)))
            continue
        r = cands[0]
        email = d.get("email")
        out.append({
            "id": hid, "layer": "state", "match": {"state": "MA"}, "office": office,
            "name": d["name"],
            "party": clean_party((d.get("party") or [{}])[0].get("name")),
            "termStart": r.get("start_date"), "termEnd": r.get("end_date"),
            "nextElection": ELECTION_DAY, "onBallot2026": True,
            "photo": None,
            "_photo_candidates": [d["image"]] if d.get("image") else [],  # verified to load in verify_photos
            "url": url,
            "email": email if email and not email.startswith("http") else None,
            "sources": [url,
                        "https://github.com/openstates/people/blob/main/data/ma/executive/" + files[f[0]].name,
                        "https://www.wcvb.com/article/massachusetts-general-election-2026-guide/73886807"],
            "note": None,
        })
    return out


def build_us_house(census, problems):
    data = fetch_json("https://unitedstates.github.io/congress-legislators/legislators-current.json")
    out, seen = [], set()
    labels = {a["BASENAME"]: a for a in census["congress"]}
    for p in data:
        t = p["terms"][-1]
        if t["state"] != "MA" or t["type"] != "rep":
            continue
        dist = str(int(t["district"]))
        row = labels.get(dist)
        if row is None:
            problems.append("U.S. House MA-%s has no Census congressional district" % dist)
            continue
        seen.add(dist)
        lab = congress_labels(dist)
        bio = p["id"]["bioguide"]
        name = p["name"].get("official_full") or "%s %s" % (p["name"]["first"], p["name"]["last"])
        out.append({
            "id": "ma-congress:%s" % dist, "layer": "congress",
            "match": {"state": "MA", "name": lab["name"], "geoid": row["GEOID"]},
            "office": "U.S. Representative", "name": name,
            "party": clean_party(t["party"]),
            "termStart": t["start"], "termEnd": t["end"],
            "nextElection": ELECTION_DAY, "onBallot2026": True,
            "photo": None,
            "_photo_candidates": ["https://bioguide.congress.gov/bioguide/photo/%s/%s.jpg" % (bio[0], bio)],
            "url": t.get("url"), "email": None,
            "sources": ["https://unitedstates.github.io/congress-legislators/legislators-current.json",
                        "https://bioguide.congress.gov/search/bio/%s" % bio],
            "note": None,
        })
    for r in census["congress"]:
        if r["BASENAME"] not in seen:
            problems.append("Census congressional district %s has no U.S. Representative" % r["NAME"])
    out.sort(key=lambda h: int(h["id"].split(":")[1]))
    return out


# ----------------------------------------------------------------------------
# Counties: Sheriffs and District Attorneys (curated, cross-checked with PD43+)
# ----------------------------------------------------------------------------

PD43 = "https://electionstats.state.ma.us/elections/view/%s/"
PD43_CSV = "https://electionstats.state.ma.us/elections/download/%s/precincts_include:0/"
MSA_LOCATIONS = "https://www.mass.gov/orgs/massachusetts-sheriffs-association/locations"
MSA_PAGE = "https://www.masssheriffs.org/%s-county-sheriffs-office"
MSA_REPORT_2026 = "https://malegislature.gov/Reports/54903/Cover%20Letter.pdf"
DA_CONTACTS = "https://www.mass.gov/doc/contact-information-for-massachusetts-district-attorneys-offices/download"
DA_DIRECTORY = "https://www.mass.gov/lists/directory-of-district-attorney-offices"

# county fips -> (county name, PD43+ election id of the 2022 sheriff race)
SHERIFFS = [
    # fips, county, name, party, termStart, pd43 id, url, extra sources, note, onBallot2026, nextElection
    ("25001", "Barnstable", "Donna D. Buckley", "Democratic", "2023-01-04", "154425",
     MSA_PAGE % "barnstable", ["https://www.mass.gov/news/meet-the-sheriffs"], None),
    ("25003", "Berkshire", "Thomas N. Bowler", "Democratic", None, "154366",
     MSA_PAGE % "berkshire", [MSA_LOCATIONS], None),
    ("25005", "Bristol", "Paul R. Heroux", "Democratic", None, "154360",
     MSA_PAGE % "bristol", ["https://www.mass.gov/news/meet-the-sheriffs"], None),
    ("25007", "Dukes", "Robert W. Ogden", "Democratic", None, "154392",
     MSA_PAGE % "dukes", [MSA_LOCATIONS], None),
    ("25009", "Essex", "Kevin F. Coppinger", "Democratic", None, "154379",
     MSA_PAGE % "essex", [MSA_LOCATIONS], None),
    ("25011", "Franklin", "Lori M. Streeter", "Democratic", None, "154405",
     "https://www.fcso-ma.us/learn-about-the-sheriff",
     ["https://www.recorder.com/Interim-sheriff-announces-election-bid-60215759",
      "https://whmp.com/news/160061-three-candidates-are-competing-to-become-franklin-countys-next-sheriff-in-the-november-third-election/"],
     "Appointed interim sheriff by Gov. Healey in January 2025 after Christopher Donelan retired. "
     "Seat is on the Nov. 3, 2026 ballot to fill the final two years of the term (ends January 2029)."),
    ("25013", "Hampden", "Nicholas Cocchi", "Democratic", None, "154371",
     MSA_PAGE % "hampden", [MSA_REPORT_2026], None),
    ("25015", "Hampshire", "Patrick J. Cahillane", "Democratic", None, "154384",
     "https://www.hampshiresheriffs.com/contact/about-sheriff-cahillane", [MSA_REPORT_2026], None),
    ("25017", "Middlesex", "Peter J. Koutoujian", "Democratic", None, "154351",
     MSA_PAGE % "middlesex", [MSA_REPORT_2026], None),
    ("25019", "Nantucket", "James A. Perelman", "Democratic", "2023-01-03", "154559",
     MSA_PAGE % "nantucket",
     ["https://www.ack.net/crime-courts-fire/perelman-sworn-in-to-third-term-as-sheriff/article_ddb3f8df-69c5-548e-8622-49e96626e81b.html"],
     "Nantucket County has its own elected sheriff (one of 14). Won in 2022 as the Democratic nominee."),
    ("25021", "Norfolk", "Patrick W. McDermott", "Democratic", None, "154420",
     MSA_PAGE % "norfolk", [MSA_REPORT_2026], None),
    ("25023", "Plymouth", "Joseph D. McDonald Jr.", "Republican", None, "154343",
     MSA_PAGE % "plymouth", [MSA_REPORT_2026], None),
    ("25025", "Suffolk", "Steven W. Tompkins", "Democratic", None, "154468",
     MSA_PAGE % "suffolk",
     ["https://www.bostonglobe.com/2026/10/02/newsletters/steve-tompkins-suffolk-sheriff-leadership-team-the-scrum/",
      "https://www.wbur.org/news/2026/09/09/sheriff-steve-tompkins-maura-healey-return-to-work"],
     "On leave from August 2025 (Special Sheriff Mark Lawhorne ran the office) while under federal indictment; "
     "acquitted in September 2026 and back on the job."),
    ("25027", "Worcester", "Lewis G. Evangelidis", "Republican", None, "154399",
     "https://worcestercountysheriff.com/", [MSA_LOCATIONS], None),
]

# DA district -> (district name, PD43+ id, counties covered, DA name, party, url, extra sources, note)
DAS = [
    ("Berkshire District", "154362", [("25003", "Berkshire")], "Timothy J. Shugrue", "Democratic",
     "https://berkshiredistrictattorney.com/", [DA_CONTACTS], None),
    ("Bristol District", "154354", [("25005", "Bristol")], "Thomas M. Quinn III", "Democratic",
     DA_DIRECTORY, [DA_CONTACTS, "https://www.bostonglobe.com/2026/02/02/metro/massachusetts-da-races/"],
     "Not seeking reelection in 2026."),
    ("Cape and Islands District", "154388",
     [("25001", "Barnstable"), ("25007", "Dukes"), ("25019", "Nantucket")], "Robert J. Galibois", "Democratic",
     DA_DIRECTORY, [DA_CONTACTS], None),
    ("Eastern District", "154374", [("25009", "Essex")], "Paul F. Tucker", "Democratic",
     "https://www.essexcountyda.com/", [DA_CONTACTS], None),
    ("Hampden District", "154367", [("25013", "Hampden")], "Anthony D. Gulluni", "Democratic",
     "https://www.hampdenda.com/", [DA_CONTACTS], None),
    ("Middle District", "154397", [("25027", "Worcester")], "Joseph D. Early Jr.", "Democratic",
     "https://worcesterda.com/", ["https://worcesterda.com/da-early-hosts-discussion-on-understanding-addiction-and-supporting-recovery/"],
     None),
    ("Norfolk District", "154417", [("25021", "Norfolk")], "Michael W. Morrissey", "Democratic",
     DA_DIRECTORY, [DA_CONTACTS, "https://www.bostonglobe.com/2026/02/02/metro/massachusetts-da-races/"],
     "Not seeking reelection in 2026."),
    ("Northern District", "154346", [("25017", "Middlesex")], "Marian T. Ryan", "Democratic",
     "https://www.middlesexda.com/", [DA_CONTACTS], None),
    ("Northwestern District", "154380", [("25011", "Franklin"), ("25015", "Hampshire")], "David E. Sullivan",
     "Democratic", "https://www.northwesternda.org/", [DA_CONTACTS], None),
    ("Plymouth District", "154337", [("25023", "Plymouth")], "Timothy J. Cruz", "Republican",
     "https://plymouthda.com/", [DA_CONTACTS, "https://www.datimcruz.com/"], None),
    ("Suffolk District", "154445", [("25025", "Suffolk")], "Kevin R. Hayden", "Democratic",
     "https://www.suffolkdistrictattorney.com/", [DA_CONTACTS, "https://www.wcvb.com/article/ma-primary-results-da-sept-2026/73521958"],
     None),
]

SHERIFF_NEXT = "2028-11-07"   # six-year terms from the 2022 election; Nov 7, 2028 is the 2028 state election day


def pd43_winner(election_id):
    """(winner name, ballot party) of a PD43+ election: first candidate column."""
    rows = list(csv.reader(io.StringIO(fetch(PD43_CSV % election_id))))
    hdr, parties = rows[0], rows[1]
    for h, p in zip(hdr[3:], parties[3:]):
        if h not in ("All Others", "Blanks", "Total Votes Cast"):
            return h, p
    return None, None


def build_counties(census, problems, notes_out):
    county_rows = {a["GEOID"]: a for a in census["counties"]}
    out = []
    # --- Sheriffs
    seen = set()
    for fips, county, name, party, tstart, pd_id, url, extra, note in SHERIFFS:
        row = county_rows.get(fips)
        if row is None or row["BASENAME"] != county:
            problems.append("sheriff: county %s %s not in the Census county list" % (fips, county))
            continue
        seen.add(fips)
        w_name, w_party = pd43_winner(pd_id)
        replaced = None
        if name_key(w_name) != name_key(name):
            if county == "Franklin":
                replaced = w_name
            else:
                problems.append("sheriff %s: PD43+ 2022 winner is %s but table has %s (check for turnover)" % (
                    county, w_name, name))
        elif clean_party(w_party) != party:
            problems.append("sheriff %s: PD43+ party %s differs from table %s" % (county, w_party, party))
        is_franklin = county == "Franklin"
        if replaced:
            notes_out.append("Franklin County sheriff: the 2022 winner on PD43+ is %s; he retired and Gov. Healey "
                             "appointed %s in January 2025. The appointee is listed as the current holder." % (replaced, name))
        out.append({
            "id": "ma-sheriff:%s" % _slug(county),
            "layer": "county", "match": {"geoid": fips},
            "office": "Sheriff", "name": name, "party": party,
            "termStart": tstart, "termEnd": None,
            "nextElection": ELECTION_DAY if is_franklin else SHERIFF_NEXT,
            "onBallot2026": True if is_franklin else False,
            "photo": None, "url": url, "email": None,
            "sources": ([PD43 % pd_id] + extra)[:3],
            "note": note or ("Six-year term elected in 2022; ends January 2029."),
        })
    for fips, row in county_rows.items():
        if fips not in seen:
            problems.append("county %s %s has no sheriff entry" % (fips, row["NAME"]))
    # --- District Attorneys: one entry per county covered
    covered = set()
    for district, pd_id, counties, name, party, url, extra, note in DAS:
        w_name, w_party = pd43_winner(pd_id)
        if name_key(w_name) != name_key(name):
            problems.append("DA %s: PD43+ 2022 winner is %s but table has %s (check for turnover)" % (district, w_name, name))
        elif clean_party(w_party) != party:
            problems.append("DA %s: PD43+ party %s differs from table %s" % (district, w_party, party))
        names = [c for _, c in counties]
        where = names[0] + " County" if len(names) == 1 else " and ".join([", ".join(names[:-1]), names[-1]]) + " counties"
        for fips, county in counties:
            row = county_rows.get(fips)
            if row is None or row["BASENAME"] != county:
                problems.append("DA %s: county %s %s not in the Census county list" % (district, fips, county))
                continue
            covered.add(fips)
            base_note = "%s (%s)." % (district, where)
            out.append({
                "id": "ma-da:%s:%s" % (_slug(district.replace(" District", "")), _slug(county)),
                "layer": "county", "match": {"geoid": fips},
                "office": "District Attorney", "name": name, "party": party,
                "termStart": None, "termEnd": None,
                "nextElection": ELECTION_DAY, "onBallot2026": True,
                "photo": None, "url": url,
                "email": None,
                "sources": ([PD43 % pd_id] + extra)[:3],
                "note": (base_note + " " + note) if note else base_note,
            })
    for fips, row in county_rows.items():
        if fips not in covered:
            problems.append("county %s %s is covered by no District Attorney entry" % (fips, row["NAME"]))
    return out


# ----------------------------------------------------------------------------
# Mayors (curated; each verified on/before 2026-10-24, see header docstring)
# ----------------------------------------------------------------------------

def _wp(city_title):
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(city_title.replace(" ", "_"), safe="_,()")


# city BASENAME (Census), mayor name, termStart (only when a source states the date), official page,
# extra sources (a Wikipedia city article is added automatically), note, termEnd (only if sourced)
MAYORS = [
    ("Agawam Town", "Christopher Johnson", None, "https://www.agawam.ma.us/",
     ["https://www.masslive.com/opinion/2026/02/christopher-johnson-the-next-big-thing-in-agawam-is-tech-savvy-streamlined-government-viewpoint.html",
      "https://www.westernmassnews.com/2024/01/03/christopher-johnson-sworn-agawams-mayor/"], None, None),
    ("Amesbury", "Kassandra Gove", None, "https://www.amesburyma.gov/", [], None, None),
    ("Attleboro", "Cathleen DeSimone", None, "https://www.cityofattleboro.us/",
     ["https://www.wpri.com/news/local-news/se-mass/cathleen-desimone-wins-attleboro-mayor-race/",
      "https://www.boston.com/news/local-news/2026/03/21/the-battle-over-the-aging-attleboro-zoo-is-getting-wild/"], None, None),
    ("Beverly", "Michael P. Cahill", None, "https://www.beverlyma.gov/", [], None, None),
    ("Boston", "Michelle Wu", None, "https://www.boston.gov/departments/mayors-office",
     ["https://github.com/openstates/people/blob/main/data/ma/municipalities/Michelle-Wu-0913703a-217f-432b-955d-f6033e1fc663.yml"],
     "Reelected unopposed in November 2025.", "2030-01-07"),
    ("Braintree Town", "Erin V. Joyce", None, "https://www.braintreema.gov/mayor", [], None, None),
    ("Brockton", "Moises M. Rodrigues", "2026-01-05", "https://brockton.ma.us/government/mayors-office/",
     ["https://www.wgbh.org/news/politics/2026-01-05/we-are-a-mosaic-rodrigues-sworn-in-as-brocktons-first-elected-mayor-of-color"],
     "First popularly elected mayor of color in Brockton.", None),
    ("Cambridge", "Sumbul Siddiqui", "2026-01-05", "https://www.cambridgema.gov/departments/mayorsoffice",
     ["https://www.thecrimson.com/article/2026/1/5/sumbul-siddiqui-elected-mayor-again/",
      "https://www.bostonglobe.com/2026/01/05/metro/sumbul-siddiqui-cambridge-mayor/"],
     "Chosen mayor by the City Council for 2026-2027; the city manager runs city government.", None),
    ("Chicopee", "John L. Vieau", "2026-01-05", "https://chicopeema.gov/393/Mayors-Office",
     ["https://spectrumnews1.com/ma/worcester/news/2026/01/05/chicopee-holds-2026-inauguration"], None, None),
    ("Easthampton", "Salem Derby", None, "https://www.easthamptonma.gov/",
     ["https://www.wwlp.com/news/easthampton-mayor-shares-his-goals-for-the-future/",
      "https://www.wwlp.com/news/local-news/hampshire-county/easthampton-mayor-announces-prop-2%C2%BD-override-for-fiscal-crisis/"],
     "Interim mayor from July 2025 after Nicole LaChapelle resigned; elected November 4, 2025.", None),
    ("Everett", "Robert Van Campen", "2026-01-05", "https://cityofeverett.com/",
     ["https://www.cbsnews.com/boston/news/encore-boston-harbor-hotel-expansion-everett/",
      "https://www.wgbh.org/news/politics/2026-01-12/everetts-new-mayor-says-schools-are-his-first-priority"],
     "Defeated Carlo DeMaria, mayor since 2008, in November 2025.", None),
    ("Fall River", "Paul E. Coogan", None, "https://fallriverma.gov/government/mayors_office/index.php",
     ["https://www.heraldnews.com/story/news/politics/elections/2025/12/22/everything-you-need-to-know-about-fall-rivers-2026-inauguration/87816951007/"],
     None, None),
    ("Fitchburg", "Samantha Squailia", None, "https://fitchburgma.gov/412/Mayors-Office", [], None, None),
    ("Framingham", "Charlie Sisitsky", "2026-01-01", "https://www.framinghamma.gov/",
     ["https://www.bostonglobe.com/2026/01/01/metro/newton-mayor-marc-laredo-sworn-in/",
      "https://www.metrowestdailynews.com/story/news/local/2026/01/22/mayor-charlie-sisitsky-state-of-the-city-address-will-broadcast-january-26-on-access-framingham/88284076007/"],
     "Second four-year term.", None),
    ("Gardner", "Michael J. Nicholson", None, "https://www.gardner-ma.gov/",
     ["https://www.thegardnernews.com/story/news/politics/elections/state/2026/10/12/2026-election-guide-gardner-ma-candidates-ballot-questions-templeton-westminster/92154343007/",
      "https://www.yahoo.com/news/articles/mayor-nicholson-outlines-vision-gardners-101305475.html"],
     "Also a candidate for State Representative (2nd Worcester) on the Nov. 3, 2026 ballot; remains mayor.", None),
    ("Gloucester", "Paul Lundberg", "2026-01-01", "https://www.gloucester-ma.gov/",
     ["https://www.bostonglobe.com/2026/01/01/metro/newton-mayor-marc-laredo-sworn-in/",
      "https://www.bostonglobe.com/2026/01/29/metro/ethics-commission-fines-former-gloucester-harbormaster/"],
     "Defeated Greg Verga in November 2025.", None),
    ("Greenfield", "Ginny Desorgher", None, "https://greenfield-ma.gov/",
     ["https://github.com/openstates/people/blob/main/data/ma/municipalities/Virginia-DeSorgher-512c10a1-c321-4e4c-9a2a-1e5eab3550bd.yml"],
     None, "2028-01-01"),
    ("Haverhill", "Melinda E. Barrett", None, "https://www.haverhillma.gov/government/mayor-and-council/",
     ["https://www.haverhillma.gov/news/posts/mayor-melinda-e-barrett-and-police-chief-wayne-tracy-announce-the-appointment-of-meaghan-pare-as-deputy-chief/"],
     None, None),
    ("Holyoke", "Joshua A. Garcia", None, "https://www.holyoke.org/", [], None, None),
    ("Lawrence", "Brian DePeña", None, "https://www.cityoflawrence.com/",
     ["https://www.wbur.org/news/2026/10/22/lawrence-recall-election-mayor-brian-depena",
      "https://www.cbsnews.com/boston/news/massachusetts-mayoral-race-results/"],
     "Reelected November 2025. Faces state and federal criminal charges; City Council voted no confidence in "
     "October 2026 and a recall effort is underway. Still in office as of 2026-10-24.", None),
    ("Leominster", "Dean J. Mazzarella", None, "https://www.leominster-ma.gov/", [], None, None),
    ("Lowell", "Erik Gitschier", "2026-01-05", "https://www.lowellma.gov/",
     ["https://www.lowellsun.com/2026/01/05/councilor-erik-gitschier-selected-as-mayor-of-lowell-after-second-ballot/"],
     "Chosen mayor by the City Council; the city manager runs city government.", None),
    ("Lynn", "Jared C. Nicholson", None, "https://www.lynnma.gov/",
     ["https://github.com/openstates/people/blob/main/data/ma/municipalities/Jared-Nicholson-5b21dd89-cebf-446b-9a0c-17fb6f2ba3b4.yml"],
     None, "2030-01-05"),
    ("Malden", "Gary Christenson", None, "https://www.cityofmalden.org/263/Mayor",
     ["https://github.com/openstates/people/blob/main/data/ma/municipalities/Gary-Christenson-0ab2a1c5-70d5-4033-9f76-f7d9e2479900.yml"],
     None, "2028-01-03"),
    ("Marlborough", "J. Christian Dumais", "2026-01-05", "https://www.marlborough-ma.gov/163/About",
     ["https://www.communityadvocate.com/marlborough/inauguration-day-city-leaders-look-forward-to-helping-marlborough-in-the-future/article_879b1caa-cce3-44cd-9c47-d04cb6644099.html"],
     "Second term.", None),
    ("Medford", "Breanna Lungo-Koehn", "2026-01-04", "https://www.medfordma.org/mayors-office",
     ["https://www.tuftsdaily.com/article/2026/01/medford-mayor-city-council-school-committee-sworn-in-for-two-year-term"],
     None, None),
    ("Melrose", "Jennifer Grigoraitis", None, "https://www.cityofmelrose.org/mayor", [], None, None),
    ("Methuen", "David P. Beauregard Jr.", None, "https://www.cityofmethuen.net/mayor",
     ["https://www.cbsnews.com/boston/news/massachusetts-mayoral-race-results/"],
     "Goes by D.J. Beauregard; reelected November 2025.", None),
    ("New Bedford", "Jon Mitchell", None, "https://www.newbedford-ma.gov/mayor/",
     ["https://www.newbedford-ma.gov/blog/news/mayor-mitchell-delivers-2026-state-of-the-city-address/"], None, None),
    ("Newburyport", "Sean R. Reardon", "2026-01-05", "https://www.cityofnewburyport.com/",
     ["https://www.cityofnewburyport.com/home/news/the-city-of-newburyports-2026-inauguration-is-today",
      "https://www.cnhinews.com/massachusetts/article_54d4bdf6-a35f-54d7-93a1-47d44fd972c8.html"], None, None),
    ("Newton", "Marc Laredo", "2026-01-01", "https://www.newtonma.gov/",
     ["https://www.bostonglobe.com/2026/01/01/metro/newton-mayor-marc-laredo-sworn-in/",
      "https://github.com/openstates/people/blob/main/data/ma/municipalities/Marc-Laredo-f536d703-2220-491b-a38c-93df88a70156.yml"],
     "First term (sworn in January 1, 2026).", "2030-01-01"),
    ("North Adams", "Jennifer A. Macksey", None, "https://www.northadams-ma.gov/government/mayor_s_office/index.php",
     ["https://www.northadams-ma.gov/2026.04.28%20City%20Council%20Minutes.pdf?t=202605120708070"], None, None),
    ("Northampton", "Gina-Louise Sciarra", "2026-01-05", "https://www.northamptonma.gov/",
     ["https://www.wwlp.com/news/local-news/hampshire-county/northampton-mayor-gina-louise-sciarra-sworn-in-for-second-term/",
      "https://www.wgbh.org/news/politics/2026-01-08/across-western-massachusetts-elected-officials-sworn-into-office"],
     "Second term.", None),
    ("Peabody", "Edward A. Bettencourt Jr.", "2026-01-05", "https://www.peabody-ma.gov/",
     ["https://peabody-ma.gov/mayors/Inaugural%2026F.pdf",
      "https://patch.com/massachusetts/peabody/our-moment-mayor-ted-bettencourt-touts-generational-projects-inauguration"], None, None),
    ("Pittsfield", "Peter Marchetti", "2024-01-02", "https://www.pittsfieldma.gov/545/Mayors-Office",
     ["https://www.pittsfieldma.gov/592/Local-State-and-Federal-Elected-Official",
      "https://www.wamc.org/news/2024-01-15/mayor-marchetti-cool-to-pittsfield-city-council-call-for-level-budget"],
     "Four-year term.", None),
    ("Quincy", "Thomas P. Koch", None, "https://www.quincyma.gov/", [], None, None),
    ("Revere", "Patrick M. Keefe Jr.", None, "https://www.revere.org/mayors-office", [], None, None),
    ("Salem", "Dominick Pangallo", None, "https://www.salem.com/mayor", [], None, None),
    ("Somerville", "Jake Wilson", None, "https://www.somervillema.gov/departments/mayors-office",
     ["https://www.cbsnews.com/boston/news/massachusetts-mayoral-race-results/"],
     "Took office January 2026 after defeating Willie Burnley Jr.; incumbent Katjana Ballantyne lost the September 2025 preliminary.", None),
    ("Springfield", "Domenic J. Sarno", None, "https://www.springfield-ma.gov/cos/mayor", [], None, None),
    ("Taunton", "Shaunna O'Connell", None, "https://www.taunton-ma.gov/",
     ["https://www.bostonglobe.com/2025/11/05/metro/mayoral-elections-taunton-lawrence-somerville-everett-gloucester-brockton-fall-river/"],
     "Reelected November 2025.", None),
    ("Waltham", "Jeannette A. McCarthy", None, "https://www.city.waltham.ma.us/",
     ["https://emilysaperia.substack.com/p/house-minority-whip-katherine-clark",
      "https://hoodline.com/2026/10/waltham-planning-department-says-moody-street-pedestrian-plan-is-dead-mayor-disagrees/"],
     None, None),
    ("West Springfield Town", "William C. Reichelt", None, "https://www.townofwestspringfield.org/Government/Mayor-Reichelts-Office",
     ["https://www.wwlp.com/news/local-news/hampden-county/mayor-william-reichelt-west-springfield-officials-sworn-in-at-ceremony/"],
     None, None),
    ("Westfield", "Michael A. McCabe", None, "https://www.cityofwestfield.org/mayor", [],
     "First took office January 3, 2022 (per the city website).", None),
    ("Weymouth Town", "Mike Molisse", None, "https://www.weymouth.ma.us/",
     ["https://www.patriotledger.com/story/news/politics/elections/local/2025/11/04/weymouth-ma-election-results-mayor-town-council-school-committee-ballot-nov-4th/87071608007/",
      "https://uwua.net/2026/01/from-meter-reader-to-mayor-mike-molisses-union-road-to-public-service/"],
     "Acting mayor from July 15, 2025 after Robert Hedlund resigned; elected November 4, 2025.", None),
    ("Woburn", "Michael Concannon", "2026-01-05", "https://woburnma.gov/government/mayor/",
     ["https://woburnma.gov/government/mayor/media/"], None, None),
    ("Worcester", "Joseph M. Petty", None, "https://www.worcesterma.gov/mayor", [],
     "Worcester also has a city manager.", None),
]

# Wikipedia article title per Census BASENAME (infobox cross-check and a second source)
WP_TITLE = {"Boston": "Boston"}


def wp_title(base):
    b = re.sub(r" Town$", "", base)
    return WP_TITLE.get(base) or ("%s, Massachusetts" % b)


def wp_infobox_mayor(title):
    """leader_name next to a 'Mayor' leader_title in the city's Wikipedia infobox, or None."""
    url = ("https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main"
           "&format=json&redirects=1&titles=" + urllib.parse.quote(title))
    j = None
    for attempt in range(4):
        if not is_cached(url):
            time.sleep(2.0 + 4 * attempt)  # be polite to the MediaWiki API (it answers 429 to bursts)
        try:
            j = fetch_json(url)
            break
        except Exception:
            continue
    if j is None:
        return "unavailable"
    page = list(j["query"]["pages"].values())[0]
    if "revisions" not in page:
        return None
    text = page["revisions"][0]["slots"]["main"]["*"]
    fields = dict(re.findall(r"^\s*\|\s*(leader_(?:title|name)\d*)\s*=\s*(.*)$", text, flags=re.M))
    for k, v in fields.items():
        m = re.match(r"leader_title(\d*)$", k)
        if m and re.search(r"mayor", v, flags=re.I) and not re.search(r"<!--", v):
            nm = fields.get("leader_name" + m.group(1), "")
            nm = re.sub(r"<ref.*", "", nm)
            nm = re.sub(r"\{\{.*?\}\}", "", nm)
            nm = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", nm)
            nm = re.sub(r"\(.*?\)", "", nm).strip()
            return nm or None
    return None


def build_mayors(census, problems, notes_out):
    out = []
    ids = set()
    open_states = {}
    for p in load_people(Path(ARGS_PEOPLE) / "data" / "ma" / "municipalities"):
        for r in p.get("roles") or []:
            if r.get("type") == "mayor":
                open_states.setdefault(re.search(r"place:([a-z_]+)", r["jurisdiction"]).group(1), []).append((p, r))
    mismatches = []
    for base, name, tstart, url, extra, note, tend in MAYORS:
        entry = city_entry_for(census, base)
        if entry is None:
            problems.append("mayor %s: no unique Census county subdivision named %s" % (name, base))
            continue
        label = re.sub(r" Town$", "", base)
        hid = "ma-mayor:%s" % _slug(label)
        if hid in ids:
            problems.append("duplicate id " + hid)
        ids.add(hid)
        title = wp_title(base)
        w = wp_infobox_mayor(title)
        if w == "unavailable":
            INFO_LINES.append("%s: Wikipedia API unavailable (rate limited); infobox not compared" % label)
        elif w is None:
            INFO_LINES.append("%s: Wikipedia infobox has no mayor name (table: %s)" % (label, name))
        elif name_key(w) != name_key(name) and name_key(w) not in name_key(name):
            mismatches.append("%s: Wikipedia infobox says %s, table says %s" % (label, w, name))
        else:
            INFO_LINES.append("%s: Wikipedia infobox agrees (%s)" % (label, w))
        os_key = _slug(label).replace("-", "_")
        os_hits = open_states.get(os_key, [])
        party, email = None, None
        for p, r in os_hits:
            if name_key(p["name"]) == name_key(name):
                party = clean_party((p.get("party") or [{}])[0].get("name"))
                email = p.get("email")
                if r.get("end_date") and r["end_date"] <= AS_OF:
                    mismatches.append("%s: Open States role for %s ended %s (stale; table is newer)" % (
                        label, p["name"], r["end_date"]))
            elif r.get("end_date") and r["end_date"] > AS_OF:
                mismatches.append("%s: Open States lists %s through %s, table has %s" % (label, p["name"], r["end_date"], name))
        sources = list(dict.fromkeys([url] + extra + [_wp(title)]))[:3]
        out.append({
            "id": hid, "layer": "city",
            "match": {"geoid": entry["geoid"], "name": entry["name"]},
            "office": "Mayor", "name": name, "party": party,
            "termStart": tstart, "termEnd": tend,
            "nextElection": None, "onBallot2026": False,
            "photo": None, "url": url, "email": email if email and "@" in email and "town." not in email else None,
            "sources": sources, "note": note,
        })
    notes_out.extend("Source disagreement: " + m for m in mismatches)
    return out


# ----------------------------------------------------------------------------
# Orchestration
# ----------------------------------------------------------------------------

ARGS_PEOPLE = "/tmp/oh-people"
INFO_LINES = []   # console-only cross-check results (not written to the data file)

LAYER_ORDER = {"state": 0, "congress": 1, "senate": 2, "house": 3, "county": 4, "city": 5}

# Facts verified against malegislature.gov / news for seats that changed hands since January 2025.
KNOWN_CHANGES = [
    ("house", "3rd Bristol District", "Lisa Field",
     "3rd Bristol: Carol Doherty died Feb. 15, 2025; Lisa Field (D) won the June 10, 2025 special election and took office July 16, 2025."),
    ("house", "6th Essex District", "Hannah Bowen",
     "6th Essex: Jerry Parisella resigned January 2025 to become a District Court judge; Hannah Bowen (D) won the special election and took office May 21, 2025."),
    ("house", "5th Essex District", "Andrew Tarr",
     "5th Essex: Ann-Margaret Ferrante died; Andrew 'Dru' Tarr (D) won the March 31, 2026 special election and took office April 15, 2026."),
    ("senate", "First Middlesex District", "Vanna Howard",
     "First Middlesex (Senate): Edward Kennedy died October 2025; Vanna Howard (D) won the March 2026 special election and took office March 18, 2026."),
]
KNOWN_VACANCIES = {
    "1st Franklin District": "1st Franklin (House): vacant. Natalie Blais resigned January 2026 (to join UMass Amherst); no special election will be held.",
    "16th Middlesex District": "16th Middlesex (House): vacant. Rodney Elliott resigned effective August 1, 2026 (House Journal, July 9, 2026); the seat is on the Nov. 3, 2026 ballot as an open seat.",
    "17th Middlesex District": "17th Middlesex (House): vacant. Vanna Howard resigned March 17, 2026 after winning the First Middlesex Senate special election; no special election will be held.",
}


def verify_photos(holders):
    cand = sorted({u for h in holders for u in h.get("_photo_candidates", [])})
    with ThreadPoolExecutor(8) as ex:
        ok = dict(zip(cand, ex.map(lambda u: head_ok(u, "image/"), cand)))
    for h in holders:
        for u in h.pop("_photo_candidates", []):
            if ok.get(u):
                h["photo"] = u
                break


def check_stack_samples(census, problems, mayors):
    """Live point lookups through the same TIGERweb queries the app makes."""
    samples = [("Boston", (-71.0589, 42.3601)), ("Medford", (-71.1062, 42.4184)), ("Springfield", (-72.5898, 42.1015))]
    lines = []
    by_name = {m["match"]["name"]: m for m in mayors}
    for label, pt in samples:
        found = stack_city_entry(pt, census)
        got = found[0] if found else None
        m = by_name.get(label)
        ok = bool(got and m and got["geoid"] == m["match"]["geoid"] and got["name"] == m["match"]["name"])
        lines.append("  stack(%s): city:%s name=%r type=%r (%d city entries) -> %s" % (
            label, got["geoid"] if got else None, got["name"] if got else None, got["type"] if got else None,
            len(found), "matches holder" if ok else "MISMATCH"))
        if not ok:
            problems.append("stack lookup for %s does not match the mayor's match object" % label)
        for kind, key, rows in (("senate", "senate", census["senate"]), ("house", "house", census["house"])):
            a = census_query(key, point=pt)
            lines.append("    %s: geoid=%s name=%r" % (kind, a[0]["GEOID"], a[0]["NAME"]))
    return lines


def js_text(meta, holders):
    head = "// GENERATED by scripts/export_ma_officeholders.py. DO NOT EDIT BY HAND.\n"
    head += "// Who currently holds Massachusetts offices below the national level (as of %s).\n" % meta["asOf"]
    head += "// Layers: state, congress, senate, house, county, city. See the script docstring.\n\n"
    body = "export const OFFICEHOLDERS_META = %s;\n\n" % json.dumps(meta, indent=2, ensure_ascii=False)
    items = ",\n".join("  " + json.dumps(h, ensure_ascii=False) for h in holders)
    body += "export const OFFICEHOLDERS = [\n%s\n];\n" % items
    return head + body


def main():
    global REFRESH, ARGS_PEOPLE
    ap = argparse.ArgumentParser(description="Export current Massachusetts officeholders below the national level.")
    ap.add_argument("--refresh", action="store_true", help="bypass the /tmp cache")
    ap.add_argument("--people-dir", default="/tmp/oh-people", help="Open States people checkout")
    ap.add_argument("--out", default=str(OUT_PATH))
    args = ap.parse_args()
    REFRESH = args.refresh
    ARGS_PEOPLE = args.people_dir
    ensure_people_repo(args.people_dir)

    problems, notes = [], []
    census = census_lists()
    print("Census (TIGERweb): %s" % ", ".join("%s=%d" % (k, len(v)) for k, v in census.items()))

    statewide = build_statewide(args.people_dir, problems)
    legislators, unmatched, vacant, disagreements, departed, n_api, _ = build_legislators(
        census, args.people_dir, problems, notes)
    us_house = build_us_house(census, problems)
    counties = build_counties(census, problems, notes)
    mayors = build_mayors(census, problems, notes)

    senate = [h for h in legislators if h["layer"] == "senate"]
    house = [h for h in legislators if h["layer"] == "house"]
    for h in legislators:
        h.pop("_district", None)

    # Census districts with no holder = vacancies (must be explained)
    vac_names = {v[1] for v in vacant}
    for layer, nm, gid in vacant:
        if nm not in KNOWN_VACANCIES:
            problems.append("Census %s district %s (%s) has no holder and is not a known vacancy" % (layer, nm, gid))
    for nm in KNOWN_VACANCIES:
        if nm not in vac_names:
            problems.append("known vacancy %s now has a holder; update KNOWN_VACANCIES" % nm)
    for layer, nm, expect, text in KNOWN_CHANGES:
        got = [h for h in legislators if h["layer"] == layer and h["match"]["name"] == nm]
        if not got or name_key(got[0]["name"]) != name_key(expect):
            problems.append("known change for %s is stale: expected %s, found %s" % (nm, expect, got[0]["name"] if got else None))
    notes.extend(text for _, _, _, text in KNOWN_CHANGES)
    notes.extend(KNOWN_VACANCIES[nm] for nm in sorted(KNOWN_VACANCIES) if nm in vac_names)

    holders = statewide + us_house + senate + house + counties + mayors
    verify_photos(holders)
    holders.sort(key=lambda h: LAYER_ORDER[h["layer"]])
    city_geoids = [h["match"]["geoid"] for h in mayors]
    if len(city_geoids) != len(set(city_geoids)):
        problems.append("two mayors share a city geoid")
    ids = [h["id"] for h in holders]
    if len(ids) != len(set(ids)):
        dup = sorted({i for i in ids if ids.count(i) > 1})
        problems.append("duplicate ids: %s" % dup)

    # match-object checks against the Census lists
    geoids = {"county": {a["GEOID"] for a in census["counties"]},
              "congress": {a["GEOID"] for a in census["congress"]},
              "senate": {a["GEOID"] for a in census["senate"]},
              "house": {a["GEOID"] for a in census["house"]},
              "city": {a["GEOID"] for a in census["subs"]}}
    for h in holders:
        if h["layer"] in geoids and h["match"]["geoid"] not in geoids[h["layer"]]:
            problems.append("%s: geoid %s not in Census %s list" % (h["id"], h["match"]["geoid"], h["layer"]))
    stack_lines = check_stack_samples(census, problems, mayors)

    cities_no_mayor = sorted(
        split_municipal_name(a)[0] for a in census["places"]
        if not any(m["match"]["name"] == split_municipal_name(a)[0] for m in mayors))
    notes = [
        "Not included here (another export owns them): President, Vice President, U.S. Senators and all governors, including Maura Healey.",
        "Towns are not included: select boards, town administrators, city councils, school committees. "
        "Mayors are listed only for the 47 Massachusetts cities that have one.",
        "As of 2026-10-24 the House has 157 of 160 members: three seats are vacant and omitted (see the vacancy notes below). The Senate is full at 40.",
        "Legislators: district, party, email and leadership position come from the malegislature.gov API (194th General Court); "
        "'note' is the leadership title that API publishes. 'termStart' is 2025-01-01 (194th General Court convened) unless the member "
        "took office later by special election (date from Open States). 'termEnd' 2027-01-06 is the day before the 195th convenes.",
        "All 160 House and 40 Senate seats, the 5 statewide offices (Lt. Governor, Attorney General, Secretary of the Commonwealth, "
        "Treasurer, Auditor), the 9 U.S. House seats and all 11 District Attorney seats are on the Nov. 3, 2026 ballot "
        "(WCVB 2026 general election guide; DAs are elected in 2022 and 2026). Sheriffs elected in 2022 serve to January 2029, "
        "so only the Franklin County sheriff seat (vacancy election) is on the 2026 ballot.",
        "Sheriffs: all 14 counties, including Dukes and Nantucket, have an elected sheriff; this includes counties whose county "
        "government was abolished (their sheriffs are still elected). District Attorneys: 11 districts expand to 14 county entries "
        "(Cape and Islands covers Barnstable, Dukes, Nantucket; Northwestern covers Franklin, Hampshire).",
        "County party comes from the ballot designation on the 2022 general election results (PD43+, Secretary of the Commonwealth).",
        "Mayors: nonpartisan elections, so party is null unless Open States records one (Boston, Lynn). 'termStart' is set only when "
        "a source states the swearing-in date; 'termEnd' only where Open States gives one (Boston, Lynn, Malden, Newton, Greenfield). "
        "Cambridge and Lowell mayors are chosen by the city council (sources linked); Cambridge, Lowell and Worcester also have a city manager.",
        "Mayors: no city was omitted for lack of verification; all 47 have an official city source or at least two independent news/reference sources (linked per holder). "
        "Census 'city' places with no mayor (council-manager or town-council government), so no entry: %s." % ", ".join(cities_no_mayor),
        "Open States data/ma/municipalities is stale for several mayors and was not used where it conflicts: Northampton "
        "(role end 2025-11-02), North Adams (2025-11-30), Easthampton (Nicole LaChapelle, ended 2025-11-04; she resigned July 2025).",
        "Statewide: Open States gives term dates only for the Lt. Governor (2023-01-05 to 2027-01-07) and Attorney General "
        "(2023-01-04 to 2027-01-06) and end dates for the others; missing values stay null (Galvin, Goldberg, DiZoglio start dates). "
        "The Lt. Governor's photo is null: its mass.gov image URL answers 403 to scripts and could not be verified.",
        "Photos (legislators from malegislature.gov, U.S. House from bioguide.congress.gov, statewide from Open States) are kept only when a "
        "GET with a browser User-Agent returned an image. bioguide.congress.gov and mass.gov return 403 to plain curl, so check them in a browser if a photo looks missing.",
    ] + notes
    # keep order but drop exact duplicates
    notes = list(dict.fromkeys(notes))

    n_photos = sum(1 for h in legislators if h["photo"])
    n_photos_other = {k: sum(1 for h in holders if h["layer"] == k and h["photo"]) for k in ("state", "congress")}
    counts = {
        "statewide": len(statewide), "stateSenate": len(senate), "stateHouse": len(house), "usHouse": len(us_house),
        "sheriffs": sum(1 for h in counties if h["office"] == "Sheriff"),
        "districtAttorneys": sum(1 for h in counties if h["office"] == "District Attorney"),
        "mayors": len(mayors),
    }
    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "asOf": AS_OF,
        "sources": [
            "https://malegislature.gov/api/GeneralCourts/%d/LegislativeMembers" % GENERAL_COURT,
            "https://github.com/openstates/people (data/ma; CC0)",
            "https://unitedstates.github.io/congress-legislators/legislators-current.json",
            "https://electionstats.state.ma.us (PD43+, Secretary of the Commonwealth)",
            "https://www.mass.gov/orgs/massachusetts-sheriffs-association/locations",
            DA_CONTACTS,
            "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer",
            "City websites and 2025-2026 news coverage (linked per holder)",
        ],
        "counts": counts,
        "notes": notes,
    }

    # ---- Verification summary
    print("\n=== VERIFICATION SUMMARY ===")
    print("Counts: %s" % json.dumps(counts))
    print("malegislature.gov 194th General Court members listed: %d (includes members who left)" % n_api)
    print("Legislators matched to Census districts: senate %d/40, house %d/160 (%d vacant)" % (
        len(senate), len(house), 160 - len(house)))
    print("Unmatched legislators: %s" % (unmatched or "none"))
    print("Census districts without a holder: %s" % ([v[1] for v in vacant] or "none"))
    print("Departures since Jan 2025 (Open States): %s" % "; ".join("%s %s %s %s" % d for d in departed))
    print("Legislator photos verified loading: %d/%d; statewide %d/5; U.S. House %d/9" % (
        n_photos, len(legislators), n_photos_other["state"], n_photos_other["congress"]))
    for d in disagreements:
        print("  note:", d)
    print("Stack samples:")
    for l in stack_lines:
        print(l)
    print("Notes written: %d" % len(notes))
    agree = [l for l in INFO_LINES if "agrees" in l]
    print("Mayor cross-check vs Wikipedia infobox: %d agree" % len(agree))
    for l in INFO_LINES:
        if "agrees" not in l:
            print("  info:", l)
    for n in notes:
        if n.startswith("Source disagreement"):
            print("  " + n)
    if unmatched or problems:
        print("\nFAILED:")
        for u in unmatched:
            print("  unmatched legislator:", u)
        for p in problems:
            print("  problem:", p)
        return 1

    Path(args.out).write_text(js_text(meta, holders), encoding="utf-8")
    print("\nWrote %s (%d holders, %d bytes)" % (args.out, len(holders), Path(args.out).stat().st_size))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
export_ma_ballot.py: who is on the Tue Nov 3, 2026 Massachusetts general-election
ballot for the offices BELOW the U.S. Senate / Governor / U.S. House level.

Writes data/ma-ballot.generated.js (pure ES module):

    export const MA_BALLOT_META  = { generatedAt, asOf, electionDate, sources, counts, notes, omitted };
    export const MA_BALLOT_RACES = [ { id, verified, office, kind, scope, districtName?, electionDate,
                                       term, candidates: [ { name, party, incumbent } ], uncontested,
                                       sources, verifiedOn, note } ];

CORRECTNESS BEATS COVERAGE. A race is written only when it is VERIFIED (rules below).
Every other race is listed in MA_BALLOT_META.omitted and in the printed report with the
reason. Nothing is guessed or filled in. Governor, U.S. Senate and U.S. House are covered by
data/nominees.generated.js and are not repeated. Municipal offices are not on the ballot in
most places.

OFFICES IN SCOPE
  Statewide: Lieutenant Governor, Attorney General, Secretary of the Commonwealth, Treasurer
  and Receiver-General, State Auditor. Governor's Council (8). State Senate (40) and State
  House (160). County: District Attorney (11 districts; one race per COUNTY covered, 14),
  Register of Probate (14), County Treasurer (Bristol, Norfolk, Plymouth), County Commissioner
  (Barnstable, Bristol, Dukes, Norfolk, Plymouth) and Sheriff (Franklin County only, a vacancy).

HOW THE APP MATCHES A RACE TO A PLACE (see data/census.js identifyStack)
  kind "state"  : scope {"state":"MA"}                        statewide offices
                  scope {"townGeoids":[...], "splitTownGeoids":[...], "senateGeoids":[...]}
                                                               Governor's Council
  kind "senate" : scope {"geoid":"25D25"}   Census SLDU        districtName "Third Suffolk District"
  kind "house"  : scope {"geoid":"25125"}   Census SLDL        districtName "3rd Suffolk District"
  kind "county" : scope {"countyGeoid":"25025"}                DA, Register of Probate, ...
  The district-name normalizer and the Census loaders are IMPORTED from
  scripts/export_ma_officeholders.py (the same live TIGERweb layers as data/census.js). Every
  emitted geoid is checked against those live lists.
  GOVERNOR'S COUNCIL: G.L. c.57 s.2 (Acts of 2021 ch.92) defines each of the 8 districts as a
  union of 5 whole SENATORIAL districts, and G.L. c.57 s.3 lists the cities and towns of each
  senatorial district. Both are parsed from malegislature.gov; each Census county subdivision is
  assigned to its council district (a town split only between senate districts of the same
  council district is still fully inside it); towns split between council districts go in
  splitTownGeoids; the result is checked against live TIGERweb senate-district lookups at the
  internal point of all 351 municipalities. senateGeoids (extra key) names the 5 senate districts,
  so a point's 'senate' stack entry identifies its council district exactly.

SOURCES (curl, cached in /tmp/mapachusetts-ma-ballot-cache/)
  PD43+        electionstats.state.ma.us  Sept 1, 2026 primary results (official): the certified
               Democratic and Republican nominee of every race, and primary candidates who did not win.
  Sample ballots  Official municipal "State Election" PDFs (SAMPLE_BALLOTS below: Lynnfield, Athol).
               They print every candidate for that town's races with the party label as it appears on
               the ballot and "Candidate for Re-election" for incumbents.
  Ballotpedia  House and Senate general-election tables (a full roster for all 200 seats).
  BallotReady  Statewide, Governor's Council, all 40 Senate and 36 House races (a full roster).
  Boston Globe voter guide, Boston Public Library voting guide, Wikipedia (statewide pages, the
               Governor's Council table), WBUR guide (compared only, to report its errors), and a few
               local news pages (FIELDS, SUPPORT) that are checked automatically on every run.
  G.L. c.57 s.2-3 (malegislature.gov) and Census TIGERweb for geography.
  NOT USED BY DEFAULT: sec.state.ma.us. It answers scripted requests with a bot challenge
  (Incapsula), so the script never requests it and never works around it. A human can save the
  Secretary's "2026 State Election Candidates" page from a browser and pass it with
  --sec-html PATH; it is then used as one more complete roster and as the source of ballot
  party labels. mass.gov, masslive.com and Gannett papers are likewise skipped (403/challenge).

VERIFICATION RULES (a race is written only if ALL hold)
  1. Rosters: every complete roster found for the race (Ballotpedia, BallotReady, sample ballots,
     the Secretary's list if supplied, or a news page that states the whole field) must name
     exactly the same people. A person missing from one roster, or an extra name, is a
     DISCREPANCY and the race is omitted.
  2. PD43+: every Democratic/Republican primary winner must be on every roster; every
     Democratic/Republican candidate on a roster must be a PD43+ winner. A primary candidate with
     no certified winner (removed or disqualified) is not a nominee and must not be on any roster.
  3. Every candidate needs at least TWO distinct sources among PD43+, the rosters above, and
     pages that mention the candidate next to the office (Globe, BPL, Wikipedia, news). A
     Wikipedia page and a news guide count separately; two Wikipedia pages do not.
  4. Party labels come from the printed ballot (sample ballot / Secretary's list) first, then PD43+
     (Democratic/Republican), then BallotReady's code (I -> Independent, U -> Unenrolled). For a
     non-party candidate with none of these, party is null: Ballotpedia prints "Unenrolled" for
     everyone, which is NOT the ballot designation ("Independent", "Gulf War Veteran" ...).
  5. incumbent:true only for a match with data/officeholders.ma.generated.js (read-only), a sample
     ballot's "Candidate for Re-election", or (Governor's Council) the Wikipedia council table plus
     the 2024 PD43+ general winner. For offices outside the officeholders file, false means "not
     verified as incumbent".
  When a roster comes from only one source (for example Ballotpedia for a House race that has
  no BallotReady or sample-ballot roster) the race note says so.
  Candidates are sorted alphabetically by last name (printed ballot order is not published in
  advance). Write-ins are allowed in every race and never listed.

USAGE
  python3 scripts/export_ma_ballot.py                 # cached
  python3 scripts/export_ma_ballot.py --refresh       # re-download everything
  python3 scripts/export_ma_ballot.py --sec-html /path/to/saved-candidates-page.html [--out PATH]
  Python 3.9 standard library only, no API keys. Prints a coverage summary by office and a
  per-race discrepancy report; exits non-zero only on hard errors (Census failure, the statute
  parse not covering all 351 municipalities).
"""

import argparse
import difflib
import hashlib
import html as htmllib
import importlib.util
import json
import re
import subprocess
import sys
import time
import unicodedata
from collections import OrderedDict, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

AS_OF = "2026-10-24"
ELECTION_DAY = "2026-11-03"
ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "ma-ballot.generated.js"
CACHE_DIR = Path("/tmp/mapachusetts-ma-ballot-cache")
UA_BROWSER = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/120.0 Safari/537.36")
UA_WIKI = "mapachusetts-ma-ballot-export/1.0 (civic data project; read-only API use)"

PD_BASE = "https://electionstats.state.ma.us"
PD_SEARCH_2026 = PD_BASE + "/elections/search/year_from:2026/year_to:2026"
SEC_URL = "https://www.sec.state.ma.us/divisions/elections/research-and-statistics/2026-state-election-candidates.htm"
BP_HOUSE = "https://ballotpedia.org/Massachusetts_House_of_Representatives_elections,_2026"
BP_SENATE = "https://ballotpedia.org/Massachusetts_State_Senate_elections,_2026"
BR_URL = "https://www.ballotready.org/elections/massachusetts-general-election-b8c57b5c-8573-4272-87a5-0cea85d213b2"
GLOBE_URL = "https://apps.bostonglobe.com/elections/massachusetts/voter-guide/"
BPL_URL = "https://guides.bpl.org/voting/Candidates"
WBUR_URL = "https://www.wbur.org/news/2026/10/14/massachusetts-how-to-vote-deadlines-mail-in-early"
STATUTE_COUNCIL = "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVIII/Chapter57/Section2"
STATUTE_SENATE = "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVIII/Chapter57/Section3"
WIKI_COUNCIL_PAGE = "Massachusetts Governor's Council"
WIKI_STATEWIDE = {
    "attorney-general": "2026 Massachusetts Attorney General election",
    "secretary-of-the-commonwealth": "2026 Massachusetts Secretary of the Commonwealth election",
    "treasurer": "2026 Massachusetts Treasurer and Receiver-General election",
    "state-auditor": "2026 Massachusetts State Auditor election",
    "lieutenant-governor": "2026 Massachusetts gubernatorial election",
}

REFRESH = False
FETCH_LOG = OrderedDict()   # url -> "ok" | reason it was skipped
OH = None                    # scripts/export_ma_officeholders.py, imported at runtime

CHALLENGE_MARKERS = ("Access Restricted", "Just a moment", "Enable JavaScript and cookies",
                     "Please enable JS", "Access to this page has been denied", "_Incapsula_Resource",
                     "Request unsuccessful. Incapsula", "Attention Required", "This site requires JavaScript",
                     "Not allowed | Mass Gov")


# ----------------------------------------------------------------------------
# Fetching (curl, disk cache). A challenge / 403 page is treated as "unavailable".
# ----------------------------------------------------------------------------

def fetch(url, ua=UA_BROWSER, timeout=60):
    """GET a URL with curl. Returns the body, or None if it could not be fetched or the
    host answered with an error or a bot challenge (never retried with other tricks)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / ("page-" + hashlib.sha1(url.encode("utf-8")).hexdigest() + ".json")
    rec = None
    if path.exists() and not REFRESH:
        rec = json.loads(path.read_text(encoding="utf-8"))
    else:
        for attempt in range(3):
            res = subprocess.run(
                ["curl", "-s", "-L", "-m", str(timeout), "-A", ua, "-w", "\n%{http_code}", url],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out = res.stdout.decode("utf-8", "replace")
            body, _, code = out.rpartition("\n")
            status = int(code) if code.strip().isdigit() else 0
            if status in (0, 429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
        rec = {"url": url, "status": status, "body": body}
        path.write_text(json.dumps(rec), encoding="utf-8")
    body, status = rec["body"], rec["status"]
    challenged = len(body) < 20000 and any(m in body for m in CHALLENGE_MARKERS)
    if status >= 400 or status == 0 or challenged or not body.strip():
        FETCH_LOG[url] = "skipped (HTTP %s%s)" % (status, ", bot challenge" if challenged else "")
        return None
    FETCH_LOG.setdefault(url, "ok")
    return body


def block_text(raw):
    """HTML -> text with a newline at block boundaries (scripts and styles dropped)."""
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"</?(br|p|li|ul|ol|h\d|div|tr|section|article|table|td|th)[^>]*>", "\n", s, flags=re.I)
    s = htmllib.unescape(re.sub(r"<[^>]+>", " ", s))
    s = re.sub(r"[ \t\xa0]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def deep_text(raw):
    """HTML -> flat lowercase-friendly text. Unlike block_text it also reads article text
    embedded as escaped HTML inside JSON (NewsBreak, Next.js pages). Curly quotes are
    straightened so "O’Brien" matches "O'Brien"."""
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), raw)
    s = s.replace('\\"', '"').replace("\\/", "/")
    s = re.sub(r"<style[^>]*>.*?</style>", " ", s, flags=re.S | re.I)
    s = htmllib.unescape(re.sub(r"<[^>]+>", " ", s))
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", s)


def page_supports(url, last, first_alts, ctx_tokens, window=700, ua=UA_BROWSER):
    """True if the page at url mentions `last` with one of first_alts and every ctx token
    within `window` characters. This is how every outside (non-Secretary) page is checked."""
    raw = fetch(url, ua=ua)
    if raw is None:
        return False
    low = deep_text(raw).lower().replace("'", "")
    last = last.lower().replace("\u2019", "'").replace("'", "")
    for m in re.finditer(re.escape(last), low):
        seg = low[max(0, m.start() - window): m.end() + window]
        if any(f in seg for f in first_alts) and all(t.lower() in seg for t in ctx_tokens):
            return True
    return False


# ----------------------------------------------------------------------------
# Names and ordinals
# ----------------------------------------------------------------------------

_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
_UNIT_ORD = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7,
             "eighth": 8, "ninth": 9, "tenth": 10, "eleventh": 11, "twelfth": 12, "thirteenth": 13,
             "fourteenth": 14, "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18,
             "nineteenth": 19}
_TENS_ORD = {"twentieth": 20, "thirtieth": 30, "fortieth": 40}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40}


def strip_accents(s):
    n = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in n if not unicodedata.combining(c))


def ordinal_str(n):
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return "%d%s" % (n, suffix)


def words_to_ordinals(s):
    """'Twenty-First Middlesex District' -> '21st Middlesex District' (also First..Nineteenth)."""
    def tens_unit(m):
        return ordinal_str(_TENS[m.group(1).lower()] + _UNIT_ORD[m.group(2).lower()])
    s = re.sub(r"\b(twenty|thirty|forty)[- ](%s)\b" % "|".join(
        k for k, v in _UNIT_ORD.items() if v < 10), tens_unit, s, flags=re.I)
    s = re.sub(r"\b(%s)\b" % "|".join(_TENS_ORD), lambda m: ordinal_str(_TENS_ORD[m.group(1).lower()]), s, flags=re.I)
    s = re.sub(r"\b(%s)\b" % "|".join(_UNIT_ORD), lambda m: ordinal_str(_UNIT_ORD[m.group(1).lower()]), s, flags=re.I)
    return s


def name_parts(name):
    """(first, last) lowercase letters only; quoted nicknames, suffixes and middle names dropped."""
    n = strip_accents(name or "")
    n = re.sub(r'"[^"]*"|\([^)]*\)|\u201c[^\u201d]*\u201d', " ", n)
    toks = [re.sub(r"[^a-z]", "", t.lower()) for t in re.split(r"[\s,]+", n)]
    toks = [t for t in toks if t and t not in _SUFFIXES]
    if not toks:
        return "", ""
    return toks[0], toks[-1]


_NICK_SETS = [{"bill", "billy", "will", "william"}, {"bob", "bobby", "rob", "robert"}, {"ted", "edward", "theodore"},
              {"becca", "rebecca"}, {"jack", "john"}, {"chuck", "charles"}, {"dick", "richard"},
              {"peggy", "margaret"}, {"liz", "elizabeth", "betty"}, {"kim", "kimberly", "kimberley"},
              {"deb", "deborah"}, {"tony", "anthony"}, {"dru", "andrew"}, {"dan", "daniel"}, {"tom", "thomas"},
              {"mike", "michael"}, {"joe", "joseph"}, {"gil", "gilbert"}, {"jim", "james"}, {"jenifer", "jennifer"}]


def _same_first(fa, fb):
    if fa[:1] == fb[:1]:
        return True
    return any(fa in s and fb in s for s in _NICK_SETS)


def _same_last(la, lb):
    if la == lb:
        return True
    # hyphenated or compound surnames ("Fluker-Reid" / "Reid") and one-letter spelling slips
    if min(len(la), len(lb)) >= 4 and (la.endswith(lb) or lb.endswith(la)):
        return True
    return len(la) >= 8 and len(lb) >= 8 and difflib.SequenceMatcher(None, la, lb).ratio() >= 0.88


def names_match(a, b):
    """Same person, tolerant of nicknames, middle names, hyphenation and suffixes."""
    fa, la = name_parts(a)
    fb, lb = name_parts(b)
    return bool(la) and bool(lb) and _same_last(la, lb) and _same_first(fa, fb)


def sort_key(name):
    f, l = name_parts(name)
    return (l, f, name)


def clean_name(name):
    return re.sub(r"\s+", " ", (name or "").replace("\u00a0", " ")).strip()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


PARTY_CANON = {"democratic": "Democratic", "demo": "Democratic", "democrat": "Democratic",
               "republican": "Republican", "unenrolled": "Unenrolled", "independent": "Independent",
               "libertarian": "Libertarian"}


def canon_party(label):
    if label is None:
        return None
    l = clean_name(label)
    return PARTY_CANON.get(l.lower(), l)


# ----------------------------------------------------------------------------
# Census (via scripts/export_ma_officeholders.py) and district matching
# ----------------------------------------------------------------------------

def load_officeholders_module(refresh):
    global OH
    spec = importlib.util.spec_from_file_location("export_ma_officeholders", ROOT / "scripts" / "export_ma_officeholders.py")
    OH = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(OH)
    OH.CACHE_DIR = CACHE_DIR       # share this script's cache directory
    OH.REFRESH = refresh


class Geo(object):
    """Live Census lists + lookup helpers."""

    def __init__(self):
        c = OH.census_lists()
        self.counties = c["counties"]
        self.senate = c["senate"]
        self.house = c["house"]
        self.subs = [s for s in c["subs"] if not s["BASENAME"].startswith("County subdivisions not defined")]
        self.sen_idx = OH.build_district_index(self.senate)
        self.hou_idx = OH.build_district_index(self.house)
        self.county_by_base = {x["BASENAME"].lower(): x for x in self.counties}
        self.sen_by_geoid = {x["GEOID"]: x for x in self.senate}
        self.hou_by_geoid = {x["GEOID"]: x for x in self.house}
        self.sub_by_geoid = {x["GEOID"]: x for x in self.subs}
        self.cnty_by_fp = {x["COUNTY"]: x for x in self.counties}

    def _match(self, name, idx, rows):
        n = words_to_ordinals(clean_name(name))
        row, how = OH.match_district(n, idx)
        if row is not None:
            return row
        # typo tolerance (e.g. BallotReady "Barkshire"): unique best fuzzy match on the token string
        key = " ".join(sorted(OH.normalize_district(n)))
        scored = sorted(((difflib.SequenceMatcher(None, key, " ".join(sorted(OH.normalize_district(r["BASENAME"])))).ratio(), r)
                         for r in rows), key=lambda t: -t[0])
        if scored and scored[0][0] >= 0.9 and (len(scored) < 2 or scored[0][0] - scored[1][0] > 0.05):
            return scored[0][1]
        return None

    def senate_row(self, name):
        return self._match(name, self.sen_idx, self.senate)

    def house_row(self, name):
        return self._match(name, self.hou_idx, self.house)

    def county_row(self, name):
        n = re.sub(r"\s*county\s*$", "", clean_name(name), flags=re.I).lower()
        return self.county_by_base.get(n)


# ----------------------------------------------------------------------------
# PD43+ (Secretary of the Commonwealth election statistics)
# ----------------------------------------------------------------------------

def parse_pd_search(raw):
    """Rows of a PD43+ search page: id, year, office, district, stage, candidates [(name, winner)]."""
    out = []
    for seg in re.split(r'<tr id="election-id-', raw)[1:]:
        eid = seg[:seg.index('"')]
        tds = re.findall(r"<td[^>]*>(.*?)</td>", seg, re.S)
        if len(tds) < 4:
            continue
        cl = lambda s: clean_name(htmllib.unescape(re.sub(r"<[^>]+>", "", s)))
        cands = []
        for m in re.finditer(r'<tr class="([^"]*)">\s*<td class="candidate"><div class="name"><a [^>]*>([^<]*)</a>', seg):
            cands.append((clean_name(htmllib.unescape(m.group(2))), "is_winner" in m.group(1)))
        out.append({"id": eid, "year": cl(tds[0]), "office": cl(tds[1]), "district": cl(tds[2]),
                    "stage": cl(tds[3]), "candidates": cands,
                    "url": "%s/elections/view/%s/" % (PD_BASE, eid)})
    return out


STATEWIDE = OrderedDict([
    ("lieutenant-governor", "Lieutenant Governor"),
    ("attorney-general", "Attorney General"),
    ("secretary-of-the-commonwealth", "Secretary of the Commonwealth"),
    ("treasurer", "Treasurer and Receiver-General"),
    ("state-auditor", "State Auditor"),
])
PD_STATEWIDE = {"Lieutenant Governor": "lieutenant-governor", "Attorney General": "attorney-general",
                "Secretary of the Commonwealth": "secretary-of-the-commonwealth", "Treasurer": "treasurer",
                "Auditor": "state-auditor"}
PD_COUNTY_OFFICES = {"Register of Probate": "rop", "County Treasurer": "ctreas", "Sheriff": "sheriff"}
OFFICE_LABEL = {
    "rop": "Register of Probate", "ctreas": "County Treasurer", "ccomm": "County Commissioner",
    "sheriff": "Sheriff", "da": "District Attorney", "council": "Governor's Council",
    "senate": "State Senator", "house": "State Representative",
}


def pd_race_key(row, geo):
    off, dist = row["office"], row["district"]
    if off in PD_STATEWIDE:
        return ("state", PD_STATEWIDE[off])
    if off == "Governor's Council":
        m = re.match(r"(\d+)", dist)
        return ("council", int(m.group(1))) if m else None
    if off == "State Senate":
        r = geo.senate_row(dist)
        return ("senate", r["GEOID"]) if r else None
    if off == "State Representative":
        r = geo.house_row(dist)
        return ("house", r["GEOID"]) if r else None
    if off == "District Attorney":
        return ("da", da_slug(dist))
    if off in PD_COUNTY_OFFICES:
        r = geo.county_row(dist)
        return (PD_COUNTY_OFFICES[off], r["BASENAME"].lower()) if r else None
    return None


def da_slug(name):
    n = clean_name(name).lower().replace("&", " and ")
    n = re.sub(r"\bdistrict\b", " ", n)
    return slugify(n)


# ----------------------------------------------------------------------------
# Secretary's certified candidate list
# ----------------------------------------------------------------------------

SEC_LABELS = ["Transparency Inclusion Environment", "Independent/Unenrolled", "Socialism and Liberation",
              "Gulf War Veteran", "Justice for All", "Workers Party", "Democratic", "Republican",
              "Unenrolled", "Independent", "Libertarian", "Demo"]


def parse_sec_line(line):
    """'Name, 12 Street, Town, Label' -> dict(name, town, label). Handles 'Jr.' commas,
    a missing label, and a missing comma before the label ('Concord Democratic')."""
    parts = [p.strip() for p in line.split(",")]
    idx = next((i for i, p in enumerate(parts) if i > 0 and re.match(r"^\d", p)), None)
    if idx is None:
        return {"name": clean_name(line), "town": None, "label": None}
    name = clean_name(", ".join(parts[:idx]))
    rest = [p for p in parts[idx + 1:] if p]
    town, label = None, None
    if len(rest) >= 2:
        town, label = rest[0], ", ".join(rest[1:])
    elif len(rest) == 1:
        town = rest[0]
        for lab in SEC_LABELS:
            if town.endswith(" " + lab):
                town, label = town[: -len(lab) - 1].strip(), lab
                break
    return {"name": name, "town": town, "label": canon_party(label) if label else None}


def parse_sec(raw):
    """-> (sections, ticket). sections: {(h2, h3 or None): [cand dict]}; ticket: [(gov, lg, label)]."""
    t = re.sub(r"<!--.*?-->", "", raw, flags=re.S)
    art = t[t.find("<article"):]
    sections = OrderedDict()
    ticket = []
    h2 = h3 = None
    for m in re.finditer(r"<h2[^>]*>(.*?)</h2>|<h3[^>]*>(.*?)</h3>|<p[^>]*>(.*?)</p>", art, re.S):
        if m.group(1) is not None:
            h2, h3 = clean_name(htmllib.unescape(re.sub(r"<[^>]+>", "", m.group(1)))), None
        elif m.group(2) is not None:
            h3 = clean_name(htmllib.unescape(re.sub(r"<[^>]+>", "", m.group(2))))
        else:
            line = clean_name(htmllib.unescape(re.sub(r"<[^>]+>", " ", m.group(3))))
            if not line or h2 is None or line.lower().startswith("no nominations") or "top of page" in line.lower():
                continue
            if h2.startswith("Governor"):
                mm = re.match(r"^(.*?) and (.*?),\s*(.*)$", line)
                if mm:
                    ticket.append((mm.group(1).strip(), mm.group(2).strip(), canon_party(mm.group(3))))
                continue
            sections.setdefault((h2, h3), []).append(parse_sec_line(line))
    return sections, ticket


def sec_race_key(h2, h3, geo):
    """Map an SEC section to a race key, or None if the section is out of scope."""
    if h2 == "Attorney General":
        return ("state", "attorney-general")
    if h2 == "Secretary of State":
        return ("state", "secretary-of-the-commonwealth")
    if h2 == "Treasurer":
        return ("state", "treasurer")
    if h2 == "Auditor":
        return ("state", "state-auditor")
    if h2 == "Councillor" and h3:
        m = re.match(r"(\d+)", words_to_ordinals(h3))
        return ("council", int(m.group(1))) if m else None
    if h2 == "Senator in General Court" and h3:
        r = geo.senate_row(h3)
        return ("senate", r["GEOID"]) if r else ("senate?", h3)
    if h2 == "Representative in General Court" and h3:
        r = geo.house_row(h3)
        return ("house", r["GEOID"]) if r else ("house?", h3)
    if h2 == "District Attorney" and h3:
        return ("da", da_slug(h3))
    for title, code in (("Register of Probate", "rop"), ("County Treasurer", "ctreas"),
                        ("County Commissioner", "ccomm"), ("Sheriff", "sheriff")):
        if h2.startswith(title) and h3:
            r = geo.county_row(h3)
            return (code, r["BASENAME"].lower()) if r else (code + "?", h3)
    return None


# ----------------------------------------------------------------------------
# Ballotpedia (House and Senate general-election tables)
# ----------------------------------------------------------------------------

def parse_ballotpedia(raw, geo, chamber):
    """-> {(chamber, geoid): [ {name, col, incumbent, label} ]}"""
    out = {}
    unmatched = []
    g = raw.find("general election 2026")
    pe = raw.find("primary 2026", g) if g >= 0 else -1
    raw = raw[g:pe] if g >= 0 and pe > g else raw       # only the GENERAL-election table (a primary table follows)
    for tr in re.findall(r"<tr>\s*<td>\s*<a href=\"https://ballotpedia.org/Massachusetts_[^\"]+\"[^>]*>[^<]+</a></td>.*?</tr>", raw, re.S):
        dname = clean_name(re.search(r">([^<]+)</a></td>", tr).group(1))
        row = geo.senate_row(dname) if chamber == "senate" else geo.house_row(dname)
        if row is None:
            unmatched.append(dname)
            continue
        cells = re.split(r"<td[ >]", tr)[2:]        # skip the district cell
        cands = []
        for ci, cell in enumerate(cells[:3]):
            col = "DRO"[ci]
            for m in re.finditer(r'<span class="candidate"><a[^>]*>([^<]+)</a>(.*?)<br', cell, re.S):
                tail = htmllib.unescape(re.sub(r"<[^>]+>", " ", m.group(2)))
                inc = "(i)" in tail
                lab = re.search(r"\(((?!i\))[^)]+)\)", tail)
                cands.append({"name": clean_name(htmllib.unescape(m.group(1))), "col": col, "incumbent": inc,
                              "label": clean_name(lab.group(1)) if lab else None})
        out[(chamber, row["GEOID"])] = cands
    return out, unmatched


# ----------------------------------------------------------------------------
# BallotReady election page
# ----------------------------------------------------------------------------

BR_CODES = {"D": "Democratic", "R": "Republican", "I": "Independent", "U": "Unenrolled", "L": "Libertarian",
            "SaL": "Socialism and Liberation"}


def parse_ballotready(raw, geo):
    """-> {race_key: [(name, code)]}"""
    lines = block_text(raw).split("\n")
    out = {}
    unmatched = []
    for i, ln in enumerate(lines):
        if ln.strip() != "Candidates" or i == 0:
            continue
        title = lines[i - 1].strip()
        cands = []
        j = i + 1
        while j < len(lines):
            m = re.match(r"^(.*?)\s*\(\s*([A-Za-z]+)\s*\)\s*$", lines[j].strip())
            if not m:
                break
            cands.append((clean_name(m.group(1)), m.group(2)))
            j += 1
        key = None
        st = {"Massachusetts Lieutenant Governor": "lieutenant-governor", "Massachusetts Attorney General": "attorney-general",
              "Massachusetts Secretary of the Commonwealth": "secretary-of-the-commonwealth",
              "Massachusetts Treasurer": "treasurer", "Massachusetts Auditor": "state-auditor"}
        if title in st:
            key = ("state", st[title])
        else:
            m = re.match(r"State Governor's Council Congressional District (\d+)$", title)
            if m:
                key = ("council", int(m.group(1)))
            m = re.match(r"State Senator District (.+)$", title)
            if m:
                r = geo.senate_row(m.group(1))
                key = ("senate", r["GEOID"]) if r else None
                if r is None:
                    unmatched.append(title)
            m = re.match(r"Massachusetts House of Representatives - (.+)$", title)
            if m:
                r = geo.house_row(m.group(1))
                key = ("house", r["GEOID"]) if r else None
                if r is None:
                    unmatched.append(title)
        if key:
            out[key] = cands
    return out, unmatched


# ----------------------------------------------------------------------------
# Governor's Council: statutes (G.L. c.57 s.2 and s.3)
# ----------------------------------------------------------------------------

def parse_statutes(geo):
    """-> (council_of_senate {senate geoid: n}, senate_towns {senate geoid: (whole set, partial set)})."""
    raw2, raw3 = fetch(STATUTE_COUNCIL), fetch(STATUTE_SENATE)
    if raw2 is None or raw3 is None:
        raise RuntimeError("could not fetch the General Laws c.57 pages from malegislature.gov")
    council_of = {}
    for ln in block_text(raw2).split("\n"):
        m = re.match(r"^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth)\s*[\u2014-]\s*Consisting of the following senatorial districts:\s*(.*)$", ln.strip())
        if not m:
            continue
        n = _UNIT_ORD[m.group(1).lower()]
        names = [x.strip() for x in re.split(r";\s*(?:and\s+)?", m.group(2).rstrip(". "))]
        for nm in names:
            r = geo.senate_row(nm)
            if r is None:
                raise RuntimeError("statute senate district %r does not match Census" % nm)
            council_of[r["GEOID"]] = n
    if len(council_of) != 40 or sorted(set(council_of.values())) != list(range(1, 9)):
        raise RuntimeError("c.57 s.2 parse: expected 40 senate districts in 8 councils, got %d" % len(council_of))

    # towns per senate district (c.57 s.3)
    name2sub = {}
    for s in geo.subs:
        k = re.sub(r" Town$", "", s["BASENAME"]).lower()
        name2sub[k] = s
    names = sorted(name2sub, key=lambda k: -len(k))
    pat = re.compile(r"(?<![\w-])(" + "|".join(re.escape(n) for n in names) + r")(?![\w-])", re.I)
    by_county = defaultdict(list)
    for s in geo.subs:
        by_county[geo.cnty_by_fp[s["COUNTY"]]["BASENAME"].lower()].append(s)
    towns = {}
    for ln in block_text(raw3).split("\n"):
        if "Consisting of:" not in ln:
            continue
        nm, rest = ln.split("Consisting of:", 1)
        nm = nm.strip().rstrip("\u2014-").strip()
        r = geo.senate_row(nm)
        if r is None:
            raise RuntimeError("statute senate district %r does not match Census" % nm)
        t = re.sub(r"block \d+", "<B>", rest)
        t = re.sub(r"VTD \w+", "<V>", t)
        whole, partial = set(), set()
        for m in re.finditer(r"the (?:cities and towns|towns?) in the county of (\w+)", t):
            for s in by_county[m.group(1).lower()]:
                whole.add(s["GEOID"])
        t = re.sub(r"the (?:cities and towns|towns?) in the county of \w+", " ", t)
        t = re.sub(r"(?:of |in )?the county of \w+", " ", t)
        for m in pat.finditer(t):
            s = name2sub[m.group(1).lower()]
            after = t[m.end(): m.end() + 30]
            if re.match(r"\s*,?\s*(<V>|<B>|ward|precinct)", after):
                partial.add(s["GEOID"])
            else:
                whole.add(s["GEOID"])
        towns[r["GEOID"]] = (whole, partial)
    if len(towns) != 40:
        raise RuntimeError("c.57 s.3 parse: expected 40 senatorial districts, got %d" % len(towns))
    wc, pc = defaultdict(list), defaultdict(list)
    for sg, (w, p) in towns.items():
        for g in w:
            wc[g].append(sg)
        for g in p:
            pc[g].append(sg)
    problems = []
    for s in geo.subs:
        g = s["GEOID"]
        if len(wc[g]) + (1 if pc[g] else 0) == 0:
            problems.append("%s not covered by any senatorial district" % s["BASENAME"])
        if len(wc[g]) > 1 or (wc[g] and pc[g]) or (pc[g] and len(pc[g]) < 2):
            problems.append("%s inconsistent: whole in %s, partial in %s" % (s["BASENAME"], wc[g], pc[g]))
    if problems:
        raise RuntimeError("c.57 s.3 parse is not a clean partition of the 351 municipalities: " + "; ".join(problems[:8]))
    return council_of, towns


def council_maps(geo, council_of, senate_towns):
    """-> {n: {'towns': [...], 'split': [...], 'senate': [...]}} and a list of split-town names."""
    sd = defaultdict(set)      # town geoid -> set of senate geoids
    for sg, (w, p) in senate_towns.items():
        for g in list(w) + list(p):
            sd[g].add(sg)
    res = {n: {"towns": [], "split": [], "senate": sorted(g for g, c in council_of.items() if c == n)} for n in range(1, 9)}
    split_names = []
    for g, sgs in sd.items():
        cs = sorted(set(council_of[x] for x in sgs))
        if len(cs) == 1:
            res[cs[0]]["towns"].append(g)
        else:
            for c in cs:
                res[c]["split"].append(g)
            split_names.append("%s (councils %s)" % (geo.sub_by_geoid[g]["BASENAME"], ", ".join(str(c) for c in cs)))
    for n in res:
        res[n]["towns"].sort()
        res[n]["split"].sort()
    return res, sorted(split_names)


def check_statute_against_census(geo, senate_towns):
    """Live TIGERweb check: the senate district at every municipality's internal point must be one of
    the districts the statute assigns to that municipality. Returns (checked, mismatches)."""
    owners = defaultdict(set)
    for sg, (w, p) in senate_towns.items():
        for g in list(w) + list(p):
            owners[g].add(sg)

    def one(s):
        try:
            lat, lng = float(s["INTPTLAT"]), float(s["INTPTLON"])
            hits = OH.census_query("senate", point=(lng, lat))
            return s, [h["GEOID"] for h in hits]
        except Exception as e:           # network problem: report, do not guess
            return s, "error: %s" % e
    bad, n = [], 0
    with ThreadPoolExecutor(6) as ex:
        for s, hit in ex.map(one, geo.subs):
            n += 1
            if isinstance(hit, str) or not hit or not (set(hit) & owners[s["GEOID"]]):
                bad.append("%s: Census says %s, statute says %s" % (s["BASENAME"], hit, sorted(owners[s["GEOID"]])))
    return n, bad


# ----------------------------------------------------------------------------
# Incumbents
# ----------------------------------------------------------------------------

def load_officeholders():
    path = ROOT / "data" / "officeholders.ma.generated.js"
    txt = path.read_text(encoding="utf-8")
    m = re.search(r"export const OFFICEHOLDERS = (\[.*\]);?\s*$", txt, re.S)
    return json.loads(m.group(1))


# ----------------------------------------------------------------------------
# Official municipal sample ballots (PDF)
# ----------------------------------------------------------------------------

SAMPLE_BALLOTS = [
    ("Lynnfield", "https://www.lynnfieldma.gov/DocumentCenter/View/3410/November-3-2026-State-Election-Sample-Ballot"),
    ("Athol", "https://www.athol-ma.gov/DocumentCenter/View/1216"),
]
BALLOT_TITLES = ["SENATOR IN CONGRESS", "GOVERNOR AND LIEUTENANT GOVERNOR", "ATTORNEY GENERAL", "SECRETARY OF STATE",
                 "TREASURER", "AUDITOR", "REPRESENTATIVE IN CONGRESS", "COUNCILLOR", "SENATOR IN GENERAL COURT",
                 "REPRESENTATIVE IN GENERAL COURT", "DISTRICT ATTORNEY", "REGISTER OF PROBATE", "COUNTY TREASURER",
                 "COUNTY COMMISSIONER", "SHERIFF"]


def fetch_bin(url, timeout=90):
    """Binary GET (PDFs) with the same disk cache; None on error or challenge."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()
    path, meta = CACHE_DIR / ("bin-" + key), CACHE_DIR / ("bin-" + key + ".status")
    if not (path.exists() and meta.exists()) or REFRESH:
        res = subprocess.run(["curl", "-s", "-L", "-m", str(timeout), "-A", UA_BROWSER, "-o", str(path), "-w", "%{http_code}", url],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        meta.write_text(res.stdout.decode("ascii", "replace").strip() or "0")
    status = int(meta.read_text() or 0)
    data = path.read_bytes() if path.exists() else b""
    if status >= 400 or status == 0 or not data.startswith(b"%PDF"):
        FETCH_LOG[url] = "skipped (HTTP %s, not a PDF)" % status
        return None
    FETCH_LOG.setdefault(url, "ok")
    return data


def pdf_lines(data):
    """Text lines of a simple text-based PDF (FlateDecode content streams, Tj/TJ operators).
    Strings in two-byte (CID) fonts decode to garbage and are dropped."""
    import zlib
    out = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S):
        try:
            s = zlib.decompress(m.group(1))
        except Exception:
            continue
        if b"BT" not in s:
            continue
        for tm in re.finditer(rb"\[(.*?)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*Tj", s, re.S):
            parts = re.findall(rb"\(((?:\\.|[^\\)])*)\)", tm.group(1)) if tm.group(1) is not None else [tm.group(2)]
            raw = b"".join(parts)
            raw = re.sub(rb"\\([0-7]{3})", lambda x: bytes([int(x.group(1), 8)]), raw)
            raw = re.sub(rb"\\(.)", rb"\1", raw)
            out.append(raw.decode("latin-1"))
        out.append("\n")
    lines = []
    for chunk in "\n".join(out).split("\n"):
        c = chunk.strip()
        if c and "\x00" not in c and not c.startswith("en-US"):
            lines.append(c)
    return lines


def parse_sample_ballot(data, town, url, geo):
    """-> ({race_key: [entry]}, warnings). Only 'STATE ELECTION' ballots dated Nov 3, 2026 are accepted."""
    lines = pdf_lines(data)
    blob = " ".join(lines)
    if "STATE ELECTION" not in blob or "JAMES AND KITTREDGE" not in blob:
        return {}, ["%s: not a Nov 3, 2026 general state-election ballot" % town]
    races, warns = {}, []
    i, n = 0, len(lines)
    while i < n:
        title = lines[i]
        if title not in BALLOT_TITLES:
            i += 1
            continue
        j = i + 1
        district = None
        if j < n and not lines[j].startswith("Vote for"):
            district = lines[j]
            j += 1
        if j < n and lines[j].startswith("Vote for"):
            j += 1
        cands = []
        while j < n and not lines[j].startswith("DO NOT VOTE"):
            name = lines[j]
            j += 1
            label, inc = None, False
            if j < n and not re.match(r"^\d", lines[j]) and not lines[j].startswith(("Candidate for", "DO NOT VOTE")):
                label = lines[j]
                j += 1
            if j < n and re.match(r"^\d", lines[j]):
                j += 1
            if j < n and lines[j].startswith("Candidate for Re-election"):
                inc = True
                j += 1
            if re.match(r"^[A-Za-z][A-Za-z .,'\-]+$", name) and label:
                cands.append({"name": name, "label": canon_party(label), "inc": inc})
        i = j
        key = sample_race_key(title, district, geo)
        if key is None:
            continue
        entries = []
        if title == "GOVERNOR AND LIEUTENANT GOVERNOR":
            for c in cands:
                m = re.match(r"^(.*?) AND (.*)$", c["name"])
                if m:
                    entries.append({"name": m.group(2).title(), "label": c["label"], "inc": False, "sn": True})
        else:
            entries = [{"name": smart_case(c["name"]), "label": c["label"], "inc": c["inc"], "sn": False} for c in cands]
        if key in races:
            a = sorted(name_parts(e["name"])[1] for e in races[key])
            b = sorted(name_parts(e["name"])[1] for e in entries)
            if a != b:
                warns.append("%s: %s printed twice with different candidates" % (town, key))
            continue
        races[key] = entries
    return races, warns


def sample_race_key(title, district, geo):
    st = {"GOVERNOR AND LIEUTENANT GOVERNOR": "lieutenant-governor", "ATTORNEY GENERAL": "attorney-general",
          "SECRETARY OF STATE": "secretary-of-the-commonwealth", "TREASURER": "treasurer", "AUDITOR": "state-auditor"}
    if title in st:
        return ("state", st[title])
    if title == "COUNCILLOR" and district:
        m = re.match(r"(\d+)", words_to_ordinals(district.title()))
        return ("council", int(m.group(1))) if m else None
    if title == "SENATOR IN GENERAL COURT" and district:
        r = geo.senate_row(district.title())
        return ("senate", r["GEOID"]) if r else None
    if title == "REPRESENTATIVE IN GENERAL COURT" and district:
        r = geo.house_row(district.title())
        return ("house", r["GEOID"]) if r else None
    if title == "DISTRICT ATTORNEY" and district:
        return ("da", da_slug(district))
    for t, code in (("REGISTER OF PROBATE", "rop"), ("COUNTY TREASURER", "ctreas"), ("COUNTY COMMISSIONER", "ccomm"), ("SHERIFF", "sheriff")):
        if title == t and district:
            r = geo.county_row(district.title())
            return (code, r["BASENAME"].lower()) if r else None
    return None


def smart_case(upper):
    """'MICHAEL C. WALSH' -> 'Michael C. Walsh' (mixed-case words such as DiZOGLIO are kept)."""
    out = []
    for w in upper.split():
        if any(c.islower() for c in w):
            out.append(w)
        elif re.match(r"^(JR|SR)\.?$", w):
            out.append(w.title())
        elif "'" in w:
            out.append("'".join(p.capitalize() for p in w.split("'")))
        else:
            out.append(w.capitalize())
    return " ".join(out)


# ----------------------------------------------------------------------------
# Outside pages checked on every run (for races and candidates no complete roster covers)
# ----------------------------------------------------------------------------

Q3 = "https://www.southshore.news/p/the-november-nine-question-3"
NBL = "https://www.newsbreak.com/news/4959322729081-in-bristol-county-s-most-obscure-race-register-of-probate-faces-a-challenger"
FIELDS = [
    # (race key, url, [(name, first-name alternatives)], context tokens): a page that names the WHOLE field
    (("da", "norfolk"), Q3, [("Djuna Perkins", ["djuna"]), ("Joe Pagliarulo", ["joe", "joseph"])], ["district attorney"]),
    (("ctreas", "norfolk"), Q3, [("Michael Bellotti", ["michael"])], ["treasurer"]),
    (("rop", "norfolk"), Q3, [("Colleen Brierley", ["colleen"])], ["register of probate"]),
    (("ccomm", "norfolk"), Q3, [("Peter Collins", ["peter"])], ["commissioner"]),
    (("ctreas", "plymouth"), Q3, [("Thomas O'Brien", ["thomas"])], ["treasurer"]),
    (("rop", "plymouth"), Q3, [("Matthew McDonough", ["matthew"])], ["register of probate"]),
    (("da", "plymouth"), Q3, [("Timothy Cruz", ["timothy"])], ["district attorney"]),
    (("ctreas", "bristol"), NBL, [("Christopher Saunders", ["christopher"])], ["treasurer"]),
    (("ccomm", "bristol"), NBL, [("John T. Saunders", ["john"])], ["commissioner"]),
    (("rop", "bristol"), NBL, [("Tom Hoye", ["tom", "thomas"]), ("Melanie Patenaude Layden", ["melanie"])], ["register of probate"]),
    (("sheriff", "franklin"), "https://whmp.com/news/160061-three-candidates-are-competing-to-become-franklin-countys-next-sheriff-in-the-november-third-election/",
     [("Lori Streeter", ["lori"]), ("Jon Hall", ["jon"]), ("Gary Gagnon", ["gary"])], ["sheriff"]),
    (("ccomm", "barnstable"), "https://www.capenews.net/falmouth/news/early-voting-starts-saturday-heres-whats-on-the-ballot/article_0a5da0a5-babd-4baf-8f48-83b18f4adad5.html",
     [("Daniel Gessen", ["daniel", "dan"]), ("Adam Hogue", ["adam"])], ["commissioner"]),
]
SUPPORT = [
    # (race key, candidate last name, first-name alternatives, context tokens, [urls]): the page mentions the candidate in this race
    (("da", "norfolk"), "Pagliarulo", ["joe", "joseph"], ["norfolk"],
     ["https://www.serpalaw.com/boston-criminal-law-updates/2026-district-attorney-primary-results-suffolk-norfolk-middlesex/",
      "https://www.cbsnews.com/boston/news/norfolk-county-da-candidates-karen-read-sandra-birchmore/"]),
    (("da", "norfolk"), "Perkins", ["djuna"], ["norfolk"],
     ["https://www.serpalaw.com/boston-criminal-law-updates/2026-district-attorney-primary-results-suffolk-norfolk-middlesex/",
      "https://www.cbsnews.com/boston/news/norfolk-county-da-candidates-karen-read-sandra-birchmore/"]),
    (("rop", "middlesex"), "Martorella", ["tara"], ["probate"], ["https://the-reading-observer.squarespace.com/probate-candidates"]),
    (("ccomm", "barnstable"), "Hogue", ["adam"], ["commissioner"], ["https://barnstablertc.com/"]),
    (("ccomm", "plymouth"), "Nyman", ["rhonda"], ["commissioner"],
     ["https://massachusettsintel.substack.com/p/four-candidates-vie-for-plymouth", "https://www.nymanforplymouth.com/"]),
    (("ccomm", "plymouth"), "O'Brien", ["anthony"], ["commissioner"], ["https://anthonyobrien.com/", "https://www.southshore.news/p/obrien-leads-plymouth-county-gop"]),
]
SUPPORT += [
    # House candidates with no PD43+ record: a second source outside Ballotpedia (campaign sites are used only as a last resort)
    (("house", "25001"), "Glynn", ["joe", "joseph"], ["first barnstable"],
     ["https://www.capecodchronicle.com/articles/4333/view.html", "https://www.aol.com/articles/2026-election-running-sept-1-090149000.html"]),
    (("house", "25028"), "Frieden", ["gil", "gilbert"], ["5th essex"],
     ["https://www.ballotready.org/people/gilbert-frieden", "https://www.votegil.org/"]),
    (("house", "25042"), "Lavallee", ["amy"], ["franklin", "independent"],
     ["https://www.yahoo.com/news/politics/articles/rural-issues-top-concern-1st-203619020.html"]),
    (("house", "25043"), "Whipps", ["susannah"], ["2nd franklin"], ["https://www.ballotready.org/people/susannah-m-whipps"]),
    (("house", "25046"), "Perron", ["jason"], ["3rd hampden"],
     ["https://www.msn.com/en-us/news/politics/jason-perron-receives-masscop-endorsement-in-3rd-hampden-state-representative-race/ar-AA24nYtR",
      "https://issuu.com/the-reminder/docs/psa-20260219"]),
    (("house", "25048"), "Candelario Gonzalez", ["candelario"], ["5th hampden", "independent"],
     ["https://www.yahoo.com/news/politics/articles/education-funding-emerges-key-issue-193621360.html"]),
    (("house", "25132"), "Kreinbring", ["devin"], ["suffolk"], [BPL_URL]),
    (("house", "25143"), "Reilly", ["john"], ["representative"], ["https://reillyformass.com/"]),
    (("house", "25148"), "Dotson", ["terry"], ["7th worcester"], ["https://www.terryburkedotson.com/"]),
]
STATEWIDE_PAGES = [GLOBE_URL, BPL_URL]
COUNTY_COMMISSIONER_COUNTIES = ["barnstable", "bristol", "dukes", "norfolk", "plymouth"]
EXPECTED_LAST_GENERAL = {"rop": 2020, "ctreas": 2020, "da": 2022, "council": 2024}   # + term => 2026
OFFICE_ID = {"rop": 537, "ctreas": 389, "da": 530, "council": 529}


# ----------------------------------------------------------------------------
# Race model
# ----------------------------------------------------------------------------

class Race(object):
    def __init__(self, key, office, kind, scope, district_name, term):
        self.key, self.office, self.kind, self.scope = key, office, kind, scope
        self.district_name, self.term = district_name, term
        self.pd = []              # primary winners [{party, name, url}]
        self.pd_nonwinners = defaultdict(list)   # party -> [names on the primary ballot who did not win]
        self.pd_urls = []
        self.rosters = []         # complete rosters [{src, url, items:[{name,party,inc,sn}]}]
        self.support = []         # [{src, url, name, sn}]
        self.problems, self.infos, self.cands = [], [], []
        self.note = None
        self.id = None


def src_domain(url):
    return re.sub(r"^https?://(www\.)?([^/]+)/?.*$", r"\2", url)


def same_person(a, b):
    if a.get("sn") or b.get("sn"):
        return name_parts(a["name"])[1] == name_parts(b["name"])[1]
    return names_match(a["name"], b["name"])


def pretty_pd(name):
    n = clean_name(name)
    return re.sub(r",?\s+(Jr|Sr)$", lambda m: ", " + m.group(1) + ".", n)


def pretty_br(name):
    return clean_name(re.sub(r'\s*"[^"]*"\s*', " ", name))


def build_universe(geo, council_info):
    races = OrderedDict()
    for k, label in STATEWIDE.items():
        races[("state", k)] = Race(("state", k), label, "state", {"state": "MA"}, None, "4 years")
    for n in range(1, 9):
        ci = council_info[n]
        scope = OrderedDict([("townGeoids", ci["towns"]), ("splitTownGeoids", ci["split"]), ("senateGeoids", ci["senate"])])
        races[("council", n)] = Race(("council", n), "Governor's Council", "state", scope,
                                     "Governor's Council District %d" % n, "2 years")
    for r in sorted(geo.senate, key=lambda x: x["GEOID"]):
        races[("senate", r["GEOID"])] = Race(("senate", r["GEOID"]), "State Senator", "senate", {"geoid": r["GEOID"]}, r["NAME"], "2 years")
    for r in sorted(geo.house, key=lambda x: x["GEOID"]):
        races[("house", r["GEOID"])] = Race(("house", r["GEOID"]), "State Representative", "house", {"geoid": r["GEOID"]}, r["NAME"], "2 years")
    for c in COUNTY_COMMISSIONER_COUNTIES:
        races[("ccomm", c)] = make_county_race(("ccomm", c), geo, {}, None)
    return races


COUNTY_ID = {"da": "district-attorney", "rop": "register-of-probate", "ctreas": "county-treasurer",
             "ccomm": "county-commissioner", "sheriff": "sheriff"}


def race_id(race, geo):
    t, k = race.key
    if t == "state":
        return "ma-2026:" + k
    if t == "council":
        return "ma-2026:governors-council:%d" % k
    if t == "senate":
        return "ma-2026:senate:" + slugify(geo.sen_by_geoid[k]["BASENAME"])
    if t == "house":
        return "ma-2026:house:" + slugify(geo.hou_by_geoid[k]["BASENAME"])
    if t == "da":
        return "ma-2026:district-attorney:" + k
    return "ma-2026:%s:%s-county" % (COUNTY_ID[t], k)


def make_county_race(key, geo, da_counties, district_label):
    t, k = key
    if t == "da":
        counties = da_counties.get(k, [])
        nm = clean_name(re.sub(r"(?i)\bdistrict\b", "", (district_label or k).replace("&", "and")))
        return Race(key, "District Attorney", "county", {"countyGeoid": counties[0] if counties else None}, nm + " District", "4 years")
    row = geo.county_by_base.get(k)
    term = {"rop": "6 years", "ctreas": "6 years", "ccomm": None, "sheriff": "2 years"}[t]
    return Race(key, OFFICE_LABEL[t], "county", {"countyGeoid": row["GEOID"]}, row["NAME"], term)


# ----------------------------------------------------------------------------
# Assembling and verifying one race
# ----------------------------------------------------------------------------

def party_from_br(code):
    return BR_CODES.get(code)


def assemble(race, geo, holders, council_inc, wiki_text):
    t, k = race.key
    # ---- gather entries ------------------------------------------------------------------------
    entries = []   # every mention: dict(cls, kind('pd'|'roster'|'support'), url, name, party, inc, sn, rank)
    for p in race.pd:
        entries.append({"cls": "PD43+", "kind": "pd", "url": p["url"], "name": pretty_pd(p["name"]), "party": p["party"],
                        "inc": None, "sn": False, "rank": 0})
    for r in race.rosters:
        for it in r["items"]:
            e = dict(it)
            e.update({"cls": r["src"], "kind": "roster", "url": r["url"]})
            entries.append(e)
    for s in race.support:
        entries.append({"cls": s["src"], "kind": "support", "url": s["url"], "name": s["name"], "party": None,
                        "inc": None, "sn": s.get("sn", False), "rank": 9})

    clusters = []
    for e in entries:
        for c in clusters:
            if same_person(c[0], e):
                c.append(e)
                break
        else:
            clusters.append([e])
    # a surname-only cluster (lieutenant governor tickets) adopts the full name of a cluster with the same surname
    if not clusters or (not race.rosters and not race.pd):
        race.problems.append("no complete roster of the field and no PD43+ nominee: nothing could be verified")
        return

    roster_srcs = [r["src"] for r in race.rosters]
    pd_names = [p["name"] for p in race.pd]
    # (2) PD43+ non-winners must not be on a roster
    for party, names in race.pd_nonwinners.items():
        won = any(p["party"] == party for p in race.pd)
        for nm in names:
            for c in clusters:
                if any(e["kind"] == "roster" for e in c) and any(names_match(nm, e["name"]) and not e["sn"] for e in c) \
                        and not any(e["kind"] == "pd" for e in c):
                    race.problems.append("%s was on the %s primary ballot without a certified win, yet a roster lists them" % (nm, party))
        if names and not won:
            race.infos.append("no %s nominee: PD43+ shows %s on the %s primary ballot with no certified winner" % (party, ", ".join(names), party))

    final = []
    for c in clusters:
        pd = [e for e in c if e["kind"] == "pd"]
        rost = [e for e in c if e["kind"] == "roster"]
        sup = [e for e in c if e["kind"] == "support"]
        classes = sorted(set(e["cls"] for e in c))
        # display name: PD43+ > Secretary's list > BallotReady > sample ballot > other
        pri = {"PD43+": 0, "SEC": 1, "BallotReady": 2}
        disp = sorted([e for e in c if not e["sn"] and e["kind"] != "support"],
                      key=lambda e: (pri.get(e["cls"], 4 if e["cls"].startswith("Sample") else 6), len(e["name"])))
        name = disp[0]["name"] if disp else None
        if name is not None and disp[0]["cls"] == "PD43+":
            others = [e for e in disp if e["cls"] != "PD43+"]
            lp = name_parts(name)[1]
            if others and all(name_parts(e["name"])[1] != lp and not name_parts(e["name"])[1].endswith(lp)
                              and not lp.endswith(name_parts(e["name"])[1]) for e in others) \
                    and not re.search(r"\b(Jr|Sr|II|III|IV)\.?$", name):
                good = sorted(others, key=lambda e: (pri.get(e["cls"], 4 if e["cls"].startswith("Sample") else 6), len(e["name"])))[0]["name"]
                fixed = name.rsplit(" ", 1)[0] + " " + good.replace(",", "").split()[-1]
                race.infos.append("PD43+ spells %r differently from the other sources (%r); using %r" % (name, good, fixed))
                name = fixed
        if name is None:
            race.problems.append("no full name for candidate %r (only a surname appears in the sources)" % c[0]["name"])
            name = c[0]["name"]
        # party
        labels = OrderedDict()
        for e in c:
            if e["kind"] == "roster" and e.get("party") and (e["cls"].startswith("Sample") or e["cls"] == "SEC"):
                labels.setdefault("ballot", set()).add(canon_party(e["party"]))
            elif e["kind"] == "pd":
                labels.setdefault("pd", set()).add(e["party"])
            elif e["kind"] == "roster" and e["cls"] == "BallotReady" and e.get("party"):
                labels.setdefault("br", set()).add(e["party"])
            elif e["kind"] == "roster" and e["cls"] == "Ballotpedia" and e.get("party") in ("Democratic", "Republican"):
                labels.setdefault("bp", set()).add(e["party"])
        party = None
        for src in ("ballot", "pd", "br", "bp"):
            if labels.get(src):
                party = sorted(labels[src])[0]
                break
        allp = set()
        for src in ("ballot", "pd", "br", "bp"):
            allp |= labels.get(src, set())
        if len(allp) > 1:
            race.problems.append("party labels disagree for %s: %s" % (name, "; ".join(
                "%s=%s" % (s, "/".join(sorted(v))) for s, v in labels.items())))
        # roster agreement
        for rs in set(roster_srcs):
            if not any(e["kind"] == "roster" and e["cls"] == rs for e in c):
                race.problems.append("%s is not on the %s roster" % (name, rs))
        if not pd and party in ("Democratic", "Republican") and k_has_pd(race):
            race.problems.append("%s is listed as a %s candidate but did not win that primary in PD43+" % (name, party))
        if pd and not rost and roster_srcs:
            race.problems.append("PD43+ nominee %s is missing from every roster" % name)
        # incumbent
        inc = is_incumbent(race, name, holders, council_inc)
        sample_inc = any(e.get("inc") for e in c if e["cls"].startswith("Sample"))
        if sample_inc and not inc and t in ("senate", "house", "state", "da", "sheriff", "council"):
            race.infos.append("sample ballot marks %s 'Candidate for Re-election' but the officeholders file does not (file used)" % name)
        incumbent = bool(inc or sample_inc)
        # (3) two sources
        if len(classes) < 2:
            race.problems.append("%s has only one source (%s)" % (name, classes[0]))
        final.append({"name": name, "party": party, "incumbent": incumbent, "classes": classes,
                      "urls": [e["url"] for e in c if e["url"]]})
    # complete rosters must contain every cluster that appears in some roster or PD43+ (also every PD winner)
    race.cands = final
    if not race.rosters:
        race.problems.append("no complete roster of the field (Ballotpedia, BallotReady, sample ballot or news page)")
    elif len(set(roster_srcs)) == 1:
        only = roster_srcs[0].replace("Page:", "news page ")
        race.note = "The full candidate list rests on one roster (%s), cross-checked against the PD43+ primary winners; no second complete roster was found." % only
    unlabeled = [c["name"] for c in final if c["party"] is None]
    if unlabeled:
        txt = "Party label not confirmed against the printed ballot for %s (non-party candidate; Ballotpedia calls every one 'Unenrolled')." % ", ".join(unlabeled)
        race.note = (race.note + " " if race.note else "") + txt


def k_has_pd(race):
    """True for offices whose Democratic/Republican nominees PD43+ certifies (everything except county commissioner)."""
    return race.key[0] != "ccomm"


def is_incumbent(race, name, holders, council_inc):
    t, k = race.key
    if t == "state":
        want = STATEWIDE[k]
        return any(h["layer"] == "state" and h["office"] == want and names_match(h["name"], name) for h in holders)
    if t in ("senate", "house"):
        return any(h["layer"] == t and h["match"].get("geoid") == k and names_match(h["name"], name) for h in holders)
    if t == "council":
        return k in council_inc and names_match(council_inc[k], name)
    if t == "da":
        return any(h["id"].startswith("ma-da:%s:" % k) and names_match(h["name"], name) for h in holders)
    if t == "sheriff":
        return any(h["layer"] == "county" and h["office"] == "Sheriff" and h["id"].endswith(k + " county")
                   and names_match(h["name"], name) for h in holders)
    return False


def council_incumbents():
    """{district n: name}: the Wikipedia council table AND the 2024 PD43+ general winner agree."""
    wt = wikitext(WIKI_COUNCIL_PAGE)
    table = {}
    if wt:
        for m in re.finditer(r"\|\s*(\d)(?:st|nd|rd|th)\s*\n\|\{\{sortname\|([^|}]+)\|([^|}]+)", wt):
            table[int(m.group(1))] = clean_name(m.group(2)) + " " + clean_name(m.group(3))
    pd24 = {}
    raw = fetch(PD_BASE + "/elections/search/year_from:2024/year_to:2024/office_id:529")
    if raw:
        for r in parse_pd_search(raw):
            if r["stage"] == "General Election":
                m = re.match(r"(\d+)", r["district"])
                w = [n for n, win in r["candidates"] if win]
                if m and w:
                    pd24[int(m.group(1))] = w[0]
    return {n: pd24[n] for n, nm in table.items() if n in pd24 and names_match(nm, pd24[n])}


def wikitext(title):
    import urllib.parse
    url = ("https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page="
           + urllib.parse.quote(title))
    raw = fetch(url, ua=UA_WIKI)
    if raw is None:
        return None
    try:
        return json.loads(raw).get("parse", {}).get("wikitext")
    except ValueError:
        return None


def term_check(races, geo, disc):
    """Cross-check term lengths against PD43+ history: the seat must have had a general election in
    2026 minus its term (special elections in between are ignored)."""
    for t, oid in OFFICE_ID.items():
        raw = fetch(PD_BASE + "/elections/search/year_from:2000/year_to:2025/office_id:%d" % oid)
        if raw is None:
            continue
        years = defaultdict(set)
        for r in parse_pd_search(raw):
            if r["stage"] != "General Election":
                continue
            fake = {"office": {"rop": "Register of Probate", "ctreas": "County Treasurer", "da": "District Attorney",
                               "council": "Governor's Council"}[t], "district": r["district"]}
            key = pd_race_key(fake, geo)
            if key:
                years[key].add(int(r["year"]))
        for key, race in races.items():
            if key[0] != t or not race.term:
                continue
            want = 2026 - int(race.term.split()[0])
            if key not in years:
                race.infos.append("term check: no PD43+ general-election history found for this seat")
            elif want not in years[key]:
                disc(race.id, "term check: PD43+ has no general election in %d for this seat (years seen: %s); term %s is unconfirmed" % (
                    want, sorted(years[key])[-4:], race.term))


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main():
    global REFRESH, OUT_PATH
    ap = argparse.ArgumentParser(description="Export the Nov 3 2026 Massachusetts ballot (verified races only)")
    ap.add_argument("--refresh", action="store_true", help="re-download everything instead of using the /tmp cache")
    ap.add_argument("--sec-html", help="a copy of the Secretary's '2026 State Election Candidates' page saved from a browser")
    ap.add_argument("--out", help="output path (default data/ma-ballot.generated.js)")
    args = ap.parse_args()
    REFRESH = args.refresh
    if args.out:
        OUT_PATH = Path(args.out)
    load_officeholders_module(REFRESH)
    hard_errors, discrepancies = [], []

    def disc(where, msg):
        discrepancies.append((where, msg))

    print("== Massachusetts Nov 3 2026 ballot export (as of %s) ==" % AS_OF)
    geo = Geo()
    print("Census (live TIGERweb): %d counties, %d senate, %d house districts, %d municipalities" % (
        len(geo.counties), len(geo.senate), len(geo.house), len(geo.subs)))

    # ---- Governor's Council towns -------------------------------------------------------------
    council_of, senate_towns = parse_statutes(geo)
    council_info, split_names = council_maps(geo, council_of, senate_towns)
    checked, bad = check_statute_against_census(geo, senate_towns)
    print("Governor's Council: G.L. c.57 s.2-3 cover all %d municipalities; live Census point check: %d checked, %d mismatches" % (
        len(geo.subs), checked, len(bad)))
    if bad:
        hard_errors.append("statute vs Census mismatches: " + "; ".join(bad[:5]))
    for n in range(1, 9):
        print("  council %d: %3d whole towns, %d split towns; senate districts: %s" % (
            n, len(council_info[n]["towns"]), len(council_info[n]["split"]),
            ", ".join(geo.sen_by_geoid[g]["BASENAME"] for g in council_info[n]["senate"])))
    if split_names:
        print("  towns split between council districts: " + "; ".join(split_names))

    holders = load_officeholders()
    races = build_universe(geo, council_info)
    da_counties = defaultdict(list)
    for h in holders:
        if h["id"].startswith("ma-da:"):
            da_counties[h["id"].split(":")[1]].append(h["match"]["geoid"])

    # ---- PD43+ ---------------------------------------------------------------------------------
    raw = fetch(PD_SEARCH_2026)
    if raw is None:
        raise SystemExit("PD43+ is unavailable; nothing can be verified")
    pd_rows = [r for r in parse_pd_search(raw) if r["year"] == "2026" and r["stage"] in ("Democratic Primary", "Republican Primary")]
    print("PD43+: %d Democratic/Republican primary result pages for 2026 (%d in scope here)" % (
        len(pd_rows), len([r for r in pd_rows if r["office"] not in ("U.S. Senate", "Governor", "U.S. House")])))
    pd_all_names = []
    for r in pd_rows:
        if r["office"] in ("U.S. Senate", "Governor", "U.S. House"):
            continue            # covered by data/nominees.generated.js
        key = pd_race_key(r, geo)
        if key is None:
            disc("PD43+", "could not map %s / %s (%s)" % (r["office"], r["district"], r["stage"]))
            continue
        party = "Democratic" if r["stage"].startswith("Democratic") else "Republican"
        wins = [n for n, w in r["candidates"] if w]
        for n, w in r["candidates"]:
            pd_all_names.append((n, r["office"], r["district"], party, w))
        race = races.get(key)
        if race is None:
            race = make_county_race(key, geo, da_counties, r["district"])
            races[key] = race
        race.pd_urls.append(r["url"])
        if len(wins) > 1:
            race.problems.append("PD43+ %s primary lists %d winners" % (party, len(wins)))
        elif wins:
            race.pd.append({"party": party, "name": wins[0], "url": r["url"]})
        else:
            for n, w in r["candidates"]:
                race.pd_nonwinners[party].append(n)
    for k, race in races.items():
        race.id = race_id(race, geo)

    # ---- complete rosters ----------------------------------------------------------------------
    n_sources = defaultdict(int)
    bpd = {}
    for url, ch in ((BP_HOUSE, "house"), (BP_SENATE, "senate")):
        rawb = fetch(url)
        if rawb is None:
            disc("Ballotpedia", "page unavailable: " + url)
            continue
        part, unm = parse_ballotpedia(rawb, geo, ch)
        for key, lst in part.items():
            r = races.get(key)
            if r is not None:
                items = [{"name": b["name"], "party": {"D": "Democratic", "R": "Republican"}.get(b["col"]), "inc": b["incumbent"],
                          "sn": False, "rank": 5} for b in lst]
                r.rosters.append({"src": "Ballotpedia", "url": url, "items": items})
                bpd[key] = lst
        print("Ballotpedia %s: %d districts" % (ch, len(part)))
        for u in unm:
            disc("Ballotpedia", "district %r could not be matched to Census" % u)
    rawr = fetch(BR_URL)
    if rawr is None:
        disc("BallotReady", "election page unavailable")
    else:
        br, unm = parse_ballotready(rawr, geo)
        for key, lst in br.items():
            r = races.get(key)
            if r is not None:
                r.rosters.append({"src": "BallotReady", "url": BR_URL, "items": [
                    {"name": pretty_br(n), "party": party_from_br(code), "inc": None, "sn": False, "rank": 2} for n, code in lst]})
        print("BallotReady: %d races" % len(br))
        for u in unm:
            disc("BallotReady", "%r could not be matched to Census" % u)
    for town, url in SAMPLE_BALLOTS:
        data = fetch_bin(url)
        if data is None:
            disc("sample ballot", "%s unavailable: %s" % (town, url))
            continue
        sb, warns = parse_sample_ballot(data, town, url, geo)
        for w in warns:
            disc("sample ballot", w)
        for key, ents in sb.items():
            r = races.get(key)
            if r is None:
                r = make_county_race(key, geo, da_counties, None) if key[0] in COUNTY_ID else None
                if r is not None:
                    r.id = race_id(r, geo)
                    races[key] = r
            if r is not None:
                r.rosters.append({"src": "Sample ballot (%s)" % town, "url": url, "items": [
                    {"name": e["name"], "party": e["label"], "inc": e["inc"], "sn": e["sn"], "rank": 3} for e in ents]})
        print("Sample ballot %s: %d races parsed" % (town, len(sb)))
    if args.sec_html:
        sec_raw = Path(args.sec_html).read_text(encoding="utf-8", errors="replace")
        sections, ticket = parse_sec(sec_raw)
        for (h2, h3), cands in sections.items():
            key = sec_race_key(h2, h3, geo)
            if key is None or key[0].endswith("?"):
                continue
            r = races.get(key)
            if r is None and key[0] in COUNTY_ID:
                r = make_county_race(key, geo, da_counties, h3)
                r.id = race_id(r, geo)
                races[key] = r
            if r is not None:
                r.rosters.append({"src": "SEC", "url": SEC_URL, "items": [
                    {"name": c["name"], "party": c["label"], "inc": None, "sn": False, "rank": 1} for c in cands]})
        lgr = races[("state", "lieutenant-governor")]
        if ticket:
            lgr.rosters.append({"src": "SEC", "url": SEC_URL, "items": [
                {"name": t[1], "party": t[2], "inc": None, "sn": True, "rank": 1} for t in ticket]})
        print("Secretary's list (user-supplied file): %d sections" % len(sections))
    else:
        print("Secretary's candidate list: not used (pass --sec-html with a browser-saved copy to add it)")

    # ---- news pages that state a whole field, and supporting mentions --------------------------
    for key, url, people, ctx in FIELDS:
        race = races.get(key)
        if race is None:
            continue
        ok = []
        for nm, firsts in people:
            if page_supports(url, name_parts(nm)[1], firsts, ctx, window=900):
                ok.append(nm)
        if len(ok) == len(people):
            race.rosters.append({"src": "Page:" + src_domain(url), "url": url, "items": [
                {"name": nm, "party": None, "inc": None, "sn": False, "rank": 8} for nm, _ in people]})
        else:
            race.infos.append("news page %s did not confirm all of %s (confirmed: %s)" % (src_domain(url), [p[0] for p in people], ok))
    for key, last, firsts, ctx, urls in SUPPORT:
        race = races.get(key)
        if race is None:
            continue
        for u in urls:
            if page_supports(u, last, firsts, ctx, window=900):
                race.support.append({"src": "Page:" + src_domain(u), "url": u, "name": last, "sn": True})
    # statewide candidates: Globe, BPL, Wikipedia mention the person next to the office
    wiki_cache = {}
    for slug, title in WIKI_STATEWIDE.items():
        wiki_cache[slug] = wikitext(title)
    for slug in STATEWIDE:
        race = races[("state", slug)]
        names = []
        for r in race.rosters:
            for it in r["items"]:
                if not it["sn"] and it["name"] not in names:
                    names.append(it["name"])
        for p in race.pd:
            if not any(names_match(p["name"], x) for x in names):
                names.append(p["name"])
        ctx = {"lieutenant-governor": ["lieutenant"], "attorney-general": ["attorney general"],
               "secretary-of-the-commonwealth": ["secretary"], "treasurer": ["treasurer"], "state-auditor": ["auditor"]}[slug]
        for nm in names:
            f, l = name_parts(nm)
            for u in STATEWIDE_PAGES:
                c2 = ["gov"] if (u == BPL_URL and slug == "lieutenant-governor") else ctx
                if page_supports(u, l, [f, f[:3]], c2, window=900):
                    race.support.append({"src": "Page:" + src_domain(u), "url": u, "name": nm})
            wt = wiki_cache.get(slug)
            if wt and re.search(re.escape(l), strip_accents(wt), re.I):
                race.support.append({"src": "Page:wikipedia.org", "url": "https://en.wikipedia.org/wiki/" + WIKI_STATEWIDE[slug].replace(" ", "_"),
                                     "name": nm})

    # ---- assemble + verify -------------------------------------------------------------------------
    council_inc = council_incumbents()
    for k, race in races.items():
        assemble(race, geo, holders, council_inc, wiki_cache)
    term_check(races, geo, disc)
    ids = {}
    for k, race in races.items():
        if race.id in ids:
            hard_errors.append("duplicate race id " + race.id)
        ids[race.id] = race
    compare_wbur(races, pd_all_names, disc)

    order = {"state": 0, "council": 1, "senate": 2, "house": 3, "da": 4, "rop": 5, "ctreas": 6, "ccomm": 7, "sheriff": 8}
    verified, omitted = [], []
    for k, race in sorted(races.items(), key=lambda kv: (order.get(kv[0][0], 9), str(kv[0][1]))):
        (omitted if (race.problems or not race.cands) else verified).append(race)
        for p in race.problems:
            disc(race.id, p)
        for p in race.infos:
            disc(race.id, "INFO " + p)

    out_races = []
    for race in verified:
        if race.key[0] == "da":
            for cg in sorted(da_counties.get(race.key[1], [])):
                out_races.append(expand_da(race, cg, geo, da_counties))
        else:
            out_races.append(race_record(race))
    seen = set()
    for r in out_races:
        if r["id"] in seen:
            hard_errors.append("duplicate output id " + r["id"])
        seen.add(r["id"])
    verify_geoids(out_races, geo, hard_errors)

    notes = build_notes(races, geo, split_names, bad, omitted, bool(args.sec_html))
    counts = build_counts(out_races, races, omitted, da_counties)
    omitted_list = []
    for r in omitted:
        omitted_list.append(OrderedDict([("id", r.id), ("office", r.office), ("districtName", r.district_name),
                                         ("reasons", r.problems or ["no candidates found"])]))
    meta = OrderedDict([
        ("generatedAt", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
        ("asOf", AS_OF), ("electionDate", ELECTION_DAY),
        ("sources", meta_sources(bool(args.sec_html))),
        ("counts", counts), ("notes", notes), ("omitted", omitted_list),
    ])
    write_js(meta, out_races)

    print_coverage(counts, omitted)
    print("\n== Discrepancy report (%d entries) ==" % len(discrepancies))
    for where, msg in discrepancies:
        print("  [%s] %s" % (where, msg))
    skipped = [(u, s) for u, s in FETCH_LOG.items() if s != "ok"]
    if skipped:
        print("\n== Pages skipped (error or bot challenge; never worked around) ==")
        for u, s in skipped:
            print("  %s  %s" % (s, u))
    print("\nWrote %s: %d races, %d candidates" % (OUT_PATH, len(out_races), sum(len(r["candidates"]) for r in out_races)))
    if hard_errors:
        print("\nHARD ERRORS:")
        for e in hard_errors:
            print("  " + e)
        sys.exit(1)


# ----------------------------------------------------------------------------
# Output helpers
# ----------------------------------------------------------------------------

def race_record(race, extra_id=None, scope=None):
    cands = sorted(race.cands, key=lambda c: sort_key(c["name"]))
    srcs = []
    for u in race.pd_urls:
        if u not in srcs:
            srcs.append(u)
    for c in cands:
        for u in c["urls"]:
            if u not in srcs:
                srcs.append(u)
    rec = OrderedDict([("id", extra_id or race.id), ("verified", True), ("office", race.office), ("kind", race.kind),
                       ("scope", scope if scope is not None else race.scope)])
    if race.district_name:
        rec["districtName"] = race.district_name
    rec["electionDate"] = ELECTION_DAY
    rec["term"] = race.term
    rec["candidates"] = [OrderedDict([("name", c["name"]), ("party", c["party"]), ("incumbent", bool(c["incumbent"]))]) for c in cands]
    rec["uncontested"] = len(cands) == 1
    rec["sources"] = srcs
    rec["verifiedOn"] = AS_OF
    rec["note"] = race.note
    return rec


def expand_da(race, county_geoid, geo, da_counties):
    """One District Attorney record per county the district covers (the app matches a 'county' stack entry)."""
    row = next(x for x in geo.counties if x["GEOID"] == county_geoid)
    rec = race_record(race, extra_id="ma-2026:district-attorney:%s:%s" % (race.key[1], slugify(row["NAME"])),
                      scope={"countyGeoid": county_geoid})
    covered = da_counties.get(race.key[1], [])
    if len(covered) > 1:
        names = [x["NAME"] for x in geo.counties if x["GEOID"] in set(covered)]
        extra = "%s covers %s; one record per county with identical candidates." % (race.district_name, ", ".join(names))
        rec["note"] = (race.note + " " if race.note else "") + extra
    return rec


def verify_geoids(out_races, geo, hard_errors):
    cg = set(x["GEOID"] for x in geo.counties)
    sg, hg, tg = set(geo.sen_by_geoid), set(geo.hou_by_geoid), set(geo.sub_by_geoid)
    for r in out_races:
        sc = r["scope"]
        if "geoid" in sc:
            ok = sc["geoid"] in (sg if r["kind"] == "senate" else hg)
        elif "countyGeoid" in sc:
            ok = sc["countyGeoid"] in cg
        elif "townGeoids" in sc:
            ok = all(g in tg for g in sc["townGeoids"] + sc["splitTownGeoids"]) and all(g in sg for g in sc["senateGeoids"])
        else:
            ok = sc == {"state": "MA"}
        if not ok:
            hard_errors.append("scope of %s has a geoid that does not exist in the live Census lists" % r["id"])


def meta_sources(with_sec):
    s = [
        PD_SEARCH_2026 + " (PD43+: Sept 1, 2026 primary results, Secretary of the Commonwealth)",
        BP_HOUSE, BP_SENATE, BR_URL, GLOBE_URL, BPL_URL,
        "https://en.wikipedia.org/wiki/2026_Massachusetts_elections (and the per-office 2026 pages, via the MediaWiki API)",
        WBUR_URL + " (compared only)",
        STATUTE_COUNCIL + " (G.L. c.57 s.2)", STATUTE_SENATE + " (G.L. c.57 s.3)",
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer (geoids, live)",
    ]
    s += ["%s (official municipal sample ballot, %s)" % (u, t) for t, u in SAMPLE_BALLOTS]
    s.append("Local news pages listed per race in `sources` (FIELDS and SUPPORT in scripts/export_ma_ballot.py)")
    if with_sec:
        s.append(SEC_URL + " (Secretary's certified candidate list, browser-saved copy supplied with --sec-html)")
    return s


def build_counts(out_races, races, omitted, da_counties):
    by = OrderedDict()

    def bump(office, field, n=1):
        by.setdefault(office, OrderedDict([("expectedRaces", 0), ("verifiedRaces", 0), ("omittedRaces", 0), ("candidates", 0)]))[field] += n
    for r in out_races:
        bump(r["office"], "verifiedRaces")
        bump(r["office"], "candidates", len(r["candidates"]))
    om = set(id(r) for r in omitted)
    for k, race in races.items():
        n = max(1, len(da_counties.get(k[1], []))) if k[0] == "da" else 1
        bump(race.office, "expectedRaces", n)
        if id(race) in om:
            bump(race.office, "omittedRaces", n)
    return OrderedDict([("races", len(out_races)), ("candidates", sum(len(r["candidates"]) for r in out_races)),
                        ("verifiedRaces", len(out_races)), ("byOffice", by)])


def print_coverage(counts, omitted):
    print("\n== Coverage (verified races written / expected) ==")
    for off, d in counts["byOffice"].items():
        print("  %-34s verified %3d / expected %3d   omitted %3d   candidates %4d" % (
            off, d["verifiedRaces"], d["expectedRaces"], d["omittedRaces"], d["candidates"]))
    print("  TOTAL: %d verified race records, %d candidates, %d omitted races" % (
        counts["verifiedRaces"], counts["candidates"], len(omitted)))
    if omitted:
        print("\n== Omitted races ==")
        for r in omitted:
            print("  %s (%s): %s" % (r.id, r.district_name or r.office, " | ".join(r.problems) or "no candidates found"))


def build_notes(races, geo, split_names, bad, omitted, with_sec):
    n = []
    n.append("Race records are written only when VERIFIED (see the script docstring): complete rosters must agree with each other and with the Sept 1 PD43+ primary winners, and every candidate needs two distinct sources. Races that fail are listed in MA_BALLOT_META.omitted with the reason; nothing is guessed.")
    n.append("Candidates are sorted alphabetically by last name; the printed ballot order is not published in advance and may differ. Write-in candidates are allowed in every race and are never listed. uncontested:true means exactly one name is known for the race.")
    n.append("Party labels: the printed ballot label (sample ballot%s) when available, otherwise Democratic/Republican from PD43+, otherwise BallotReady's code (I = Independent, U = Unenrolled). party:null means a non-party candidate whose ballot designation could not be confirmed (Ballotpedia prints 'Unenrolled' for all of them, which is not reliable)." % (" or the Secretary's list" if with_sec else ""))
    n.append("incumbent:true only where verified against data/officeholders.ma.generated.js, a sample ballot's 'Candidate for Re-election', or (Governor's Council) the Wikipedia council table plus the 2024 PD43+ general winner. For Register of Probate, County Treasurer and County Commissioner, incumbent:false means 'not verified as incumbent'.")
    n.append("District Attorney races are emitted once per county covered (scope.countyGeoid): Cape and Islands = Barnstable, Dukes and Nantucket; Northwestern = Franklin and Hampshire. Each county record repeats the same candidates.")
    n.append("Governor's Council: G.L. c.57 s.2 (Acts of 2021 ch.92) defines each district as a union of 5 whole senatorial districts and c.57 s.3 lists the municipalities of each senatorial district. townGeoids = municipalities fully inside the council district (including towns split only between senate districts of the same council district); splitTownGeoids = towns split between council districts; senateGeoids = the 5 senate districts, which identify the council district exactly from a point's 'senate' stack entry. Verified against live TIGERweb senate-district lookups for all %d municipalities (%d mismatches)." % (len(geo.subs), len(bad)))
    if split_names:
        n.append("Towns split between Governor's Council districts (listed in splitTownGeoids of every council district they touch): " + "; ".join(split_names) + ".")
    n.append("Special elections already held in 2026 (1st Middlesex Senate, March 3; 5th Essex House, March 31) are over; those seats are on the Nov 3 ballot as regular races.")
    n.append("Offices checked and NOT on the Nov 3, 2026 ballot (absent from the 2026 PD43+ results; last elected in the years shown by PD43+): Register of Deeds (2022/2024), Clerk of Courts (2024), Clerk of the Superior Court civil and criminal (2024), and every Sheriff except Franklin County (13 sheriffs were elected in 2022 for 6-year terms; Franklin County is a special election for the unexpired term ending January 2029). County Treasurer is on the ballot only in Bristol, Norfolk and Plymouth counties.")
    n.append("County Commissioner contests exist only in the few counties whose county government survives (Barnstable, Bristol, Dukes, Norfolk and Plymouth; the New Bedford Light notes most county governments were abolished in the late 1990s). PD43+ has no county-commissioner record, so each county needs two outside sources; the omitted list shows which succeeded. One contest can elect several people (Dukes County elects seven commissioners).")
    n.append("Regional or local bodies on the ballot that this export ignores: Barnstable Assembly of Delegates and Charter Study Commissioners, Martha's Vineyard Commission, Franklin Council of Governments executive committee.")
    n.append("Lieutenant Governor candidates run as tickets with the Governor (Healey/Driscoll, Minogue/Oliver, James/Kittredge), as printed on the sample ballots.")
    n.append("WBUR's Oct 14 guide says the Attorney General race is Andrea Campbell vs Republican 'Seth Aitken'. That is wrong: PD43+, both sample ballots, BallotReady, the Boston Globe, the Boston Public Library guide and Wikipedia all name Michael C. Walsh (Wikipedia's infobox 'Michael Walsh' is the same person). Seth Thomas Aitken is the Republican nominee for Bristol District Attorney (PD43+ election 172932). WBUR's list also omits independent Lieutenant Governor candidate Kayla Kittredge.")
    skipped = sorted(set(src_domain(u) for u, s in FETCH_LOG.items() if s != "ok"))
    n.append("Pages that answered with an error or a bot challenge were skipped, never worked around: " + (", ".join(skipped) or "none") + ".")
    n.append("Omitted races: %d (see MA_BALLOT_META.omitted)." % len(omitted))
    return n


def compare_wbur(races, pd_all_names, disc):
    raw = fetch(WBUR_URL)
    if raw is None:
        disc("WBUR", "guide unavailable")
        return
    text = block_text(raw)
    lines = {"lieutenant-governor": r"Lt\. Governor:(.*)", "attorney-general": r"Attorney General:(.*)",
             "treasurer": r"Treasurer:(.*)", "secretary-of-the-commonwealth": r"Secretary of the Commonwealth:(.*)",
             "state-auditor": r"Auditor:(.*)"}
    for slug, rx in lines.items():
        m = re.search(rx, text)
        race = races.get(("state", slug))
        if not m or race is None or not race.cands:
            continue
        ln = m.group(1)
        named = re.findall(r"(?:Republican|Libertarian|Democrat|independent|unenrolled)(?: challenger)?\s+((?:[A-Z][\w.'-]+ ?){2,3})", ln)
        for nm in named:
            nm = nm.strip()
            if not any(names_match(nm, c["name"]) for c in race.cands):
                hits = [x for x in pd_all_names if names_match(nm, x[0])]
                hits.sort(key=lambda x: not x[4])
                where = ""
                if hits:
                    a = hits[0]
                    where = " PD43+ shows %s only as the %s %s for %s %s." % (a[0], a[3], "nominee" if a[4] else "candidate", a[1], a[2])
                disc(race.id, "WBUR (Oct 14) names '%s', who is NOT in the verified field (%s).%s WBUR is wrong here." % (
                    nm, ", ".join(c["name"] for c in race.cands), where))
        for c in race.cands:
            if name_parts(c["name"])[1] not in ln.lower().replace("'", ""):
                disc(race.id, "WBUR line omits verified candidate %s (%s)" % (c["name"], c["party"]))


def write_js(meta, races):
    def dump(o):
        s = json.dumps(o, indent=2, ensure_ascii=False)
        return s.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    txt = ("// GENERATED by scripts/export_ma_ballot.py. DO NOT EDIT BY HAND.\n"
           "// Massachusetts Nov 3, 2026 general election: verified races below Governor / U.S. Senate / U.S. House.\n"
           "// Races are written only when verified; see MA_BALLOT_META.notes and .omitted. As of %s.\n"
           "export const MA_BALLOT_META = %s;\n\n"
           "export const MA_BALLOT_RACES = %s;\n") % (AS_OF, dump(meta), dump(races))
    OUT_PATH.write_text(txt, encoding="utf-8")


if __name__ == "__main__":
    main()

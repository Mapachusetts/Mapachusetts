#!/usr/bin/env python3
"""
Build a dataset of who CURRENTLY HOLDS national and statewide executive/Senate
offices (whether or not the seat is on the Nov 3, 2026 ballot):

    * the President           (1)
    * the Vice President      (1)
    * every U.S. Senator      (100: both seats of all 50 states)
    * every state Governor    (50)

Nothing else is in scope (no lieutenant governors, House members, DC or
territories).

Output (pure ES module, safe to import in the browser):
    data/officeholders.generated.js
        export const OFFICEHOLDERS_META = { generatedAt, asOf, sources, counts, notes };
        export const OFFICEHOLDERS = [ { id, layer, match, office, name, party,
            termStart, termEnd, nextElection, onBallot2026, seat, [special],
            appointed, photo, url, sources }, ... ];

Run:
    python3 scripts/export_officeholders.py            # uses /tmp caches when present
    python3 scripts/export_officeholders.py --refresh  # re-download / re-clone everything
    python3 scripts/export_officeholders.py --no-link-checks   # skip the HTTP checks of photo/url links

Python 3.9 standard library only (plus the system `git` binary for the sparse
Open States clone). No API keys. Caches live under
/tmp/mapachusetts-officeholders-cache/ .

SOURCES
  * https://unitedstates.github.io/congress-legislators/executive.json
        President / Vice President terms.
  * https://unitedstates.github.io/congress-legislators/legislators-current.json
        Senators (term start/end, class, party, bioguide id, how = appointment).
  * https://www.senate.gov/general/contact_information/senators_cfm.xml
        Official Senate roster. Used as an independent check of the senate
        delegation of every state (member, state, class, party, bioguide id)
        and as the preferred source of each senator's official website.
  * Open States people repo (CC0), data/<st>/executive/*.yml, sparse clone
        into the cache dir (its own clone, never shared with other jobs).
        Governors: role start/end dates, party, image, official link.
  * Wikipedia (CC BY-SA 4.0) via the MediaWiki parse API:
        "List of current United States senators", "List of current United
        States governors", the President / Vice President infoboxes, and the
        2027 KY / LA / MS gubernatorial election pages. These are second,
        independent sources for the identity checks, and the fallback source
        for a governor if Open States has no active governor role.
  * data/nominees.generated.js (read only) for the 2026 Senate and Governor
        races, used to cross-check onBallot2026 / nextElection / special.
  * Louisiana Secretary of State 2027 election calendar (verified by hand,
        see LA_2027_NOTE): gubernatorial primary 2027-10-09, general 2027-11-20.

METHOD
  1. President / Vice President: the executive.json person whose last term
     contains today's date. Portraits: Wikipedia page image (a Wikimedia
     Commons official portrait), checked for HTTP 200.
  2. Senators: legislators-current.json entries whose last term is "sen".
     termStart/termEnd = start/end of that last term entry; appointed is true
     when the term's `how` is "appointment" (a senator who was appointed and
     later won the seat in a special election is `appointed: false`).
     party "Democrat" is normalised to "Democratic".
  3. Governors: for every state the Open States executive file with a
     `governor` role active today (start <= today <= end). If a state has no
     such file, or the role has expired, the Wikipedia list is the fallback
     (and this is reported in the notes). termEnd = role end_date.
     termStart = role start_date ONLY when it is the start of the current
     term (role length is at most one term + ~100 days). When Open States
     merges consecutive terms of a re-elected governor into one role (for
     example start 2019, end 2027) the start of the CURRENT term is not
     known, so termStart is null and the governor is listed in the notes.
     appointed is true iff the governor took office after the most recent
     regular election plus a 90 day inauguration window, i.e. succeeded
     mid-term and has not yet faced the voters.
  4. Next election / ballot flags come from the explicit state groups below
     (2026 group = states that have a governor race in nominees.generated.js)
     and are cross-checked against the term end dates and Wikipedia. The
     Senate class decides senators: Class 2 -> 2026-11-03, Class 3 ->
     2028-11-07, Class 1 -> 2030-11-05, except the Class 3 special-election
     seats (OH, FL) which are on the 2026 ballot.
  5. Photos / links are fetched (HEAD, then ranged GET) with a browser-like
     User-Agent. Senators: the first verified 200 of (a) the @unitedstates
     mirror of the official Bioguide portrait, (b) the Wikipedia portrait,
     else (c) the standard congress.gov member-image URL, which sits behind a
     Cloudflare challenge and cannot be verified from a script (reported).

VERIFICATION CHECKS (printed as a summary; exit code 1 if the counts are
not exactly 1 / 1 / 100 / 50, in which case no file is written)
  * counts: 1 President, 1 Vice President, 100 senators (2 per state, one
    Class each), 50 governors.
  * senate.gov XML vs congress-legislators: same 100 bioguide ids, same
    state, class and party for each.
  * Wikipedia senators list vs congress-legislators: same people per state
    and the same class; Wikipedia's appointees (post-2025) vs `how`.
  * Wikipedia governors list vs Open States: same person per state, same
    party, start date, and end year consistent with the Open States end date.
  * President / Vice President vs the Wikipedia infoboxes.
  * Next-election groups: disjoint, cover 50 states, the 2026 group equals the
    states with a governor race in nominees.generated.js and agrees with the
    Open States end dates; Senate on-ballot seats vs nominees.generated.js
    (one seat per race state, special flags, incumbent names).
  * KY / LA / MS 2027 election dates vs the Wikipedia infoboxes.
Every disagreement is printed; those that change the output are recorded in
OFFICEHOLDERS_META.notes together with how they were resolved.
"""
import json
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "officeholders.generated.js"
NOMINEES_JS = ROOT / "data" / "nominees.generated.js"
CACHE = Path("/tmp/mapachusetts-officeholders-cache")
OS_CLONE = CACHE / "openstates-people"

ARGS = set(sys.argv[1:])
REFRESH = "--refresh" in ARGS
LINK_CHECKS = "--no-link-checks" not in ARGS

BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
              "(KHTML, like Gecko) Version/17.0 Safari/605.1.15")
API_UA = "mapachusetts-civic/1.0 (https://github.com/Mapachusetts/Mapachusetts)"

URL_EXEC = "https://unitedstates.github.io/congress-legislators/executive.json"
URL_LEG = "https://unitedstates.github.io/congress-legislators/legislators-current.json"
URL_SENATE_XML = "https://www.senate.gov/general/contact_information/senators_cfm.xml"
URL_OS_REPO = "https://github.com/openstates/people"
URL_WIKI_SEN = "https://en.wikipedia.org/wiki/List_of_current_United_States_senators"
URL_WIKI_GOV = "https://en.wikipedia.org/wiki/List_of_current_United_States_governors"
URL_LA_CAL = "https://www.sos.la.gov/media/byfpyc5f/elections-calendar-2027.pdf"
WIKI_API = "https://en.wikipedia.org/w/api.php"
MIRROR_PHOTO = "https://unitedstates.github.io/images/congress/225x275/{bio}.jpg"
CONGRESS_PHOTO = "https://www.congress.gov/img/member/{bio}_200.jpg"
OS_BLOB = "https://github.com/openstates/people/blob/main/data/{st}/executive/{fn}"

ELECTION_2026 = "2026-11-03"
STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY",
]
STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire",
    "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
    "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee",
    "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}
NAME_TO_ST = {v: k for k, v in STATE_NAMES.items()}

# Governor election groups other than the 2026 group (which comes from
# nominees.generated.js). Source: the task brief, cross-checked at run time
# against Open States end dates and Wikipedia.
GOV_2025 = {"NJ", "VA"}
GOV_2027 = {"KY", "LA", "MS"}
GOV_2028 = {"DE", "IN", "MO", "MT", "NC", "ND", "UT", "WA", "WV"}
TWO_YEAR_TERM = {"NH", "VT"}
# Most recent regular gubernatorial election date per group (for `appointed`).
LAST_ELECTION = {
    "2026": date(2022, 11, 8),
    "2026-2yr": date(2024, 11, 5),
    "2025": date(2025, 11, 4),
    "2027-KY-MS": date(2023, 11, 7),
    "2027-LA": date(2023, 10, 14),
    "2028": date(2024, 11, 5),
}
# Louisiana's 2027 calendar, read from URL_LA_CAL (Revised 10/2026): the
# gubernatorial primary is 2027-10-09 and the general 2027-11-20 (dates are
# subject to change by the legislature).
LA_2027_NOTE = ("Louisiana governor: nextElection is the first-round date 2027-10-09 "
                "(general/runoff 2027-11-20) per the Louisiana Secretary of State 2027 "
                "calendar (" + URL_LA_CAL + "); the calendar says dates are subject to "
                "change by the legislature.")

NOTES = []          # recorded in META.notes
DISAGREEMENTS = []  # printed in the summary
UNVERIFIED = []     # holders whose photo / dates are unverified
APPOINTEES = []


def today():
    return datetime.now().date()


TODAY = today()


def note(msg):
    if msg not in NOTES:
        NOTES.append(msg)


def disagree(msg):
    DISAGREEMENTS.append(msg)
    print("  DISAGREEMENT: " + msg)


# ---------------------------------------------------------------------------
# Networking / caching


# ---------------------------------------------------------------------------


def http_get(url, ua=BROWSER_UA, timeout=60, tries=3):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # pragma: no cover - network flakiness
            last = exc
    raise RuntimeError("GET failed for " + url + ": " + str(last))


def cached(name, url, ua=BROWSER_UA):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if REFRESH or not path.exists():
        print("  fetching " + url)
        path.write_bytes(http_get(url, ua=ua))
    return path.read_text(encoding="utf-8")


def wiki_wikitext(page, section=None):
    key = re.sub(r"[^A-Za-z0-9]+", "_", page) + ("_s" + str(section) if section is not None else "")
    params = {"action": "parse", "page": page, "prop": "wikitext", "format": "json",
              "formatversion": "2", "redirects": "1"}
    if section is not None:
        params["section"] = str(section)
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    data = json.loads(cached("wiki_" + key + ".json", url, ua=API_UA))
    if "error" in data:
        raise RuntimeError("Wikipedia error for " + page + ": " + str(data["error"]))
    return data["parse"]["wikitext"]


def wiki_page_image(title):
    url = WIKI_API + "?" + urllib.parse.urlencode({
        "action": "query", "titles": title, "prop": "pageimages", "piprop": "name",
        "format": "json", "formatversion": "2", "redirects": "1"})
    data = json.loads(cached("wikipage_" + re.sub(r"[^A-Za-z0-9]+", "_", title) + ".json", url, ua=API_UA))
    pages = data.get("query", {}).get("pages", [])
    return pages[0].get("pageimage") if pages else None


def wikipedia_file_url(filename, width=300):
    """en.wikipedia Special:FilePath resolves both local and Commons files."""
    fn = filename.strip().replace(" ", "_")
    return "https://en.wikipedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn, safe="()_.,-'") \
        + "?width=" + str(width)


def commons_url(filename, width=400):
    fn = filename.strip().replace(" ", "_")
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn, safe="()_.,-'") \
        + "?width=" + str(width)


def ensure_openstates():
    """Own sparse clone of the Open States people repo (executive dirs only)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    if REFRESH and OS_CLONE.exists():
        shutil.rmtree(OS_CLONE)
    if not OS_CLONE.exists():
        print("  cloning " + URL_OS_REPO + " (sparse)")
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse",
                        URL_OS_REPO + ".git", str(OS_CLONE)], check=True)
    subprocess.run(["git", "-C", str(OS_CLONE), "sparse-checkout", "set", "--no-cone",
                    "/data/*/executive/"], check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    head = subprocess.run(["git", "-C", str(OS_CLONE), "log", "-1", "--format=%cs"],
                          capture_output=True, text=True).stdout.strip()
    return head


# ---------------------------------------------------------------------------
# Small helpers


# ---------------------------------------------------------------------------


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s.replace("-", " "))
    toks = [t for t in s.split() if t not in ("jr", "sr", "ii", "iii", "iv")]
    return " ".join(toks)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")


def parse_date(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    s = str(s).strip().strip("'\"")
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def election_day(year):
    """First Tuesday after the first Monday in November."""
    d = date(year, 11, 1)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d + timedelta(days=1)


def fix_party(p):
    if p is None:
        return None
    p = str(p).strip()
    if p == "Democrat":
        return "Democratic"
    if p in ("Democratic-Farmer-Labor", "Democratic-Farmer-Labor Party"):
        note("Minnesota's Democratic-Farmer-Labor (DFL) party is reported as \"Democratic\" "
             "(Minnesota's affiliate of the Democratic Party).")
        return "Democratic"
    return p or None


def to_https(u):
    if not u:
        return None
    u = u.strip()
    if u.startswith("http://"):
        u = "https://" + u[len("http://"):]
    return u


# ---------------------------------------------------------------------------
# Minimal YAML reader (Open States executive files)


# ---------------------------------------------------------------------------


def _scalar(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
        q = v[0]
        v = v[1:-1]
        if q == "'":
            v = v.replace("''", "'")
    return v


def parse_yaml(text):
    """Return a dict. Handles top-level scalars, lists of flat dicts or scalars
    and one-level dicts; deeper nesting is ignored (not needed here)."""
    lines = [ln.rstrip("\n") for ln in text.splitlines()
             if ln.strip() and not ln.lstrip().startswith("#")]
    out = {}
    i = 0
    top = re.compile(r"^([A-Za-z_][\w ]*):(?:\s+(.*))?$")
    while i < len(lines):
        m = top.match(lines[i])
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2)
        i += 1
        if val is not None and val.strip() != "":
            out[key] = _scalar(val)
            continue
        block = []
        while i < len(lines) and not top.match(lines[i]):
            block.append(lines[i])
            i += 1
        if not block:
            out[key] = None
        elif block[0].lstrip().startswith("- ") or block[0].strip() == "-":
            items = []
            for ln in block:
                stripped = ln.strip()
                indent = len(ln) - len(ln.lstrip())
                if stripped.startswith("- ") and indent == len(block[0]) - len(block[0].lstrip()):
                    rest = stripped[2:]
                    km = re.match(r"^([A-Za-z_][\w ]*):(?:\s+(.*))?$", rest)
                    if km:
                        items.append({km.group(1): _scalar(km.group(2) or "")})
                    else:
                        items.append(_scalar(rest))
                elif items and isinstance(items[-1], dict):
                    km = re.match(r"^([A-Za-z_][\w ]*):(?:\s+(.*))?$", stripped)
                    if km and indent <= len(block[0]) - len(block[0].lstrip()) + 2:
                        items[-1][km.group(1)] = _scalar(km.group(2) or "")
            out[key] = items
        else:
            d = {}
            for ln in block:
                km = re.match(r"^\s+([A-Za-z_][\w ]*):(?:\s+(.*))?$", ln)
                if km:
                    d[km.group(1)] = _scalar(km.group(2) or "")
            out[key] = d
    return out


# ---------------------------------------------------------------------------
# Wikipedia parsers


# ---------------------------------------------------------------------------


def _sortname(row):
    m = re.search(r"\{\{sortname\|([^|}]*)\|([^|}]*)", row)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # plain wiki link in the name cell: ! scope="row" | [[Jeff Landry]]
    m = re.search(r'!\s*scope="row"\s*\|\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', row)
    if m:
        full = re.sub(r"\s*\(.*?\)", "", m.group(2) or m.group(1)).strip()
        parts = full.rsplit(" ", 1)
        return (parts[0], parts[1]) if len(parts) == 2 else ("", full)
    return None


def _party_link(row):
    m = re.search(r"\[\[[^\]|]*\|(Republican|Democratic|Independent)\]\]", row)
    return m.group(1) if m else None


def parse_wiki_senators(wt):
    start = wt.index("==List of senators==")
    end = wt.index("\n==See also==", start)
    rows = re.split(r"\n\|-[^\n]*\n", wt[start:end])
    cur = None
    out = []
    for row in rows:
        sm = re.search(r"\[\[List of United States senators from ([^|\]]+)\|", row)
        if sm:
            cur = NAME_TO_ST.get(sm.group(1).strip())
        nm = _sortname(row)
        if not nm:
            continue
        cls = re.search(r"Class (\d)", row)
        dm = re.search(r'data-sort-value="(\d{4})/(\d\d)/(\d\d)"', row)
        fm = re.search(r"\[\[File:([^|\]]+)", row)
        efn = " ".join(re.findall(r"\{\{efn\|(.*?)\}\}", row, re.S))
        out.append({
            "state": cur, "first": nm[0], "last": nm[1],
            "party": _party_link(row),
            "cls": int(cls.group(1)) if cls else None,
            "assumed": date(int(dm.group(1)), int(dm.group(2)), int(dm.group(3))) if dm else None,
            "file": fm.group(1).strip() if fm else None,
            "efn": efn,
        })
    return out


def _wiki_date(cell):
    m = re.search(r"\{\{dts\|(\d{4})\|(\d{1,2})\|(\d{1,2})", cell)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.search(r"\{\{dts\|([A-Za-z]+ \d{1,2}, \d{4})", cell)
    if m:
        try:
            return datetime.strptime(m.group(1), "%B %d, %Y").date()
        except ValueError:
            return None
    m = re.search(r"([A-Z][a-z]+ \d{1,2}, \d{4})", cell)
    if m:
        try:
            return datetime.strptime(m.group(1), "%B %d, %Y").date()
        except ValueError:
            return None
    return None


def parse_wiki_governors(wt):
    start = wt.index("==State governors==")
    end = wt.index("==Territory governors==", start)
    rows = re.split(r"\n\|-[^\n]*\n", wt[start:end])
    out = []
    for row in rows:
        sm = re.search(r"\[\[Governor of ([^|\]]+)\|", row)
        nm = _sortname(row)
        if not sm or not nm:
            continue
        st = NAME_TO_ST.get(sm.group(1).strip())
        lines = row.split("\n")
        party = None
        for k, ln in enumerate(lines):
            if "party color" in ln and k + 1 < len(lines):
                pm = re.search(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", lines[k + 1])
                party = pm.group(1).strip() if pm else None
                break
        tstart = None
        endyear = None
        for k, ln in enumerate(lines):
            if "dts|" in ln and tstart is None:
                tstart = _wiki_date(ln)
                if k + 1 < len(lines):
                    ym = re.search(r"(\d{4})", lines[k + 1])
                    endyear = int(ym.group(1)) if ym else None
                break
        fm = re.search(r"\[\[File:([^|\]]+)", row)
        out.append({"state": st, "first": nm[0], "last": nm[1], "party": party,
                    "start": tstart, "endyear": endyear,
                    "file": fm.group(1).strip() if fm else None})
    return out


def parse_nominees():
    t = NOMINEES_JS.read_text(encoding="utf-8")
    i = t.index("export const NOMINEES = ") + len("export const NOMINEES = ")
    nxt = t.find("\nexport", i)
    body = t[i:nxt if nxt != -1 else len(t)].strip().rstrip(";")
    return json.loads(body)


# ---------------------------------------------------------------------------
# Link checking


# ---------------------------------------------------------------------------

WIKIMEDIA_HOSTS = ("wikimedia.org", "wikipedia.org")


def is_wikimedia(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    return any(host == h or host.endswith("." + h) for h in WIKIMEDIA_HOSTS)


def check_url(url, want_image=False):
    """Return (status, ok). status is an int HTTP code or a short error string.
    HEAD first, then a ranged GET. 429 (rate limited) is retried with backoff."""
    ua = API_UA if is_wikimedia(url) else BROWSER_UA
    status = "error"
    for method in ("HEAD", "GET"):
        for attempt in range(5):
            try:
                headers = {"User-Agent": ua, "Accept": "image/*,*/*;q=0.8"}
                if method == "GET":
                    headers["Range"] = "bytes=0-1023"
                req = urllib.request.Request(url, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=25) as resp:
                    code = resp.getcode()
                    ctype = resp.headers.get("Content-Type", "")
                    if code in (200, 206):
                        if want_image and not ctype.lower().startswith("image/"):
                            return code, False
                        return code, True
                    status = code
                    break
            except urllib.error.HTTPError as exc:
                status = exc.code
                if exc.code == 429 or exc.code >= 500:
                    time.sleep(2 * (attempt + 1))
                    continue
                break
            except Exception as exc:
                status = type(exc).__name__
                break
        if method == "HEAD" and status in (403, 405, 400, 501, 429) or \
                (method == "HEAD" and not isinstance(status, int)):
            continue
        if method == "HEAD" and isinstance(status, int) and status not in (200, 206):
            # definitive (404 etc.) answers do not need a GET
            if status in (404, 410):
                return status, False
    return status, False


TRANSIENT = ("URLError", "timeout", "TimeoutError", "error", "RemoteDisconnected")


def run_checks(urls):
    """urls: dict url -> want_image. Returns dict url -> (status, ok); cached.
    Transient failures (429 / 5xx / network errors) are never cached."""
    cache_path = CACHE / "linkcheck.json"
    store = {}
    if cache_path.exists() and not REFRESH:
        try:
            store = json.loads(cache_path.read_text())
        except ValueError:
            store = {}
    todo = [u for u in urls if u not in store]
    if todo and LINK_CHECKS:
        print("  checking " + str(len(todo)) + " links")
        wm = [u for u in todo if is_wikimedia(u)]
        other = [u for u in todo if not is_wikimedia(u)]
        for group, workers in ((other, 12), (wm, 2)):
            if not group:
                continue
            with ThreadPoolExecutor(max_workers=workers) as ex:
                for u, res in zip(group, ex.map(lambda x: check_url(x, urls[x]), group)):
                    transient = (res[0] == 429 or (isinstance(res[0], int) and res[0] >= 500)
                                 or (isinstance(res[0], str)))
                    store[u] = [res[0], res[1], bool(transient)]
        CACHE.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps({u: v for u, v in store.items() if not (len(v) > 2 and v[2] and not v[1])}))
    return {u: (tuple(store[u][:2]) if u in store else ("unchecked", None)) for u in urls}


# ---------------------------------------------------------------------------
# Main build


# ---------------------------------------------------------------------------


def load_sources():
    print("Loading sources")
    ex = json.loads(cached("executive.json", URL_EXEC))
    leg = json.loads(cached("legislators-current.json", URL_LEG))
    xml_text = cached("senators_cfm.xml", URL_SENATE_XML)
    if "<contact_information>" not in xml_text:
        raise RuntimeError("senate.gov roster XML did not load (got an error page): " + URL_SENATE_XML)
    xml_root = ET.fromstring(xml_text.encode("utf-8"))
    wiki_sen = parse_wiki_senators(wiki_wikitext("List of current United States senators"))
    wiki_gov = parse_wiki_governors(wiki_wikitext("List of current United States governors"))
    os_head = ensure_openstates()
    nominees = parse_nominees()
    return ex, leg, xml_root, wiki_sen, wiki_gov, os_head, nominees


def exec_holders(ex):
    cur = {"prez": [], "viceprez": []}
    for p in ex:
        t = p["terms"][-1]
        s, e = parse_date(t["start"]), parse_date(t["end"])
        if t["type"] in cur and s and e and s <= TODAY < e:
            cur[t["type"]].append((p, t))
    return cur


def display_name(p):
    n = p["name"]
    return n.get("official_full") or (n.get("first", "") + " " + n.get("last", "")).strip()


def build_exec(ex, photo_files):
    holders = []
    cur = exec_holders(ex)
    spec = [("prez", "president", "President of the United States",
             "https://www.whitehouse.gov/administration/donald-j-trump/", "President_of_the_United_States"),
            ("viceprez", "vice-president", "Vice President of the United States",
             "https://www.whitehouse.gov/administration/jd-vance/", "Vice_President_of_the_United_States")]
    for typ, hid, office, url, wpage in spec:
        for p, t in cur[typ]:
            nm = display_name(p)
            # Whitehouse.gov bio URLs are static for the incumbent pair; checked below.
            holders.append({
                "id": hid, "layer": "country", "match": {}, "office": office, "name": nm,
                "party": fix_party(t.get("party")),
                "termStart": t["start"], "termEnd": t["end"],
                "nextElection": str(election_day(2028)), "onBallot2026": False,
                "seat": None, "appointed": False,
                "photo": photo_files.get(hid), "url": url,
                "sources": [URL_EXEC, "https://en.wikipedia.org/wiki/" + wpage],
            })
    return holders, cur


def check_exec_wikipedia(cur):
    for typ, page, label in (("prez", "President of the United States", "President"),
                             ("viceprez", "Vice President of the United States", "Vice President")):
        wt = wiki_wikitext(page, section=0)
        m = re.search(r"\|\s*incumbent\s*=\s*\[\[([^\]|]+)", wt)
        wname = m.group(1) if m else None
        for p, _ in cur[typ]:
            ours = norm(display_name(p))
            if wname and norm(re.sub(r"\(.*?\)", "", wname)).replace("jd ", "j d ") != ours \
                    and norm(wname) != ours and norm(wname).replace(" ", "") != ours.replace(" ", ""):
                disagree(label + ": congress-legislators says '" + display_name(p)
                         + "', Wikipedia infobox says '" + str(wname) + "'")


def senator_holders(leg, xml_root, wiki_sen, nominees):
    sens = [p for p in leg if p["terms"][-1]["type"] == "sen"]
    xml_by_bio = {}
    for mem in xml_root.findall("member"):
        row = {c.tag: (c.text or "").strip() for c in mem}
        xml_by_bio[row.get("bioguide_id", "")] = row
    roman = {"Class I": 1, "Class II": 2, "Class III": 3}
    party_map = {"D": "Democratic", "R": "Republican", "ID": "Independent", "I": "Independent"}

    # --- senate.gov XML vs congress-legislators -----------------------------
    jb = {p["id"]["bioguide"]: p for p in sens}
    only_json = sorted(set(jb) - set(xml_by_bio))
    only_xml = sorted(set(xml_by_bio) - set(jb))
    if only_json or only_xml:
        disagree("senate.gov roster vs congress-legislators: only in legislators: "
                 + str(only_json) + "; only in senate.gov: " + str(only_xml))
    drop = set()
    for bio in set(jb) & set(xml_by_bio):
        t = jb[bio]["terms"][-1]
        x = xml_by_bio[bio]
        if x.get("state") != t["state"] or roman.get(x.get("class")) != t["class"] \
                or party_map.get(x.get("party"), x.get("party")) != fix_party(t["party"]) \
                and not (x.get("party") in ("I", "ID") and t["party"] == "Independent"):
            disagree("senator " + display_name(jb[bio]) + " (" + bio + "): legislators says "
                     + t["state"] + " class " + str(t["class"]) + " " + t["party"]
                     + "; senate.gov says " + str(x.get("state")) + " " + str(x.get("class"))
                     + " " + str(x.get("party")))
            drop.add(bio)
    if drop:
        # senate.gov is the official roster: exclude records that disagree and
        # report them (nothing is guessed).
        sens = [p for p in sens if p["id"]["bioguide"] not in drop]
        note("Excluded senators whose state/class/party disagreed between congress-legislators and "
             "senate.gov: " + ", ".join(sorted(drop)))

    # --- Wikipedia cross-check ---------------------------------------------
    wk = {}
    for w in wiki_sen:
        wk.setdefault(w["state"], []).append(w)
    for st in STATES:
        ours = [p for p in sens if p["terms"][-1]["state"] == st]
        theirs = wk.get(st, [])
        our_keys = sorted((p["terms"][-1]["class"], norm(display_name(p) + " " + p["name"]["last"])) for p in ours)
        for w in theirs:
            hit = [p for p in ours if p["terms"][-1]["class"] == w["cls"]
                   and norm(w["last"]) in norm(display_name(p) + " " + p["name"]["last"]).split(" ")
                   + [norm(display_name(p) + " " + p["name"]["last"])]
                   or (p["terms"][-1]["class"] == w["cls"]
                       and norm(w["last"]) in norm(display_name(p) + " " + p["name"]["last"]))]
            if not hit:
                disagree("Wikipedia lists " + w["first"] + " " + w["last"] + " (" + st + ", class "
                         + str(w["cls"]) + ") but congress-legislators has "
                         + str([display_name(p) + " class " + str(p["terms"][-1]["class"]) for p in ours]))
        if len(theirs) != 2:
            disagree("Wikipedia senators list has " + str(len(theirs)) + " rows for " + st)
        # party check
        for w in theirs:
            for p in ours:
                if p["terms"][-1]["class"] == w["cls"] and norm(w["last"]) in norm(display_name(p) + " " + p["name"]["last"]):
                    if w["party"] and fix_party(p["terms"][-1]["party"]) != w["party"]:
                        disagree(st + " " + w["last"] + ": party " + str(p["terms"][-1]["party"])
                                 + " vs Wikipedia " + w["party"])
    wiki_appointed = sorted((w["state"], w["last"]) for w in wiki_sen
                            if (w["assumed"] is None or w["assumed"] >= date(2024, 11, 1))
                            and re.match(r"\s*(Appointed|Took office following)", w["efn"]))
    json_appointed = sorted((p["terms"][-1]["state"], p["name"]["last"]) for p in sens
                            if p["terms"][-1].get("how") == "appointment")
    print("  appointees  congress-legislators: " + str(json_appointed))
    print("  appointees  Wikipedia (since Nov 2024, footnote says appointed): " + str(wiki_appointed))
    wl = {(s, norm(l).split(" ")[0]) for s, l in wiki_appointed}
    jl = {(s, norm(l).split(" ")[0]) for s, l in json_appointed}
    if wl != jl:
        disagree("Senate appointees differ: congress-legislators " + str(json_appointed)
                 + " vs Wikipedia footnotes " + str(wiki_appointed))

    # --- mid-term start dates vs each person's own Wikipedia article ---------
    for p in sens:
        t = p["terms"][-1]
        if t["start"][5:] in ("01-03", "01-20") and not t.get("how"):
            continue
        title = p["id"].get("wikipedia") or display_name(p)
        try:
            wt = wiki_wikitext(title, section=0)
        except Exception as exc:
            note("Could not load Wikipedia article '" + title + "' to verify the start date: " + str(exc))
            continue
        found = set()
        for m in re.finditer(r"term_start\s*=\s*([^\n]+)", wt):
            v = m.group(1)
            d = _wiki_date(v.replace("{{Start date", "{{dts").replace("{{start date", "{{dts"))
            if d:
                found.add(d.isoformat())
        d0 = datetime.strptime(t["start"], "%Y-%m-%d")
        spelled = d0.strftime("%B ") + str(d0.day) + d0.strftime(", %Y")
        numeric = "|" + str(d0.year) + "|" + str(d0.month) + "|" + str(d0.day)
        if t["start"] in found or spelled in wt or numeric in wt:
            print("  start date confirmed by Wikipedia article: " + display_name(p) + " " + t["start"])
        elif t.get("how") == "special-election" and any(f < t["start"] for f in found):
            note(display_name(p) + " (" + t["state"] + "): congress-legislators starts the current (elected) "
                 "term on " + t["start"] + " after a special election; the Wikipedia infobox shows the earlier "
                 "appointment date " + ", ".join(sorted(found)) + ". The elected-term date is kept.")
        else:
            disagree("senator " + display_name(p) + " (" + t["state"] + "): term start " + t["start"]
                     + " (congress-legislators) not found in the Wikipedia article "
                     "infobox term_start values " + str(sorted(found)))
    # --- ballot / special flags from nominees.generated.js ------------------
    race_states = {v["state"]: v for k, v in nominees.items() if k.startswith("senate:")}
    holders = []
    for p in sens:
        t = p["terms"][-1]
        st, cls = t["state"], t["class"]
        bio = p["id"]["bioguide"]
        x = xml_by_bio.get(bio, {})
        special = bool(race_states.get(st, {}).get("special")) and cls == 3
        regular_ballot = cls == 2
        on_ballot = special or regular_ballot
        if on_ballot:
            nxt = ELECTION_2026
        elif cls == 3:
            nxt = str(election_day(2028))
        else:
            nxt = str(election_day(2030))
        nm = display_name(p)
        url = to_https(x.get("website")) or to_https(t.get("url"))
        holders.append({
            "id": "senate:" + st + ":" + slug(p["name"]["last"] + " " + p["name"]["first"]),
            "layer": "state", "match": {"state": st}, "office": "U.S. Senator", "name": nm,
            "party": fix_party(t.get("party")),
            "termStart": t["start"], "termEnd": t["end"],
            "nextElection": nxt, "onBallot2026": on_ballot,
            "seat": "Class " + str(cls), "special": special,
            "appointed": t.get("how") == "appointment",
            "photo": None, "url": url,
            "sources": [URL_LEG, URL_SENATE_XML, URL_WIKI_SEN],
            "_bio": bio, "_wikifile": None,
        })
    # Wikipedia portrait filenames (fallback photo)
    for h in holders:
        st = h["match"]["state"]
        for w in wk.get(st, []):
            if w["cls"] is not None and "Class " + str(w["cls"]) == h["seat"] \
                    and norm(w["last"]) in norm(h["name"] + " " + h["id"]):
                h["_wikifile"] = w["file"]
    # ballot cross-check vs nominees: a state has a Senate seat on the 2026 ballot iff a race exists,
    # and exactly one of its seats is on the ballot.
    for st in STATES:
        n_on = sum(1 for h in holders if h["match"]["state"] == st and h["onBallot2026"])
        if n_on != (1 if st in race_states else 0):
            disagree("Senate " + st + ": " + str(n_on) + " seat(s) on the ballot by class rule, "
                     "nominees.generated.js has race=" + str(st in race_states))
        if st in race_states:
            sp = [h for h in holders if h["match"]["state"] == st and h["onBallot2026"]]
            if sp and bool(race_states[st].get("special")) != bool(sp[0].get("special")):
                disagree("Senate " + st + ": special flag differs from nominees.generated.js")
    # incumbent cross-check vs nominees
    for st, race in sorted(race_states.items()):
        on = [h for h in holders if h["match"]["state"] == st and h["onBallot2026"]]
        if len(on) != 1:
            disagree("Senate race " + st + ": expected exactly 1 on-ballot seat, found " + str(len(on)))
            continue
        incs = [c["name"] for c in race["candidates"] if c.get("incumbent")]
        if incs and norm(incs[0]).split(" ")[-1] not in norm(on[0]["name"]).split(" ") \
                and norm(incs[0]) != norm(on[0]["name"]):
            disagree("Senate race " + st + ": nominees.generated.js incumbent '" + incs[0]
                     + "' != current holder of that seat '" + on[0]["name"] + "'")
    return holders


def governor_holders(wiki_gov, nominees, os_head):
    # election groups
    gov_2026 = {v["state"] for k, v in nominees.items() if k.startswith("governor:")}
    groups = [gov_2026, GOV_2025, GOV_2027, GOV_2028]
    union = set().union(*groups)
    if sum(len(g) for g in groups) != len(union) or union != set(STATES):
        disagree("governor election groups are not a disjoint cover of 50 states: missing "
                 + str(sorted(set(STATES) - union)) + " extra/duplicates "
                 + str(sum(len(g) for g in groups) - len(union)))
    if len(gov_2026) != 36:
        disagree("nominees.generated.js has " + str(len(gov_2026)) + " governor races (expected 36)")

    wg = {w["state"]: w for w in wiki_gov}
    if len(wg) != 50:
        disagree("Wikipedia governors list has " + str(len(wg)) + " states (expected 50)")

    holders = []
    fallbacks = []
    merged = []
    ltgov_diff = []
    for st in STATES:
        # find active governor role in Open States
        cands = []
        chain = {}
        lt_end = {}
        d = OS_CLONE / "data" / st.lower() / "executive"
        for f in sorted(d.glob("*.yml")) if d.exists() else []:
            y = parse_yaml(f.read_text(encoding="utf-8"))
            for r in y.get("roles") or []:
                if isinstance(r, dict) and r.get("type") == "governor":
                    s, e = parse_date(r.get("start_date")), parse_date(r.get("end_date"))
                    if s and s <= TODAY and (e is None or e >= TODAY):
                        cands.append((y, r, f.name, s, e))
            for r in y.get("roles") or []:
                if isinstance(r, dict) and r.get("type") == "lt_governor":
                    le = parse_date(r.get("end_date"))
                    if le and le >= TODAY:
                        lt_end[st] = le
            chain[f.name] = sorted(
                (parse_date(r.get("start_date")), parse_date(r.get("end_date")))
                for r in (y.get("roles") or [])
                if isinstance(r, dict) and r.get("type") == "governor" and parse_date(r.get("start_date")))
        w = wg.get(st)
        if len(cands) > 1:
            disagree(st + ": " + str(len(cands)) + " active governor roles in Open States")
        if not cands:
            fallbacks.append(st)
            if not w:
                disagree(st + ": no governor in Open States or Wikipedia")
                continue
            y, r, fname, s, e = ({"name": (w["first"] + " " + w["last"]).strip(), "party": [{"name": w["party"]}],
                                  "image": None, "links": []}, {}, None, w["start"], None)
        else:
            y, r, fname, s, e = cands[0]
        osname = y.get("name", "")
        span = (e - s).days if (e and s) else None   # role length per Open States
        # compare with Wikipedia
        if w:
            if (" " + norm(w["last"]) + " ") not in (" " + norm(osname) + " "):
                disagree(st + " governor: Open States '" + osname + "' vs Wikipedia '"
                         + w["first"] + " " + w["last"] + "'")
            ops = fix_party((y.get("party") or [{}])[0].get("name") if y.get("party") else None)
            wp = w["party"]
            if ops and wp and ops != wp and not (ops == "Democratic" and wp.startswith("Democratic")):
                disagree(st + " governor " + osname + ": party Open States '" + str(ops)
                         + "' vs Wikipedia '" + str(wp) + "'")
            if w["endyear"] and e and w["endyear"] not in (e.year, (e - timedelta(days=3)).year):
                disagree(st + " governor " + osname + ": term end year Open States " + str(e.year)
                         + " (" + str(e) + ") vs Wikipedia " + str(w["endyear"]))
                note(st + " governor: Open States termEnd " + str(e) + " contradicts Wikipedia's "
                     + str(w["endyear"]) + " and the 4-year term; termEnd set to null (not guessed).")
                e = None
        L = 2 if st in TWO_YEAR_TERM else 4
        in_group = ("2026" if st in gov_2026 else "2025" if st in GOV_2025 else
                    "2027" if st in GOV_2027 else "2028" if st in GOV_2028 else None)
        # Open States end date vs election group
        if e:
            ey = e.year if e.month >= 11 else e.year - 1
            want = {"2026": 2026, "2025": 2029, "2027": 2027, "2028": 2028}.get(in_group)
            if want and ey != want:
                disagree(st + " governor " + osname + ": Open States term end " + str(e)
                         + " implies a " + str(ey) + " election but the state's next election is " + str(want))
        # Same-ticket sanity check: the lieutenant governor's end date in the same data set
        if e and st in lt_end and abs((e - lt_end[st]).days) > 3:
            ltgov_diff.append(st + " (governor " + str(e) + ", lt. governor " + str(lt_end[st]) + ")")
        # Start date handling
        term_start = None
        if s and (span is None or span <= L * 365 + 100):
            term_start = str(s)
        elif s:
            merged.append(st)
        # Wikipedia's term start is the start of continuous service, so compare it with the start
        # of the unbroken chain of Open States governor roles ending in the current role.
        cstart = s
        if fname and s:
            roles_sorted = chain.get(fname, [])
            moved = True
            while moved:
                moved = False
                for (rs, re_) in roles_sorted:
                    if re_ and cstart and rs < cstart and abs((cstart - re_).days) <= 3:
                        cstart = rs
                        moved = True
        if w and w["start"] and cstart and w["start"] != cstart:
            disagree(st + " governor " + osname + ": continuous-service start Open States " + str(cstart)
                     + " vs Wikipedia term start " + str(w["start"]))
            if term_start and cstart == s:
                term_start = str(w["start"])
                s = w["start"]
                note(st + " governor: Open States start " + str(cstart) + " contradicts Wikipedia's "
                     + str(w["start"]) + " (an exact inauguration date); the Wikipedia date is used.")
        # appointed?
        if st in gov_2026 and st in TWO_YEAR_TERM:
            last = LAST_ELECTION["2026-2yr"]
        elif st in gov_2026:
            last = LAST_ELECTION["2026"]
        elif st in GOV_2025:
            last = LAST_ELECTION["2025"]
        elif st == "LA":
            last = LAST_ELECTION["2027-LA"]
        elif st in GOV_2027:
            last = LAST_ELECTION["2027-KY-MS"]
        else:
            last = LAST_ELECTION["2028"]
        appointed = bool(s and s > last + timedelta(days=90))
        # next election
        if st in gov_2026:
            nxt = ELECTION_2026
        elif st in GOV_2025:
            nxt = str(election_day(2029))
        elif st == "LA":
            nxt = "2027-10-09"
        elif st in GOV_2027:
            nxt = str(election_day(2027))
        else:
            nxt = str(election_day(2028))
        party = fix_party((y.get("party") or [{}])[0].get("name") if y.get("party") else None)
        links = [lk for lk in (y.get("links") or []) if isinstance(lk, dict) and lk.get("url")
                 and lk.get("note") != "webform"]
        url = to_https(links[0]["url"]) if links else None
        if not url:
            srcs = [sx for sx in (y.get("sources") or []) if isinstance(sx, dict) and sx.get("url")]
            url = None  # never guess an official site from a third-party source
        sources = []
        if fname:
            sources.append(OS_BLOB.format(st=st.lower(), fn=fname))
        else:
            sources.append(URL_WIKI_GOV)
        if URL_WIKI_GOV not in sources:
            sources.append(URL_WIKI_GOV)
        gh = {
            "id": "governor:" + st, "layer": "state", "match": {"state": st},
            "office": "Governor", "name": osname if osname else None,
            "party": party,
            "termStart": term_start, "termEnd": str(e) if e else None,
            "nextElection": nxt, "onBallot2026": st in gov_2026,
            "seat": None, "appointed": appointed,
            "photo": None, "url": url, "sources": sources,
            "_osimage": y.get("image"), "_wikifile": w["file"] if w else None,
            "_fallback": not cands,
        }
        holders.append(gh)
    # compare nominee incumbents for governor (informational)
    for k, v in sorted(nominees.items()):
        if not k.startswith("governor:"):
            continue
        inc = [c["name"] for c in v["candidates"] if c.get("incumbent")]
        cur = [h for h in holders if h["match"]["state"] == v["state"]]
        if inc and cur and norm(inc[0]).split(" ")[-1] not in norm(cur[0]["name"]).split(" "):
            disagree("Governor race " + v["state"] + ": nominees.generated.js incumbent '" + inc[0]
                     + "' != current governor '" + cur[0]["name"] + "'")
    if fallbacks:
        note("Governor fallback to the Wikipedia list (no active Open States governor role) for: "
             + ", ".join(fallbacks) + ". Wikipedia gives no exact term end, so termEnd is null for them.")
    if ltgov_diff:
        note("Open States governor end dates are partly nominal (e.g. start + 4 years). Where the same "
             "state's lieutenant governor role ends on a different day (>3 days) the governor's exact "
             "termEnd day is doubtful (the month still agrees): " + "; ".join(ltgov_diff) + ".")
    if merged:
        note("termStart is null for governors whose Open States role merges several consecutive terms "
             "(start of the CURRENT term unknown, never guessed): " + ", ".join(merged) + ".")
    return holders, os_head, merged, fallbacks


def verify_dates_2027():
    """KY/LA/MS 2027 election dates vs Wikipedia infoboxes."""
    expect = {"KY": "2027-11-02", "MS": "2027-11-02", "LA": "2027-10-09"}
    for st, exp in expect.items():
        page = "2027 " + STATE_NAMES[st] + " gubernatorial election"
        try:
            wt = wiki_wikitext(page)
        except Exception as exc:
            note("Could not load the Wikipedia page for the " + page + ": " + str(exc))
            continue
        m = re.search(r"election_date\s*=\s*([A-Za-z]+ \d{1,2}, \d{4})", wt)
        if not m:
            note("No election_date found in the Wikipedia infobox for the " + page + ".")
            continue
        got = datetime.strptime(m.group(1), "%B %d, %Y").date().isoformat()
        print("  " + st + " 2027 governor election date: Wikipedia " + got + ", used " + exp)
        if got != exp:
            disagree(st + " 2027 governor election: Wikipedia says " + got + ", script uses " + exp)


def main():
    ex, leg, xml_root, wiki_sen, wiki_gov, os_head, nominees = load_sources()

    # --- photos for President / VP ----------------------------------------
    print("Building holders")
    pres_photos = {}
    for hid, title in (("president", "Donald Trump"), ("vice-president", "JD Vance")):
        fn = wiki_page_image(title)
        pres_photos[hid] = commons_url(fn, 400) if fn else None
    exec_list, cur_exec = build_exec(ex, pres_photos)
    check_exec_wikipedia(cur_exec)
    sens = senator_holders(leg, xml_root, wiki_sen, nominees)
    govs, os_head, merged, fallbacks = governor_holders(wiki_gov, nominees, os_head)
    verify_dates_2027()
    note(LA_2027_NOTE)

    # --- link checks (phase 1: primary photo candidates + official links) ---
    phase1 = {}
    for h in exec_list:
        if h["photo"]:
            phase1[h["photo"]] = True
        if h["url"]:
            phase1[h["url"]] = False
    for h in sens:
        phase1[MIRROR_PHOTO.format(bio=h["_bio"])] = True
        if h["url"]:
            phase1[h["url"]] = False
    for h in govs:
        if h["_osimage"]:
            phase1[h["_osimage"]] = True
        if h["url"]:
            phase1[h["url"]] = False
    results = run_checks(phase1)

    def ok(u):
        r = results.get(u)
        return bool(r and r[1])

    def dead(u):
        r = results.get(u)
        return bool(r and r[0] in (404, 410))

    # phase 2: Wikipedia portraits, only where the primary candidate failed
    phase2 = {}
    for h in sens:
        if not ok(MIRROR_PHOTO.format(bio=h["_bio"])) and h["_wikifile"]:
            phase2[wikipedia_file_url(h["_wikifile"], 300)] = True
    for h in govs:
        if not (h["_osimage"] and ok(h["_osimage"])) and h["_wikifile"]:
            phase2[wikipedia_file_url(h["_wikifile"], 300)] = True
    results.update(run_checks(phase2))

    unverified_photo = []
    for h in exec_list:
        if h["photo"] and not ok(h["photo"]):
            unverified_photo.append(h["id"])
    wiki_photo_sen = []
    for h in sens:
        mirror = MIRROR_PHOTO.format(bio=h["_bio"])
        wk = wikipedia_file_url(h["_wikifile"], 300) if h["_wikifile"] else None
        if ok(mirror):
            h["photo"] = mirror
        elif wk and ok(wk):
            h["photo"] = wk
            wiki_photo_sen.append(h["id"])
        else:
            h["photo"] = CONGRESS_PHOTO.format(bio=h["_bio"].lower())
            unverified_photo.append(h["id"])
    nophoto = []
    wiki_photo_gov = []
    for h in govs:
        wk = wikipedia_file_url(h["_wikifile"], 300) if h["_wikifile"] else None
        if h["_osimage"] and ok(h["_osimage"]):
            h["photo"] = h["_osimage"]
        elif wk and ok(wk):
            h["photo"] = wk
            wiki_photo_gov.append(h["id"])
        else:
            h["photo"] = None
            nophoto.append(h["id"])
    # dead official links -> null
    for h in exec_list + sens + govs:
        if h["url"] and dead(h["url"]):
            note(h["id"] + ": official url returned 404/410 and was dropped (null).")
            h["url"] = None
    if unverified_photo:
        note("Photos NOT verified by HTTP 200 (standard congress.gov member-image URL "
             "https://www.congress.gov/img/member/<bioguide>_200.jpg, which sits behind a Cloudflare "
             "challenge and returns 403 to scripts; it is expected to load in a browser): "
             + ", ".join(unverified_photo) + ".")
    if wiki_photo_sen:
        note("Senator photos that use a Wikipedia/Wikimedia Commons portrait (HTTP 200 verified) because "
             "the Bioguide mirror has no image yet: " + ", ".join(wiki_photo_sen) + ".")
    if wiki_photo_gov:
        note("Governor photos taken from the Wikipedia governors list (HTTP 200 verified) because the Open "
             "States image is missing or does not return an image; these are the Wikipedia lead images and "
             "are not guaranteed to be official portraits: " + ", ".join(wiki_photo_gov) + ".")
    if nophoto:
        note("No verified portrait (photo is null): " + ", ".join(nophoto) + ".")
    senate_gov_blocked = [h["id"] for h in sens + govs if h["url"] and not ok(h["url"]) and not dead(h["url"])]
    mirror_used = sum(1 for h in sens if h["photo"] and h["photo"].startswith(MIRROR_PHOTO.split("{")[0]))
    note("Senator portraits: " + str(mirror_used) + " use the unitedstates.github.io mirror of the official "
         "Bioguide photo (HTTP 200 verified, 225x275).")
    note("Governor termEnd values are the Open States role end_date; the exact day of an outgoing term "
         "is not independently verified (the Wikipedia list gives only the year, which is cross-checked). "
         "For the Ohio and Florida appointees, termEnd is the congress-legislators value 2026-11-03 "
         "(election day); the seat is held until the winner of the special election is sworn in.")
    if senate_gov_blocked:
        note("Official site links that did not return HTTP 200 to a script (403/other, kept; they load "
             "in browsers): " + ", ".join(senate_gov_blocked) + ".")
    wh_ok = [h["id"] for h in exec_list if h["url"] and ok(h["url"])]
    wh_bad = [h["id"] for h in exec_list if h["url"] and not ok(h["url"])]
    note("President / Vice President official pages (whitehouse.gov): HTTP 200 verified for "
         + (", ".join(wh_ok) or "none") + (("; NOT verified for " + ", ".join(wh_bad)) if wh_bad else "") + ".")
    note("Senator party 'Independent' covers the two independents who caucus with the Democrats.")

    # --- assemble ----------------------------------------------------------
    senators = sorted(sens, key=lambda h: (h["match"]["state"], h["seat"]))
    governors = sorted(govs, key=lambda h: h["match"]["state"])
    all_holders = exec_list + senators + governors
    for h in all_holders:
        for k in [k for k in h if k.startswith("_")]:
            del h[k]
    order = ["id", "layer", "match", "office", "name", "party", "termStart", "termEnd",
             "nextElection", "onBallot2026", "seat", "special", "appointed", "photo", "url", "sources"]
    final = []
    for h in all_holders:
        final.append({k: h[k] for k in order if k in h})

    counts = {
        "president": sum(1 for h in final if h["id"] == "president"),
        "vicePresident": sum(1 for h in final if h["id"] == "vice-president"),
        "senators": sum(1 for h in final if h["office"] == "U.S. Senator"),
        "governors": sum(1 for h in final if h["office"] == "Governor"),
    }
    per_state_bad = [st for st in STATES
                     if sum(1 for h in final if h["office"] == "U.S. Senator" and h["match"]["state"] == st) != 2
                     or sum(1 for h in final if h["office"] == "Governor" and h["match"]["state"] == st) != 1]
    ids = [h["id"] for h in final]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    ok_counts = (counts == {"president": 1, "vicePresident": 1, "senators": 100, "governors": 50}
                 and not per_state_bad and not dup)

    # null-field report
    for h in final:
        missing = [k for k in ("name", "party", "termStart", "termEnd", "photo", "url") if h[k] is None]
        if missing and h["office"] != "Governor":
            UNVERIFIED.append(h["id"] + ": null " + ",".join(missing))
        elif missing:
            UNVERIFIED.append(h["id"] + ": null " + ",".join(missing))
    appointees = [(h["office"], h["match"].get("state"), h["name"]) for h in final if h["appointed"]]

    print("")
    print("=== VERIFICATION SUMMARY (as of " + str(TODAY) + ") ===")
    print("counts: " + json.dumps(counts))
    print("states with wrong delegation size: " + str(per_state_bad) + "; duplicate ids: " + str(dup))
    print("Open States clone commit date: " + str(os_head))
    print("disagreements: " + str(len(DISAGREEMENTS)))
    for d in DISAGREEMENTS:
        print("  - " + d)
    print("appointees: " + str(appointees))
    print("governors with merged Open States terms (termStart null): " + str(merged))
    print("holders with null fields: " + str(len(UNVERIFIED)))
    for u in UNVERIFIED:
        print("  - " + u)
    print("photos not verified by HTTP 200: " + str(unverified_photo))
    print("on ballot 2026: senators=" + str(sum(1 for h in final if h["office"] == "U.S. Senator" and h["onBallot2026"]))
          + " governors=" + str(sum(1 for h in final if h["office"] == "Governor" and h["onBallot2026"])))

    if not ok_counts:
        print("FAIL: counts are not 1 / 1 / 100 / 50 (or per-state / duplicate check failed); nothing written.")
        return 1

    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "asOf": TODAY.isoformat(),
        "sources": [
            URL_EXEC, URL_LEG, URL_SENATE_XML,
            "Open States people repo (CC0), data/<st>/executive: " + URL_OS_REPO,
            "Wikipedia (CC BY-SA 4.0) via the MediaWiki API: " + URL_WIKI_SEN + " ; " + URL_WIKI_GOV,
            "data/nominees.generated.js (2026 races, used for cross-checks only)",
            URL_LA_CAL,
        ],
        "counts": counts,
        "notes": NOTES,
    }
    text = ("// GENERATED by scripts/export_officeholders.py. DO NOT EDIT BY HAND.\n"
            "export const OFFICEHOLDERS_META = " + json.dumps(meta, indent=2, ensure_ascii=False) + ";\n"
            "export const OFFICEHOLDERS = " + json.dumps(final, indent=2, ensure_ascii=False) + ";\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print("wrote " + str(OUT.relative_to(ROOT)) + " (" + str(len(final)) + " holders)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

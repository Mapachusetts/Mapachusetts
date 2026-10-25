#!/usr/bin/env python3
"""
Build a nationwide dataset of 2026 U.S. general-election NOMINEES
(U.S. Senate, Governor, U.S. House) with FEC campaign-finance totals.

Sources (no API keys):
  * Wikipedia (MediaWiki parse API, CC BY-SA 4.0): one election page per state
    and office. The {{Infobox election}} template of each race gives the
    nominees, parties, photos and the incumbent ("before_election").
  * FEC bulk files cn26.zip (candidate master) and weball26.zip (all-candidates
    financial summary). Senate/House nominees are matched to an FEC candidate
    by office + state + district + normalized name. Governors are not federal,
    so they never get FEC data.

Output (pure ES module, safe to import in the browser):
  data/nominees.generated.js

Run:
  python3 scripts/export_nominees.py            # uses /tmp caches when present
  python3 scripts/export_nominees.py --refresh  # re-download everything

Python 3.9 standard library only. Caches live under /tmp.
"""
import csv
import io
import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "nominees.generated.js"
WIKI_CACHE = Path("/tmp/mapachusetts-wiki-cache")
FEC_CACHE = Path("/tmp/mapachusetts-fec")
USER_AGENT = "mapachusetts-civic/1.0 (https://github.com/Mapachusetts/Mapachusetts)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_BASE = "https://en.wikipedia.org/wiki/"
FEC_URLS = {
    "cn26.zip": "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
    "weball26.zip": "https://www.fec.gov/files/bulk-downloads/2026/weball26.zip",
}
ELECTION_DATE = "2026-11-03"
REFRESH = "--refresh" in sys.argv
REQUEST_SLEEP = 0.3

STATES = {
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
NAME_TO_ABBR = dict((v, k) for k, v in STATES.items())

# House seats per state after the 2020 apportionment (sums to 435).
HOUSE_SEATS = {
    "AL": 7, "AK": 1, "AZ": 9, "AR": 4, "CA": 52, "CO": 8, "CT": 5, "DE": 1, "FL": 28,
    "GA": 14, "HI": 2, "ID": 2, "IL": 17, "IN": 9, "IA": 4, "KS": 4, "KY": 6, "LA": 6,
    "ME": 2, "MD": 8, "MA": 9, "MI": 13, "MN": 8, "MS": 4, "MO": 8, "MT": 2, "NE": 3,
    "NV": 4, "NH": 2, "NJ": 12, "NM": 3, "NY": 26, "NC": 14, "ND": 1, "OH": 15, "OK": 5,
    "OR": 6, "PA": 17, "RI": 2, "SC": 7, "SD": 1, "TN": 9, "TX": 38, "UT": 4, "VT": 1,
    "VA": 11, "WA": 10, "WV": 2, "WI": 8, "WY": 1,
}
AT_LARGE = set(k for k, v in HOUSE_SEATS.items() if v == 1)

OFFICE_TITLES = {"senate": "U.S. Senator", "governor": "Governor", "house": "U.S. Representative"}


def log(msg):
    print(msg, flush=True)


# --------------------------------------------------------------------------
# Wikipedia fetching (cached, polite, retrying)
# --------------------------------------------------------------------------
_last_request = [0.0]
WIKI_STATS = {"network": 0, "cached": 0}


def _cache_path(title):
    return WIKI_CACHE / (re.sub(r"[^A-Za-z0-9]+", "_", title) + ".json")


def wiki_get(title):
    """Return the raw parse-API JSON for a page title (cached). Missing pages
    are returned as {'error': ...} and cached too."""
    WIKI_CACHE.mkdir(parents=True, exist_ok=True)
    path = _cache_path(title)
    if path.exists() and not REFRESH:
        try:
            WIKI_STATS["cached"] += 1
            return json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            pass
    url = (WIKI_API + "?action=parse&page=" + urllib.parse.quote(title)
           + "&prop=wikitext&format=json&redirects=1")
    last_err = None
    for attempt in range(5):
        wait = REQUEST_SLEEP - (time.time() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            _last_request[0] = time.time()
            WIKI_STATS["network"] += 1
            path.write_text(json.dumps(data), encoding="utf-8")
            return data
        except urllib.error.HTTPError as err:
            last_err = err
            _last_request[0] = time.time()
            if err.code == 429 or err.code >= 500:
                retry_after = err.headers.get("Retry-After") if err.headers else None
                try:
                    delay = float(retry_after)
                except (TypeError, ValueError):
                    delay = 5.0 * (attempt + 1)
                log("  ... HTTP %s for %r, backing off %.0fs" % (err.code, title, delay))
                time.sleep(min(delay, 90.0))
            else:
                time.sleep(1.0)
        except Exception as err:  # network hiccup: retry
            last_err = err
            _last_request[0] = time.time()
            time.sleep(2.0)
    raise RuntimeError("Could not fetch %r: %s" % (title, last_err))


def wiki_page(title):
    """Return (resolved_title, wikitext) or None when the page does not exist."""
    data = wiki_get(title)
    if "parse" not in data:
        return None
    return data["parse"]["title"], data["parse"]["wikitext"]["*"]


# --------------------------------------------------------------------------
# Wikitext helpers
# --------------------------------------------------------------------------
LINK_RE = re.compile(r"\[\[([^\]\[]*)\]\]")
PIPE = "\x01"


def strip_noise(s):
    """Remove comments, <ref>...</ref>, other tags (<br> becomes a space)."""
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<ref\b[^>]*?/>", "", s, flags=re.I)
    s = re.sub(r"<ref\b[^>]*>.*?</ref\s*>", "", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"</?[A-Za-z][^>]*>", "", s)
    return s


def _protect_pipes(s):
    return LINK_RE.sub(lambda m: m.group(0).replace("|", PIPE), s)


FIRST_ARG = set([
    "nowrap", "small", "smaller", "nobr", "abbr", "ill", "party name with color",
    "party name", "nom", "center", "strong", "em", "bold", "italic", "noitalic",
    "small caps", "smallcaps", "big", "larger", "hidden", "nounderlines", "color",
])
LAST_ARG = set(["sort", "lang", "lang-es", "transliteration"])
LIST_TEMPLATES = set(["plainlist", "hlist", "ubl", "flatlist", "unbulleted list", "bulleted list"])


def _arg_value(a):
    a = a.strip()
    m = re.match(r"^\w{1,8}\s*=\s*(.*)$", a, flags=re.S)
    if m and not a.startswith("[["):
        return m.group(1).strip()
    return a


def _template_handler(m):
    parts = m.group(1).split("|")
    name = parts[0].strip().lower()
    args = [_arg_value(a) for a in parts[1:]]
    if name in FIRST_ARG:
        return args[0] if args else ""
    if name in LAST_ARG:
        return args[-1] if args else ""
    if name in LIST_TEMPLATES:
        return "; ".join(a for a in args if a)
    if name in ("snd", "spaced ndash", "ndash"):
        return "-"
    if name in ("nbsp", "br", "break"):
        return " "
    return ""  # efn, cite *, sfn, party shading, etc.


def resolve_templates(s):
    s = _protect_pipes(s)
    for _ in range(25):
        new = re.sub(r"\{\{([^{}]*)\}\}", _template_handler, s)
        if new == s:
            break
        s = new
    return s.replace("{{", "").replace("}}", "")


def link_to_text(s):
    def repl(m):
        inner = m.group(1).replace(PIPE, "|")
        if re.match(r"^\s*(File|Image|Category):", inner, flags=re.I):
            return ""
        if "|" in inner:
            return inner.split("|", 1)[1]
        return inner
    return LINK_RE.sub(repl, s)


def clean_text(raw):
    s = resolve_templates(strip_noise(raw))
    s = link_to_text(s)
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"&nbsp;|\xa0", " ", s)
    s = s.replace("&amp;", "&").replace("&ndash;", "-").replace("&#39;", "'")
    s = re.sub(r"\s+", " ", s).strip(" \t\n;,*")
    return s


def first_link_target(raw):
    """Target of the first [[wikilink]] (after dropping refs / junk templates)."""
    s = resolve_templates(strip_noise(raw))
    for m in LINK_RE.finditer(s):
        inner = m.group(1).replace(PIPE, "|")
        target = inner.split("|")[0].split("#")[0].strip()
        if not target or re.match(r"^(File|Image|Category|Wikipedia|Help):", target, flags=re.I):
            continue
        return target
    return None


def all_link_targets(raw):
    s = resolve_templates(strip_noise(raw))
    out = []
    for m in LINK_RE.finditer(s):
        inner = m.group(1).replace(PIPE, "|")
        target = inner.split("|")[0].split("#")[0].strip()
        if target and not re.match(r"^(File|Image|Category):", target, flags=re.I):
            out.append(target)
    return out


def wiki_url(target):
    return WIKI_BASE + urllib.parse.quote(target.replace(" ", "_"), safe="()_,'-.!~*:")


def photo_url(raw):
    s = strip_noise(raw)
    s = resolve_templates(s)
    s = s.replace(PIPE, "|")
    m = re.search(r"\[\[\s*(?:File|Image):\s*([^|\]]+)", s, flags=re.I)
    name = m.group(1) if m else s.split("|")[0]
    name = re.sub(r"^\s*(File|Image):", "", name.strip(), flags=re.I).strip()
    if not name or "." not in name:
        return None
    if re.match(r"^(3x4|placeholder|no[ _-]?image|blank|silhouette|replace|default)", name, flags=re.I):
        return None
    name = name.replace(" ", "_")
    return ("https://commons.wikimedia.org/wiki/Special:FilePath/"
            + urllib.parse.quote(name, safe="()_,'-.!~*") + "?width=240")


# --------------------------------------------------------------------------
# Infobox extraction
# --------------------------------------------------------------------------
INFOBOX_RE = re.compile(r"\{\{\s*Infobox\s+election\b", re.I)
BRACE_RE = re.compile(r"\{\{|\}\}")


def extract_infoboxes(wikitext):
    """Yield (start_index, block_text) for each {{Infobox election ...}}."""
    out = []
    for m in INFOBOX_RE.finditer(wikitext):
        depth = 0
        end = None
        for b in BRACE_RE.finditer(wikitext, m.start()):
            depth += 1 if b.group(0) == "{{" else -1
            if depth == 0:
                end = b.end()
                break
        if end:
            out.append((m.start(), wikitext[m.start():end]))
    return out


def split_top_level(body):
    """Split on '|' that are not inside [[ ]] or {{ }}."""
    parts, cur = [], []
    depth_t = depth_l = 0
    i = 0
    n = len(body)
    while i < n:
        two = body[i:i + 2]
        if two == "{{":
            depth_t += 1
            cur.append(two)
            i += 2
        elif two == "}}":
            depth_t -= 1
            cur.append(two)
            i += 2
        elif two == "[[":
            depth_l += 1
            cur.append(two)
            i += 2
        elif two == "]]":
            depth_l -= 1
            cur.append(two)
            i += 2
        elif body[i] == "|" and depth_t == 0 and depth_l == 0:
            parts.append("".join(cur))
            cur = []
            i += 1
        else:
            cur.append(body[i])
            i += 1
    parts.append("".join(cur))
    return parts


def parse_infobox(block):
    """Return an ordered dict-like mapping of param name -> raw value."""
    block = strip_noise_keep_br(block)
    inner = block[2:-2]
    parts = split_top_level(inner)
    params = {}
    for part in parts[1:]:
        if "=" not in part:
            continue
        key, val = part.split("=", 1)
        key = key.strip().lower()
        if re.match(r"^[a-z_0-9 ]+$", key):
            params[key] = val.strip()
    return params


def strip_noise_keep_br(s):
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<ref\b[^>]*?/>", "", s, flags=re.I)
    s = re.sub(r"<ref\b[^>]*>.*?</ref\s*>", "", s, flags=re.S | re.I)
    return s


# --------------------------------------------------------------------------
# Party / name normalization
# --------------------------------------------------------------------------
def normalize_party(text):
    t = (text or "").strip()
    low = t.lower()
    if not low:
        return ""
    if "working families" in low:
        return "Working Families"
    if "democratic-nonpartisan" in low or "democratic–nonpartisan" in low:
        return "Democratic-NPL"
    if "democratic" in low:
        return "Democratic"
    if "republican" in low:
        return "Republican"
    if low.startswith("libertarian"):
        return "Libertarian"
    if low.startswith("green"):
        return "Green"
    if low.startswith("constitution"):
        return "Constitution"
    if low.startswith("forward"):
        return "Forward"
    if low.startswith("conservative"):
        return "Conservative"
    if "alaskan independence" in low:
        return "Alaskan Independence"
    if low.startswith("independent") and not low.startswith("independent party") \
            and not low.startswith("independence"):
        return "Independent"
    if low in ("no party affiliation", "no party", "nonpartisan", "unaffiliated", "none"):
        return "Independent"
    if "write-in" in low:
        return "Write-in"
    s = re.sub(r"\s*\([^)]*\)", "", t)
    s = re.sub(r"\bParty\b", "", s)
    s = re.sub(r"\s+of\s+[A-Z][\w ]*$", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or t


PLACEHOLDERS = set(["", "tbd", "tba", "none", "vacant", "n/a", "?", "-", "unknown", "to be determined"])


def clean_person_name(raw):
    name = clean_text(raw)
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return name


TITLE_TOKENS = set(["MR", "MRS", "MS", "DR", "SEN", "SENATOR", "REP", "REPRESENTATIVE", "HON",
                    "HONORABLE", "GOV", "GOVERNOR", "PROF", "REV", "CAPT", "COL", "MAJ", "LT",
                    "GEN", "SGT", "JUDGE", "MD", "ESQ", "PHD", "DDS", "DVM", "CPT", "CDR"])
SUFFIX_TOKENS = set(["JR", "SR", "II", "III", "IV", "V", "2ND", "3RD"])
NICK_GROUPS = [
    "WILLIAM BILL BILLY WILL WILLY", "ROBERT BOB BOBBY ROB ROBBIE", "RICHARD DICK RICK RICKY RICH",
    "JAMES JIM JIMMY JAMIE", "MICHAEL MIKE MICK MICKEY", "THOMAS TOM TOMMY", "JOSEPH JOE JOEY",
    "DANIEL DAN DANNY", "DAVID DAVE DAVEY", "CHRISTOPHER CHRIS KIT", "BENJAMIN BEN BENNY",
    "TIMOTHY TIM TIMMY", "STEVEN STEPHEN STEVE", "ANTHONY TONY", "ANDREW ANDY DREW",
    "MATTHEW MATT", "NICHOLAS NICK NICKY", "PATRICK PAT PATTY", "PATRICIA PAT PATTY TRISH",
    "KATHERINE KATHLEEN KATHY KATIE KATE KATHRYN CATHERINE CATHY KATHARINE",
    "ELIZABETH LIZ BETH BETSY BETTY LIZZIE ELIZA", "SUSAN SUE SUSIE", "JENNIFER JEN JENNY",
    "REBECCA BECKY", "DEBORAH DEBBIE DEB", "CHARLES CHUCK CHARLIE CHAS", "HENRY HANK",
    "JOHN JACK JOHNNY JON JONATHAN", "EDWARD ED EDDIE TED NED", "THEODORE TED TEDDY THEO",
    "ALBERT AL BERT", "ALAN ALLEN AL", "ALFRED AL FRED", "SAMUEL SAM SAMMY", "GREGORY GREG",
    "JEFFREY GEOFFREY JEFF", "KENNETH KEN KENNY", "LAWRENCE LARRY", "RONALD RON RONNIE",
    "DONALD DON DONNIE", "DOUGLAS DOUG", "EUGENE GENE", "FRANCIS FRANK FRANKIE", "FREDERICK FRED FREDDIE",
    "GERALD JERRY GERRY", "JOSHUA JOSH", "ZACHARY ZACH ZACK", "ALEXANDER ALEX ALEXANDRA SANDY",
    "TERRENCE TERRY TERENCE", "VICTORIA VICKI VICKY", "MARGARET PEGGY MAGGIE MEG MARGE MARGIE",
    "NATHAN NATHANIEL NATE", "RANDALL RANDY", "RUSSELL RUSS", "PHILIP PHILLIP PHIL",
    "JONATHAN JON NATHAN", "MARY MOLLY POLLY", "SARAH SALLY", "CHRISTINE CHRISTINA CHRIS CHRISTY TINA",
    "STANLEY STAN", "LEONARD LEN LENNY LEO", "NORMAN NORM", "WALTER WALT WALLY", "RAYMOND RAY",
    "HAROLD HAL HARRY", "HERBERT HERB", "GORDON GORDY", "LEWIS LOUIS LOU LOUIE", "MARTIN MARTY",
    "JOSE PEPE", "MANUEL MANNY", "FRANCISCO FRANK PACO", "ROBERTO BOB", "ENRIQUE HENRY ENRIQUE",
    "ABRAHAM ABE", "BARBARA BARB BARBIE", "CYNTHIA CINDY", "DOROTHY DOTTIE DOT", "JACQUELINE JACKIE",
    "JUDITH JUDY", "KIMBERLY KIM", "LINDA LINDY", "MELISSA MEL MISSY", "NANCY NAN", "SANDRA SANDY",
    "STEPHANIE STEPH", "VIRGINIA GINNY", "WENDY WENDELL", "TIFFANY TIFF", "ANGELA ANGIE",
    "ALEJANDRO ALEX", "FERNANDO FERNIE", "GUILLERMO WILLIAM", "RAFAEL RAFA RAPHAEL", "RAPHAEL RAFAEL RAY",
    "ELEANOR ELLIE ELLEN", "KRISTEN KRISTIN KRISTINE KRIS", "LAUREN LAURA LAURIE", "SHERRY SHERRIE",
    "ROSEMARY ROSIE", "PHILLIP PHIL", "DENNIS DENNY", "DONALD DON", "RODNEY ROD", "ROLAND ROLLY",
    "GREGG GREG", "JEFFERY JEFF", "BRADLEY BRAD", "CHESTER CHET", "CLIFFORD CLIFF", "DARREN DARRIN",
    "GABRIEL GABE GABRIELLE GABBY", "NICOLE NIKKI NICKI NICOLA", "NELIDA NELLIE NELLY",
    "JAMES JAY", "LUCIA LUCY LUCILLE", "BERNARD BERNIE BERNEY BERNY", "SUZANNE SUSAN SUE SUZIE SUZY SUZANN",
    "MAXWELL MAXIMILIAN MAX", "ISABEL ISABELLA IZZY", "CAROLINE CAROL CARRIE", "ANTONIO TONY",
    "TRENT TRENTON", "THADDEUS THAD", "TIMOTHY TIM", "TYLER TY", "WESLEY WES", "ZACHARIAH ZACK",
]
NICK_INDEX = {}
for _grp in NICK_GROUPS:
    _names = _grp.split()
    for _n in _names:
        NICK_INDEX.setdefault(_n, set()).update(_names)


def _norm_token_text(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[^A-Z0-9 ]", "", s.upper().replace("-", "").replace("'", "").replace(".", ""))


def _strip_decor(s):
    s = re.sub(r"\([^)]*\)", " ", s)
    nick = re.findall(r"[\"“”]([^\"“”]+)[\"“”]", s)
    s = re.sub(r"[\"“”][^\"“”]*[\"“”]", " ", s)
    return s, nick


def _filter_tokens(tokens):
    return [t for t in tokens if t and t not in TITLE_TOKENS and t not in SUFFIX_TOKENS]


def parse_fec_parts(name):
    """'LAST, FIRST MIDDLE SUFFIX' -> (last tokens, given tokens)."""
    s, _ = _strip_decor(name)
    if "," in s:
        last_part, rest = s.split(",", 1)
        return (_filter_tokens(_norm_token_text(last_part).split()),
                _filter_tokens(_norm_token_text(rest).split()))
    tokens = _filter_tokens(_norm_token_text(s).split())
    if len(tokens) < 2:
        return tokens, []
    return [tokens[-1]], tokens[:-1]


def parse_wiki_name(name):
    """'First Middle Last' -> (tokens, nickname tokens)."""
    s, nick = _strip_decor(name)
    tokens = _filter_tokens(_norm_token_text(s).split())
    return tokens, [_norm_token_text(n).replace(" ", "") for n in nick]


def first_compat(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    if len(a) >= 2 and len(b) >= 2 and (a.startswith(b) or b.startswith(a)):
        return True
    if b in NICK_INDEX.get(a, ()):
        return True
    return False


def _fec_variants(name):
    """(last, given tokens) readings of an FEC name: as written, suffix of a
    multi-word surname ("O SALVESEN"), a maiden/other surname hiding in the
    given names ("ARENHOLZ, ASHLEY HINSON"), and a reversed "FIRST, LAST"."""
    last_tokens, given = parse_fec_parts(name)
    out = []
    if last_tokens and given:
        out.append(("".join(last_tokens), given))
        for i in range(1, len(last_tokens)):
            out.append(("".join(last_tokens[i:]), given))
        for g in given[1:]:
            out.append((g, [given[0]]))
        out.append((given[0], ["".join(last_tokens)] + given[1:]))
    return out


def names_match(wiki_name, fec_name):
    """Last-name equality plus first-name compatibility."""
    tokens, nicks = parse_wiki_name(wiki_name)
    if len(tokens) < 2:
        return False
    for fec_last, fec_given in _fec_variants(fec_name):
        for k in range(1, len(tokens)):
            if "".join(tokens[k:]) != fec_last:
                continue
            wiki_given = tokens[:k]
            if any(first_compat(tokens[0], g) for g in fec_given):
                return True
            if any(first_compat(w, fec_given[0]) for w in wiki_given + nicks):
                return True
            # "J. D. Ford" vs "FORD, JAMES DAVID": all initials, in order
            if len(wiki_given) >= 2 and all(len(w) == 1 for w in wiki_given):
                initials = [g[0] for g in fec_given]
                it = iter(initials)
                if all(any(w == x for x in it) for w in wiki_given):
                    return True
    return False


def within_one_edit(a, b):
    """True when a and b differ by one substitution, insertion, deletion or
    adjacent transposition (typos like RIECHARD / REICHARD)."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        diff = [i for i in range(len(a)) if a[i] != b[i]]
        if len(diff) == 1:
            return True
        return len(diff) == 2 and diff[1] == diff[0] + 1 and a[diff[0]] == b[diff[1]] \
            and a[diff[1]] == b[diff[0]]
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    for i in range(len(long_)):
        if long_[:i] + long_[i + 1:] == short:
            return True
    return False


def fuzzy_name_match(wiki_name, fec_name):
    """Same first name, surname within one typo (>= 5 letters)."""
    tokens, nicks = parse_wiki_name(wiki_name)
    last_tokens, given = parse_fec_parts(fec_name)
    if len(tokens) < 2 or not last_tokens or not given:
        return False
    wiki_last, fec_last = tokens[-1], "".join(last_tokens)
    if len(wiki_last) < 5 or len(fec_last) < 5 or wiki_last == fec_last:
        return False
    return within_one_edit(wiki_last, fec_last) and any(
        first_compat(tokens[0], g) for g in given[:1])


def last_name_compat(wiki_name, fec_name):
    tokens, _ = parse_wiki_name(wiki_name)
    if len(tokens) < 2:
        return False
    for fec_last, _ in _fec_variants(fec_name)[:1]:
        for k in range(1, len(tokens)):
            if "".join(tokens[k:]) == fec_last:
                return True
    return False


def same_person(name_a, name_b, strict=False):
    """Loose wiki-name vs wiki-name test (for the incumbent check). With
    strict=True the first names must be identical (no nickname/prefix)."""
    ta, _ = parse_wiki_name(name_a)
    tb, _ = parse_wiki_name(name_b)
    if not ta or not tb:
        return False
    if "".join(ta) == "".join(tb):
        return True
    if len(ta) < 2 or len(tb) < 2:
        return False
    for ka in range(1, len(ta)):
        for kb in range(1, len(tb)):
            if "".join(ta[ka:]) == "".join(tb[kb:]):
                if ta[0] == tb[0] or (not strict and first_compat(ta[0], tb[0])):
                    return True
    return False


# --------------------------------------------------------------------------
# Race extraction from infoboxes
# --------------------------------------------------------------------------
def infobox_candidates(params):
    """List of dicts (name, link, partyRaw, partyLink, image) in infobox order."""
    indexes = set()
    for key in params:
        m = re.match(r"^(nominee|candidate)(\d+)$", key)
        if m:
            indexes.add(int(m.group(2)))
    use_nominee = any(("nominee%d" % i) in params and params["nominee%d" % i].strip() for i in indexes)
    prefix = "nominee" if use_nominee else "candidate"
    out = []
    for i in sorted(indexes):
        raw = params.get("%s%d" % (prefix, i), "")
        name = clean_person_name(raw)
        if name.lower() in PLACEHOLDERS:
            continue
        party_raw = params.get("party%d" % i, "")
        party_text = clean_text(party_raw)
        party_link = first_link_target(party_raw)
        out.append({
            "index": i,
            "name": name,
            "link": first_link_target(raw),
            "party_text": party_text,
            "party_link": party_link,
            "image_raw": params.get("image%d" % i, ""),
            "used_candidate_fields": prefix == "candidate",
        })
    return out


def incumbent_names(params):
    raw = params.get("before_election", "")
    names = []
    text = clean_text(raw)
    if text:
        names.append(text)
        for piece in re.split(r"\s*;\s*", text):
            if piece:
                names.append(piece)
    names.extend(all_link_targets(raw))
    return names


def parse_date(text):
    t = clean_text(text)
    for fmt in ("%B %d, %Y", "%B %d %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(t, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"([A-Z][a-z]+ \d{1,2}, \d{4})", t)
    if m:
        try:
            return datetime.strptime(m.group(1), "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def build_candidates(params):
    inc_names = incumbent_names(params)
    inc_links = all_link_targets(params.get("before_election", ""))
    cands = []
    for c in infobox_candidates(params):
        party_text = c["party_text"]
        detail = c["party_link"] or party_text
        detail = re.sub(r"\s+", " ", detail or "").strip()
        party = normalize_party(c["party_link"] or party_text) or normalize_party(party_text)
        is_inc = False
        if c["link"] and c["link"] in inc_links:
            is_inc = True  # same article as the sitting officeholder
        else:
            for n in inc_names:
                # different article => same_person must agree on the exact first name
                if same_person(c["name"], n, strict=bool(c["link"] and inc_links)):
                    is_inc = True
                    break
        entry = {
            "name": c["name"],
            "party": party,
            "partyDetail": detail,
            "incumbent": is_inc,
            "wikipedia": wiki_url(c["link"]) if c["link"] else None,
            "photo": photo_url(c["image_raw"]) if c["image_raw"].strip() else None,
        }
        cands.append(entry)
    return cands


def district_from_infobox(params, heading):
    name = clean_text(params.get("election_name", ""))
    m = re.search(r"(\d+)(?:st|nd|rd|th) congressional district", name, flags=re.I)
    if m:
        return int(m.group(1))
    if re.search(r"at[- ]large", name, flags=re.I):
        return 0
    if heading:
        m = re.search(r"District\s+(\d+)", heading, flags=re.I)
        if m:
            return int(m.group(1))
        if re.search(r"at[- ]large", heading, flags=re.I):
            return 0
    return None


def heading_before(wikitext, pos):
    heads = re.findall(r"^=+\s*(.*?)\s*=+\s*$", wikitext[:pos], flags=re.M)
    return heads[-1] if heads else None


def make_race(office, state, district, special, title_resolved, params, candidates):
    date = parse_date(params.get("election_date", "")) or ELECTION_DATE
    key = "%s:%s" % (office, state)
    if office == "house":
        key = "house:%s-%s" % (state, district)
    return {
        "id": key,
        "office": office,
        "state": state,
        "district": district,
        "special": bool(special),
        "title": OFFICE_TITLES[office],
        "electionDate": date,
        "status": "nominees" if candidates else "pending",
        "source": WIKI_BASE + urllib.parse.quote(title_resolved.replace(" ", "_"), safe="()_,'-.!~*:"),
        "candidates": candidates,
    }


# --------------------------------------------------------------------------
# Collect races
# --------------------------------------------------------------------------
def collect_single_race_pages(office, notes):
    """Senate / governor: first infobox of each state page is the general."""
    races = {}
    seen_titles = {}
    for abbr, state_name in sorted(STATES.items()):
        if office == "senate":
            titles = ["2026 United States Senate election in %s" % state_name,
                      "2026 United States Senate special election in %s" % state_name]
        else:
            titles = ["2026 %s gubernatorial election" % state_name]
        for t in titles:
            page = wiki_page(t)
            if not page:
                continue
            resolved, text = page
            if (office, resolved) in seen_titles:
                continue
            seen_titles[(office, resolved)] = True
            boxes = extract_infoboxes(text)
            if not boxes:
                notes.append("%s %s: page %r has no Infobox election" % (office, abbr, resolved))
                continue
            params = parse_infobox(boxes[0][1])
            cands = build_candidates(params)
            special = "special election" in resolved.lower()
            race = make_race(office, abbr, None, special, resolved, params, cands)
            if race["id"] in races:
                race["id"] = race["id"] + "-special"
                notes.append("%s %s: duplicate race key, stored as %s" % (office, abbr, race["id"]))
            races[race["id"]] = race
            if any(c.get("used_candidate_fields") for c in infobox_candidates(params)):
                notes.append("%s %s: infobox only had candidateN fields (no nominees)" % (office, abbr))
    return races


def collect_house(notes):
    races = {}
    for abbr, state_name in sorted(STATES.items()):
        page = None
        for t in ("2026 United States House of Representatives elections in %s" % state_name,
                  "2026 United States House of Representatives election in %s" % state_name):
            page = wiki_page(t)
            if page:
                break
        if not page:
            notes.append("house %s: no Wikipedia House page found" % abbr)
            continue
        resolved, text = page
        pages = [(resolved, text)]
        # Big states (California) split the districts into sub-pages
        # "... elections in X (districts 1-26)"; follow those links.
        subs = set(re.findall(
            r"(2026 United States House of Representatives elections in %s \(districts[^)\]|}]*\))"
            % re.escape(state_name), text))
        for sub in sorted(subs):
            sub_page = wiki_page(sub)
            if sub_page:
                pages.append(sub_page)
                notes.append("house %s: also read sub-page %r" % (abbr, sub_page[0]))
        per_district = {}
        for page_title, page_text in pages:
            for pos, block in extract_infoboxes(page_text):
                params = parse_infobox(block)
                district = district_from_infobox(params, heading_before(page_text, pos))
                if district is None:
                    continue
                per_district.setdefault(district, []).append((page_title, params))
        for district, plist in per_district.items():
            def score(item):
                p = item[1]
                date = parse_date(p.get("election_date", ""))
                name = clean_text(p.get("election_name", "")).lower()
                s = 0
                if date in (None, ELECTION_DATE):
                    s += 2
                if "special" not in name:
                    s += 1
                return -s
            plist = sorted(plist, key=score)  # stable: best first, then page order
            race_title, params = plist[0]
            if len(plist) > 1:
                notes.append("house %s district %s: %d infoboxes, used the best-scored one"
                             % (abbr, district, len(plist)))
            cands = build_candidates(params)
            if abbr in AT_LARGE or district == 0:
                dkey = "AL"
            else:
                dkey = "%02d" % district
            race = make_race("house", abbr, dkey, False, race_title, params, cands)
            races[race["id"]] = race
    return races


# --------------------------------------------------------------------------
# FEC bulk data
# --------------------------------------------------------------------------
def fec_read(zip_name):
    FEC_CACHE.mkdir(parents=True, exist_ok=True)
    path = FEC_CACHE / zip_name
    if REFRESH or not path.exists() or path.stat().st_size < 1000:
        log("  downloading %s" % FEC_URLS[zip_name])
        req = urllib.request.Request(FEC_URLS[zip_name], headers={"User-Agent": USER_AGENT})
        last = None
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    path.write_bytes(resp.read())
                last = None
                break
            except Exception as err:
                last = err
                time.sleep(2)
        if last:
            raise RuntimeError("FEC download failed: %s" % last)
    with zipfile.ZipFile(str(path)) as zf:
        member = [n for n in zf.namelist() if n.lower().endswith(".txt")][0]
        raw = zf.read(member).decode("latin-1")
    return [row for row in csv.reader(io.StringIO(raw), delimiter="|", quoting=csv.QUOTE_NONE)]


def money(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    return int(round(f))


def fec_date(v):
    try:
        return datetime.strptime(v.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def load_fec():
    cn_rows = fec_read("cn26.zip")
    wb_rows = fec_read("weball26.zip")
    master = {}
    for r in cn_rows:
        if len(r) < 8 or r[5] not in ("S", "H"):
            continue
        master[r[0]] = {
            "id": r[0], "name": r[1], "party": r[2], "year": r[3], "state": r[4],
            "office": r[5], "district": r[6], "ici": r[7],
        }
    summary = {}
    for r in wb_rows:
        if len(r) < 30:
            continue
        summary[r[0]] = {
            "ici": r[2], "receipts": money(r[5]), "disbursements": money(r[7]),
            "cashOnHand": money(r[10]), "candidateContrib": money(r[11]),
            "candidateLoans": money(r[12]), "debts": money(r[16]),
            "individuals": money(r[17]), "pacs": money(r[25]), "party": money(r[26]),
            "coverageEnd": fec_date(r[27]),
        }
    index = {}
    for rec in master.values():
        index.setdefault((rec["office"], rec["state"], rec["district"]), []).append(rec)
    return master, summary, index


FEC_PARTY = {"DEM": "Democratic", "REP": "Republican", "LIB": "Libertarian", "GRE": "Green",
             "IND": "Independent", "NPA": "Independent", "CON": "Constitution", "UNK": ""}


def fec_hits(office, state, district, cand, index, summary):
    """Return (ordered FEC records, kind). Only 2026-cycle records are used.
    kind: 'ok', 'incumbent-fallback', 'only-other-year' or None."""
    office_code = "S" if office == "senate" else "H"
    if office == "senate":
        districts = ["00"]
    elif district == "AL":
        districts = ["00", "01"]
    else:
        districts = [district]
    pool = []
    for d in districts:
        pool.extend(index.get((office_code, state, d), []))
    hits = [r for r in pool if names_match(cand["name"], r["name"])]
    if not hits and cand.get("incumbent"):
        # Sitting member known by a nickname ("Jake Ellzey" = JOHN KEVIN ELLZEY):
        # same surname, FEC says incumbent (I), and exactly one such record.
        alt = [r for r in pool if r["year"] == "2026" and r["ici"] == "I"
               and last_name_compat(cand["name"], r["name"])]
        if len(alt) == 1:
            return alt, "incumbent-fallback"
    if not hits:
        # Typo in one of the sources (Wikipedia "Riechard" vs FEC "REICHARD"):
        # same first name, surname one edit away, same party, one such record.
        typo = [r for r in pool if r["year"] == "2026"
                and FEC_PARTY.get(r["party"], "") == cand["party"]
                and fuzzy_name_match(cand["name"], r["name"])]
        if len(typo) == 1:
            return typo, "fuzzy-surname"
        return [], None
    this_cycle = [r for r in hits if r["year"] == "2026"]
    if not this_cycle:
        return [], "only-other-year"
    this_cycle.sort(key=lambda r: (
        0 if FEC_PARTY.get(r["party"], "") == cand["party"] else 1,
        -(summary.get(r["id"], {}).get("receipts", 0))))
    return this_cycle, "ok"


def assign_fec(race, index, summary):
    """Match every candidate of a race to at most one FEC record, one-to-one.
    Returns a list parallel to race['candidates'] of (record or None, kind)."""
    cands = race["candidates"]
    found = []
    for c in cands:
        hits, kind = fec_hits(race["office"], race["state"], race["district"], c, index, summary)
        _, given = parse_fec_parts(hits[0]["name"]) if hits else ([], [])
        wiki_tokens, _ = parse_wiki_name(c["name"])
        exact_first = 1 if (hits and wiki_tokens and given and wiki_tokens[0] == given[0]) else 0
        found.append((hits, kind, (exact_first, 1 if c.get("incumbent") else 0)))
    order = sorted(range(len(cands)), key=lambda i: found[i][2], reverse=True)
    taken = set()
    result = [(None, found[i][1] if found[i][1] == "only-other-year" else None) for i in range(len(cands))]
    for i in order:
        hits, kind, _ = found[i]
        for rec in hits:
            if rec["id"] not in taken:
                taken.add(rec["id"])
                result[i] = (rec, kind)
                break
    return result


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------
def candidate_output(c, fec_rec, summary):
    out = {
        "name": c["name"],
        "party": c["party"],
        "partyDetail": c["partyDetail"],
    }
    if c.get("incumbent"):
        out["incumbent"] = True
    if c.get("wikipedia"):
        out["wikipedia"] = c["wikipedia"]
    if c.get("photo"):
        out["photo"] = c["photo"]
    out["fecId"] = fec_rec["id"] if fec_rec else None
    if fec_rec:
        s = summary.get(fec_rec["id"])
        if s:
            out["fec"] = {
                "cycle": 2026, "receipts": s["receipts"], "disbursements": s["disbursements"],
                "cashOnHand": s["cashOnHand"], "individuals": s["individuals"], "pacs": s["pacs"],
                "party": s["party"], "candidateContrib": s["candidateContrib"],
                "candidateLoans": s["candidateLoans"], "debts": s["debts"],
                "coverageEnd": s["coverageEnd"],
            }
        else:  # registered with the FEC but no financial summary filed yet
            out["fec"] = {
                "cycle": 2026, "receipts": 0, "disbursements": 0, "cashOnHand": 0,
                "individuals": 0, "pacs": 0, "party": 0, "candidateContrib": 0,
                "candidateLoans": 0, "debts": 0, "coverageEnd": None,
            }
    else:
        out["fec"] = None
    return out


def _first_token(name):
    t, _ = parse_wiki_name(name)
    return t[0] if t else ""


def _first_token_fec(name):
    _, given = parse_fec_parts(name)
    return given[0] if given else ""


def sort_key(race_id):
    order = {"senate": 0, "governor": 1, "house": 2}
    return (order[race_id.split(":")[0]], race_id)


def write_module(meta, nominees):
    body = []
    body.append("// GENERATED by scripts/export_nominees.py. DO NOT EDIT BY HAND.")
    body.append("export const NOMINEES_META = %s;" % json.dumps(meta, indent=2, ensure_ascii=False))
    body.append("export const NOMINEES = %s;" % json.dumps(nominees, indent=2, ensure_ascii=False))
    text = "\n".join(body) + "\n"
    text = text.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def expected_titles_from_list(page_title, pattern):
    page = wiki_page(page_title)
    if not page:
        return None
    return set(m.strip() for m in re.findall(pattern, page[1]))


def main():
    t0 = time.time()
    notes = []
    log("== Wikipedia: Senate ==")
    senate = collect_single_race_pages("senate", notes)
    log("   %d senate races" % len(senate))
    log("== Wikipedia: Governor ==")
    governor = collect_single_race_pages("governor", notes)
    log("   %d governor races" % len(governor))
    log("== Wikipedia: House ==")
    house = collect_house(notes)
    log("   %d house races" % len(house))

    log("== FEC bulk data ==")
    master, summary, index = load_fec()
    log("   %d S/H candidates in cn26, %d rows in weball26" % (len(master), len(summary)))

    races = {}
    races.update(senate)
    races.update(governor)
    races.update(house)

    matched = []
    unmatched = []
    other_year = []
    fallbacks = []
    nominees = {}
    for rid in sorted(races, key=sort_key):
        race = races[rid]
        out_cands = []
        if race["office"] in ("senate", "house"):
            assigned = assign_fec(race, index, summary)
        else:
            assigned = [(None, None)] * len(race["candidates"])
        for c, (rec, note) in zip(race["candidates"], assigned):
            if race["office"] in ("senate", "house"):
                if note == "only-other-year":
                    other_year.append((rid, c["name"]))
                if note in ("incumbent-fallback", "fuzzy-surname"):
                    fallbacks.append((rid, c["name"], rec["name"], rec["id"], note))
                if rec:
                    if rec["ici"] == "I" or summary.get(rec["id"], {}).get("ici") == "I":
                        c["incumbent"] = True
                    if not c["party"]:
                        c["party"] = FEC_PARTY.get(rec["party"], "")
                    matched.append((rid, c["name"], rec))
                else:
                    unmatched.append((rid, c["name"], c["party"]))
            out_cands.append(candidate_output(c, rec, summary))
        race_out = dict(race)
        race_out["candidates"] = out_cands
        nominees[rid] = race_out

    n_s = sum(1 for r in nominees.values() if r["office"] == "senate")
    n_g = sum(1 for r in nominees.values() if r["office"] == "governor")
    n_h = sum(1 for r in nominees.values() if r["office"] == "house")
    n_c = sum(len(r["candidates"]) for r in nominees.values())
    n_fed = sum(len(r["candidates"]) for r in nominees.values() if r["office"] != "governor")
    meta = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "electionDate": ELECTION_DATE,
        "sources": [
            "Wikipedia (CC BY-SA 4.0), 2026 United States Senate, gubernatorial and House election "
            "pages, retrieved via the MediaWiki API: https://en.wikipedia.org/",
            "FEC bulk data (public domain): candidate master cn26 and all-candidates summary "
            "weball26, https://www.fec.gov/data/browse-data/?tab=bulk-data",
        ],
        "counts": {"senate": n_s, "governor": n_g, "house": n_h, "candidates": n_c,
                   "fecMatched": len(matched)},
    }
    size = write_module(meta, nominees)

    # ------------------------------------------------------------------ report
    log("")
    log("=" * 70)
    log("SUMMARY")
    log("=" * 70)
    log("Wikipedia requests: %d network, %d cached" % (WIKI_STATS["network"], WIKI_STATS["cached"]))
    log("Races: senate=%d (expect 35)  governor=%d (expect 36)  house=%d (expect 435)" % (n_s, n_g, n_h))
    log("Candidates: %d total (%d federal, %d governor)" % (n_c, n_fed, n_c - n_fed))

    # cross-check race sets against the list pages
    sen_list = expected_titles_from_list(
        "2026 United States Senate elections",
        r"\[\[(2026 United States Senate (?:special )?election in [A-Za-z ]+)[\]|]")
    gov_list = expected_titles_from_list(
        "2026 United States gubernatorial elections",
        r"\[\[(2026 [A-Za-z ]+ gubernatorial election)[\]|]")
    got_sen = set(re.sub(r".*/wiki/", "", r["source"]).replace("_", " ")
                  for r in nominees.values() if r["office"] == "senate")
    got_gov = set(re.sub(r".*/wiki/", "", r["source"]).replace("_", " ")
                  for r in nominees.values() if r["office"] == "governor")
    if sen_list is not None:
        log("Senate list-page cross-check: missing from dataset=%s ; extra in dataset=%s"
            % (sorted(sen_list - got_sen), sorted(got_sen - sen_list)))
    if gov_list is not None:
        log("Governor list-page cross-check: missing from dataset=%s ; extra in dataset=%s"
            % (sorted(gov_list - got_gov), sorted(got_gov - gov_list)))

    bad_house = []
    for abbr, seats in sorted(HOUSE_SEATS.items()):
        have = sum(1 for r in nominees.values() if r["office"] == "house" and r["state"] == abbr)
        if have != seats:
            have_keys = sorted(r["district"] for r in nominees.values()
                               if r["office"] == "house" and r["state"] == abbr)
            expect_keys = ["AL"] if seats == 1 else ["%02d" % i for i in range(1, seats + 1)]
            bad_house.append("%s: have %d expect %d (missing %s, unexpected %s)" % (
                abbr, have, seats, sorted(set(expect_keys) - set(have_keys)),
                sorted(set(have_keys) - set(expect_keys))))
    log("House per-state count problems: %s" % (bad_house or "none"))

    pending = [rid for rid, r in nominees.items() if r["status"] == "pending"]
    log("Races with status 'pending' (no nominees listed): %d %s" % (len(pending), pending))
    one_cand = [rid for rid, r in nominees.items() if len(r["candidates"]) == 1]
    log("Races with a single listed nominee: %d (House: %d)" % (
        len(one_cand), sum(1 for x in one_cand if x.startswith("house:"))))

    no_name = [(rid, i) for rid, r in nominees.items() for i, c in enumerate(r["candidates"])
               if not c["name"]]
    no_party = [(rid, c["name"]) for rid, r in nominees.items() for c in r["candidates"]
                if not c["party"]]
    log("Candidates without a name: %s" % (no_name or "none"))
    log("Candidates without a party: %s" % (no_party or "none"))

    parties = {}
    for r in nominees.values():
        for c in r["candidates"]:
            parties[c["party"]] = parties.get(c["party"], 0) + 1
    log("Party distribution: %s" % sorted(parties.items(), key=lambda kv: -kv[1]))

    log("FEC match: %d of %d Senate+House nominees (%.1f%%)" % (
        len(matched), n_fed, 100.0 * len(matched) / max(1, n_fed)))
    main_unmatched = [u for u in unmatched if u[2] in ("Democratic", "Republican")]
    n_main = sum(1 for r in nominees.values() if r["office"] != "governor"
                 for c in r["candidates"] if c["party"] in ("Democratic", "Republican"))
    log("  D/R nominees matched: %d of %d (%.1f%%)" % (
        n_main - len(main_unmatched), n_main, 100.0 * (n_main - len(main_unmatched)) / max(1, n_main)))
    log("  matched to an FEC id but no weball26 summary row: %d" % sum(
        1 for m in matched if m[2]["id"] not in summary))
    log("  names that match an FEC record only for a non-2026 cycle (left null): %s" % other_year)
    log("  unmatched D/R nominees (%d): %s" % (
        len(main_unmatched), [(u[0], u[1]) for u in main_unmatched][:60]))

    log("  incumbent/fuzzy-surname fallback matches (%d): %s" % (len(fallbacks), fallbacks))
    loose = [(rid, name, rec["name"]) for rid, name, rec in matched
             if _first_token(name) != _first_token_fec(rec["name"])]
    log("  matches where first names differ (nickname/prefix/other), %d: %s" % (len(loose), loose[:80]))

    rng = random.Random(2026)
    log("10 random matched pairs (wiki name -> FEC name -> receipts):")
    for rid, name, rec in rng.sample(matched, min(10, len(matched))):
        log("   %-12s %-28s -> %-32s %-10s $%s" % (
            rid, name, rec["name"], rec["id"], format(summary.get(rec["id"], {}).get("receipts", 0), ",")))

    def find(rid, fragment):
        for c in nominees.get(rid, {}).get("candidates", []):
            if fragment in c["name"]:
                return c
        return None
    mk = find("senate:MA", "Markey")
    de = find("senate:MA", "Deaton")
    log("Markey -> %s (expect S4MA00028); Deaton -> %s (expect S6MA00304)" % (
        mk and mk["fecId"], de and de["fecId"]))
    warren = [rid for rid, r in nominees.items() if r["office"] == "senate"
              for c in r["candidates"] if "Warren" in c["name"]]
    log("Warren in Senate 2026 set: %s (expect False)" % bool(warren))

    if notes:
        log("Parser notes (%d):" % len(notes))
        for n in notes:
            log("   - " + n)
    log("Wrote %s (%d bytes, %.1f KB) in %.1fs" % (OUT, size, size / 1024.0, time.time() - t0))


if __name__ == "__main__":
    main()

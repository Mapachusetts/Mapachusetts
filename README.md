# Mapachusetts 🌎

**Politics, mapped to where you live.** An interactive 3D globe that shows every
layer of U.S. government covering a spot (country, state, congressional
district, state senate and house districts, county, city or town, school
district, and city wards where open data exists), plus the elections and town
halls that matter there.

- **Find a place 4 ways:** search, **Use my location**, the *Browse by list*
  menus (State → County → City), or just click the globe.
- **See the stack:** a *layer dock* of color-coded chips, each with a glowing
  outline on the map. Hover or click a chip to highlight that boundary.
- **Ballot by layer:** each layer of government has its own section (what it
  does, and the races it decides). Plus an *Events* tab for town halls, meetings
  and voting dates, and an Election Day countdown.
- **Every state, county and city** is reachable. States and counties are real,
  clickable shapes; counties and cities load from the Census the first time you
  open their parent.
- **U.S. only for now.** The world stays on the globe, but only the U.S. is lit
  up; everything else is greyed out and says it isn't available yet.
- **Candidate profiles:** click a candidate on the ballot (or search a name) to
  open a six-tab research profile: *In the News* (cited), *Funding*, *Career*,
  *Issues* (with voting records), *Sources* and *Myths & Facts*. `?candidate=maura-healey`
  is a shareable link.
- **Voting precincts and wards** for any U.S. spot (Census 2020 voting districts).
- **Night / Day** map themes, keyboard friendly (press `/` to search), phone
  layout with a bottom sheet.

> **Real vs. sample data.** Boundaries and districts are real (Census). The
> **Massachusetts 2026 governor and U.S. Senate races are real**: researched
> candidates (Healey, Minogue, Markey, Deaton) with cited news, funding, issues,
> careers, sources and myths, opened from the ballot, the search box or the
> intro. Everything else (other states' races, local offices, events) is a
> **SAMPLE placeholder**, labeled "Sample" in the UI.

## Run it

Static site using ES modules, so serve it over HTTP (not `file://`):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://localhost:8000
```

> **Keep `--bind 127.0.0.1`.** This folder also holds the Next.js app, whose
> `.env` file contains secret keys (`SUPABASE_SERVICE_ROLE_KEY`). A plain
> `http.server` serves every file here to anyone on your network, `.env`
> included. `.env` is gitignored; just don't expose this folder. For the
> Next.js app itself see the section at the bottom.

Needs internet (map tiles, MapLibre, the Census service and the geocoder load
from public hosts). Geolocation needs a secure context; `localhost` counts,
production needs HTTPS. No API keys anywhere.

## Where does X go? (start here when adding data)

| I want to add or change...                      | Edit this | How |
| ----------------------------------------------- | --------- | --- |
| **Add or update a researched candidate**        | `supabase/seed-data/<slug>.json` (+ `lib/candidate-profiles.ts`), then `python3 scripts/export_candidates.py` | The export script rebuilds `data/political-data.generated.js`. Never edit that file by hand. See "Political data in the globe". |
| **Which candidates are in which race**          | `data/candidates.js` → `RACES` | List candidate slugs per race; names and parties come from the profiles. |
| **Real races / candidates** (your datasets)     | `data/civic.js` → `fetchRacesForPlace(placeId, stack)` | Return `Race` objects (`data/types.js`). Give each a **`kind`** (which layer decides it) and the UI files it under the right layer. Key district races on the ids in `stack` (e.g. `congress:4822`, `school:4819650`). |
| **Real events / town halls**                    | `data/civic.js` → `fetchEventsForPlace(placeId)` | Return `Event` objects. Optional `kind` adds a colored layer tag. |
| **Sample races/events for one place**           | `data/places.js` → that place's `races: []` / `events: []` | Use factories from `data/races.js` / `data/events.js`. Copy Sugar Land (TX) or Medford (MA). |
| A new **layer of government** (e.g. fire district) | `data/kinds.js` + a lookup in `data/census.js` (or `data/local-sources.js`) | `kinds.js` sets its icon, color and the plain-language blurb. |
| **City wards / council districts** for a city   | `data/local-sources.js` | Add one entry (ArcGIS or Socrata URL + field). It shows up automatically. Boston, Chicago and NYC are done. |
| A new **kind of race** (icon, tag)              | `data/races.js` → `CATEGORY_META` | |
| A new **kind of event**                         | `data/events.js` → `EVENT_TYPES` | |
| **Exact field names / shapes**                  | `data/types.js` | JSDoc for `Place`, `Race`, `Event`, `Jurisdiction`, `GeocodeResult`. Point prompts here. |
| **Geocoder** (text search)                      | `js/geocode.js` | Swap `PHOTON_URL`, or self-host Photon. Holds the U.S.-only filter. |
| **Which countries are active** on the globe     | `js/globe.js` → `ACTIVE_COUNTRIES` | ISO alpha-3 codes. Also needs places in `data/places.js` and a wider geocoder filter. |
| **Map colors / themes**                         | `js/globe.js` → `THEMES`; `styles.css` top | |
| **Layer colors** (used everywhere)              | `data/kinds.js` | One color per layer: map outline, dock chip and ballot section share it. |
| **Look and feel**                               | `styles.css`, `index.html` | CSS variables are at the top of `styles.css`. |

### How it fits together

```
 search / GPS / menus / globe click
              │
        js/navigation.js   (which place am I on? + the exact point)
              │
          js/app.js ────────────────────────────────────────────────┐
              │                                                      │
   data/civic.js  (the ONE data seam)                        js/globe.js  js/ui.js
     ├─ geography ─► data/census.js        real boundaries     (map layers)  (dock, ballot,
     │               data/local-sources.js wards, council                     events, menus)
     └─ politics  ─► data/candidates.js    REAL researched races + candidates
                     data/places.js        SAMPLE races + events (everything else)
```

When you land on a place, the app asks the **Census Bureau (TIGERweb)** which
boundaries contain the point, in parallel, and gets back a **stack** of
`Jurisdiction`s. Each one becomes a dock chip, a glowing outline, and a ballot
section. Races are matched to layers by their `kind`.

Races/events attached to a place (in `data/places.js`) are also **inherited by
everything below it**: put a governor race on the state, a mayor race on the
city.

### Districts follow the exact point

A city can span several congressional or legislative districts. The stack is
looked up for the **spot you searched or your GPS position**; for a plain city
click it uses the city's center, and the UI says so.

## Files

```
index.html         Page structure (command bar, browse panel, hero, dossier, dock)
styles.css         All styling (Night/Day tokens at the top)

scripts/
  export_candidates.py  Teammates' candidate data -> data/political-data.generated.js

prototypes/
  ward-layer/      Original Leaflet voting-district map (kept for reference)

js/
  app.js           Entry point: wires everything together
  candidate-sheet.js  Candidate profile sheet (six tabs), ported from the React app
  navigation.js    "Where am I?" state + the exact point + menu choices
  globe.js         MapLibre 3D globe: world shading, clickable shapes, layer outlines, pins
  ui.js            Renders dock, ballot-by-layer, events, countdown, menus, messages
  search.js        Search-as-you-type box (accessible combobox)
  geocode.js       Text search (Photon), U.S.-only filter
  geolocation.js   Browser location, as a promise

data/
  civic.js         THE data seam. Swap sample politics for real data here
  candidates.js    Real candidates + the races they run in (merge logic from lib/candidates.ts)
  political-data.generated.js  GENERATED from the research app's data. Don't edit
  census.js        Census TIGERweb client: stack, boundaries, county/city lists
  local-sources.js City ward / council-district sources (Boston, Chicago, NYC)
  kinds.js         The layers of government: names, icons, colors, explanations
  places.js        Place tree + SAMPLE races/events + lookup helpers
  races.js         Race factories + category tags
  events.js        Event factories + event-type icons/colors
  levels.js        World > Country > State > County > City > District
  us-states.js     50 states + DC (names, centers, zooms, FIPS codes)
  types.js         JSDoc reference for every data shape
```

## Good to know

- **Where your data goes (privacy):** the text typed in the search box goes to
  the public geocoder `photon.komoot.io`. The coordinates of a searched spot or
  of the user's location (only when they press *Use my location*) go to the
  U.S. Census Bureau's TIGERweb service, and to the city open-data portals for
  Boston, Chicago and NYC when the point is in those cities. Nothing else leaves
  the browser. The public geocoder is shared and rate-limited, so self-host or
  use a paid one for production.
- **District maps can lag reality.** Boundaries are whatever the Census has
  published (currently the 120th Congress and 2026 legislative districts). Some
  states redrew maps for 2026, so the UI tells people to confirm with their
  local election office. Congressional districts are not guaranteed to match
  the maps used on Election Day.
- **Cities & towns:** in New England-style states (CT, ME, MA, MI, MN, NH, NJ,
  NY, PA, RI, VT, WI) towns come from Census "county subdivisions"; elsewhere,
  from "incorporated places". A spot with no city or town is shown as
  unincorporated, and the county covers it. A city that straddles counties is
  listed under the county holding its center.
- **Map tech:** MapLibre GL JS 6 (ES module from unpkg, version pinned in
  `js/globe.js` and `index.html`). Basemaps: OpenFreeMap (dark and bright).
  Country shading: MapLibre demo tiles. No keys needed.
- **Sample dates** are relative to today so demos never look stale. Election Day
  events use the real dates (Nov 3, 2026 and Nov 7, 2028).
- **Accessibility:** keyboard-friendly search, tabs and menus; visible focus
  rings; 44px+ touch targets; screen-reader labels; reduced-motion support.
  Full WCAG validation still needs testing with assistive technology and an
  accessibility review.
- **Precincts** come from the 2020 Census voting districts, which can be out of
  date (precincts change often). Treat them as a guide and confirm your polling
  place with your local election office. City *council* wards exist only for the
  three cities in `data/local-sources.js`.
- **Not covered yet:** U.S. territories (Puerto Rico, Guam, ...), real races
  outside Massachusetts, and automated tests.

## Political data in the globe

The candidate research app (below) is the **source of truth** for political
data. The globe is a static site with no build step, so it reads a generated
copy:

```
supabase/seed-data/*.json        politician + cited news summary   ┐
lib/candidate-profiles.ts        funding / issues / career / ...   ┴─► python3 scripts/export_candidates.py
                                                                          │
                                                       data/political-data.generated.js
                                                                          │
                           data/candidates.js  (merge by slug, same logic as lib/candidates.ts)
                                  │                          │
                    racesForState("MA") ──► ballot     getCandidate(slug) ──► js/candidate-sheet.js
```

**Add a candidate:** create `supabase/seed-data/<slug>.json` (copy an existing
one), optionally add a curated profile to `lib/candidate-profiles.ts`, run
`python3 scripts/export_candidates.py`, then list the slug in a race in
`RACES` in `data/candidates.js`. The Next.js app picks up the same files
(`node supabase/build-news-seed.mjs` rebuilds its SQL).

**Live data (not wired yet):** the globe reads the exported file, not Supabase,
so news summaries refresh whenever you re-run the export. To read Supabase
live instead, replace the bodies of `fetchRacesForPlace` in `data/civic.js`
with a call to Supabase's REST API using the **anon** key (it is designed to be
public; Row Level Security gives read-only access). Never put the
`service_role` key in browser code.

---

## Candidate research app (Next.js + Supabase)

> From the `politician_pages` / `candidate-search` branches. This is the
> political-data side of the project: candidate profiles, cited news
> summaries and the Supabase database. The globe UI above reads the same
> candidates through `data/candidates.js` (see "Political data in the globe").

A civic research site for Massachusetts candidates: search a candidate to see
cited summaries of their recent news coverage, funding, issue positions, career
history, sources, and common myths.

- **Framework:** Next.js (App Router) — frontend + API in one project
- **Database:** Supabase (Postgres)
- **Hosting:** Vercel (app) + Supabase (database)

### Routes

- `/` — landing page and the candidate research UI (search plus tabs for
  In the News, Funding, Career, Issues, Sources, and Myths & Facts)
- `/?candidate=<slug>` — opens a candidate's profile directly (shareable)
- `/news` — latest stored headlines, linking to the original reporting
- `/politicians/<slug>` — redirects to `/?candidate=<slug>`

### Where the data comes from

Each profile merges two sources by `slug` (see `lib/candidates.ts`):

- **Supabase** — `politicians` (name, office, party, bio, career history) and
  `politician_news_summaries` (AI-written summaries with numbered citations).
- **Curated profiles** — `lib/candidate-profiles.ts`, hand-written funding,
  issue, source, and myth data from the original candidate-search design.
  A profile without a Supabase row still appears in search.

Tabs with no data for a candidate show an empty state instead of hiding.

### Setup

#### 1. Install dependencies

```bash
npm install
```

#### 2. Create the database

In the Supabase dashboard, open **SQL Editor → New query** and run, in order:

1. [`supabase/schema.sql`](supabase/schema.sql) — tables, indexes, Row Level
   Security (public read).
2. [`supabase/news_seed.sql`](supabase/news_seed.sql) — the 2026 statewide
   candidates and their cited news summaries (Oct 10–24, 2026).

`news_seed.sql` is generated from `supabase/seed-data/*.json`. After editing
those files, rebuild it with `node supabase/build-news-seed.mjs`, which also
validates the citations.

#### 3. Environment variables

Values live in `.env` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
ANTHROPIC_API_KEY=<optional; only for npm run summarize>
```

- The URL and anon key are safe to expose to the browser.
- The `service_role` and Anthropic keys are secrets and are only used
  server-side. Never commit them or ship them to the browser.

#### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

### Refreshing the news

- `npm run ingest` — pulls RSS headlines into `articles`.
- `npm run summarize` — fetches article text (kept in memory only), links
  articles to politicians by full name, and writes cited summaries. Needs
  `ANTHROPIC_API_KEY`.
- `npm run news` — both, in order.

Only headlines, links, short snippets, and summaries are stored, never full
article text.

### Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo.
3. Add the environment variables above in the Vercel project settings.
4. Deploy.

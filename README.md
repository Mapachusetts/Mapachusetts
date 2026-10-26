# Mapachusetts

**Politics, mapped to where you live.** An interactive 3D globe that shows every
layer of U.S. government covering a spot (country, state, congressional
district, state senate and house districts, county, city or town, school
district, and city wards where open data exists), plus the elections and public
meetings that matter there. It is written to work for any U.S. address, not one
state.

- **Find a place 5 ways:** search a place, a **street address or ZIP code**,
  **Use my location**, the *Browse by list* menus (State, County, City), or click
  the globe.
- **See the stack:** a *layer dock* of color-coded chips, each with a glowing
  outline on the map.
- **Ballot by layer:** each layer of government has its own section (what it
  does, and the races it decides), plus an *Events* tab and an Election Day
  countdown.
- **Who holds office now:** in each layer's ballot section, an *In office now* list
  with the people who hold the seats, on the ballot or not (the President and
  Vice President, both U.S. senators and the governor of every state, and for
  Massachusetts also statewide officers, state legislators, U.S.
  representatives, sheriffs, district attorneys and mayors).
- **Candidates in every state:** U.S. Senate, governor and U.S. House nominees,
  with official FEC money totals. Click one for a profile. Where the team has
  researched someone (cited news, issues, career, myths and facts) the profile
  has more tabs.
- **Massachusetts pilot (everything on your ballot):** every layer you live in
  stays visible as you drop from the nation to your city, with who is in office and
  who is running at each level; the nine statewide ballot questions in plain words
  (plus any district-only question); a *Voting* tab that warns what changed since
  the last election (for example the federal mail-ballot rule fight) and lets you
  say how you voted in 2024 so the notices that matter to you stand out; and a
  phone-friendly layout. See "Massachusetts pilot".
- **Accounts (optional):** signed-in Massachusetts users get an *Ask* tab (an AI
  helper for nonpartisan questions, backed by Kiro) and a *Reports* tab (report a
  protest from where you stand, rate its intensity, and see recent reports on the
  map). See "Accounts, the assistant server and protest reports".
- **Races people are looking at:** the front page lists a geographically
  diverse set of races, chosen by recent attention (see "Trending").
- **U.S. only for now.** The rest of the world stays on the globe but is greyed
  out.
- **Voting precincts and wards** for any U.S. spot (Census 2020 voting districts).
- **Night / Day** themes, keyboard friendly (press `/` to search), phone layout.
- **Custom icons:** all icons are a hand-made SVG set in `js/icons.js`. There are
  no emoji in the interface.

> **Everything shown is real, or not shown.** There is no placeholder data.
> Boundaries come from the Census. Candidates come from Wikipedia's 2026 election
> pages matched to FEC filings. Meetings come from city Legistar calendars. Where
> there is no free national source, the app says so instead of inventing
> entries. See "What is and isn't covered".

## Run it

Static site using ES modules, so serve it over HTTP (not `file://`):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://localhost:8000
```

> **Keep `--bind 127.0.0.1`.** This folder also holds the Next.js app, whose
> `.env` file contains secret keys (`SUPABASE_SERVICE_ROLE_KEY`). A plain
> `http.server` serves every file here to anyone on your network, `.env`
> included. `.env` is gitignored; just don't expose this folder. If you deploy
> the static site, publish only the site files (`index.html`, `styles.css`,
> `js/`, `data/`), never the repo root.

Needs internet (map tiles, MapLibre, the Census service and the geocoder load
from public hosts). Geolocation needs a secure context; `localhost` counts,
production needs HTTPS. No API keys anywhere.

## What is and isn't covered

| Level | Status | Source |
| ----- | ------ | ------ |
| U.S. Senate, governor, U.S. House nominees, all states | Covered (see the counts in `data/nominees.generated.js`) | Wikipedia election pages (MediaWiki API), matched to FEC candidate files |
| Campaign money for those candidates | Covered where the FEC has a matching filing | FEC bulk files `cn26`, `weball26` |
| Researched profiles (news, issues, career) | Massachusetts Senate and governor only | `supabase/seed-data/`, `lib/candidate-profiles.ts` |
| Who holds office: President, Vice President, 100 senators, 50 governors | Covered, all states | congress-legislators, senate.gov, Open States, cross-checked against Wikipedia |
| Who holds office: Massachusetts statewide, legislature, U.S. House, sheriffs, DAs, 47 mayors | Covered, Massachusetts only | malegislature.gov, Open States, congress-legislators, MA election results, city sites. 3 House seats are vacant and not shown. Towns, city councils and school committees are not included |
| Who holds office: smaller seats in other states | **Not covered yet** | Add a generated file in the shape of `Officeholder` (`data/types.js`) and list it in `data/officeholders.js` |
| Public meetings | 25 cities with a Legistar calendar, plus Election Day everywhere | Legistar Web API |
| Massachusetts: statewide offices below governor, Governor's Council, State Senate and House, county offices | Covered where we could confirm the roster from at least two sources (see `data/ma-ballot.generated.js` for counts) | Official primary results (PD43+), municipal sample ballots, Ballotpedia, BallotReady, news guides |
| Massachusetts ballot questions | All 9 statewide, plus the one district-only question that could be verified | Hand-curated in `data/ma-ballot-questions.js` from town copies of the official booklet |
| Massachusetts voting-change notices and key dates | 28 notices, 10 dates, hand-curated | `data/ma-voting-notices.js` (court status can change daily) |
| State legislature, county, city, school board candidates in other states | **Not covered.** No free national source exists | See "Adding more" |
| Louisiana U.S. House | Pending: no nominees were listed on Wikipedia when the data was generated | |
| U.S. territories, tribal lands | Not covered yet | |

Options for the missing levels: Google Civic `voterInfoQuery` (needs a key, only
works near an election), Ballotpedia API or BallotReady API (paid), Open States
(key, legislators not candidates), or Wikipedia's per-state pages (free, but
each state is formatted differently).

## Refreshing generated data

Generated files are never edited by hand. Each script is Python 3 standard
library only and needs internet.

| Script | Writes | Notes |
| ------ | ------ | ----- |
| `python3 scripts/export_nominees.py` | `data/nominees.generated.js` | `--refresh` ignores the local download cache |
| `python3 scripts/export_events.py` | `data/events.generated.js` | Edit the `CITIES` table to add a city |
| `python3 scripts/export_trending.py` | `data/trending.generated.js` | Front-page "races people are looking at" |
| `python3 scripts/export_officeholders.py` | `data/officeholders.generated.js` | President, VP, senators, governors. Exits non-zero unless it finds 1, 1, 100 and 50. `--refresh` bypasses the cache |
| `python3 scripts/export_ma_officeholders.py` | `data/officeholders.ma.generated.js` | Massachusetts only. Exits non-zero if a legislator can't be matched to a Census district. Some mayors, sheriffs and DAs are kept in curated tables inside the script (with sources); re-check them after each election |
| `python3 scripts/export_ma_ballot.py` | `data/ma-ballot.generated.js` | Massachusetts pilot candidates below U.S. House. A race is written only if its roster agrees across two independent sources; the rest are listed in the script's notes |
| `python3 scripts/export_candidates.py` | `data/political-data.generated.js` | Researched profiles from `supabase/seed-data` |

Nominees, meetings and trending change daily near an election. Running these on
a schedule (a GitHub Actions cron that commits the results) is the intended way
to keep the site current. The front page hides the "right now" wording if the
trending file is more than 14 days old.

### Trending

"Trending" means how often each race's Wikipedia article was viewed over the
last 3 days (Wikimedia Pageviews API, public, no key). It measures attention,
not importance or competitiveness. To keep the front page diverse, the script
takes the top race from each Census region first (Northeast, Midwest, South,
West) and then fills the remaining slots, so it is never all one corner of the
country. The page says what it is based on and the dates.

## Massachusetts pilot

Massachusetts is the test state for the features below. They are switched on by
`pilotStates` in `js/config.js` (one list, one place) and nothing in other states
changes.

- **Whole ballot, every layer.** In the pilot every layer that has something to show
  (officeholders, races or questions) starts open, and the layer header says how
  many people are in office. Other states keep the one-layer-open view.
- **Candidates.** `data/ma-ballot.js` matches races to the layers covering your spot:
  statewide offices by state, State Senate/House by the Census district id, county
  offices by county id, and Governor's Council by State Senate district (exact even
  where a town is split, such as Boston). Each person gets a basic profile and is
  findable in search. Races we could not confirm are simply absent; the page says
  so and points to the official sample ballot.
- **Ballot questions.** Yes and No shown side by side, what happens if it passes and
  when, cost, attributed arguments, and sources. Nothing in any question changes how
  you vote on Nov. 3, 2026.
- **Voting tab.** Key dates and 28 notices sorted into Changed, Could still change,
  Same as before and Good to know. Choose how you voted in 2024 (kept only in your
  browser) and the notices that apply to you are marked. A banner on the Ballot tab
  shows the next deadline.
- **Keeping it honest.** The two curated files carry their sources and the date they
  were checked. Re-check them before each release and delete notices after Nov. 3.
  They were compiled by an AI assistant from public sources and have not been
  reviewed by an election official. The pages say so.

## Accounts, the assistant server and protest reports

Accounts are optional and the site works fully without them. Turn them on in four steps:

1. **Database.** Run `supabase/accounts.sql` in the Supabase SQL editor. It adds
   profiles, protest reports (the text people write is private; only the AI summary,
   rounded location, intensity and time are readable by signed-in users), flags (three
   flags hide a report) and usage counters, all behind Row Level Security. Then run
   the checks listed in `server/README.md`.
2. **Assistant server.** `server/assistant.py` (Python standard library only) checks
   logins, rate-limits people, calls Kiro, and is the only thing allowed to write
   reports. It holds `SUPABASE_SERVICE_ROLE_KEY` and `KIRO_API_KEY`, so it must run on
   a server you control (not in the browser, and not on Vercel's serverless runtime
   since it needs the Kiro CLI). `python3 server/check_kiro.py` is a one-time smoke
   test. Tests: `python3 -m unittest discover -s server/tests` (64 tests with fake
   Supabase and fake Kiro).
3. **Site settings.** Fill `supabaseUrl`, `supabaseAnonKey` (public by design) and
   `assistantUrl` in `js/config.js`. Never put a secret there.
4. **Serve over HTTPS** in production, and set `ALLOWED_ORIGINS` on the server.

What account holders get, in Massachusetts only:

- **Ask.** Questions go to Kiro with a short summary of what is on your page. The
  helper is told to stay nonpartisan, to say when it is unsure, never to recommend a
  candidate or discourage voting, and to send people to the official lookup for dates,
  deadlines, ID rules and polling places.
- **Reports.** The report must be filed from your current location (accuracy of 200 m
  or better, inside Massachusetts). You rate it Peaceful, Tense, Disruptive or Unsafe
  and describe it. Kiro writes a neutral one or two sentence summary of the protest
  only: no opinions, no motives, no names or details that identify private people.
  Text with emails, phone numbers, license plates or street addresses is refused.
  Reports expire after 6 hours, are limited per person, and can be flagged or deleted
  by their author. Only signed-in users can see reports.
- **How "Kiro API" works.** Kiro has no hosted chat API. The supported way is Kiro CLI
  headless mode (`KIRO_API_KEY` plus `kiro-cli chat --no-interactive`), which the
  server runs with no tools allowed and an empty working directory. Usage is billed to
  the Kiro account that owns the key, so confirm Kiro's terms allow serving public
  users before launch. The flags are documented as of Oct 2026 and could not be run in
  this build environment (see "Not verified" below).

## Where does X go? (start here when adding data)

| I want to add or change...                      | Edit this | How |
| ----------------------------------------------- | --------- | --- |
| **A researched candidate**                      | `supabase/seed-data/<slug>.json` (+ `lib/candidate-profiles.ts`), then `python3 scripts/export_candidates.py` | The slug must match the one `data/candidates.js` makes from the nominee's name. |
| **Real local races / candidates**               | `data/civic.js` → `fetchRacesForPlace(placeId, stack)` | Return `Race` objects (`data/types.js`). Give each a **`kind`** (which layer decides it) and the UI files it under the right layer. Key district races on the ids in `stack` (e.g. `congress:4822`, `school:4819650`). |
| **Officeholders for another state** | `scripts/export_ma_officeholders.py` as a template | Same output shape; match legislative districts by their Census `geoid` and name. List the new file in `data/officeholders.js` and add the state code to `localStates` |
| **More cities' meetings**                       | `scripts/export_events.py` → `CITIES` | Any city on Legistar. Re-run the script. |
| A new **layer of government** (e.g. fire district) | `data/kinds.js` + a lookup in `data/census.js` (or `data/local-sources.js`) | `kinds.js` sets its icon key, color and the plain-language blurb. |
| **City wards / council districts**              | `data/local-sources.js` | Add one entry (ArcGIS or Socrata URL + field). Boston, Chicago and NYC are done. |
| A new **kind of race** or **event** (icon, tag) | `data/races.js` → `CATEGORY_META`; `data/events.js` → `EVENT_TYPES` | Icons are keys of `js/icons.js`. |
| **An icon**                                     | `js/icons.js` | `icon("name", { size })` returns an SVG string. Duotone, 24px grid. |
| **Exact field names / shapes**                  | `data/types.js` | JSDoc for `Place`, `Race`, `Event`, `Jurisdiction`, `GeocodeResult`. |
| **Geocoder** (text, address, ZIP search)        | `js/geocode.js` | Swap `PHOTON_URL`, or self-host Photon. Holds the U.S.-only filter. |
| **Which countries are active** on the globe     | `js/globe.js` → `ACTIVE_COUNTRIES` | ISO alpha-3 codes. Also needs places in `data/places.js` and a wider geocoder filter. |
| **Map colors / themes**                         | `js/globe.js` → `THEMES`; `styles.css` top | |
| **Look and feel**                               | `styles.css`, `index.html` | CSS variables are at the top of `styles.css`. |

### How it fits together

```
 search / ZIP / address / GPS / menus / globe click
              │
        js/navigation.js   (which place am I on? + the exact point)
              │
          js/app.js ────────────────────────────────────────────────┐
              │                                                      │
   data/civic.js  (the ONE data seam)                        js/globe.js  js/ui.js
     ├─ geography ─► data/census.js        real boundaries     (map layers)  (dock, ballot,
     │               data/local-sources.js wards, council                     events, menus)
     └─ politics  ─► data/candidates.js    nominees + FEC money + research
                     data/events.generated.js  real meetings
```

When you land on a place, the app asks the **Census Bureau (TIGERweb)** which
boundaries contain the point, in parallel, and gets back a **stack** of
`Jurisdiction`s. Each one becomes a dock chip, a glowing outline, and a ballot
section. Races are matched to layers by their `kind`. A state page lists its
Senate, governor and every House race; a city or address lists only the House
race for the district that covers that spot.

### Districts follow the exact point

A city can span several congressional or legislative districts. The stack is
looked up for the **spot you searched or your GPS position**. Only a street
address or GPS fix is treated as exact. A ZIP code, city or county is an area,
so the UI says districts are for its center and suggests an address.

## Files

```
index.html         Page structure (command bar, browse panel, hero, dossier, dock)
styles.css         All styling (Night/Day tokens at the top)

scripts/           Python 3 (stdlib only) exporters, see "Refreshing generated data"

prototypes/
  ward-layer/      Original Leaflet voting-district map (kept for reference)

js/
  app.js           Entry point: wires everything together, front-page trending
  icons.js         The custom SVG icon set
  candidate-sheet.js  Candidate profile sheet (tabs shown only when there is data)
  navigation.js    "Where am I?" state + the exact point + menu choices
  globe.js         MapLibre 3D globe: world shading, clickable shapes, outlines, pins
  ui.js            Renders dock, ballot-by-layer, events, countdown, menus, messages
  search.js        Search-as-you-type box (accessible combobox)
  geocode.js       Place, street address and ZIP search (Photon), U.S.-only filter
  geolocation.js   Browser location, as a promise
  config.js        Public deployment settings and the pilot-state list
  voting-info.js   Voting tab (key dates, change notices, "how did you vote last time")
  auth.js          Tiny Supabase Auth client (no third-party code on a login page)
  account.js       Account dialog
  api.js           Calls to the assistant server and Supabase's table API
  assistant.js     Ask tab
  reports.js       Reports tab and the map pins
  dom.js           Safe DOM helpers (user text always uses textContent)

server/            Assistant server, its tests and a Kiro smoke test
supabase/accounts.sql  Tables and Row Level Security for accounts and reports

data/
  civic.js         THE data seam: races and events for a place
  candidates.js    People and races from the generated files (merge logic from lib/candidates.ts)
  ma-ballot.js                 Massachusetts pilot: races and ballot questions matched to your layers
  ma-ballot.generated.js         GENERATED: MA candidates below U.S. House
  ma-ballot-questions.js         CURATED: the 2026 ballot questions
  ma-voting-notices.js           CURATED: voting-change notices and key dates
  officeholders.js             Who holds each office now, matched to the Census stack
  officeholders.generated.js     GENERATED: President, VP, senators, governors
  officeholders.ma.generated.js  GENERATED: Massachusetts statewide, legislature, county, mayors
  nominees.generated.js        GENERATED: Senate, governor, House nominees + FEC money
  events.generated.js          GENERATED: city meetings
  trending.generated.js        GENERATED: front-page races
  political-data.generated.js  GENERATED: researched profiles
  census.js        Census TIGERweb client: stack, boundaries, county/city lists
  local-sources.js City ward / council-district sources (Boston, Chicago, NYC)
  kinds.js         The layers of government: names, icon keys, colors, explanations
  places.js        Place tree (geography only) + lookup helpers
  races.js         Category tags and the election date constants
  events.js        Event-type metadata and the Election Day event
  levels.js        World > Country > State > County > City > District
  us-states.js     50 states + DC (names, centers, zooms, FIPS codes)
  types.js         JSDoc reference for every data shape
```

## Good to know

- **Where your data goes (privacy):** the app has no server and keeps no
  history. Text typed in the search box, **including a street address or ZIP
  code**, is sent to the public geocoder `photon.komoot.io`. The coordinates of a
  searched spot or of the user's location (only when they press *Use my
  location*) go to the U.S. Census Bureau's TIGERweb service, and to the city
  open-data portals for Boston, Chicago and NYC when the point is in those
  cities. Map tiles load from OpenFreeMap and MapLibre from unpkg. The front
  page links to a plain-language version of this. The public geocoder is shared
  and rate-limited, so self-host or use a paid one for production. (The Census
  geocoder was rejected for addresses because it doesn't allow browser requests.)
- **District maps can lag reality.** Boundaries are whatever the Census has
  published. Some states redrew maps for 2026, so the UI tells people to confirm
  with their local election office.
- **Officeholders change.** Appointments, resignations, deaths and special
  elections happen between refreshes (the data includes several this year), and
  after Nov. 3 the winners take office in January. Each list says "As of" a date,
  and a seat whose election date has passed is labeled "list not yet updated"
  rather than showing a stale "next election". Re-run the two officeholder
  scripts on a schedule and after every election.
- **Nominee lists are compiled from Wikipedia**, a volunteer-edited source.
  Minor-party and independent candidates are sometimes missing from an infobox.
  The profile links to the Wikipedia article and the FEC filing so people can
  check. Late changes (withdrawals, court rulings) appear after the next refresh.
- **Voting dates and polling places** are not listed by state yet. The app links
  to `usa.gov/election-office`, `vote411.org` and Ballotpedia's sample ballot
  lookup. (`vote.gov` blocks automated checks, so it isn't linked directly.)
- **Cities & towns:** in New England-style states (CT, ME, MA, MI, MN, NH, NJ,
  NY, PA, RI, VT, WI) towns come from Census "county subdivisions"; elsewhere,
  from "incorporated places". A spot with no city or town is shown as
  unincorporated, and the county covers it.
- **Map tech:** MapLibre GL JS 6 (ES module from unpkg, version pinned in
  `js/globe.js` and `index.html`). Basemaps: OpenFreeMap. Country shading:
  MapLibre demo tiles. No keys needed.
- **Accessibility:** keyboard-friendly search, tabs and menus; visible focus
  rings; 44px+ touch targets; screen-reader labels; reduced-motion support.
  Full WCAG validation still needs testing with assistive technology and an
  accessibility review.
- **Precincts** come from the 2020 Census voting districts, which can be out of
  date. Treat them as a guide and confirm your polling place with your local
  election office.
- **Not covered yet:** U.S. territories, other languages, and automated tests.
- **Not verified in this build.** Browser flows were tested against fakes of Supabase
  and Kiro, and the assistant server against a fake of each. Not run against a real
  Supabase project (the column-level grants and Row Level Security in
  `supabase/accounts.sql` need the checks in `server/README.md`) or the real Kiro CLI
  (flags and output format are assumptions listed in `server/README.md`).
- **Protest reports can be misused.** They are unverified, AI-summarized and visible to
  signed-in users, and the server blocks personal details, but a person can still file
  a false report. Decide who may sign up, who reviews flags, and your retention policy
  before launching; the safeguards in this repo are rate limits, expiry, flags and
  deletion by the author.
- `presentation/`, `.kiro/` and `KIRO_USAGE.md` are not part of the site.

## Political data in the globe

The candidate research app (below) is the **source of truth** for researched
profiles. The globe is a static site with no build step, so it reads generated
copies:

```
supabase/seed-data/*.json        politician + cited news summary   ┐
lib/candidate-profiles.ts        issues / career / sources / ...   ┴─► python3 scripts/export_candidates.py
                                                                          │
                                                       data/political-data.generated.js ─┐
Wikipedia + FEC ──► python3 scripts/export_nominees.py ──► data/nominees.generated.js ───┤
                                                                                          ▼
                                data/candidates.js (nominee + FEC + research, merged by slug)
                                  │                          │
                racesForPlace("MA", {congress: "MA-05"})   getCandidate(slug) ──► js/candidate-sheet.js
```

**Research a candidate:** create `supabase/seed-data/<slug>.json` (copy an
existing one) using the slug `data/candidates.js` generates from the nominee's
name, optionally add a curated profile to `lib/candidate-profiles.ts`, then run
`python3 scripts/export_candidates.py`. The Next.js app picks up the same files
(`node supabase/build-news-seed.mjs` rebuilds its SQL). Funding figures are not
hand-written: the Money tab always shows FEC totals.

**Live data (not wired yet):** the globe reads the exported files, not Supabase.
To read Supabase live, call its REST API with the **anon** key (it is designed
to be public; Row Level Security gives read-only access). Never put the
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

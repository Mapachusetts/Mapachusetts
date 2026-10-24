# Developer guide

How Mapachusetts is put together and where to change things. For the feature
overview, tech stack and setup, see the [README](../README.md).

## Routes

| URL                    | What it is                                                   |
| ---------------------- | ------------------------------------------------------------ |
| `/`                    | The 3D globe (`public/index.html`, served by a rewrite in `next.config.mjs`) |
| `/?place=<id>`         | Globe opened on a place, e.g. `/?place=us-ma` (ids in `public/data/places.js`) |
| `/candidates`          | Candidate search + research profiles                         |
| `/candidates/<slug>`   | One candidate's profile (linked from the globe's race cards) |
| `/news`                | Latest stored headlines                                      |
| `/politicians/<slug>`, `/?candidate=<slug>` | Old links; redirect to `/candidates/<slug>` |

## Where does X go? (start here when adding data)

| I want to add or change...                    | Edit this                                    | How |
| --------------------------------------------- | -------------------------------------------- | --- |
| A real **data source** (API) for races/events | `public/data/civic.js`                       | Replace the body of `fetchRacesForPlace` / `fetchEventsForPlace`. Return objects shaped like `Race` / `Event` in `public/data/types.js`. **The UI needs no changes.** |
| **Races** for a specific place                | `public/data/places.js` → that place's `races: []` | Use a factory from `public/data/races.js` (`makeGovernorRace`, `makeMayorRace`, ...) for samples, or write a `Race` object (see the Massachusetts races). |
| **Link a candidate to their profile**         | the race's `candidates[]` in `public/data/places.js` | Add `slug: "<slug>"`. It must match a `politicians.slug` in Supabase or a profile in `lib/candidate-profiles.ts`. |
| **Events / town halls** for a place           | `public/data/places.js` → that place's `events: []` | Use `makeEvent({...})` from `public/data/events.js`. |
| A new **county or city** with its own data    | `public/data/places.js`                      | Nest a `node({...})` under its parent state/county. Copy Sugar Land (TX) or Medford (MA) as a template. |
| A new **kind of race** (icon, color, group)   | `public/data/races.js` → `CATEGORY_META`     | Add a category; set it on the race's `category`. |
| A new **kind of event**                       | `public/data/events.js` → `EVENT_TYPES`      | Add a type; set it on the event's `type`. |
| The **levels** (e.g. add "ward" under city)   | `public/data/levels.js`                      | Add to `LEVELS`; add matching nodes in `places.js`. |
| **Exact field names / shapes**                | `public/data/types.js`                       | JSDoc reference for `Place`, `Race`, `Event`, `GeocodeResult`. Point prompts at this file. |
| **Geocoder** (search + "Use my location")     | `public/js/geocode.js`                       | Swap `PHOTON_URL`, or self-host Photon. Also holds the U.S.-only filter. |
| **Which countries are active** on the globe   | `public/js/globe.js` → `ACTIVE_COUNTRIES`    | ISO alpha-3 codes (`"USA"`). Also needs places in `places.js` and a wider geocoder filter. |
| **Map colors** (active vs. greyed out)        | `public/js/globe.js` (top) + `public/styles.css` | `ACTIVE_COLOR`, `INACTIVE_COLOR`. |
| A **candidate profile** (funding, issues, myths) | `lib/candidate-profiles.ts`              | Add an entry with the candidate's `slug`. Shapes are in `lib/types.ts` (`CandidateProfile`). |
| A candidate's **news summary**                | `supabase/seed-data/<slug>.json`             | Then run `node supabase/build-news-seed.mjs` and re-run `news_seed.sql`, or use `npm run summarize`. |
| **Look and feel** (globe)                     | `public/styles.css`, `public/index.html`     | CSS variables are at the top of `styles.css`. |
| **Look and feel** (candidate/news pages)      | `app/globals.css`, `components/`             | The navbar matches the globe's top bar. |

## How data flows

```
 search box ─┐
 menus      ─┼─► js/navigation.js (current place) ─► js/app.js ─┬─► js/globe.js   (camera, pins, colored regions)
 geolocation ┤                                                    ├─► js/ui.js      (menus, breadcrumbs, cards)
 globe click ┘                                                    └─► data/civic.js (races + events for this place)
                                                                           │
                                                                           └─► data/places.js (sample tree today; real API tomorrow)

 race card name (slug) ─► /candidates/<slug> ─► lib/candidates.ts ─┬─► Supabase (politicians, news summaries)
                                                                   └─► lib/candidate-profiles.ts (curated funding, issues, myths)
```

Every place carries its own `races` and `events`. When you open a place, the app
collects its own **plus those of every ancestor** (`racesForNode` /
`eventsForNode` in `public/data/places.js`), so put data at the **highest level
that applies**: a governor race belongs on the state, a mayor race on the city.

### Anything not curated still works

All 50 states + DC always exist (`public/data/us-states.js`). Counties, cities
and districts that aren't in `places.js` are created the first time someone
searches for them (`ensurePath`), with no races/events of their own. The UI
tells the user "We don't have local details for X yet" and shows what applies
from above.

## Candidate pages

Each profile merges two sources by `slug` (`lib/candidates.ts`):

- **Supabase:** `politicians` (name, office, party, bio, career history) and
  `politician_news_summaries` (summaries with numbered citations).
- **Curated profiles:** `lib/candidate-profiles.ts`: photos, status, funding,
  issue, source, and myth data from the candidate-search design. A profile
  without a Supabase row still appears.

Supabase career entries are sorted newest first, and a curated entry with the
same years adds its organization and description. Tabs with no data show an
empty state instead of hiding.

### Seed data

`supabase/news_seed.sql` is generated from `supabase/seed-data/*.json`. After
editing those files, rebuild it:

```bash
node supabase/build-news-seed.mjs
```

The script checks each file before writing SQL: citations numbered 1..n, every
`[n]` resolves to a source, every source is cited, https URLs, and dates inside
the research window.

### Refreshing the news

- `npm run ingest`: pulls RSS headlines into `articles` (feeds are listed in
  `FEED_URLS` in `lib/ingest.ts`).
- `npm run summarize`: fetches article text (kept in memory only), links
  articles to politicians by full name, and writes cited summaries. Needs
  `ANTHROPIC_API_KEY`; set `SUMMARY_MODEL` to change the model.
- `npm run news`: both, in order.

## Files

```
public/              The globe (static; served at "/")
  index.html         Page structure (top bar, menus, globe, info panel)
  styles.css         Globe styling
  js/
    app.js           Entry point: wires everything together (+ ?place= deep links)
    navigation.js    "Where am I?" state: descend / ascend / jump, menu choices
    globe.js         MapLibre 3D globe: pins, camera, active/greyed-out regions
    ui.js            Renders menus, breadcrumbs, race + event cards, messages
    search.js        Search-as-you-type box (accessible combobox)
    geocode.js       Place search + reverse geocoding (Photon), U.S.-only filter
    geolocation.js   Browser location, as a promise
  data/
    civic.js         THE data seam: the only module the app asks for races/events
    places.js        Place tree + races/events + lookup helpers
    races.js         Race factories + category icons/colors
    events.js        Event factories + event-type icons/colors
    levels.js        World > Country > State > County > City > District
    us-states.js     All 50 states + DC (names, centers, zooms)
    types.js         JSDoc reference for every data shape

app/
  candidates/        /candidates and /candidates/[slug]
  news/              /news
  politicians/       Redirects old /politicians/[slug] links
  layout.tsx         Navbar + footer for the Next.js pages
  globals.css        Styles for the Next.js pages

components/
  CandidateResearch.tsx   Search, profile header and the six tabs
  CitedText.tsx           Turns [n] markers into citation links
  Navbar.tsx              Top bar for the Next.js pages
  ResearchSection.tsx     Shared "Candidate Research" section

lib/
  candidates.ts           Merges Supabase rows with curated profiles
  candidate-profiles.ts   Curated profiles (funding, issues, sources, myths)
  politicians.ts, articles.ts   Supabase queries
  ingest.ts, summarize.ts       News pipeline (CLI)
  types.ts                Shared TypeScript types
  supabase/server.ts      Server-only Supabase client (service_role key)

supabase/
  schema.sql         Tables, indexes, Row Level Security
  news_seed.sql      Generated seed (candidates + summaries)
  seed-data/         Researched summaries as JSON
  build-news-seed.mjs  Validates seed-data and writes news_seed.sql
```

## Good to know

- **Map tech:** MapLibre GL JS 6 is an ES module from unpkg, version pinned in
  `public/js/globe.js` and `public/index.html`. Basemap: OpenFreeMap "bright".
  Country shading: MapLibre demo vector tiles.
- **Links between the two halves:** the globe is a static page, so links from
  Next.js pages to `/` are plain `<a>` tags (full page load), not `<Link>`.
- **Dates:** the sample events use dates relative to today so demos never look
  stale. Election Day events use the real date (Nov 3, 2026).
- **Geocoder fair use:** the public Photon instance is shared and rate-limited.
  Keep the search debounce, and self-host or use a paid provider for production.

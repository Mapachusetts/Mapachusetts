# Mapachusetts 🌎

An interactive 3D globe that helps people find the **U.S.** elections, offices,
town halls and public meetings that matter where they live, plus a research
profile for each candidate (cited news summaries, funding, career, issues).

- **Find a place 3 ways:** type it in the search box, pick from the State /
  County / City menus, or press **Use my location**. Or just click the globe.
- **See what applies there:** an *On the ballot* tab and an *Events & town halls*
  tab, including everything that applies from larger areas (a state's governor
  race shows up for every city in that state).
- **Open a candidate:** highlighted candidate names on a race card open that
  candidate's research page at `/candidates/<slug>`.
- **U.S. only for now.** The whole world stays on the globe, but only the U.S. is
  colored in; every other country is greyed out and explains it isn't available
  yet. Search, the menus and geolocation only accept U.S. places.

> **Most races, candidates and events are SAMPLE placeholders**, labeled
> "Sample" in the UI. The Massachusetts governor and U.S. Senate races list the
> real 2026 candidates. Real datasets plug in through `public/data/civic.js`.

## Run it

It's one Next.js app. The globe is a static site in `public/`, served at `/`;
the candidate and news pages are Next.js routes.

```bash
npm install
npm run dev
# open http://localhost:3000
```

The globe needs internet (map tiles, MapLibre and the geocoder load from public
CDNs). Geolocation needs a secure context; `localhost` counts, production needs
HTTPS. The candidate pages need Supabase (see [Candidate pages](#candidate-pages-nextjs--supabase)).

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
| **Look and feel** (globe)                     | `public/styles.css`, `public/index.html`     | CSS variables are at the top of `styles.css`. |
| **Look and feel** (candidate/news pages)      | `app/globals.css`, `components/`             | The navbar matches the globe's top bar. |

### How data flows

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

## Candidate pages (Next.js + Supabase)

Each profile merges two sources by `slug` (see `lib/candidates.ts`):

- **Supabase:** `politicians` (name, office, party, bio, career history) and
  `politician_news_summaries` (AI-written summaries with numbered citations).
- **Curated profiles:** `lib/candidate-profiles.ts`, hand-written photos,
  status, funding, issue, source, and myth data from the candidate-search
  design. A profile without a Supabase row still appears.

Tabs with no data for a candidate show an empty state instead of hiding.

### Database setup

In the Supabase dashboard, open **SQL Editor → New query** and run, in order:

1. [`supabase/schema.sql`](supabase/schema.sql): tables, indexes, Row Level
   Security (public read).
2. [`supabase/news_seed.sql`](supabase/news_seed.sql): the 2026 statewide
   candidates and their cited news summaries (Oct 10–24, 2026).

`news_seed.sql` is generated from `supabase/seed-data/*.json`. After editing
those files, rebuild it with `node supabase/build-news-seed.mjs`, which also
validates the citations.

### Environment variables

Values live in `.env` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
ANTHROPIC_API_KEY=<optional; only for npm run summarize>
```

The `service_role` and Anthropic keys are secrets, used server-side only. Never
commit them or ship them to the browser.

### Refreshing the news

- `npm run ingest`: pulls RSS headlines into `articles`.
- `npm run summarize`: fetches article text (kept in memory only), links
  articles to politicians by full name, and writes cited summaries. Needs
  `ANTHROPIC_API_KEY`.
- `npm run news`: both, in order.

Only headlines, links, short snippets, and summaries are stored, never full
article text.

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

app/                 Next.js routes: candidates, news, redirects
components/          Candidate research UI (React)
lib/                 Data layer: Supabase queries, curated profiles, news pipeline
supabase/            schema.sql, news_seed.sql, seed-data/
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo.
3. Add the environment variables above in the Vercel project settings.
4. Deploy.

## Good to know

- **Privacy:** the text typed in the globe's search box and (only when the user
  presses *Use my location*) their coordinates are sent to the public geocoder
  `photon.komoot.io`. The public instance is shared and rate-limited, so
  self-host or use a paid provider for production.
- **Map tech:** MapLibre GL JS 6 (ES module from unpkg, version pinned in
  `public/js/globe.js` and `public/index.html`). Basemap: OpenFreeMap "bright".
  Country shading: MapLibre demo vector tiles. No API keys needed for the map.
- **Dates:** the sample events use dates relative to today so demos never look
  stale. Election Day events use the real date (Nov 3, 2026).
- **Accessibility:** keyboard-friendly search and tabs, visible focus rings,
  44px+ touch targets, screen-reader labels. Full WCAG validation still needs
  testing with assistive technology and an accessibility review.
- **Not covered yet:** U.S. territories (Puerto Rico, Guam, ...) aren't included,
  and there's no automated test suite.

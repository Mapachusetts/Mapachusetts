# Mapachusetts 🌎

**Find what's on your ballot, then get to know who's running.**

Mapachusetts is a civic information site. An interactive 3D globe shows the
U.S. elections, offices, town halls and public meetings that apply where you
live. Each Massachusetts candidate has a research profile with cited news
summaries, campaign funding, career history and issue positions, in plain
English.

> **Status:** prototype. The Massachusetts governor and U.S. Senate races and
> the candidate news summaries use real 2026 data. Most other races and all
> events on the globe are sample placeholders, labeled **Sample** in the UI.
> See [What's real and what's sample](#whats-real-and-whats-sample).

## Features

### 🌎 Ballot globe (`/`)

- **Interactive 3D globe.** The U.S. is highlighted; other countries are
  greyed out and explain they aren't covered yet. An idle sway keeps the U.S.
  in view.
- **Four ways to find your place:** search-as-you-type, State / County / City
  dropdowns, **Use my location**, or click a pin on the map. Breadcrumbs and
  **Back up** / **Whole world** buttons move you between levels.
- **On the ballot tab.** Races are grouped by type (executive, legislative,
  local, schools, ballot questions). Races are inherited from larger areas, so
  the governor's race shows up for every Massachusetts city.
- **Real Massachusetts races.** The 2026 governor and U.S. Senate cards list
  the actual ballot candidates. Highlighted names open that candidate's
  profile.
- **Events & town halls tab.** Upcoming meetings, hearings, forums and Election
  Day, with date badges, "in 3 days" labels and online options.
- **Works anywhere in the U.S.** Places without curated data are created on the
  fly from search, with a "no local details yet" note and everything that
  applies from the state level.
- **Shareable deep links:** `/?place=us-ma` opens the globe on Massachusetts.

### 👤 Candidate research profiles (`/candidates`)

- **Search and browse** candidates by name, office or party. Each profile has
  its own shareable URL: `/candidates/<slug>`.
- **Profile header:** official photo, party, current-status badge, term info,
  and links to the candidate's races on the map and to OpenSecrets.
- **Six tabs:**

  | Tab | What it shows |
  | --- | --- |
  | In the News | AI-written summary of recent coverage. Every sentence has `[n]` citations that jump to a numbered list of source articles. |
  | Funding | Total raised, top industry, small-donor share, and bar charts of top funding sources, with plain-English explanations. |
  | Career | Current-status card (committees, what the office means), bio, and a career timeline. |
  | Issues | Positions across 11 topics, each with sub-issues, a support meter, and vote records. |
  | Sources | Research sources tagged by media-bias rating and source type, plus the articles cited in the news summary. |
  | Myths & Facts | Widely shared claims, where they came from, and what the record shows, with a link to verify. |

- **"In plain English" and "Why people are searching this"** boxes explain
  each topic for readers who don't follow politics closely.
- **Honest empty states.** If a tab has no data for a candidate, it says so and
  points to official sources (FEC, OpenSecrets, Massachusetts OCPF).

### 📰 News pipeline (`/news` + CLI)

- **`npm run ingest`** pulls political headlines from RSS feeds into Supabase,
  de-duplicated by URL.
- **`npm run summarize`** reads each article, matches it to politicians by full
  name, and asks Claude for a neutral summary per candidate. Citation numbers
  are checked against the real sources before saving.
- **`/news`** lists the stored headlines and links to the original reporting.
- **Copyright-conscious:** only headlines, links, short snippets and summaries
  are stored, never full article text.

### ♿ Accessibility

Keyboard-operable search (ARIA combobox) and tabs (arrow keys), visible focus
rings, 44px+ touch targets, a skip link, screen-reader labels, and reduced
motion support. Full WCAG conformance still needs testing with assistive
technology and an accessibility review.

## Tech stack

| Layer | Technology |
| --- | --- |
| Web framework | [Next.js 16](https://nextjs.org) (App Router) with React 19. Server components load data; client components handle search, tabs and the menu. |
| Language | TypeScript 5 (strict) for the app; vanilla JavaScript ES modules for the globe, with no build step |
| Map | [MapLibre GL JS 6.15](https://maplibre.org) in globe projection, [OpenFreeMap](https://openfreemap.org) "bright" vector basemap, MapLibre demo tiles for country shading |
| Geocoding | [Photon](https://photon.komoot.io) (OpenStreetMap data), filtered to the U.S.; the browser Geolocation API for "Use my location" |
| Database | [Supabase](https://supabase.com) (PostgreSQL) with Row Level Security (public read-only), full-text and `pg_trgm` indexes, via `@supabase/supabase-js` 2 |
| AI | Anthropic Claude through the Messages API for news summaries (model set by `SUMMARY_MODEL`) |
| News ingest | RSS 2.0 feeds (default: Politico Congress); RSS and article HTML parsed without extra libraries |
| Styling | Plain CSS with custom properties; no CSS framework |
| Tooling | Node.js 20.9+ (developed on Node 24), `tsx` for the CLI scripts |
| Hosting | Built for Vercel (app) and Supabase (database) |

The app has four runtime npm dependencies: `next`, `react`, `react-dom` and
`@supabase/supabase-js`. The globe loads MapLibre from a CDN, and none of the
map services need an API key.

### How it fits together

```
Browser
 ├─ /                 Static globe (public/index.html + js/ + data/), served by a rewrite
 │                      └─ candidate name on a race card ──► /candidates/<slug>
 ├─ /candidates/...   Next.js page ─► lib/candidates.ts ─┬─► Supabase: politicians, news summaries
 │                                                       └─► lib/candidate-profiles.ts (curated)
 └─ /news             Next.js page ─► Supabase: articles

CLI: npm run news
 RSS feeds ─────► lib/ingest.ts ────► articles
 article pages ─► lib/summarize.ts ─► Claude ─► politician_news_summaries (+ article_politicians)
```

Profiles merge Supabase data with hand-curated profiles by `slug`. If Supabase
is unreachable, the curated profiles still render.

## What's real and what's sample

| Data | Status |
| --- | --- |
| Massachusetts governor and U.S. Senate races on the globe | Real 2026 ballot candidates ([GBH News voter guide](https://www.wgbh.org/news/politics/2026-10-22/mass-midterm-election-2026-everything-you-need-to-know)) |
| News summaries for Healey, Minogue, Markey and Deaton | Real coverage from Oct 10–24, 2026: 8 cited articles each, 26 unique articles. Written with AI assistance; verify claims with the linked sources. |
| Curated profiles (Warren, Markey) | Hand-written research. Funding figures cite OpenSecrets. Some status details may be out of date. |
| All other races, and every event on the globe | Sample placeholders, labeled **Sample** |

## Getting started

**Prerequisites:** Node.js 20.9+ and a Supabase project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up the database.** In the Supabase SQL Editor, run
   [`supabase/schema.sql`](supabase/schema.sql), then
   [`supabase/news_seed.sql`](supabase/news_seed.sql). Both are safe to re-run.

3. **Add environment variables** to `.env` (gitignored):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
   ANTHROPIC_API_KEY=<optional; only for npm run summarize>
   ```

4. **Run it**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. The globe needs internet access for map tiles,
   MapLibre and the geocoder.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run ingest` | Pull RSS headlines into `articles` |
| `npm run summarize` | Write cited news summaries (needs `ANTHROPIC_API_KEY`) |
| `npm run news` | `ingest`, then `summarize` |
| `node supabase/build-news-seed.mjs` | Validate `supabase/seed-data/*.json` and rebuild `news_seed.sql` |

### Deploying

Import the repo into Vercel, add the environment variables above in the project
settings, and deploy. Production needs HTTPS for **Use my location**.

## Project structure

```
public/        The globe: index.html, styles.css, js/ (map, search, UI), data/ (places, races, events)
app/           Next.js routes: /candidates, /candidates/[slug], /news, redirects
components/    Candidate research UI (search, profile tabs, citations, navbar)
lib/           Data layer: Supabase queries, curated profiles, RSS ingest, summarizer
supabase/      schema.sql, news_seed.sql, seed-data/ (researched summaries as JSON)
docs/          DEVELOPMENT.md: where to add data, data flow, file-by-file guide
```

## Privacy and security

- The Supabase `service_role` key is only used server-side. The public can read
  but not write any table (Row Level Security).
- Text typed into the globe's search box, and your coordinates only if you press
  **Use my location**, are sent to the public Photon geocoder.
- `npm run summarize` sends article excerpts to Anthropic.

## Known limitations

- Most globe data is sample. Real civic data plugs in through
  `public/data/civic.js` without UI changes.
- Five candidates have profiles. Other ballot candidates (for example Andrea
  James, Shiva Ayyadurai and Joe Tache) are listed without one.
- The summarizer matches politicians by exact full name, so "Sen. Warren" alone
  isn't linked.
- AI summaries can contain mistakes; citations are there so readers can check.
- U.S. territories aren't covered, and there's no automated test suite.

## Contributing

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for where each kind of data
lives, how data flows through the globe, and a file-by-file guide.

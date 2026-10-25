# Tech stack and commands

## Globe app (no build step)

- Static site using ES modules, so it must be served over HTTP, not `file://`.
- Run: `python3 -m http.server 8000 --bind 127.0.0.1`, then open http://localhost:8000
- Keep `--bind 127.0.0.1`. The repo root also holds `.env` with secret keys, and a plain `http.server` would expose it to the network.
- MapLibre GL JS 6 loaded from unpkg (version pinned in `js/globe.js` and `index.html`). Basemaps: OpenFreeMap. Country shading: MapLibre demo tiles.
- Boundaries: U.S. Census TIGERweb. Geocoder: Photon (`photon.komoot.io`). City wards: ArcGIS or Socrata portals for Boston, Chicago, NYC.
- No API keys are needed for the globe.

## Candidate research app

- Next.js (App Router), React, TypeScript, Supabase (Postgres), hosted on Vercel and Supabase.
- `npm install`, `npm run dev` (http://localhost:3000), `npm run build`, `npm run lint`.
- News pipeline: `npm run ingest` (RSS into `articles`), `npm run summarize` (needs `ANTHROPIC_API_KEY`), `npm run news` (both).
- Rebuild the news seed SQL with `node supabase/build-news-seed.mjs`. It also validates citations.

## Secrets

- `.env` is gitignored. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may reach the browser.
- `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are server-side only. Never put them in browser code, in the `js/` or `data/` folders, or in a commit.

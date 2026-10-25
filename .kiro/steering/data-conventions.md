# Data conventions: where changes go

Read the "Where does X go?" table in `README.md` before adding data. The rules below are the ones that are easy to break.

## Never edit by hand

- `data/political-data.generated.js` is generated. Edit the sources, then run `python3 scripts/export_candidates.py`.
- `supabase/news_seed.sql` is generated. Edit `supabase/seed-data/*.json`, then run `node supabase/build-news-seed.mjs`.

## Candidate data flow

- Source of truth: `supabase/seed-data/<slug>.json` (politician + cited news summary) and `lib/candidate-profiles.ts` (funding, issues, career, sources, myths, status), merged by `slug`.
- The globe merges them in `data/candidates.js` with the same logic as `lib/candidates.ts`. Keep the two in sync.
- Which candidates run in which race: `RACES` in `data/candidates.js`, listed by slug.

## Other places

- Real races and events: `data/civic.js` (`fetchRacesForPlace`, `fetchEventsForPlace`). This is the one data seam. Give each race a `kind` so the UI files it under the right layer.
- Sample races and events: `data/places.js`, using the factories in `data/races.js` and `data/events.js`. Sample data must stay labeled "Sample".
- New layer of government: `data/kinds.js` plus a lookup in `data/census.js` or `data/local-sources.js`.
- City wards or council districts: add one entry to `data/local-sources.js`.
- Data shapes: `data/types.js` (JSDoc).
- Layer colors live only in `data/kinds.js`. Map outline, dock chip and ballot section share them.

## Style

- Match existing patterns: plain JS ES modules in `js/` and `data/`, TypeScript in `app/`, `components/` and `lib/`.
- Do not add dependencies to the globe. It has no build step.

# Mapachusetts: product context

Civic Action track project. Politics, mapped to where you live.

Two parts share one repo and one source of truth for candidate data:

1. **Globe app** (static site: `index.html`, `js/`, `data/`, `styles.css`). A MapLibre 3D globe. Search, GPS, browse menus or a globe click picks a place. The app shows every layer of government covering that spot (country, state, congressional district, state senate and house districts, county, city or town, school district, and city wards where open data exists), plus the races and events for each layer.
2. **Candidate research app** (Next.js + Supabase: `app/`, `components/`, `lib/`, `supabase/`). Six-tab profiles per candidate: In the News (cited), Funding, Career, Issues, Sources, Myths & Facts.

## Scope and honesty rules

- U.S. only for now. Other countries are greyed out and say so.
- Real data: Census boundaries, and the Massachusetts 2026 governor and U.S. Senate races (Healey, Minogue, Markey, Deaton).
- Everything else (other states' races, local offices, events) is SAMPLE data and must be labeled "Sample" in the UI. Never present sample data as real.
- District and precinct data can lag reality. Keep the "confirm with your local election office" messaging.
- Candidate news summaries must carry numbered citations. Do not store full article text, only headlines, links, short snippets and summaries.

## Audience

Voters who want to know who represents them and what is on their ballot. Use plain language, not jargon. Keep accessibility in mind: keyboard-friendly, visible focus, 44px+ touch targets, screen-reader labels, reduced-motion support.

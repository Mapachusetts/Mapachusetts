# Mapachusetts

*Politics, mapped to where you live.*

**Track:** Civic Action

## What it is

Every U.S. address sits inside a stack of governments: the country, a state, a congressional district, state legislative districts, a county, a city or town, a school district, and often a ward and a voting precinct. It's easy to know who your president and governor are. It's much harder to know your state representative, your school district or your ward, even though those offices decide schools, zoning, policing, roads and local taxes. The information exists, but it's scattered across Census files, city GIS portals, campaign finance sites and news coverage.

Mapachusetts brings it together on an interactive 3D globe. Pick any spot in the United States to see every layer of government that covers it, what each one does, what's on the ballot there, and cited research on the candidates.

## How it works

1. **Find a place, four ways.** Search a city, town, neighborhood, county or state (candidate names work in the same box), press **Use my location**, pick State → County → City from **Browse by list**, or click the globe, where states and counties are clickable shapes and cities are pins.
2. **See your layers.** Mapachusetts asks the U.S. Census Bureau, in parallel, which boundaries contain that point. The answer becomes the **layer dock**: one color-coded chip per government, each with a glowing outline on the globe. Hover a chip to highlight its boundary, or click it to zoom there and open its ballot section.
3. **Read the ballot, layer by layer.** The side panel groups races under the layer of government that decides them, from national down to neighborhood, and each section starts with a plain-language explanation of what that layer does. An **Events** tab lists town halls, meetings, hearings, candidate forums and voting dates.
4. **Research the candidates.** Click a candidate on a race card to open a six-tab profile with a shareable link (for example `?candidate=maura-healey`).

## Features

### Map and geography

- A 3D globe (MapLibre GL) with the U.S. lit up and the rest of the world greyed out. Clicking another country explains that it isn't covered yet.
- Every state, county, city and town in the 50 states and DC. County and town lists load from the Census the first time you open their parent.
- Up to ten kinds of layers per spot: country, state, U.S. House district, state senate district, state house district, county, city or town, school district, city council ward or district, and voting precinct.
- Districts follow the exact point. A large city can span several congressional or legislative districts, so lookups use your GPS position or the specific neighborhood you searched. If you only picked a city, the panel says it's using the city's center and suggests using your location instead.
- Real-world edge cases are handled: New England-style towns versus incorporated cities, unincorporated areas (the app explains that the county provides local services), at-large and delegate House seats, and Massachusetts precinct codes ("0306" reads as Ward 3, Precinct 6).
- City wards and council districts from the Boston, Chicago and New York City open-data portals.
- Night and Day map themes, remembered between visits.

### Ballot and events

- Race cards show the office, election date, term and candidates, tagged **✓ Researched** or **Sample**.
- Event cards show the type, date and time ("Tomorrow", "In 5 days"), venue, whether there's an online option, and which layer of government is holding it.
- A countdown to the next general election (November 3, 2026, then November 7, 2028).

### Candidate research profiles

Researched data covers Massachusetts' two 2026 statewide races: **Governor** (Maura Healey, D, vs. Mike Minogue, R) and **U.S. Senate** (Ed Markey, D, vs. John Deaton, R). Elizabeth Warren also has a curated profile, reachable from search. Profiles open from the ballot, the intro screen or the search box, where candidates appear instantly as you type.

- **In the News:** a neutral summary of recent coverage where every sentence carries numbered citations. Click one to jump to the article. Each 2026 candidate's summary cites eight articles published October 10–24, 2026.
- **Funding:** total raised, top industry, small-donor share and a chart of the top contributing industries, linked to OpenSecrets.
- **Career:** bio and a timeline of roles held, plus current status and committee assignments where available.
- **Issues:** 11 topic areas, from healthcare and housing to climate and technology. Each issue expands into an "In plain English" summary, why people are searching it, a position meter, deeper detail and the related vote record.
- **Sources:** every research source tagged by type and by bias rating (Ad Fontes Media, AllSides), so readers can cross-check across the spectrum.
- **Myths & Facts:** widely shared claims, where they come from, what the record shows, and a primary source to check it.

The four 2026 candidates all have cited news, a bio and a career timeline. Funding, Issues and Myths & Facts are filled in for Markey and Warren so far. For the others, those tabs show a clear empty state, and Funding links to FEC.gov, OpenSecrets and OCPF.

### Built to be trusted

- **Real vs. sample is always labeled.** Boundaries are real everywhere. The Massachusetts governor and U.S. Senate races are real and researched. Other races, local offices and events are placeholders for now, marked "Sample" in the UI.
- **Sources are shown.** Each ballot section credits where its boundary came from. The panel notes that some states redrew districts for 2026 and that precinct lines come from the 2020 Census, and asks people to confirm with their local election office.
- **Citations are checked.** The summarizer is told to stay neutral, use only the articles it's given and cite every sentence, and it keeps only citations that actually appear in the text. The seed build fails if a citation points nowhere, a source is never cited, a link isn't HTTPS, or an article falls outside the research window.
- **Nonpartisan design.** Layer colors deliberately avoid red and blue.
- **Respect for publishers.** We store headlines, links, short snippets and summaries, never full article text. Article text is held in memory only while a summary is written.
- **Privacy.** No accounts and no API keys in the browser. Place searches go to the Photon geocoder, and coordinates go to the Census Bureau (plus the Boston, Chicago or NYC portal inside those cities). Your location is read only when you ask for it.

### Accessible by default

- Full keyboard support: `/` or Ctrl/Cmd+K jumps to search; the search box is an accessible combobox (arrow keys, Enter, Escape, screen-reader announcements); tabs follow the standard arrow-key pattern; Escape closes a profile and returns focus where you left off.
- Skip link, visible focus rings, 44px+ touch targets, screen-reader labels, live status messages and reduced-motion support.
- **Browse by list** is a full alternative to the map.
- On phones, the side panel becomes a bottom sheet.
- Plain language throughout. Full WCAG conformance still needs testing with assistive technology and an expert review.

## Architecture: Netlify + Supabase

- **Netlify (frontend).** The globe is a static site: HTML, CSS and vanilla ES modules with no build step. `netlify.toml` publishes only the site's own files (`index.html`, `styles.css`, `js/`, `data/`), so nothing else in the repo is served.
- **Supabase (backend).** Postgres is the system of record for candidate data, in four tables: `politicians`, `articles`, `article_politicians` and `politician_news_summaries`, with full-text and fuzzy name search indexes. Row Level Security makes every table public read-only; writes happen only server-side with the service-role key.
- **News pipeline.** `npm run ingest` pulls RSS headlines into `articles`, de-duplicated by URL. `npm run summarize` fetches each article, matches politicians by full name, links them, and asks Claude for a cited summary that is validated and saved per politician.
- **Candidate research app.** A Next.js (App Router, React 19) site reads Supabase server-side: candidate search with the same six tabs, `?candidate=` deep links, and a `/news` page of stored headlines that link to the original reporting.
- **One source, two apps.** The researched candidate files build both a validated SQL seed for Supabase and a static data module for the globe, and both apps merge the data the same way. The globe ships that snapshot, so it runs on static hosting with no database keys in the browser. The current summaries were researched with Kiro sub-agents and pass the seed build's validation.

### Public data sources

- **U.S. Census Bureau TIGERweb:** states, counties, cities and towns, 120th Congress districts, 2026 state legislative districts, school districts and 2020 voting districts. Free, keyless and queried live from the browser.
- **City open data:** City of Boston Open Data, City of Chicago Data Portal and NYC Open Data for wards and council districts.
- **Maps and search:** OpenStreetMap data via Photon, OpenFreeMap basemaps and MapLibre demo tiles for country shapes.
- **Candidate research:** Massachusetts and national news outlets (The Boston Globe, WBUR, GBH News, WCVB, Boston.com and others), OpenSecrets, Senate and Congress.gov records, GovTrack, Ballotpedia, PolitiFact and FactCheck.org.

## Who it's for and how it grows

Mapachusetts is for anyone who has looked at a ballot and recognized only the top few names: first-time voters, people who just moved, and people who don't follow politics closely. It also helps teachers, organizers and local reporters explain who represents a given block.

The geography already works nationwide, so growth is mostly adding data, and each step is small by design:

- **A city's wards:** one config entry pointing at an ArcGIS or Socrata layer.
- **A candidate:** one JSON file, a re-run of the export script, and a line adding them to a race.
- **A new layer of government** (a fire district, for example): one entry in `data/kinds.js` plus a lookup.
- **Real races for any state:** every ballot item flows through one module (`data/civic.js`), so a statewide feed or the Supabase tables can replace the sample data without touching the UI.

Next up: reading Supabase live from the globe through its public read-only access, running the news pipeline on a schedule, and adding races for more states and the U.S. territories.

## Try it

On the intro screen, pick **Boston, MA** (wards and council districts), **Medford, MA** or **Sugar Land, TX**, or open a candidate under "Massachusetts 2026: meet the candidates." Press **Use my location** to see your own layers.

**Built with:** MapLibre GL JS, vanilla JavaScript, Next.js, React, TypeScript, Supabase (Postgres), Netlify, Python, Node.js, the Anthropic Claude API, U.S. Census TIGERweb, Photon (OpenStreetMap) and OpenFreeMap.

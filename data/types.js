// data/types.js
// One place that documents every data shape the UI understands. Nothing here
// runs: these are JSDoc typedefs for people (and AI prompts) to point at, e.g.
// "add a dataset of school board races shaped like Race in data/types.js".
//
// Rule of thumb: the UI never needs to change when data is added. It renders
// whatever Place / Race / Event objects it is given.

/**
 * A place in the hierarchy: World > United States > State > County > City > District.
 * Defined in data/places.js (states) or created at runtime from Census lists and search results.
 *
 * @typedef {Object} Place
 * @property {string}   id        Unique and stable, e.g. "us-tx" (states) or a generated id for counties and cities.
 * @property {string}   name      Display name, e.g. "Sugar Land".
 * @property {"globe"|"country"|"state"|"county"|"city"|"district"} level
 *                                 See data/levels.js.
 * @property {[number, number]} center  [lng, lat] the camera flies to.
 * @property {number}   [zoom]    Camera zoom override (else the level default).
 * @property {[number, number, number, number]} [extent]
 *                                 [west, south, east, north]; camera frames this
 *                                 box instead of using zoom (search results).
 * @property {[number, number, number, number]} [bbox]
 *                                 Offline-only fallback for matching GPS points.
 * @property {string[]} [aliases] Other names that should match this place.
 * @property {string}   [code]    "US" for the country, USPS code for states ("TX").
 * @property {string}   [geoid]   Census id (state "48", county "48157", city
 *                                 "4870808"). Lets Census data and meeting feeds attach to a place.
 * @property {Race[]}   races     Races DECIDED at this place (inherited downward).
 * @property {Event[]}  events    Events at this place (inherited downward).
 * @property {Place[]}  children  Places one level down.
 * @property {Place}    [parent]  Set automatically; do not write by hand.
 * @property {boolean}  [dynamic] True if created at runtime from a search.
 */

/**
 * Something on the ballot: a candidate race or a ballot question.
 * Generated from real nominees in data/candidates.js (see data/nominees.generated.js).
 * A teammate can also attach a hand-researched local race to a Place.
 * Shown in the "On the ballot" tab, grouped by `category`.
 *
 * @typedef {Object} Race
 * @property {string} id
 * @property {string} office        "Governor of Texas", "Mayor of Medford", ...
 * @property {"country"|"state"|"congress"|"senate"|"house"|"county"|"city"|"school"|"ward"|"precinct"} kind
 *                                   WHICH LAYER OF GOVERNMENT decides it
 *                                   (KINDS in data/kinds.js). The Ballot tab is
 *                                   grouped by this, and it picks the color.
 * @property {"executive"|"legislative"|"local"|"education"|"measure"} category
 *                                   Small tag + icon on the card
 *                                   (CATEGORY_META in data/races.js; icons are keys of js/icons.js).
 * @property {string} [jurisdictionId]  Set on races generated for a district,
 *                                   e.g. "congress:4822".
 * @property {{name: string, party: string|null, slug?: string}[]} candidates
 *                                   A `slug` makes the candidate clickable: it
 *                                   opens their profile (CandidateView).
 * @property {string|null} [term]    "4 years"; null for ballot questions.
 * @property {string|null} electionDate  "YYYY-MM-DD" or null if it varies.
 * @property {{name: string, party: string|null}[]} candidates
 *                                   For ballot questions use Yes / No.
 * @property {string} [description]  One or two plain-language sentences.
 * @property {string} [scopeName]    Added automatically: the Place that decides it.
 */

/**
 * A civic event: town hall, public meeting, debate/forum, voting date, ...
 * Real events only: Election Day and city meetings from data/events.generated.js
 * (scripts/export_events.py). Shown in "Events & town halls",
 * soonest first; past events are hidden automatically.
 *
 * @typedef {Object} Event
 * @property {string} id
 * @property {string} title
 * @property {"townhall"|"meeting"|"debate"|"voting"|"hearing"|"community"} type
 *                                   Controls icon and color (EVENT_TYPES in
 *                                   data/events.js).
 * @property {string}  start         ISO 8601 local date-time, "2026-11-03T07:00:00".
 * @property {string}  [end]         Same format. If omitted, 3 hours is assumed.
 * @property {string}  [venue]       "Sugar Land City Hall, Council Chamber".
 * @property {boolean} [virtual]     True if people can join online.
 * @property {string}  [description]
 * @property {string}  [url]         Link for details or sign-up.
 * @property {string}  source        Where it came from, e.g. "Legistar". Nothing in
 *                                   the app is placeholder data; do not add any.
 * @property {string}  [scopeName]   Added automatically: the Place it applies to.
 */

/**
 * Someone who HOLDS an office right now, whether or not the seat is on the
 * ballot. Generated by scripts/export_officeholders.py and
 * scripts/export_ma_officeholders.py, read through data/officeholders.js.
 *
 * @typedef {Object} Officeholder
 * @property {string} id
 * @property {"country"|"state"|"congress"|"senate"|"house"|"county"|"city"} layer
 *                                   The layer of government (KINDS in data/kinds.js).
 * @property {{state?: string, geoid?: string, name?: string}} match
 *                                   How to find the layer in the Census stack:
 *                                   {} for the country, {state: "TX"} for a
 *                                   state, {geoid} for a district, county or city.
 * @property {string} office         "Governor", "State Representative", "Mayor", ...
 * @property {string} name
 * @property {string|null} party
 * @property {string|null} termStart   ISO date; null when not verified.
 * @property {string|null} termEnd     ISO date; null when not verified.
 * @property {string|null} nextElection  ISO date (or a year); null if unknown.
 * @property {boolean} onBallot2026  True only when the seat is on the Nov 3, 2026 ballot.
 * @property {boolean} [appointed]
 * @property {string|null} photo
 * @property {string|null} url       Official page.
 * @property {string[]} sources
 * @property {string|null} note
 */
/**
 * A researched candidate, merged from the Supabase seed data and the curated
 * profile (data/candidates.js; same shape as CandidateView in lib/types.ts).
 * Empty tabs are fine: missing data shows an empty state.
 *
 * @typedef {Object} CandidateView
 * @property {string} slug       "maura-healey" (matches supabase/seed-data/<slug>.json)
 * @property {string} name
 * @property {string} role       "Governor of Massachusetts"
 * @property {string} party      "Democratic" | "Republican" | ...
 * @property {string|null} bio
 * @property {string|null} photo         Official portrait URL (https only)
 * @property {object|null} status        { statusType, statusLabel, termInfo, ... }
 * @property {string|null} openSecretsUrl
 * @property {object[]} career           [{ years, title, org, description }]
 * @property {object|null} funding       { total, topIndustry, smallDonorPct, sources[] ... }
 * @property {object[]} opinions         issue topics -> sub-issues -> vote records
 * @property {object[]} sources          [{ name, url, bias, type, description }]
 * @property {object[]} misconceptions   [{ category, myth, reality, sourceUrl ... }]
 * @property {object|null} news          { summary (with [n] markers), citations[], generated_at }
 */

/**
 * One layer of government covering a point: a state, a congressional district,
 * a school district, a ward... Produced by data/census.js (and
 * data/local-sources.js for wards). A place's "stack" is the list of these.
 *
 * @typedef {Object} Jurisdiction
 * @property {string} id        "congress:4822", "county:48157", ... (unique)
 * @property {"country"|"state"|"congress"|"senate"|"house"|"county"|"city"|"school"|"ward"|"precinct"} kind
 * @property {string} name      "Fort Bend County"
 * @property {string} [short]   Compact label for chips: "TX-22"
 * @property {string} [type]    "City", "Town", "Unified school district"
 * @property {string} geoid     Census id (or "<source>:<value>" for wards)
 * @property {[number, number]} [center]  [lng, lat] inside the area
 * @property {string} [source]  Credit shown in the UI
 */

/**
 * What the geocoder returns for a search (js/geocode.js).
 * Counties come back WITHOUT the word "County" ("Fort Bend").
 *
 * @typedef {Object} GeocodeResult
 * @property {string} type          "city" | "county" | "state" | "district" | "locality" | ...
 * @property {string} name
 * @property {string} country
 * @property {string} countryCode   "US" is the only value the app accepts.
 * @property {string} state
 * @property {string} county
 * @property {string} city
 * @property {number} lng
 * @property {number} lat
 * @property {[number, number, number, number]|null} extent  [w, s, e, n]
 * @property {string} label         "Medford, Middlesex County, Massachusetts"
 */

export {};

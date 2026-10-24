// data/types.js
// One place that documents every data shape the UI understands. Nothing here
// runs: these are JSDoc typedefs for people (and AI prompts) to point at, e.g.
// "add a dataset of school board races shaped like Race in data/types.js".
//
// Rule of thumb: the UI never needs to change when data is added. It renders
// whatever Place / Race / Event objects it is given.

/**
 * A place in the hierarchy: World > United States > State > County > City > District.
 * Defined in data/places.js (curated) or created at runtime from search results.
 *
 * @typedef {Object} Place
 * @property {string}   id        Unique and stable, e.g. "tx-sugarland" or "us-tx".
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
 * @property {Race[]}   races     Races DECIDED at this place (inherited downward).
 * @property {Event[]}  events    Events at this place (inherited downward).
 * @property {Place[]}  children  Places one level down.
 * @property {Place}    [parent]  Set automatically; do not write by hand.
 * @property {boolean}  [dynamic] True if created at runtime from a search.
 */

/**
 * Something on the ballot: a candidate race or a ballot question.
 * Built with the factories in data/races.js, or write the object directly.
 * Shown in the "On the ballot" tab, grouped by `category`.
 *
 * @typedef {Object} Race
 * @property {string} id
 * @property {string} office        "Governor of Texas", "Mayor of Medford", ...
 * @property {"executive"|"legislative"|"local"|"education"|"measure"} category
 *                                   Controls grouping, icon and color
 *                                   (CATEGORY_META in data/races.js).
 * @property {string|null} [term]    "4 years"; null for ballot questions.
 * @property {string|null} electionDate  "YYYY-MM-DD" or null if it varies.
 * @property {{name: string, party: string|null}[]} candidates
 *                                   For ballot questions use Yes / No.
 * @property {string} [description]  One or two plain-language sentences.
 * @property {string} [scopeName]    Added automatically: the Place that decides it.
 */

/**
 * A civic event: town hall, public meeting, debate/forum, voting date, ...
 * Built with makeEvent() in data/events.js. Shown in "Events & town halls",
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
 * @property {string}  source        "sample" for placeholder data; set a real
 *                                   source name for real feeds. Anything marked
 *                                   "sample" shows a "Sample" badge in the UI.
 * @property {string}  [scopeName]   Added automatically: the Place it applies to.
 */

/**
 * What the geocoder returns for a search or "Use my location" (js/geocode.js).
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

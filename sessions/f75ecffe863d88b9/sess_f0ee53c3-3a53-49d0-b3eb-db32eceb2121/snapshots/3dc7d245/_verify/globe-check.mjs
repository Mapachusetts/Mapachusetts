// TEMPORARY verification script (deleted after use).
// Loads the real globe data + race-card renderer with a tiny DOM stub, and
// checks the Next.js routing config.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let failures = 0;
function check(label, ok) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

// ---- Minimal DOM stub (just what ui.js's _raceCard uses) ----
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.className = "";
    this._text = "";
    this.style = { setProperty() {} };
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  findAll(pred, out = []) {
    for (const c of this.children) { if (pred(c)) out.push(c); c.findAll(pred, out); }
    return out;
  }
}
globalThis.document = { createElement: (t) => new El(t) };

const root = process.cwd();
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const places = await imp("public/data/places.js");
const { UI } = await imp("public/js/ui.js");

// ---- Data: real MA races, slugs, inheritance ----
const ma = places.findNodeById("us-ma");
check("us-ma place exists (deep link target)", ma?.name === "Massachusetts");

const medford = places.racesForNode("ma-medford");
const gov = medford.find((r) => r.id === "ma-governor-2026");
const sen = medford.find((r) => r.id === "ma-us-senate-2026");
check("Medford inherits the real MA governor race", !!gov && gov.scopeName === "Massachusetts");
check("Medford inherits the real MA Senate race", !!sen);
check("governor slugs = maura-healey, mike-minogue", JSON.stringify(gov.candidates.filter((c) => c.slug).map((c) => c.slug)) === '["maura-healey","mike-minogue"]');
check("Senate slugs = ed-markey, john-deaton", JSON.stringify(sen.candidates.filter((c) => c.slug).map((c) => c.slug)) === '["ed-markey","john-deaton"]');
check("Senate lists all 4 ballot candidates", sen.candidates.length === 4);
check("real races have a source link, not 'sample'", gov.source !== "sample" && /^https:\/\//.test(gov.sourceUrl) && sen.source !== "sample");
const sampleRaces = medford.filter((r) => !r.id.startsWith("ma-governor") && !r.id.startsWith("ma-us-senate"));
check(`all ${sampleRaces.length} other Medford races are marked sample`, sampleRaces.length > 0 && sampleRaces.every((r) => r.source === "sample"));
check("Texas governor is still the sample placeholder", places.racesForNode("tx-sugarland").some((r) => r.office === "Governor of Texas" && r.source === "sample"));

// Every slug on the globe must resolve to a candidate page.
const known = new Set(readdirSync(join(root, "supabase/seed-data")).map((f) => f.replace(/\.json$/, "")));
const profiles = readFileSync(join(root, "lib/candidate-profiles.ts"), "utf8");
for (const m of profiles.matchAll(/^\s{4}slug: "([^"]+)"/gm)) known.add(m[1]);
const allSlugs = [];
(function walk(n) {
  for (const r of n.races) for (const c of r.candidates || []) if (c.slug) allSlugs.push(c.slug);
  n.children.forEach(walk);
})(places.PLACES);
check(`every globe slug has a candidate page (${allSlugs.join(", ")})`, allSlugs.length === 4 && allSlugs.every((s) => known.has(s)));

// ---- Rendering: race cards ----
const card = UI.prototype._raceCard.call({}, gov);
const links = card.findAll((e) => e.tagName === "A" && e.className === "chip-link");
check("governor card: 2 profile links", links.length === 2);
check("link href = /candidates/maura-healey", links[0]?.href === "/candidates/maura-healey");
check("link text includes name + party + screen-reader hint", links[0]?.textContent === "Maura Healey (Democratic), view candidate profile");
const plain = card.findAll((e) => e.tagName === "LI" && e.className !== "chip-has-link");
check("Andrea James (no profile) stays a plain chip", plain.length === 1 && plain[0].textContent === "Andrea James (Independent)");
check("governor card: hint + source link, no Sample tag", card.findAll((e) => e.className === "card-hint").length === 1 && card.findAll((e) => e.className === "card-source" && e.target === "_blank" && e.rel === "noopener noreferrer").length === 1 && card.findAll((e) => e.className === "tag tag-sample").length === 0);

const sampleCard = UI.prototype._raceCard.call({}, sampleRaces[0]);
check("sample race card shows Sample tag and no links", sampleCard.findAll((e) => e.className === "tag tag-sample").length === 1 && sampleCard.findAll((e) => e.tagName === "A").length === 0);

// ---- Next.js routing config ----
const cfg = (await imp("next.config.mjs")).default;
const rewrites = await cfg.rewrites();
const redirects = await cfg.redirects();
check("rewrite / -> /index.html (beforeFiles)", rewrites.beforeFiles?.[0]?.source === "/" && rewrites.beforeFiles[0].destination === "/index.html");
check("redirect /?candidate=slug -> /candidates/:slug", redirects[0]?.destination === "/candidates/:slug" && redirects[0].has?.[0]?.key === "candidate");
check("slug pattern accepts real slugs", new RegExp(`^${redirects[0].has[0].value}$`).test("maura-healey"));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

// js/search.js
// Search-as-you-type place picker (an accessible "combobox").
//
// - Type a place ("Medford, MA", "Sugar Land TX", "Paris") and pick a result.
// - Works with mouse, touch and keyboard (Up/Down, Enter, Escape).
// - Requests are debounced and cancelled when superseded, to be kind to the
//   shared public geocoder (see js/geocode.js).

import { searchPlaces } from "./geocode.js";
import { searchCandidates } from "../data/candidates.js";
import { icon } from "./icons.js";

const DEBOUNCE_MS = 300;

export class SearchBox {
  /**
   * @param {object} refs - { form, input, list, status }
   * @param {object} handlers - { onSelect(descriptor), onSelectCandidate(slug) }
   */
  constructor(refs, handlers = {}) {
    this.refs = refs;
    this.handlers = handlers;
    this.results = [];
    this.activeIndex = -1;
    this._timer = null;
    this._abort = null;
    this._seq = 0;

    const { form, input } = refs;

    input.addEventListener("input", () => this._onInput());
    input.addEventListener("keydown", (e) => this._onKeyDown(e));
    input.addEventListener("focus", () => {
      if (this.results.length) this._open();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._submit();
    });

    // Close the list when clicking elsewhere.
    document.addEventListener("click", (e) => {
      if (!form.contains(e.target)) this._close();
    });
  }

  focus() {
    this.refs.input.focus();
  }

  setValue(text) {
    this.refs.input.value = text;
  }

  // ----- Input handling ----------------------------------------------------

  _onInput() {
    const q = this.refs.input.value.trim();
    clearTimeout(this._timer);
    if (this._abort) this._abort.abort();

    if (q.length < 2) {
      this.results = [];
      this._render();
      this._close();
      this._message("");
      return;
    }
    // Candidates are searched locally, so they appear instantly.
    this._candidates = candidateResults(q);
    if (this._candidates.length) {
      this.results = this._candidates;
      this.activeIndex = 0;
      this._render();
      this._open();
    }
    this._message("Searching…");
    this._timer = setTimeout(() => this._run(q), DEBOUNCE_MS);
  }

  async _run(q) {
    const seq = ++this._seq;
    this._abort = new AbortController();
    try {
      const places = await searchPlaces(q, this._abort.signal);
      if (seq !== this._seq) return; // a newer search is in flight
      const results = [...candidateResults(q), ...places];
      this.results = results;
      this.activeIndex = results.length ? 0 : -1;
      this._render();
      if (results.length) {
        this._open();
        this._message(
          `${results.length} suggestion${results.length === 1 ? "" : "s"}. Use the arrow keys and Enter to choose.`
        );
      } else {
        this._open();
        this._message("");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      if (seq !== this._seq) return;
      this.results = candidateResults(q);
      this._render(
        this.results.length
          ? null
          : "We couldn't reach the search service. Check your connection, or pick a place from the lists instead."
      );
      this._open();
      this._message("Place search is unavailable right now.");
    }
  }

  _onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!this.results.length) return;
      this._open();
      this._setActive((this.activeIndex + 1) % this.results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!this.results.length) return;
      this._setActive(
        (this.activeIndex - 1 + this.results.length) % this.results.length
      );
    } else if (e.key === "Escape") {
      this._close();
    }
  }

  // Enter / the Search button: pick the highlighted suggestion, or search now.
  async _submit() {
    clearTimeout(this._timer);
    const q = this.refs.input.value.trim();
    if (q.length < 2) {
      this._message("Type a city, county, state or country to search.");
      return;
    }
    if (this.results.length && this.activeIndex >= 0) {
      this._choose(this.results[this.activeIndex]);
      return;
    }
    // Nothing loaded yet (user typed fast and pressed Enter): fetch, then pick.
    this._message("Searching…");
    try {
      const cands = candidateResults(q);
      const results = [...cands, ...(await searchPlaces(q))];
      if (results.length) {
        this._choose(results[0]);
      } else {
        this.results = [];
        this._render();
        this._open();
      }
    } catch {
      this._render("We couldn't reach the search service. Try again in a moment.");
      this._open();
    }
  }

  _choose(desc) {
    this.refs.input.value = desc.kind === "candidate" ? desc.name : desc.label;
    this.results = [];
    this._render();
    this._close();
    this._message("");
    if (desc.kind === "candidate") this.handlers.onSelectCandidate?.(desc.slug);
    else this.handlers.onSelect?.(desc);
  }

  // ----- Rendering ---------------------------------------------------------

  _render(errorText) {
    const list = this.refs.list;
    list.innerHTML = "";
    if (errorText) {
      list.appendChild(emptyItem(errorText));
      return;
    }
    if (!this.results.length) {
      if (this.refs.input.value.trim().length >= 2) {
        list.appendChild(
          emptyItem(
            "No U.S. places or candidates found. Try a city and state, like “Sugar Land, TX”."
          )
        );
      }
      return;
    }
    this.results.forEach((r, i) => {
      const li = document.createElement("li");
      li.id = `search-opt-${i}`;
      li.setAttribute("role", "option");
      li.className = "search-option";
      li.setAttribute("aria-selected", String(i === this.activeIndex));

      const title = document.createElement("span");
      title.className = "search-option-title";
      title.textContent = r.name;
      if (r.kind === "candidate") {
        const ico = document.createElement("span");
        ico.className = "search-option-ico";
        ico.setAttribute("aria-hidden", "true");
        ico.innerHTML = icon("community", { size: 16 }); // trusted markup from js/icons.js
        title.prepend(ico);
      }

      const sub = document.createElement("span");
      sub.className = "search-option-sub";
      sub.textContent = r.kind === "candidate" ? r.subtitle : subtitle(r);
      if (r.kind === "candidate") li.classList.add("search-option-candidate");

      li.append(title, sub);
      li.addEventListener("mousedown", (e) => e.preventDefault()); // keep input focus
      li.addEventListener("click", () => this._choose(r));
      list.appendChild(li);
    });
  }

  _setActive(i) {
    this.activeIndex = i;
    const opts = this.refs.list.querySelectorAll('[role="option"]');
    opts.forEach((o, idx) =>
      o.setAttribute("aria-selected", String(idx === i))
    );
    const active = opts[i];
    if (active) {
      this.refs.input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  }

  _open() {
    if (!this.refs.list.children.length) return;
    this.refs.list.hidden = false;
    this.refs.input.setAttribute("aria-expanded", "true");
  }

  _close() {
    this.refs.list.hidden = true;
    this.refs.input.setAttribute("aria-expanded", "false");
    this.refs.input.removeAttribute("aria-activedescendant");
  }

  // Polite screen-reader announcement (also visible as small helper text).
  _message(text) {
    this.refs.status.textContent = text;
  }
}

// Candidate rows for the dropdown: { kind: "candidate", slug, name, subtitle }.
function candidateResults(q) {
  return searchCandidates(q, 3).map((c) => ({
    kind: "candidate",
    slug: c.slug,
    name: c.name,
    subtitle: ["Candidate", [c.role, c.party].filter(Boolean).join(" · ")].filter(Boolean).join(" · "),
  }));
}

function emptyItem(text) {
  const li = document.createElement("li");
  li.className = "search-empty";
  li.textContent = text;
  return li;
}

// "Middlesex County, Massachusetts, United States" for a city result, etc.
function subtitle(r) {
  const parts = [];
  const add = (v) => v && !parts.includes(v) && parts.push(v);
  const kind = r.isZip
    ? "ZIP code"
    : {
        city: "City / town",
        county: "County",
        state: "State",
        district: "District",
        locality: "Place",
        house: "Address",
        street: "Street",
      }[r.type];
  const county =
    r.county && r.countryCode === "US" && !/county|parish|borough/i.test(r.county)
      ? `${r.county} County`
      : r.county;
  if (r.type !== "city" && r.city && r.city !== r.name) add(r.city);
  if (r.type !== "county") add(county);
  if (r.type !== "state") add(r.state);
  return [kind, parts.join(", ")].filter(Boolean).join(" · ");
}

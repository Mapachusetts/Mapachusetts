// js/ui.js
// All DOM rendering for the surrounding chrome: dropdown browser, breadcrumbs,
// the races + events panel, and status messages. Pure rendering: it takes data
// and callbacks and knows nothing about the map or the data source.

import { CATEGORY_META } from "../data/races.js";
import { EVENT_TYPES } from "../data/events.js";
import { levelByKey } from "../data/levels.js";

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

export class UI {
  /**
   * refs: { breadcrumbs, upBtn, worldBtn, browse, legend, panelTitle,
   *         panelLevel, welcome, panelBody, tabRaces, tabEvents, racesCount,
   *         eventsCount, racesList, eventsList, status }
   * handlers: { onAscend(), onReset(), onJump(id) }
   */
  constructor(refs, handlers = {}) {
    this.refs = refs;
    this.handlers = handlers;
    this._selects = new Map();
    this._statusTimer = null;

    refs.upBtn.addEventListener("click", () => handlers.onAscend?.());
    refs.worldBtn.addEventListener("click", () => handlers.onReset?.());

    refs.tabRaces.addEventListener("click", () => this.showTab("races"));
    refs.tabEvents.addEventListener("click", () => this.showTab("events"));
    // Arrow keys move between tabs (standard tab pattern).
    for (const tab of [refs.tabRaces, refs.tabEvents]) {
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const next = tab === refs.tabRaces ? "events" : "races";
          this.showTab(next);
          (next === "races" ? refs.tabRaces : refs.tabEvents).focus();
        }
      });
    }
  }

  // ----- Dropdown browser --------------------------------------------------

  // model: [{ level, label, options: [{id,name}], selectedId, parentId }]
  renderBrowse(model) {
    const container = this.refs.browse;

    // Build the <select>s once, then just refresh their options.
    if (!this._selects.size) {
      for (const m of model) {
        const wrap = document.createElement("label");
        wrap.className = "browse-field";

        const caption = document.createElement("span");
        caption.className = "browse-label";
        caption.textContent = m.label;

        const select = document.createElement("select");
        select.className = "browse-select";
        select.dataset.level = m.level;
        select.addEventListener("change", () => {
          const id = select.value || select.dataset.parentId;
          if (id) this.handlers.onJump?.(id);
        });

        wrap.append(caption, select);
        container.appendChild(wrap);
        this._selects.set(m.level, select);
      }
    }

    for (const m of model) {
      const select = this._selects.get(m.level);
      select.dataset.parentId = m.parentId;
      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = m.options.length ? "Choose…" : "—";
      select.appendChild(placeholder);

      for (const opt of m.options) {
        const o = document.createElement("option");
        o.value = opt.id;
        o.textContent = opt.name;
        select.appendChild(o);
      }
      select.value = m.selectedId || "";
      select.disabled = m.options.length === 0;
      select.title = m.options.length
        ? ""
        : "Nothing listed here yet. Try the search box to find it.";
    }
  }

  // ----- Breadcrumbs + header ---------------------------------------------

  // Each crumb is clickable to jump back to that level.
  renderBreadcrumbs(path) {
    const el = this.refs.breadcrumbs;
    el.innerHTML = "";
    path.forEach((node, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = "›";
        el.appendChild(sep);
      }
      const crumb = document.createElement("button");
      crumb.className = "crumb";
      crumb.type = "button";
      crumb.textContent = node.level === "globe" ? "World" : node.name;
      if (i === path.length - 1) {
        crumb.classList.add("crumb-current");
        crumb.setAttribute("aria-current", "location");
      }
      crumb.addEventListener("click", () => this.handlers.onJump?.(node.id));
      el.appendChild(crumb);
    });

    this.refs.upBtn.disabled = path.length <= 1;
    this.refs.worldBtn.disabled = path.length <= 1;
  }

  renderHeader(node) {
    const lvl = levelByKey(node.level);
    this.refs.panelTitle.textContent =
      node.level === "globe" ? "Welcome to Mapachusetts" : node.name;
    this.refs.panelLevel.textContent = lvl ? lvl.label : node.level;
    this.refs.panelLevel.hidden = node.level === "globe";
  }

  // At the whole-world level we show a friendly how-to instead of empty tabs.
  setWelcome(isWelcome) {
    this.refs.welcome.hidden = !isWelcome;
    this.refs.panelBody.hidden = isWelcome;
  }

  // The map key only makes sense while the grey/colored shading is visible.
  setLegendVisible(visible) {
    this.refs.legend.hidden = !visible;
  }

  showTab(which) {
    const races = which === "races";
    this.refs.tabRaces.setAttribute("aria-selected", String(races));
    this.refs.tabEvents.setAttribute("aria-selected", String(!races));
    this.refs.tabRaces.tabIndex = races ? 0 : -1;
    this.refs.tabEvents.tabIndex = races ? -1 : 0;
    this.refs.racesList.hidden = !races;
    this.refs.eventsList.hidden = races;
  }

  // ----- Races -------------------------------------------------------------

  renderRaces(races, node) {
    const list = this.refs.racesList;
    list.innerHTML = "";
    this.refs.racesCount.textContent = String(races.length);

    const note = noLocalDataNote(node);
    if (note) list.appendChild(note);

    if (!races.length) {
      if (!note) {
        list.appendChild(
          emptyBox(
            `No races are decided at the <strong>${escapeHtml(
              node.name
            )}</strong> level. Zoom in to a state or city to see more.`
          )
        );
      }
      return;
    }

    // Group races by category for a tidy panel.
    const byCategory = new Map();
    for (const race of races) {
      if (!byCategory.has(race.category)) byCategory.set(race.category, []);
      byCategory.get(race.category).push(race);
    }

    for (const [category, items] of byCategory) {
      const meta = CATEGORY_META[category] || {
        label: category,
        icon: "•",
        color: "#475569",
      };
      const group = document.createElement("section");
      group.className = "race-group";
      group.style.setProperty("--accent", meta.color);

      const heading = document.createElement("h3");
      heading.className = "group-title";
      heading.innerHTML = `<span aria-hidden="true">${meta.icon}</span> ${escapeHtml(
        meta.label
      )}`;
      group.appendChild(heading);

      for (const race of items) group.appendChild(this._raceCard(race));
      list.appendChild(group);
    }
  }

  _raceCard(race) {
    const card = document.createElement("article");
    card.className = "card race-card";

    if (race.source === "sample") {
      const chips = document.createElement("div");
      chips.className = "tag-row";
      chips.appendChild(tag("Sample", "tag-sample"));
      card.appendChild(chips);
    }

    const office = document.createElement("h4");
    office.className = "card-title";
    office.textContent = race.office;
    card.appendChild(office);

    const meta = document.createElement("p");
    meta.className = "card-meta";
    const bits = [];
    if (race.electionDate) {
      bits.push(`Election: ${dateFmt.format(parseLocalDate(race.electionDate))}`);
    } else if (race.category !== "measure") {
      bits.push("Election date varies");
    }
    if (race.term) bits.push(`Term: ${race.term}`);
    if (race.scopeName) bits.push(`Applies to: ${race.scopeName}`);
    meta.textContent = bits.join("  ·  ");
    card.appendChild(meta);

    if (race.description) {
      const desc = document.createElement("p");
      desc.className = "card-desc";
      desc.textContent = race.description;
      card.appendChild(desc);
    }

    if (race.candidates && race.candidates.length) {
      const cands = document.createElement("ul");
      cands.className = "chips";
      cands.setAttribute("aria-label", "Candidates or choices");
      for (const c of race.candidates) {
        const li = document.createElement("li");
        const label = c.party ? `${c.name} (${c.party})` : c.name;
        if (c.slug) {
          // Candidate with a research profile: news, funding, career, issues.
          const a = document.createElement("a");
          a.className = "chip-link";
          a.href = `/candidates/${encodeURIComponent(c.slug)}`;
          a.textContent = label;
          const hint = document.createElement("span");
          hint.className = "sr-only";
          hint.textContent = ", view candidate profile";
          a.appendChild(hint);
          li.className = "chip-has-link";
          li.appendChild(a);
        } else {
          li.textContent = label;
        }
        cands.appendChild(li);
      }
      card.appendChild(cands);

      if (race.candidates.some((c) => c.slug)) {
        const hint = document.createElement("p");
        hint.className = "card-hint";
        hint.textContent =
          "Select a highlighted name to see that candidate's news coverage, funding, career and issue positions.";
        card.appendChild(hint);
      }
    }

    if (race.sourceUrl && /^https?:\/\//i.test(race.sourceUrl)) {
      const src = document.createElement("a");
      src.className = "card-source";
      src.href = race.sourceUrl;
      src.target = "_blank";
      src.rel = "noopener noreferrer";
      src.textContent = `Source: ${race.source || "official ballot"}`;
      card.appendChild(src);
    }
    return card;
  }

  // ----- Events ------------------------------------------------------------

  renderEvents(events, node) {
    const list = this.refs.eventsList;
    list.innerHTML = "";
    this.refs.eventsCount.textContent = String(events.length);

    const note = noLocalDataNote(node);
    if (note) list.appendChild(note);

    if (!events.length) {
      list.appendChild(
        emptyBox(
          `No upcoming events are listed for <strong>${escapeHtml(
            node.name
          )}</strong> yet. Check back soon, or look at the nearest city or county.`
        )
      );
      return;
    }
    for (const evt of events) list.appendChild(this._eventCard(evt));
  }

  _eventCard(evt) {
    const meta = EVENT_TYPES[evt.type] || { label: "Event", icon: "📌", color: "#475569" };
    const start = new Date(evt.start);

    const card = document.createElement("article");
    card.className = "card event-card";
    card.style.setProperty("--accent", meta.color);

    const badge = document.createElement("div");
    badge.className = "date-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = `<span class="date-month">${escapeHtml(
      monthFmt.format(start)
    )}</span><span class="date-day">${start.getDate()}</span>`;

    const body = document.createElement("div");
    body.className = "event-body";

    const chips = document.createElement("div");
    chips.className = "tag-row";
    chips.appendChild(tag(`${meta.icon} ${meta.label}`, "tag-type"));
    if (evt.virtual) chips.appendChild(tag("💻 Online option", "tag-soft"));
    if (evt.source === "sample") chips.appendChild(tag("Sample", "tag-sample"));
    body.appendChild(chips);

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = evt.title;
    body.appendChild(title);

    const when = document.createElement("p");
    when.className = "event-when";
    const rel = relativeDay(start);
    when.textContent = `${rel ? rel + " · " : ""}${dayFmt.format(start)}, ${timeFmt.format(
      start
    )}${evt.end ? " – " + timeFmt.format(new Date(evt.end)) : ""}`;
    body.appendChild(when);

    if (evt.venue) {
      const where = document.createElement("p");
      where.className = "card-meta";
      where.textContent = `📍 ${evt.venue}`;
      body.appendChild(where);
    }
    if (evt.description) {
      const desc = document.createElement("p");
      desc.className = "card-desc";
      desc.textContent = evt.description;
      body.appendChild(desc);
    }
    if (evt.scopeName) {
      const scope = document.createElement("p");
      scope.className = "card-meta";
      scope.textContent = `Applies to: ${evt.scopeName}`;
      body.appendChild(scope);
    }
    if (evt.url) {
      const a = document.createElement("a");
      a.className = "card-link";
      a.href = evt.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Details and sign-up";
      body.appendChild(a);
    }

    card.append(badge, body);
    return card;
  }

  // ----- Status ------------------------------------------------------------

  // Transient status message (search + geolocation feedback).
  setStatus(text, kind = "info", autoHideMs = 0) {
    const el = this.refs.status;
    clearTimeout(this._statusTimer);
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.dataset.kind = kind;
    if (autoHideMs) {
      this._statusTimer = setTimeout(() => this.setStatus(null), autoHideMs);
    }
  }
}

// ----- Helpers ---------------------------------------------------------------

// A friendly heads-up when we only have inherited info for the current place.
function noLocalDataNote(node) {
  if (node.level === "globe" || node.level === "country") return null;
  if (node.races.length || node.events.length) return null;
  const box = document.createElement("div");
  box.className = "note";
  box.innerHTML = `<strong>We don't have local details for ${escapeHtml(
    node.name
  )} yet.</strong> Anything listed below applies to a larger area that includes it.`;
  return box;
}

function emptyBox(html) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = html;
  return div;
}

function tag(text, cls) {
  const span = document.createElement("span");
  span.className = `tag ${cls}`;
  span.textContent = text;
  return span;
}

// "YYYY-MM-DD" -> Date at local midnight (avoids the UTC off-by-one-day bug).
function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Today", "Tomorrow", "In 5 days" (within two weeks), else "".
function relativeDay(date) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (startOfDay(date) - startOfDay(new Date())) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 14) return `In ${diff} days`;
  return "";
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

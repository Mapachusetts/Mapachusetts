// js/ui.js
// All DOM rendering: the layer dock, the dossier (header, countdown, ballot by
// layer, events), the browse-by-list menus, breadcrumbs and status messages.
// Pure rendering: it takes data and callbacks and knows nothing about the map
// or the data source.

import { CATEGORY_META, MIDTERM_2026, PRESIDENTIAL_2028 } from "../data/races.js";
import { EVENT_TYPES } from "../data/events.js";
import { KIND_ORDER, kindMeta } from "../data/kinds.js";
import { levelByKey } from "../data/levels.js";

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });

const ICON_MOON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="currentColor"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

export class UI {
  /**
   * refs: { body, navigator, browse, upBtn, worldBtn, themeBtn, legend, dock,
   *         panelTitle, panelLevel, breadcrumbs, pointNote, countdown,
   *         tabBallot, tabEvents, ballotCount, eventsCount, ballotList,
   *         eventsList, status }
   * handlers: { onAscend(), onReset(), onJump(id), onThemeToggle(),
   *             onFocusLayer(id), onSelectLayer(id), onHoverLayer(id|null),
   *             onOpenCandidate(slug) }
   */
  constructor(refs, handlers = {}) {
    this.refs = refs;
    this.handlers = handlers;
    this._selects = new Map();
    this._statusTimer = null;

    refs.upBtn.addEventListener("click", () => handlers.onAscend?.());
    refs.worldBtn.addEventListener("click", () => handlers.onReset?.());
    refs.themeBtn.addEventListener("click", () => handlers.onThemeToggle?.());

    refs.tabBallot.addEventListener("click", () => this.showTab("ballot"));
    refs.tabEvents.addEventListener("click", () => this.showTab("events"));
    if (refs.tabCandidate) {
      refs.tabCandidate.addEventListener("click", () => this.showTab("candidate"));
    }
    // Arrow keys move between the visible tabs (standard tab pattern).
    const tabCycle = () =>
      ["ballot", "events", refs.tabCandidate && !refs.tabCandidate.hidden ? "candidate" : null].filter(
        Boolean
      );
    const tabEl = { ballot: refs.tabBallot, events: refs.tabEvents, candidate: refs.tabCandidate };
    for (const name of ["ballot", "events", "candidate"]) {
      const tab = tabEl[name];
      if (!tab) continue;
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const order = tabCycle();
          const i = order.indexOf(name);
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const next = order[(i + delta + order.length) % order.length];
          this.showTab(next);
          tabEl[next].focus();
        }
      });
    }
  }

  // ===== Theme + mode =========================================================

  setTheme(theme) {
    const night = theme === "night";
    this.refs.body.dataset.theme = theme;
    // The button shows where you'd go: a sun on the night map, a moon on the day map.
    this.refs.themeBtn.innerHTML = night ? ICON_SUN : ICON_MOON;
    const label = night ? "Switch to the day map" : "Switch to the night map";
    this.refs.themeBtn.setAttribute("aria-label", label);
    this.refs.themeBtn.title = label;
    this.refs.themeBtn.setAttribute("aria-pressed", String(!night));
  }

  // World view = full-screen globe + intro. Any place = dossier + dock.
  setMode(isWorld) {
    this.refs.body.classList.toggle("is-world", isWorld);
    // The Browse panel starts closed so the map and dossier have room; it is one
    // click away (and stays however the person leaves it while moving around).
    if (isWorld) this.refs.navigator.open = false;
    this.refs.dock.hidden = isWorld;
  }

  setLegendVisible(visible) {
    this.refs.legend.hidden = !visible;
  }

  // ===== Browse-by-list menus ==================================================

  // model: [{ level, label, options: [{id,name}], selectedId, parentId, loading }]
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
      placeholder.textContent = m.loading ? "Loading…" : m.options.length ? "Choose…" : "—";
      select.appendChild(placeholder);

      for (const opt of m.options) {
        const o = document.createElement("option");
        o.value = opt.id;
        o.textContent = opt.name;
        select.appendChild(o);
      }
      select.value = m.selectedId || "";
      select.disabled = m.loading || m.options.length === 0;
      select.setAttribute("aria-busy", String(!!m.loading));
      select.title = m.options.length || m.loading
        ? ""
        : "Pick the level above first, or use the search box.";
    }
  }

  // ===== Dossier header =======================================================

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
    this.refs.panelTitle.textContent = node.name;
    this.refs.panelLevel.textContent = lvl ? lvl.label : node.level;
    this.renderCountdown();
  }

  // "Based on your location" / "Based on the center of Medford".
  renderPointNote(text) {
    this.refs.pointNote.hidden = !text;
    this.refs.pointNote.textContent = text || "";
  }

  // Days until the next general election.
  renderCountdown() {
    const el = this.refs.countdown;
    const today = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const next = [MIDTERM_2026, PRESIDENTIAL_2028]
      .map(parseLocalDate)
      .find((d) => startOfDay(d) >= startOfDay(today));
    if (!next) {
      el.hidden = true;
      return;
    }
    const days = Math.round((startOfDay(next) - startOfDay(today)) / 86400000);
    const progress = Math.max(4, Math.min(100, ((365 - Math.min(days, 365)) / 365) * 100));
    el.hidden = false;
    el.style.setProperty("--p", String(progress));
    el.innerHTML = "";
    const ring = document.createElement("span");
    ring.className = "cd-ring";
    ring.innerHTML = `<span class="cd-num">${days === 0 ? "!" : days}</span>`;
    const text = document.createElement("span");
    text.className = "cd-text";
    text.innerHTML = `<strong>${days === 0 ? "Election Day is today" : days === 1 ? "day to Election Day" : "days to Election Day"}</strong><span>${escapeHtml(
      dateFmt.format(next)
    )}</span>`;
    el.append(ring, text);
  }

  showTab(which) {
    const map = {
      ballot: { tab: this.refs.tabBallot, panel: this.refs.ballotList },
      events: { tab: this.refs.tabEvents, panel: this.refs.eventsList },
      candidate: { tab: this.refs.tabCandidate, panel: this.refs.candidateList },
    };
    for (const [name, { tab, panel }] of Object.entries(map)) {
      if (!tab || !panel) continue;
      const active = name === which;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    }
  }

  // ===== Candidate tab ==========================================================

  /**
   * Show (and optionally focus) the Candidate tab. `render` is a callback that
   * fills the panel — the app passes the candidate sheet's renderInto().
   */
  showCandidateTab(render, { focus = true } = {}) {
    if (!this.refs.tabCandidate || !this.refs.candidateList) return;
    this.refs.tabCandidate.hidden = false;
    render(this.refs.candidateList);
    this.showTab("candidate");
    if (focus) this.refs.tabCandidate.focus({ preventScroll: true });
  }

  // Hide and clear the Candidate tab (e.g. when moving to a new place).
  hideCandidateTab() {
    if (!this.refs.tabCandidate || !this.refs.candidateList) return;
    const wasActive = this.refs.tabCandidate.getAttribute("aria-selected") === "true";
    this.refs.tabCandidate.hidden = true;
    this.refs.candidateList.replaceChildren();
    if (wasActive) this.showTab("ballot");
  }

  // ===== The layer dock =========================================================

  /**
   * @param {{status: "loading"|"ready"|"error", stack: object[],
   *          loaded: Set<string>, focusId: string|null}} info
   */
  renderDock(info) {
    const dock = this.refs.dock;
    dock.innerHTML = "";
    dock.dataset.status = info.status;

    if (info.status === "error") {
      const note = document.createElement("p");
      note.className = "dock-note";
      note.textContent =
        "Couldn't reach the Census boundary service. Showing the basics only.";
      dock.appendChild(note);
      return;
    }
    if (info.status === "loading" && !info.stack.length) {
      for (let i = 0; i < 5; i++) {
        const sk = document.createElement("span");
        sk.className = "chip chip-skeleton";
        dock.appendChild(sk);
      }
      return;
    }

    const label = document.createElement("span");
    label.className = "dock-label";
    label.textContent = "Your layers";
    dock.appendChild(label);

    info.stack.forEach((j, i) => {
      const meta = kindMeta(j.kind);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.style.setProperty("--c", meta.color);
      chip.style.setProperty("--i", String(i));
      chip.dataset.id = j.id;
      chip.setAttribute("aria-pressed", String(info.focusId === j.id));
      chip.title = `${meta.label}: ${j.name}${j.type ? ` (${j.type})` : ""}`;

      const ico = document.createElement("span");
      ico.className = "chip-ico";
      ico.setAttribute("aria-hidden", "true");
      ico.textContent = meta.icon;

      const text = document.createElement("span");
      text.className = "chip-text";
      const tag = document.createElement("span");
      tag.className = "chip-tag";
      tag.textContent = meta.tag;
      const name = document.createElement("span");
      name.className = "chip-name";
      name.textContent = j.short || j.name;
      text.append(tag, name);

      chip.append(ico, text);
      // No outline for the country; others show a dot while theirs loads.
      if (j.kind !== "country" && !info.loaded.has(j.id) && info.status === "loading") {
        chip.classList.add("chip-loading");
      }

      chip.addEventListener("click", () => this.handlers.onFocusLayer?.(j.id));
      chip.addEventListener("mouseenter", () => this.handlers.onHoverLayer?.(j.id));
      chip.addEventListener("mouseleave", () => this.handlers.onHoverLayer?.(null));
      chip.addEventListener("focus", () => this.handlers.onHoverLayer?.(j.id));
      chip.addEventListener("blur", () => this.handlers.onHoverLayer?.(null));
      dock.appendChild(chip);
    });
  }

  // ===== Ballot, grouped by layer of government =================================

  /**
   * @param {object[]} races
   * @param {{node: object, stack: object[], status: string, openKind?: string,
   *          unincorporated?: boolean, unincorporatedName?: string}} ctx
   */
  renderBallot(races, ctx) {
    const list = this.refs.ballotList;
    list.innerHTML = "";
    this.refs.ballotCount.textContent = String(races.length);

    if (ctx.unincorporated && ctx.node.level === "city") {
      list.appendChild(
        noteBox(
          `<strong>${escapeHtml(ctx.unincorporatedName || ctx.node.name)} isn't a city or town.</strong> It's an unincorporated area, so the county government handles local services.`
        )
      );
    } else if (!ctx.node.races.length && !ctx.node.events.length && ctx.node.level !== "country") {
      list.appendChild(
        noteBox(
          `<strong>We don't have local details for ${escapeHtml(ctx.node.name)} yet.</strong> The layers below are real; ballot items appear as data is added.`
        )
      );
    }

    // Which layers to show: everything in the stack, plus any layer a race
    // belongs to. Always broad -> local.
    const kinds = new Set(ctx.stack.map((j) => j.kind));
    for (const r of races) kinds.add(r.kind);
    const ordered = KIND_ORDER.filter((k) => kinds.has(k));

    if (!ordered.length) {
      list.appendChild(emptyBox("Loading the layers of government for this place…"));
      return;
    }

    for (const kind of ordered) {
      const meta = kindMeta(kind);
      const members = ctx.stack.filter((j) => j.kind === kind);
      const items = races.filter((r) => r.kind === kind);

      const sec = document.createElement("details");
      sec.className = "layer";
      sec.style.setProperty("--c", meta.color);
      sec.style.setProperty("--layer-ink", meta.ink);
      sec.dataset.ids = members.map((j) => j.id).join(" ");
      // Start with just the layer you're looking at open; the rest stay as a
      // compact one-line overview of the whole stack.
      sec.open = kind === ctx.openKind;

      const sum = document.createElement("summary");
      const ico = document.createElement("span");
      ico.className = "layer-ico";
      ico.setAttribute("aria-hidden", "true");
      ico.textContent = meta.icon;
      const title = document.createElement("span");
      title.className = "layer-title";
      const k = document.createElement("span");
      k.className = "layer-kind";
      k.textContent = meta.label;
      const n = document.createElement("span");
      n.className = "layer-name";
      n.textContent = members.map((j) => j.name).join(" · ");
      title.append(k, n);
      const count = document.createElement("span");
      count.className = "layer-count";
      count.textContent = String(items.length);
      count.title = `${items.length} ballot item${items.length === 1 ? "" : "s"}`;
      sum.append(ico, title, count);
      sec.appendChild(sum);

      const body = document.createElement("div");
      body.className = "layer-body";
      const blurb = document.createElement("p");
      blurb.className = "layer-blurb";
      blurb.textContent = meta.blurb;
      body.appendChild(blurb);

      if (items.length) {
        for (const race of items) body.appendChild(this._raceCard(race));
      } else {
        const none = document.createElement("p");
        none.className = "layer-empty";
        none.textContent = "No ballot items listed for this layer yet.";
        body.appendChild(none);
      }
      const src = members.find((j) => j.source && j.source !== "built in");
      if (src) {
        const credit = document.createElement("p");
        credit.className = "layer-credit";
        credit.textContent = `Boundary: ${src.source}`;
        body.appendChild(credit);
      }
      sec.appendChild(body);

      const first = members[0]?.id;
      if (first) {
        sum.addEventListener("mouseenter", () => this.handlers.onHoverLayer?.(first));
        sum.addEventListener("mouseleave", () => this.handlers.onHoverLayer?.(null));
        // Opening a section yourself highlights that layer on the globe. (A
        // click handler, not "toggle": toggle also fires for sections we open
        // while rendering, which would yank the map around.)
        sum.addEventListener("click", () => {
          setTimeout(() => {
            if (sec.open) this.handlers.onSelectLayer?.(first);
          }, 0);
        });
      }
      list.appendChild(sec);
    }
  }

  // Open and scroll to the ballot section for a layer (when its chip is clicked).
  revealLayer(id) {
    const sec = [...this.refs.ballotList.querySelectorAll(".layer")].find((s) =>
      (s.dataset.ids || "").split(" ").includes(id)
    );
    if (!sec) return;
    this.showTab("ballot");
    sec.open = true;
    sec.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  _raceCard(race) {
    const card = document.createElement("article");
    card.className = "card race-card";

    const tags = document.createElement("div");
    tags.className = "tag-row";
    const cat = CATEGORY_META[race.category];
    if (cat) tags.appendChild(tag(`${cat.icon} ${cat.label}`, "tag-type"));
    if (race.source === "sample") tags.appendChild(tag("Sample", "tag-sample"));
    else if (race.candidates?.some((c) => c.slug)) tags.appendChild(tag("✓ Researched", "tag-real"));
    if (tags.children.length) card.appendChild(tags);

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
    meta.textContent = bits.join("  ·  ");
    if (bits.length) card.appendChild(meta);

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
          // A researched candidate: opens their full profile.
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cand-btn";
          btn.textContent = label;
          btn.title = `Open ${c.name}'s profile`;
          btn.addEventListener("click", () => this.handlers.onOpenCandidate?.(c.slug));
          li.appendChild(btn);
        } else {
          li.textContent = label;
        }
        cands.appendChild(li);
      }
      card.appendChild(cands);
    }
    return card;
  }

  // ===== Events ===============================================================

  renderEvents(events, node) {
    const list = this.refs.eventsList;
    list.innerHTML = "";
    this.refs.eventsCount.textContent = String(events.length);

    if (!events.length) {
      list.appendChild(
        emptyBox(
          `No upcoming events are listed for <strong>${escapeHtml(
            node.name
          )}</strong> yet. Check back soon, or look at a nearby city or county.`
        )
      );
      return;
    }
    for (const evt of events) list.appendChild(this._eventCard(evt));
  }

  _eventCard(evt) {
    const meta = EVENT_TYPES[evt.type] || { label: "Event", icon: "📌", color: "#475569" };
    const layer = evt.kind ? kindMeta(evt.kind) : null;
    const start = new Date(evt.start);

    const card = document.createElement("article");
    card.className = "card event-card";
    card.style.setProperty("--accent", layer ? layer.color : meta.color);

    const badge = document.createElement("div");
    badge.className = "date-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = `<span class="date-month">${escapeHtml(monthFmt.format(start))}</span><span class="date-day">${start.getDate()}</span>`;

    const body = document.createElement("div");
    body.className = "event-body";

    const chips = document.createElement("div");
    chips.className = "tag-row";
    chips.appendChild(tag(`${meta.icon} ${meta.label}`, "tag-type"));
    if (layer) chips.appendChild(tag(`${layer.icon} ${layer.tag}`, "tag-layer", layer.ink));
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
    when.textContent = `${rel ? rel + " · " : ""}${dayFmt.format(start)}, ${timeFmt.format(start)}${
      evt.end ? " – " + timeFmt.format(new Date(evt.end)) : ""
    }`;
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

  // ===== Status ===============================================================

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

function noteBox(html) {
  const box = document.createElement("div");
  box.className = "note";
  box.innerHTML = html;
  return box;
}

function emptyBox(html) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = html;
  return div;
}

function tag(text, cls, color) {
  const span = document.createElement("span");
  span.className = `tag ${cls}`;
  span.textContent = text;
  if (color) span.style.setProperty("--tag-ink", color);
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
  const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 14) return `In ${diff} days`;
  return "";
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

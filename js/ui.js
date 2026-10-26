// js/ui.js
// All DOM rendering: the layer dock, the dossier (header, countdown, ballot by
// layer, events), the browse-by-list menus, breadcrumbs and status messages.
// Pure rendering: it takes data and callbacks and knows nothing about the map
// or the data source.

import { CATEGORY_META, MIDTERM_2026, PRESIDENTIAL_2028 } from "../data/races.js";
import { EVENT_TYPES } from "../data/events.js";
import { KIND_ORDER, kindMeta } from "../data/kinds.js";
import { levelByKey } from "../data/levels.js";
import { icon } from "./icons.js";
import { getCandidate, initials } from "../data/candidates.js";
import { OFFICEHOLDER_INFO, hasLocalOfficeholders, profileSlugFor } from "../data/officeholders.js";
import { isPilot } from "./config.js";
import { votingSummary, formatDeadline, shortLabel } from "./voting-info.js";

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: "short" });


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

    // Tabs: Ballot and Events everywhere, plus pilot tabs (Voting info, Ask,
    // Reports) that the app shows only when they apply.
    this.tabs = [
      { id: "ballot", tab: refs.tabBallot, panel: refs.ballotList },
      { id: "events", tab: refs.tabEvents, panel: refs.eventsList },
      ...(refs.extraTabs || []),
    ];
    for (const t of this.tabs) {
      t.tab.addEventListener("click", () => {
        this.showTab(t.id);
        this.handlers.onTab?.(t.id);
      });
      // Arrow keys move between visible tabs (standard tab pattern).
      t.tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const visible = this.tabs.filter((x) => !x.tab.hidden);
        const at = visible.indexOf(t);
        const next = visible[(at + (e.key === "ArrowRight" ? 1 : visible.length - 1)) % visible.length];
        this.showTab(next.id);
        this.handlers.onTab?.(next.id);
        next.tab.focus();
      });
    }
    this.activeTab = "ballot";
  }

  // ===== Theme + mode =========================================================

  setTheme(theme) {
    const night = theme === "night";
    this.refs.body.dataset.theme = theme;
    // The button shows where you'd go: a sun on the night map, a moon on the day map.
    this.refs.themeBtn.innerHTML = icon(night ? "sun" : "moon", { size: 20 });
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
    const target = this.tabs.find((t) => t.id === which && !t.tab.hidden) ? which : "ballot";
    this.activeTab = target;
    for (const t of this.tabs) {
      const on = t.id === target;
      t.tab.setAttribute("aria-selected", String(on));
      t.tab.tabIndex = on ? 0 : -1;
      t.panel.hidden = !on;
    }
  }
  /** Show or hide a pilot tab; falls back to Ballot if the open tab disappears. */
  setTabVisible(id, visible) {
    const t = this.tabs.find((x) => x.id === id);
    if (!t) return;
    t.tab.hidden = !visible;
    if (!visible) t.panel.hidden = true;
    if (!visible && this.activeTab === id) this.showTab("ballot");
  }
  /** Small number on a tab (0 or null removes it). */
  setTabCount(id, count) {
    const t = this.tabs.find((x) => x.id === id);
    const badge = t && t.tab.querySelector(".count");
    if (badge) {
      badge.textContent = String(count ?? 0);
      badge.hidden = !count;
    }
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
      ico.innerHTML = icon(meta.icon, { size: 20 });

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
    const pilot = isPilot(ctx.stateCode);
    const questions = ctx.questions || [];
    this.refs.ballotCount.textContent = String(races.length + questions.length);
    if (pilot) {
      const banner = this._votingBanner();
      if (banner) list.appendChild(banner);
    }

    if (ctx.unincorporated && ctx.node.level === "city") {
      list.appendChild(
        noteBox(
          `<strong>${escapeHtml(ctx.unincorporatedName || ctx.node.name)} isn't a city or town.</strong> It's an unincorporated area, so the county government handles local services.`
        )
      );
    }

    // Honest coverage note: federal and statewide candidates are listed for the
    // whole country; local ones are not (no free national source).
    if (pilot) {
      list.appendChild(
        noteBox(
          `<strong>Your ballot, as complete as we can make it.</strong> This page lists who is in office, the candidates we could confirm from at least two public sources (checked Oct. 24, 2026) and the ballot questions. City, town and school committee candidates and most local questions are not listed, and write-in candidates never are. Your <a href="https://www.sec.state.ma.us/wheredoivotema/bal/myelectioninfo.aspx" target="_blank" rel="noopener noreferrer">official sample ballot</a> or your clerk has the final list.`
        )
      );
    } else if (ctx.node.level !== "country" && ctx.node.level !== "globe") {
      const link = '<a href="https://ballotpedia.org/Sample_Ballot_Lookup" target="_blank" rel="noopener noreferrer">sample ballot lookup</a>';
      list.appendChild(
        noteBox(
          `<strong>Federal and governor races are listed for every state.</strong> We don't have candidate lists yet for state legislature, county, city or school board races. Use a ${link} or your local election office to see your full ballot. ${holdersCoverage(ctx.stateCode)}`
        )
      );
    }

    // Which layers to show: everything in the stack, plus any layer a race
    // belongs to. Always broad -> local.
    const kinds = new Set(ctx.stack.map((j) => j.kind));
    for (const r of races) kinds.add(r.kind);
    for (const q of questions) kinds.add(q.kind);
    for (const h of ctx.holders || []) kinds.add(h.kind);
    const ordered = KIND_ORDER.filter((k) => kinds.has(k));

    if (!ordered.length) {
      list.appendChild(emptyBox("Loading the layers of government for this place…"));
      return;
    }

    for (const kind of ordered) {
      const meta = kindMeta(kind);
      const members = ctx.stack.filter((j) => j.kind === kind);
      const items = races.filter((r) => r.kind === kind);
      const held = (ctx.holders || []).filter((h) => h.kind === kind);
      const asked = questions.filter((q) => q.kind === kind);

      const sec = document.createElement("details");
      sec.className = "layer";
      sec.style.setProperty("--c", meta.color);
      sec.style.setProperty("--layer-ink", meta.ink);
      sec.dataset.ids = members.map((j) => j.id).join(" ");
      // Start with just the layer you're looking at open; the rest stay as a
      // compact one-line overview of the whole stack.
      // In the pilot state every layer that has something to show starts open, so
      // the national and state offices never seem to disappear when you drop
      // down to a city. Elsewhere only the layer you are looking at is open.
      sec.open = kind === ctx.openKind || (pilot && (held.length > 0 || items.length > 0 || asked.length > 0));

      const sum = document.createElement("summary");
      const ico = document.createElement("span");
      ico.className = "layer-ico";
      ico.setAttribute("aria-hidden", "true");
      ico.innerHTML = icon(meta.icon, { size: 22 });
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
      const total = items.length + asked.length;
      count.textContent = String(total);
      count.title = `${total} ballot item${total === 1 ? "" : "s"}`;
      sum.append(ico, title);
      if (pilot && held.length) {
        const inOffice = document.createElement("span");
        inOffice.className = "layer-held";
        inOffice.textContent = `${held.length} in office`;
        sum.appendChild(inOffice);
      }
      sum.append(count);
      sec.appendChild(sum);

      const body = document.createElement("div");
      body.className = "layer-body";
      const blurb = document.createElement("p");
      blurb.className = "layer-blurb";
      blurb.textContent = meta.blurb;
      body.appendChild(blurb);
      if (held.length) body.appendChild(this._holders(held));
      if (asked.length) {
        body.appendChild(subheading("Questions on your ballot"));
        for (const q of asked) body.appendChild(this._questionCard(q));
      }
      if (items.length) {
        if (held.length || asked.length) body.appendChild(subheading("Candidates on your ballot"));
        for (const race of items) body.appendChild(this._raceCard(race));
      } else if (asked.length) {
        // Questions are shown above; nothing more to say for this layer.
      } else {
        const none = document.createElement("p");
        none.className = "layer-empty";
        none.textContent = emptyLayerText(kind);
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

  // "In office now": who holds each office in this layer, on the ballot or not.
  _holders(holders) {
    const wrap = document.createElement("section");
    wrap.className = "holders";
    wrap.appendChild(subheading("In office now"));
    const list = document.createElement("ul");
    list.className = "holder-list";
    for (const h of holders) list.appendChild(this._holderRow(h));
    wrap.appendChild(list);
    const credit = document.createElement("p");
    credit.className = "layer-credit";
    credit.textContent = `As of ${dateFmt.format(parseLocalDate(OFFICEHOLDER_INFO.asOf))}. Offices change hands after elections, resignations and appointments, so check the official page.`;
    wrap.appendChild(credit);
    return wrap;
  }
  _holderRow(h) {
    const li = document.createElement("li");
    li.className = "holder";
    li.dataset.party = String(h.party || "").trim().toLowerCase();

    const avatar = document.createElement("span");
    avatar.className = "holder-avatar";
    avatar.setAttribute("aria-hidden", "true");
    const setInitials = () => {
      avatar.replaceChildren(document.createTextNode(initials(h.name)));
    };
    if (h.photo && /^https?:\/\//i.test(h.photo)) {
      const img = document.createElement("img");
      img.src = h.photo;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", setInitials);
      avatar.appendChild(img);
    } else {
      setInitials();
    }

    const main = document.createElement("div");
    main.className = "holder-main";
    const office = document.createElement("div");
    office.className = "holder-office";
    office.textContent = h.office;
    main.appendChild(office);

    const slug = profileSlugFor(h);
    let nameEl;
    if (slug) {
      nameEl = document.createElement("button");
      nameEl.type = "button";
      nameEl.className = "cand-btn holder-name";
      nameEl.title = `Open ${h.name}'s profile`;
      nameEl.addEventListener("click", () => this.handlers.onOpenCandidate?.(slug));
    } else {
      nameEl = document.createElement("div");
      nameEl.className = "holder-name";
    }
    nameEl.textContent = h.name;
    main.appendChild(nameEl);

    const meta = [h.party, termText(h)].filter(Boolean).join("  ·  ");
    if (meta) {
      const p = document.createElement("div");
      p.className = "holder-meta";
      p.textContent = meta;
      main.appendChild(p);
    }

    const tags = document.createElement("div");
    tags.className = "tag-row";
    const when = electionTag(h);
    if (when) tags.appendChild(tag(when.text, when.cls, null, when.icon));
    if (h.appointed) tags.appendChild(tag("Appointed", "tag-soft", null, "check"));
    if (tags.children.length) main.appendChild(tags);

    if (h.note) {
      const n = document.createElement("div");
      n.className = "holder-note";
      n.textContent = h.note;
      main.appendChild(n);
    }
    if (h.url && /^https?:\/\//i.test(h.url)) {
      const a = document.createElement("a");
      a.className = "holder-link";
      a.href = h.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Official page ↗";
      main.appendChild(a);
    }
    li.append(avatar, main);
    return li;
  }
  _raceCard(race) {
    const card = document.createElement("article");
    card.className = "card race-card";

    const tags = document.createElement("div");
    tags.className = "tag-row";
    const cat = CATEGORY_META[race.category];
    if (cat) tags.appendChild(tag(cat.label, "tag-type", null, cat.icon));
    if (race.source === "sample") tags.appendChild(tag("Sample", "tag-sample"));
    if (race.candidates?.some((c) => c.slug && getCandidate(c.slug)?.researched)) {
      tags.appendChild(tag("Research profiles", "tag-real", null, "check"));
    }
    if (race.uncontested) tags.appendChild(tag("Only one candidate listed", "tag-soft", null, "check"));
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

    if (race.pending) {
      const wait = document.createElement("p");
      wait.className = "card-desc card-pending";
      wait.textContent =
        "The candidate list for this race isn't available yet. Check your state or local election office.";
      card.appendChild(wait);
    }

    if (race.candidates && race.candidates.length) {
      const cands = document.createElement("ul");
      cands.className = "chips";
      cands.setAttribute("aria-label", "Candidates or choices");
      for (const c of race.candidates) {
        const li = document.createElement("li");
        const label = `${c.name}${c.party ? ` (${c.party})` : ""}${c.incumbent ? ", incumbent" : ""}`;
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
    if (race.source === "ma-ballot") card.appendChild(this._raceSources(race));
    return card;
  }
  // "Where this came from" for pilot races, so a voter can check it.
  _raceSources(race) {
    const box = document.createElement("details");
    box.className = "card-sources";
    const sum = document.createElement("summary");
    sum.textContent = `Where this list comes from (${race.sources.length})`;
    box.appendChild(sum);
    const note = document.createElement("p");
    note.className = "card-note";
    note.textContent =
      "Compared across public election records and news guides on Oct. 24, 2026. Write-in candidates are always allowed and are not listed. Your sample ballot is the final word." +
      (race.note ? ` ${race.note}` : "");
    box.appendChild(note);
    const ul = document.createElement("ul");
    for (const url of race.sources) {
      if (!/^https?:\/\//i.test(url)) continue;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      try {
        a.textContent = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        a.textContent = url;
      }
      li.appendChild(a);
      ul.appendChild(li);
    }
    box.appendChild(ul);
    return box;
  }
  // A ballot question, in plain words. Yes and No sit side by side.
  _questionCard(q) {
    const card = document.createElement("article");
    card.className = "card question-card";
    const tags = document.createElement("div");
    tags.className = "tag-row";
    tags.appendChild(tag(q.number ? `Question ${q.number}` : "District question", "tag-type", null, "measure"));
    if (q.type === "public-policy") tags.appendChild(tag("Advisory only", "tag-soft"));
    if (q.affectsVoting) tags.appendChild(tag("About voting", "tag-soft", null, "ballot"));
    card.appendChild(tags);
    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = q.title;
    card.appendChild(title);
    const sum = document.createElement("p");
    sum.className = "card-desc";
    sum.textContent = q.summary;
    card.appendChild(sum);
    const grid = document.createElement("div");
    grid.className = "yes-no";
    for (const [cls, label, text] of [
      ["yes", "Yes", q.yesVote],
      ["no", "No", q.noVote],
    ]) {
      const cell = document.createElement("div");
      cell.className = `yes-no-cell ${cls}`;
      const strong = document.createElement("strong");
      strong.textContent = `${label} vote`;
      const p = document.createElement("p");
      p.textContent = String(text || "").replace(/^A (YES|NO) vote would /i, "Would ");
      cell.append(strong, p);
      grid.appendChild(cell);
    }
    card.appendChild(grid);
    if (q.whenEffective) {
      const when = document.createElement("p");
      when.className = "card-meta";
      when.textContent = `If it passes: ${q.whenEffective}`;
      card.appendChild(when);
    }
    const more = document.createElement("details");
    more.className = "card-sources";
    const msum = document.createElement("summary");
    msum.textContent = "Arguments, cost and sources";
    more.appendChild(msum);
    if (q.fiscalNote) {
      const f = document.createElement("p");
      f.className = "card-note";
      f.textContent = `Cost: ${q.fiscalNote}`;
      more.appendChild(f);
    }
    for (const [label, list] of [
      ["Supporters say", q.arguments && q.arguments.for],
      ["Opponents say", q.arguments && q.arguments.against],
    ]) {
      for (const a of list || []) {
        const p = document.createElement("p");
        p.className = "card-note";
        const b = document.createElement("strong");
        b.textContent = `${label} (${a.by}): `;
        p.append(b, document.createTextNode(a.text));
        more.appendChild(p);
      }
    }
    const ul = document.createElement("ul");
    for (const s of q.sources || []) {
      if (!/^https?:\/\//i.test(s.url)) continue;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = s.label;
      li.appendChild(a);
      ul.appendChild(li);
    }
    more.appendChild(ul);
    card.appendChild(more);
    return card;
  }
  // Top of the Ballot tab in the pilot state: the next deadline and how many
  // things about voting changed, with a way to the Voting info tab.
  _votingBanner() {
    const sum = votingSummary();
    if (!sum.next && !sum.attention) return null;
    const box = document.createElement("div");
    box.className = "vote-banner";
    box.setAttribute("role", "note");
    const ico = document.createElement("span");
    ico.className = "vote-banner-ico";
    ico.setAttribute("aria-hidden", "true");
    ico.innerHTML = icon("alert", { size: 20 });
    const text = document.createElement("div");
    const lead = document.createElement("strong");
    lead.textContent = sum.next ? `${shortLabel(sum.next)}: ${formatDeadline(sum.next)}` : "Voting changes to know about";
    const body = document.createElement("div");
    body.textContent = sum.attention
      ? `${sum.attention} things about voting changed or could still change.`
      : "Check your voting options.";
    text.append(lead, body);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost vote-banner-btn";
    btn.textContent = "See voting info";
    btn.addEventListener("click", () => {
      this.showTab("voting");
      this.handlers.onTab?.("voting");
    });
    box.append(ico, text, btn);
    return box;
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
    const meta = EVENT_TYPES[evt.type] || { label: "Event", icon: "pin", color: "#475569" };
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
    chips.appendChild(tag(meta.label, "tag-type", null, meta.icon));
    if (layer) chips.appendChild(tag(layer.tag, "tag-layer", layer.ink, layer.icon));
    if (evt.virtual) chips.appendChild(tag("Online option", "tag-soft", null, "online"));
    if (evt.source === "sample") chips.appendChild(tag("Sample", "tag-sample"));
    body.appendChild(chips);

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = evt.title;
    body.appendChild(title);

    const when = document.createElement("p");
    when.className = "event-when";
    const rel = relativeDay(start);
    when.textContent = `${rel ? rel + " · " : ""}${dayFmt.format(start)}${
      evt.allDay
        ? ", all day"
        : ", " + timeFmt.format(start) + (evt.end ? " – " + timeFmt.format(new Date(evt.end)) : "")
    }`;
    body.appendChild(when);

    if (evt.venue) {
      const where = document.createElement("p");
      where.className = "card-meta card-where";
      where.insertAdjacentHTML("afterbegin", icon("pin", { size: 14 }));
      where.append(document.createTextNode(` ${evt.venue}`));
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

// What to say when we have no races for a layer. Be honest about WHY.
function emptyLayerText(kind) {
  switch (kind) {
    case "senate":
    case "house":
      return "We don't have a list of state legislature candidates yet. Your state or local election office has the full ballot.";
    case "county":
    case "city":
    case "school":
    case "ward":
      return "We don't have a list of local candidates for this layer yet. A sample ballot from your election office will show them.";
    case "precinct":
      return "Your precinct decides where you vote. Confirm your polling place with your local election office.";
    default:
      return "No races for this layer are on the ballot we have data for.";
  }
}

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

function subheading(text) {
  const h = document.createElement("h4");
  h.className = "layer-sub";
  h.textContent = text;
  return h;
}
const monthYear = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const ELECTION_DAY_2026 = "2026-11-03";

// "Term ends January 2027", "Appointed Mar 24, 2026", or special wording for
// an appointee who serves until a special election is decided.
function termText(h) {
  if (h.termEnd === ELECTION_DAY_2026) return "Serves until the winner of the Nov. 3 election is sworn in";
  const bits = [];
  if (h.appointed && h.termStart) bits.push(`Appointed ${fullDate.format(parseLocalDate(h.termStart))}`);
  else if (h.termStart) bits.push(`Since ${monthYear.format(parseLocalDate(h.termStart))}`);
  if (h.termEnd) bits.push(`term ends ${monthYear.format(parseLocalDate(h.termEnd))}`);
  const text = bits.join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

// Is this seat on the 2026 ballot, or when is its next election?
function electionTag(h) {
  const iso = h.nextElection;
  if (!iso) return null;
  if (/^\d{4}$/.test(iso)) return { text: `Next election: ${iso}`, cls: "tag-soft", icon: "events" };
  const day = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (h.onBallot2026 && day >= today) {
    return { text: `On the ballot ${fullDate.format(day)}`, cls: "tag-type", icon: "ballot" };
  }
  if (day < today) {
    // The data predates this election: say so instead of showing stale "next" dates.
    return { text: `Election held ${fullDate.format(day)}; list not yet updated`, cls: "tag-soft", icon: "events" };
  }
  return { text: `Next election: ${fullDate.format(day)}`, cls: "tag-soft", icon: "events" };
}

// One sentence on what "in office now" covers where you are.
function holdersCoverage(stateCode) {
  const base = "Who holds office is listed for the President, Vice President, U.S. senators and governors in every state";
  return hasLocalOfficeholders(stateCode)
    ? `${base}, and for state, county and city offices in this state.`
    : `${base}. State, county and city officeholders are listed for Massachusetts only so far.`;
}

// A small pill. `iconKey` (optional) is a key into js/icons.js.
function tag(text, cls, color, iconKey) {
  const span = document.createElement("span");
  span.className = `tag ${cls}`;
  if (iconKey) span.insertAdjacentHTML("afterbegin", icon(iconKey, { size: 13 }));
  span.append(document.createTextNode(text));
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

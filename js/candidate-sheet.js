// js/candidate-sheet.js
// The candidate profile sheet: a slide-over panel with six tabs (In the News,
// Funding, Career, Issues, Sources, Myths & Facts).
//
// Ported from components/CandidateResearch.tsx (the React app) to plain DOM code
// so the static globe UI needs no build step. The data comes from
// data/candidates.js (which merges the Supabase seed data with the curated
// profiles). All text is inserted with textContent and links are validated with
// safeUrl(), exactly like the React version, so data can never inject markup.

import { getCandidate, initials } from "../data/candidates.js";

const TABS = [
  { id: "news", label: "In the News", icon: "📰" },
  { id: "funding", label: "Funding", icon: "💰" },
  { id: "career", label: "Career", icon: "🧭" },
  { id: "opinions", label: "Issues", icon: "🗣️" },
  { id: "sources", label: "Sources", icon: "🔗" },
  { id: "misconceptions", label: "Myths & Facts", icon: "🔍" },
];

const BIAS_LABELS = {
  nonpartisan: "Nonpartisan",
  center: "Center",
  "center-left": "Center-Left",
  "center-right": "Center-Right",
  left: "Left",
  right: "Right",
};

const TYPE_LABELS = {
  government: "Gov't record",
  nonprofit: "Nonprofit",
  factcheck: "Fact-checker",
  newspaper: "Newspaper",
  wire: "Wire service",
  academic: "Academic",
};

const STATUS_ICONS = { incumbent: "🏛️", running: "🗳️", former: "📋" };

// ----- Tiny DOM helper ------------------------------------------------------------

/** h("div", {class: "x", href: "..."}, child, "text", ...) */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Only http(s) links are rendered; anything else (e.g. javascript:) is dropped. */
function safeUrl(url) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function link(href, text, cls) {
  const url = safeUrl(href);
  return url
    ? h("a", { href: url, class: cls, target: "_blank", rel: "noopener noreferrer" }, text)
    : h("span", { class: cls }, text);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DATE_ONLY.test(value) ? "UTC" : "America/New_York",
  });
}

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function alignmentLabel(score) {
  if (score >= 80) return { text: "Strongly supports", cls: "align-strong-yes" };
  if (score >= 60) return { text: "Leans in favor", cls: "align-yes" };
  if (score >= 41) return { text: "Mixed position", cls: "align-mixed" };
  if (score >= 21) return { text: "Leans against", cls: "align-no" };
  return { text: "Strongly opposed", cls: "align-strong-no" };
}

function voteClass(vote) {
  const v = String(vote).toLowerCase();
  if (["yes", "co-sponsor", "sponsored", "supported", "introduced"].includes(v)) return "vote-yes";
  if (v.startsWith("no")) return "vote-no";
  return "vote-neutral";
}

const timeOf = (value) => (value ? Date.parse(value) : Number.NaN);

/** Open on the freshest tab that has data. */
function defaultTab(c) {
  if (c.news) return "news";
  if (c.funding) return "funding";
  return "career";
}

// ----- The sheet ------------------------------------------------------------------

export class CandidateSheet {
  /**
   * @param {HTMLElement} root  the <aside> that holds the sheet
   * @param {{onClose?: () => void}} [handlers]
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.slug = null;
    this.tab = "news";
    this._returnFocus = null;
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Show a candidate. Returns false if we have no data for that slug. */
  open(slug, { focus = true } = {}) {
    const c = getCandidate(slug);
    if (!c) return false;
    if (!this.isOpen) this._returnFocus = document.activeElement;
    this.slug = slug;
    this.tab = defaultTab(c);
    this.root.hidden = false;
    document.body.classList.add("has-candidate");
    this._render(c);
    // Let the slide-in animation start from the hidden state. preventScroll
    // matters: focusing something inside a container that is still translated
    // off-screen would otherwise make the browser scroll the (overflow:hidden)
    // stage sideways to "reveal" it.
    requestAnimationFrame(() => {
      this.root.classList.add("is-open");
      if (focus) this.root.querySelector(".cs-close")?.focus({ preventScroll: true });
    });
    this._setUrl(slug);
    return true;
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.remove("is-open");
    document.body.classList.remove("has-candidate");
    this.root.hidden = true;
    this.slug = null;
    this._setUrl(null);
    this._returnFocus?.focus?.();
    this._returnFocus = null;
    this.handlers.onClose?.();
  }

  // Make the profile shareable (?candidate=slug) without navigating.
  _setUrl(slug) {
    try {
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set("candidate", slug);
      else url.searchParams.delete("candidate");
      window.history.replaceState(null, "", url);
    } catch {
      /* file:// or sandboxed: sharing links just won't update */
    }
  }

  _setTab(id, focusTab = false) {
    this.tab = id;
    for (const t of TABS) {
      const active = t.id === id;
      const btn = this.root.querySelector(`#cs-tab-${t.id}`);
      const panel = this.root.querySelector(`#cs-panel-${t.id}`);
      btn.setAttribute("aria-selected", String(active));
      btn.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    }
    if (focusTab) this.root.querySelector(`#cs-tab-${id}`).focus({ preventScroll: true });
    this.root.querySelector(".cs-scroll").scrollTop = 0;
  }

  _onTabKey(e) {
    const i = TABS.findIndex((t) => t.id === this.tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    this._setTab(TABS[next].id, true);
  }

  // ----- Rendering ---------------------------------------------------------------

  _render(c) {
    const panels = {
      news: () => this._news(c.news),
      funding: () => this._funding(c.funding),
      career: () => this._career(c),
      opinions: () => this._issues(c.opinions),
      sources: () => this._sources(c.sources, c.news),
      misconceptions: () => this._myths(c.misconceptions),
    };

    const tabs = h(
      "div",
      { class: "cs-tabs", role: "tablist", "aria-label": "Candidate information" },
      TABS.map((t) =>
        h(
          "button",
          {
            class: "cs-tab",
            type: "button",
            id: `cs-tab-${t.id}`,
            role: "tab",
            "aria-selected": String(t.id === this.tab),
            "aria-controls": `cs-panel-${t.id}`,
            tabindex: t.id === this.tab ? "0" : "-1",
            onclick: () => this._setTab(t.id),
            onkeydown: (e) => this._onTabKey(e),
          },
          h("span", { "aria-hidden": "true" }, t.icon),
          " ",
          t.label
        )
      )
    );

    const body = h(
      "div",
      { class: "cs-scroll" },
      TABS.map((t) =>
        h(
          "div",
          {
            class: "cs-panel",
            id: `cs-panel-${t.id}`,
            role: "tabpanel",
            "aria-labelledby": `cs-tab-${t.id}`,
            tabindex: "0",
            hidden: t.id !== this.tab,
          },
          panels[t.id]()
        )
      )
    );

    this.root.replaceChildren(
      h(
        "button",
        {
          class: "cs-close",
          type: "button",
          onclick: () => this.close(),
          "aria-label": `Close ${c.name}'s profile`,
        },
        h("span", { "aria-hidden": "true" }, "←"),
        " Back"
      ),
      this._header(c),
      tabs,
      body,
      h(
        "footer",
        { class: "cs-foot" },
        "Research profile from the Mapachusetts candidate database. News summaries are AI-generated from linked reporting. Always verify claims with the sources."
      )
    );
  }

  _header(c) {
    const party = String(c.party || "").trim().toLowerCase();
    const photo = safeUrl(c.photo);
    const avatar = h("div", { class: "cs-avatar", "data-party": party, "aria-hidden": photo ? null : "true" });
    if (photo) {
      const img = h("img", { src: photo, alt: `Official photo of ${c.name}`, referrerpolicy: "no-referrer" });
      // Fall back to party-colored initials if the portrait fails to load.
      img.addEventListener("error", () => {
        avatar.replaceChildren(document.createTextNode(initials(c.name)));
        avatar.setAttribute("aria-hidden", "true");
      });
      avatar.append(img);
    } else {
      avatar.textContent = initials(c.name);
    }

    return h(
      "header",
      { class: "cs-head" },
      avatar,
      h(
        "div",
        { class: "cs-meta" },
        h("h2", { class: "cs-name", text: c.name }),
        c.role && h("p", { class: "cs-role", text: c.role }),
        h(
          "div",
          { class: "cs-badges" },
          c.party && h("span", { class: "cs-party", "data-party": party, text: c.party }),
          c.status &&
            h("span", {
              class: "cs-status",
              "data-status-type": c.status.statusType,
              text: c.status.statusLabel,
            })
        ),
        c.status?.termInfo && h("p", { class: "cs-term", text: c.status.termInfo }),
        link(c.openSecretsUrl, "View on OpenSecrets ↗", "cs-extlink")
      )
    );
  }

  _empty(...content) {
    return h("p", { class: "cs-empty" }, ...content);
  }

  _plain(text) {
    return h("div", { class: "cs-box cs-plain" }, h("span", { class: "cs-box-label", text: "In plain English" }), h("p", { text }));
  }

  _why(text) {
    return h("div", { class: "cs-box cs-why" }, h("span", { class: "cs-box-label", text: "🔍 Why people are searching this" }), h("p", { text }));
  }

  // -- Tab: In the News ------------------------------------------------------------

  _news(news) {
    if (!news) return this._empty("No recent news coverage has been summarized for this candidate yet.");

    const numbers = new Set(news.citations.map((c) => c.n));
    const dated = news.citations
      .filter((c) => !Number.isNaN(timeOf(c.published_at)))
      .sort((a, b) => timeOf(a.published_at) - timeOf(b.published_at));
    const from = formatDate(dated[0]?.published_at);
    const to = formatDate(dated[dated.length - 1]?.published_at);
    const range = from && to ? (from === to ? ` from ${from}` : ` from ${from} to ${to}`) : "";
    const updated = formatDate(news.generated_at);

    const paragraphs = String(news.summary)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => h("p", {}, citedText(p, numbers)));

    return [
      h("p", { class: "cs-disclaimer", text: `AI-generated summary of news coverage${range}. Verify claims using the linked sources.${updated ? ` Updated ${updated}.` : ""}` }),
      h("div", { class: "cs-summary" }, paragraphs),
      news.citations.length > 0 && h("h3", { class: "cs-sub", text: "Sources" }),
      news.citations.length > 0 &&
        h(
          "ol",
          { class: "cs-cites" },
          news.citations.map((c) => {
            const meta = [c.source, formatDate(c.published_at)].filter(Boolean).join(" · ");
            return h(
              "li",
              { id: `cs-cite-${c.n}`, value: c.n },
              link(c.url, c.title),
              meta && h("span", { class: "cs-meta-inline", text: meta })
            );
          })
        ),
    ];
  }

  // -- Tab: Funding ----------------------------------------------------------------

  _bars(items, label) {
    if (!items.length) return null;
    const maxPct = Math.max(...items.map((s) => s.pct));
    return h(
      "ul",
      { class: "cs-bars", "aria-label": label },
      items.map((s) =>
        h(
          "li",
          {},
          h("div", { class: "cs-bar-label" }, h("span", { text: s.label }), h("span", { class: "cs-bar-amount", text: formatMoney(s.amount) })),
          h(
            "div",
            { class: "cs-bar-track", role: "img", "aria-label": `${s.label}: ${s.pct}% of top contributions` },
            h("div", { class: "cs-bar-fill", style: `width:${maxPct > 0 ? (s.pct / maxPct) * 100 : 0}%` })
          )
        )
      )
    );
  }

  _funding(f) {
    if (!f) {
      return this._empty(
        "Campaign finance data hasn't been added for this candidate yet. Federal filings are on ",
        link("https://www.fec.gov/data/", "FEC.gov"),
        " and ",
        link("https://www.opensecrets.org", "OpenSecrets"),
        "; Massachusetts state races are on ",
        link("https://www.ocpf.us", "OCPF"),
        "."
      );
    }
    const stat = (label, value) =>
      h("div", { class: "cs-stat" }, h("span", { class: "cs-stat-label", text: label }), h("span", { class: "cs-stat-value", text: value }));
    return [
      h("div", { class: "cs-stats" }, stat("Total raised", f.total), stat("Top industry", f.topIndustry), stat("Small donors (<$200)", f.smallDonorPct)),
      f.plainEnglish && this._plain(f.plainEnglish),
      f.whyItMatters && this._why(f.whyItMatters),
      h("h3", { class: "cs-sub", text: "Top funding sources by industry" }),
      this._bars(f.sources, "Top funding sources breakdown"),
      f.foreignSources.length > 0 && h("h3", { class: "cs-sub", text: "Foreign policy & tariff-related PAC contributions" }),
      f.foreignSources.length > 0 && this._bars(f.foreignSources, "Foreign policy funding breakdown"),
      h("p", { class: "cs-note" }, "Data sourced from ", link("https://www.opensecrets.org", "OpenSecrets.org"), ". Verify figures directly on their platform."),
    ];
  }

  // -- Tab: Career -----------------------------------------------------------------

  _statusCard(s) {
    return h(
      "div",
      { class: "cs-statuscard" },
      h(
        "div",
        { class: "cs-statuscard-top" },
        h("span", { class: "cs-status-icon", "aria-hidden": "true", text: STATUS_ICONS[s.statusType] || "📋" }),
        h("div", {}, h("div", { class: "cs-status-title", text: `${s.currentTitle} — ${s.state}` }), h("div", { class: "cs-status-term", text: s.termInfo })),
        h("span", { class: "cs-status", "data-status-type": s.statusType, text: s.statusLabel })
      ),
      h("div", { class: "cs-box cs-plain" }, h("span", { class: "cs-box-label", text: "What this means" }), h("p", { text: s.plainEnglish })),
      s.runningFor && h("p", { class: "cs-running" }, h("span", { class: "cs-box-label", text: "Running for" }), " ", h("strong", { text: s.runningFor })),
      (s.committees || []).length > 0 &&
        h("div", { class: "cs-committees" }, h("span", { class: "cs-box-label", text: "Committee assignments" }), h("ul", {}, s.committees.map((n) => h("li", { text: n }))))
    );
  }

  _career(c) {
    if (!c.bio && !c.status && c.career.length === 0) {
      return this._empty("Career history hasn't been added for this candidate yet.");
    }
    return [
      c.status && this._statusCard(c.status),
      c.bio && h("p", { class: "cs-bio", text: c.bio }),
      c.career.length > 0 && h("p", { class: "cs-intro", text: "Roles held in chronological order, most recent first." }),
      c.career.length > 0 &&
        h(
          "ol",
          { class: "cs-timeline", "aria-label": "Career timeline" },
          c.career.map((e) =>
            h(
              "li",
              {},
              h("div", { class: "cs-years", text: e.years }),
              h("div", { class: "cs-role-block" }, h("strong", { text: e.title }), e.org && h("em", { text: e.org }), e.description && h("p", { text: e.description }))
            )
          )
        ),
    ];
  }

  // -- Tab: Issues -----------------------------------------------------------------

  _subIssue(topicId, sub) {
    const score = typeof sub.alignment === "number" ? sub.alignment : null;
    const align = score === null ? null : alignmentLabel(score);
    const detailId = `cs-sub-${topicId}-${sub.id}`;

    const detail = h(
      "div",
      { class: "cs-sub-detail", id: detailId, hidden: true },
      sub.plainEnglish && this._plain(sub.plainEnglish),
      sub.whyItMatters && this._why(sub.whyItMatters),
      h("details", { class: "cs-deep" }, h("summary", { text: "Dig deeper" }), h("p", { text: sub.detail })),
      sub.voteRecord && sub.voteRecord.length > 0 && h("h4", { text: "Vote record" }),
      sub.voteRecord &&
        sub.voteRecord.length > 0 &&
        h(
          "ul",
          { class: "cs-votes" },
          sub.voteRecord.map((v) =>
            h("li", {}, h("span", { class: "cs-vote-year", text: v.year }), h("span", { class: "cs-vote-bill", text: v.bill }), h("span", { class: `cs-vote ${voteClass(v.vote)}`, text: v.vote }))
          )
        )
    );

    const chevron = h("span", { class: "cs-chevron", "aria-hidden": "true", text: "▾" });
    const toggle = h(
      "button",
      { class: "cs-sub-toggle", type: "button", "aria-expanded": "false", "aria-controls": detailId },
      h("span", { class: "cs-sub-top" }, h("span", { class: "cs-sub-label", text: sub.label }), chevron),
      align &&
        h(
          "span",
          { class: "cs-align" },
          h("span", { class: "cs-align-track", "aria-hidden": "true" }, h("span", { class: `cs-align-fill ${align.cls}`, style: `width:${score}%` })),
          h("span", { class: `cs-align-label ${align.cls}`, text: `${align.text} · ${score}%` })
        )
    );
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
      chevron.textContent = open ? "▴" : "▾";
    });
    return h("div", { class: "cs-subissue" }, toggle, detail);
  }

  _issues(opinions) {
    if (!opinions.length) {
      return this._empty("Issue positions and voting records haven't been compiled for this candidate yet. The In the News tab covers positions reported in recent coverage.");
    }
    return [
      h("p", { class: "cs-intro", text: "Expand any issue to read the candidate's position and voting record." }),
      opinions.map((topic) =>
        h(
          "section",
          { class: "cs-topic" },
          h(
            "div",
            { class: "cs-topic-head" },
            h("span", { "aria-hidden": "true", text: topic.icon }),
            h("h3", { text: topic.topic }),
            h("span", { class: "cs-topic-count", text: `${topic.subIssues.length} issue${topic.subIssues.length === 1 ? "" : "s"}` })
          ),
          topic.subIssues.map((s) => this._subIssue(topic.id, s))
        )
      ),
    ];
  }

  // -- Tab: Sources ----------------------------------------------------------------

  _sources(sources, news) {
    const cited = news ? news.citations : [];
    if (!sources.length && !cited.length) return this._empty("No research sources have been added for this candidate yet.");
    return [
      sources.length > 0
        ? [
            h(
              "p",
              { class: "cs-intro" },
              "Every claim in this profile draws from the sources below, from outlets across the political spectrum so you can cross-reference. Bias ratings come from ",
              link("https://adfontesmedia.com", "Ad Fontes Media"),
              " and ",
              link("https://www.allsides.com", "AllSides"),
              "."
            ),
            h(
              "ul",
              { class: "cs-sources", "aria-label": "Research sources" },
              sources.map((s) =>
                h(
                  "li",
                  {},
                  h(
                    "div",
                    { class: "cs-source-head" },
                    link(s.url, `${s.name} ↗`, "cs-source-name"),
                    h("div", { class: "cs-source-tags" }, h("span", { class: `cs-tag bias-${s.bias}`, text: BIAS_LABELS[s.bias] || s.bias }), h("span", { class: "cs-tag cs-tag-type", text: TYPE_LABELS[s.type] || s.type }))
                  ),
                  h("p", { text: s.description })
                )
              )
            ),
          ]
        : h("p", { class: "cs-intro", text: "These are the news articles behind the In the News summary. Curated research sources haven't been added for this candidate yet." }),
      cited.length > 0 && h("h3", { class: "cs-sub", text: "News articles cited in “In the News”" }),
      cited.length > 0 &&
        h(
          "ul",
          { class: "cs-sources", "aria-label": "News articles cited in the summary" },
          cited.map((c) =>
            h("li", {}, h("div", { class: "cs-source-head" }, link(c.url, `${c.title} ↗`, "cs-source-name")), h("p", { text: [c.source, formatDate(c.published_at)].filter(Boolean).join(" · ") }))
          )
        ),
    ];
  }

  // -- Tab: Myths & Facts ----------------------------------------------------------

  _myths(items) {
    if (!items.length) return this._empty("No common misconceptions have been documented for this candidate yet.");
    return [
      h("p", { class: "cs-intro", text: "The most widely shared misconceptions about this candidate, each addressed with verifiable facts and a primary source you can check yourself." }),
      items.map((m) =>
        h(
          "article",
          { class: "cs-myth" },
          h("div", { class: "cs-myth-cat", text: m.category }),
          h(
            "div",
            { class: "cs-myth-claim" },
            h("div", { class: "cs-myth-head" }, h("span", { "aria-hidden": "true", text: "✕" }), " Common claim"),
            h("p", { text: `“${m.myth}”` }),
            safeUrl(m.mythSourceUrl) && link(m.mythSourceUrl, `Where this claim comes from: ${m.mythSourceLabel || "source"} ↗`, "cs-myth-link")
          ),
          h(
            "div",
            { class: "cs-myth-reality" },
            h("div", { class: "cs-myth-head" }, h("span", { "aria-hidden": "true", text: "✓" }), " What the record shows"),
            h("p", { text: m.reality }),
            link(m.sourceUrl, `Verify this: ${m.sourceLabel} ↗`, "cs-myth-link")
          )
        )
      ),
    ];
  }
}

// Turn "[1]" markers whose number has a matching citation into links to it.
// Unknown markers stay plain text (ported from components/CitedText.tsx).
function citedText(text, validNumbers) {
  const nodes = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (!validNumbers.has(n)) continue;
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const a = h("a", { href: `#cs-cite-${n}`, class: "cs-cite-ref", "aria-label": `Source ${n}`, text: `[${n}]` });
    a.addEventListener("click", (e) => {
      e.preventDefault(); // don't change the page URL hash; just scroll to the source
      document.getElementById(`cs-cite-${n}`)?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
    nodes.push(h("sup", {}, a));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

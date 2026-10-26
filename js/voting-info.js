// js/voting-info.js
// "Voting info" tab (Massachusetts pilot): key dates and warnings about what is
// different from earlier elections, so nobody is caught out by an old habit.
// Example: someone who got a mail ballot last time and assumes they will again.
//
// Content is curated in data/ma-voting-notices.js (sources and the date it was
// checked are in that file and shown here). The person can say how they voted
// last time; that choice stays in this browser only (localStorage) and is used
// to highlight the notices that matter to them.

import { icon } from "./icons.js";
import {
  MA_VOTING_NOTICES,
  MA_VOTING_NOTICES_META,
  MA_VOTING_KEY_DATES,
} from "../data/ma-voting-notices.js";

const STORE_KEY = "mapachusetts-voted-before";

/** How the person voted in 2024: value -> label. */
const HISTORY = [
  ["voted-by-mail-before", "By mail"],
  ["voted-early-before", "Early, in person"],
  ["voted-in-person-before", "On Election Day"],
  ["first-time", "First time or not sure"],
];

// How each level of notice is labeled. The label is text, never color alone.
const LEVELS = {
  changed: { label: "Changed", icon: "alert", blurb: "Different from the last election" },
  watch: { label: "Could still change", icon: "alert", blurb: "Not settled yet" },
  same: { label: "Same as before", icon: "check", blurb: "Nothing new here" },
  info: { label: "Good to know", icon: "info", blurb: "Helpful details" },
};
const LEVEL_ORDER = ["changed", "watch", "same", "info"];

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v; // only trusted icon markup from js/icons.js
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
const safe = (url) => (url && /^https?:\/\//i.test(url) ? url : null);

/** What the person told us about how they voted last time ("" if nothing). */
export function savedHistory() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return HISTORY.some(([k]) => k === v) ? v : "";
  } catch {
    return "";
  }
}
function saveHistory(value) {
  try {
    if (value) localStorage.setItem(STORE_KEY, value);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the choice just lasts until the page closes */
  }
}

/** Does a notice speak to someone with this history? ("everyone" notices are always shown, never "for you"). */
const speaksTo = (n, history) => !!history && n.appliesTo.includes(history);

/**
 * Numbers for the badge on the tab and the banner on the ballot.
 * @returns {{attention: number, forYou: number, next: object|null}}
 *   attention: notices that changed or could still change
 *   forYou:    of those, the ones that match how this person voted last time
 *   next:      the next upcoming deadline (or null once they have all passed)
 */
export function votingSummary(history = savedHistory()) {
  const attention = MA_VOTING_NOTICES.filter((n) => n.level === "changed" || n.level === "watch");
  const today = startOfToday();
  const upcoming = MA_VOTING_KEY_DATES.filter((d) => d.date && parseLocalDate(d.rangeEnd || d.date) >= today).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
  // The nearest date that is a deadline, not a start-of-polls marker.
  const next = upcoming.find((d) => /deadline|must be|last day|closes/i.test(d.label)) || upcoming[0] || null;
  return {
    attention: attention.length,
    forYou: attention.filter((n) => speaksTo(n, history)).length,
    next,
  };
}

/** Short wording for the banner; falls back to the full label. */
const SHORT = {
  "ma-2026:date-reg-deadline": "Voter registration closes",
  "ma-2026:date-mail-request-deadline": "Mail-ballot requests due",
  "ma-2026:date-mail-advice-oct27": "Last day to mail a ballot (advised)",
  "ma-2026:date-mail-postmark": "Mail ballots must be postmarked",
  "ma-2026:date-mail-received": "Mailed ballots must arrive",
  "ma-2026:date-dropbox-deadline": "Drop boxes close",
  "ma-2026:date-early-voting": "Early voting",
  "ma-2026:date-election-day": "Election Day",
};
export const shortLabel = (d) => SHORT[d.id] || d.label;

export function formatDeadline(d) {
  if (!d) return "";
  const date = parseLocalDate(d.date);
  return `${dayFmt.format(date)}${d.time ? `, ${d.time}` : ""}`;
}

export class VotingInfo {
  /**
   * @param {HTMLElement} root  the tab panel to render into
   * @param {{onChange?: () => void}} [handlers]  called when the history choice changes
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.history = savedHistory();
    this.render();
  }

  setHistory(value) {
    this.history = value;
    saveHistory(value);
    this.render();
    this.handlers.onChange?.();
  }

  render() {
    const meta = MA_VOTING_NOTICES_META;
    const sum = votingSummary(this.history);
    const checked = parseLocalDate(meta.asOf);
    this.root.replaceChildren(
      h(
        "section",
        { class: "vi-head" },
        h("h3", { class: "vi-title", text: "Voting in Massachusetts" }),
        h("p", {
          class: "vi-lead",
          text: "Election Day is Tue, Nov. 3, 2026. Here is what is different from past elections, and what could still change.",
        })
      ),
      this._history(),
      this._status(sum),
      this._dates(),
      this._notices(),
      h(
        "p",
        { class: "vi-foot" },
        `Checked ${new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(checked)} from city and state pages, court records and news reports. Rules and court cases can change, and no election official has reviewed this page. `,
        h("a", { href: "https://www.sec.state.ma.us/wheredoivotema/bal/myelectioninfo.aspx", target: "_blank", rel: "noopener noreferrer", text: "Check your own registration and polling place ↗" }),
        " or ask your city or town clerk."
      )
    );
  }

  _history() {
    const name = "vi-history";
    return h(
      "fieldset",
      { class: "vi-history" },
      h("legend", { text: "How did you vote in 2024?" }),
      h("p", { class: "vi-hint", text: "Optional. We use this to point out what matters to you. It stays on this device." }),
      h(
        "div",
        { class: "vi-choices" },
        HISTORY.map(([value, label]) => {
          const id = `${name}-${value}`;
          return h(
            "label",
            { class: "vi-choice", for: id },
            h("input", {
              type: "radio",
              id,
              name,
              value,
              checked: this.history === value,
              onchange: () => this.setHistory(value),
            }),
            h("span", { text: label })
          );
        })
      ),
      this.history &&
        h("button", { class: "vi-clear", type: "button", onclick: () => this.setHistory(""), text: "Clear my answer" })
    );
  }

  _status(sum) {
    const parts = [];
    if (this.history) {
      parts.push(
        sum.forYou
          ? `${sum.forYou} of the notices below may affect you.`
          : "None of the changes below target how you voted last time, but read the dates."
      );
    } else {
      parts.push(`${sum.attention} notices below are about changes, or things that could still change.`);
    }
    return h(
      "div",
      { class: "vi-status", role: "status" },
      h("span", { class: "vi-status-ico", "aria-hidden": "true", html: icon("alert", { size: 20 }) }),
      h("div", {}, h("strong", { text: parts[0] }), sum.next && h("div", { text: `Next date: ${shortLabel(sum.next)}, ${formatDeadline(sum.next)}.` }))
    );
  }

  _dates() {
    const today = startOfToday();
    return h(
      "section",
      { class: "vi-dates" },
      h("h4", { class: "layer-sub", text: "Key dates" }),
      h(
        "ul",
        { class: "vi-datelist" },
        MA_VOTING_KEY_DATES.slice()
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
          .map((d) => {
            const last = parseLocalDate(d.rangeEnd || d.date);
            const past = last < today;
            const range = d.rangeEnd ? `${dayFmt.format(parseLocalDate(d.date))} to ${dayFmt.format(parseLocalDate(d.rangeEnd))}` : formatDeadline(d);
            return h(
              "li",
              { class: `vi-date${past ? " is-past" : ""}` },
              h("div", { class: "vi-date-when" }, h("strong", { text: range }), past && h("span", { class: "vi-past", text: "Passed" })),
              h("div", { class: "vi-date-label", text: d.label }),
              h("details", { class: "vi-more" }, h("summary", { text: "Details" }), h("p", { text: d.detail }), this._sources(d.sources.map((u) => ({ label: hostOf(u), url: u }))))
            );
          })
      )
    );
  }

  _notices() {
    const wrap = h("section", { class: "vi-notices" });
    for (const level of LEVEL_ORDER) {
      const items = MA_VOTING_NOTICES.filter((n) => n.level === level)
        // Notices for the person's own history first.
        .sort((a, b) => Number(speaksTo(b, this.history)) - Number(speaksTo(a, this.history)));
      if (!items.length) continue;
      const meta = LEVELS[level];
      wrap.append(
        h(
          "h4",
          { class: `layer-sub vi-level vi-level-${level}` },
          h("span", { "aria-hidden": "true", html: icon(meta.icon, { size: 15 }) }),
          ` ${meta.label} (${items.length})`
        ),
        h("p", { class: "vi-level-blurb", text: meta.blurb }),
        // "Changed" and "could still change" start open; the rest are one tap away.
        ...items.map((n) => this._notice(n))
      );
    }
    return wrap;
  }

  _notice(n) {
    const mine = speaksTo(n, this.history);
    const lv = LEVELS[n.level];
    return h(
      "article",
      { class: `card vi-notice vi-${n.level}${mine ? " is-mine" : ""}` },
      h(
        "div",
        { class: "tag-row" },
        h("span", { class: `tag vi-tag vi-tag-${n.level}`, html: icon(lv.icon, { size: 13 }) + `<span>${lv.label}</span>` }),
        mine && h("span", { class: "tag vi-tag-mine", text: "May affect you" })
      ),
      h("h4", { class: "card-title", text: n.title }),
      h("p", { class: "card-desc", text: n.summary }),
      n.whatToDo && h("p", { class: "vi-todo" }, h("strong", { text: "What to do: " }), n.whatToDo),
      n.comparedTo && h("p", { class: "vi-compare", text: `Compared with: ${n.comparedTo}` }),
      this._sources(n.sources)
    );
  }

  _sources(list) {
    const items = list.filter((s) => safe(s.url));
    if (!items.length) return null;
    return h(
      "details",
      { class: "card-sources" },
      h("summary", { text: `Sources (${items.length})` }),
      h(
        "ul",
        {},
        items.map((s) => h("li", {}, h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.label })))
      )
    );
  }
}

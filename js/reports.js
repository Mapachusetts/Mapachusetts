// js/reports.js
// "Reports" tab (account holders, Massachusetts pilot): report a protest where
// you are standing, rate how intense it is, and see reports from the last few
// hours as dots on the map.
//
// How a report works
//   1. You tap "Use my location". The browser gives a position and how precise
//      it is. The report must be filed from where you are, not from a map click.
//   2. You pick an intensity and describe what is happening.
//   3. The assistant server (server/assistant.py) checks it, has Kiro write a
//      short NEUTRAL SUMMARY of the protest only (not your opinions, not names
//      of private people), and stores the report with its location rounded to
//      about 100 meters. The text you wrote stays private; only the summary is
//      shown to other account holders.
//   4. Reports leave the map after 6 hours. Anyone signed in can flag a report
//      that looks wrong; three flags hide it.

import { assistant, rest, ApiError } from "./api.js";
import { auth } from "./auth.js";
import { getCurrentPosition } from "./geolocation.js";
import { h, ico, timeAgo, timeLeft } from "./dom.js";

const MY_KEY = "mapachusetts-my-reports";
const POLL_MS = 60_000;
const MAX_TEXT = 600;
const MAX_FIX_AGE_MS = 5 * 60_000;
const MAX_ACCURACY_M = 200;
// Same box the server uses. Massachusetts, with a little margin.
const PILOT_BOX = { minLat: 41.18, maxLat: 42.89, minLng: -73.55, maxLng: -69.85 };

/** The four levels. The word is always shown; color only backs it up. */
export const INTENSITY = {
  1: { label: "Peaceful", color: "#22c55e", blurb: "People are gathering calmly: signs, chanting, speeches." },
  2: { label: "Tense", color: "#facc15", blurb: "Raised voices or standoffs, but no violence." },
  3: { label: "Disruptive", color: "#f97316", blurb: "Roads or entrances are blocked, or there is a large police response." },
  4: { label: "Unsafe", color: "#ef4444", blurb: "Violence, weapons or a dangerous crowd. Stay away." },
};

const FLAG_REASONS = [
  ["inaccurate", "It looks inaccurate"],
  ["not_a_protest", "It's not a protest"],
  ["identifies_people", "It identifies or targets people"],
  ["unsafe_or_harassing", "It's unsafe or harassing"],
  ["other", "Something else"],
];

const inPilotBox = (lat, lng) =>
  lat >= PILOT_BOX.minLat && lat <= PILOT_BOX.maxLat && lng >= PILOT_BOX.minLng && lng <= PILOT_BOX.maxLng;

function myIds() {
  try {
    const v = JSON.parse(localStorage.getItem(MY_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function rememberMine(id) {
  try {
    localStorage.setItem(MY_KEY, JSON.stringify([...new Set([...myIds(), id])].slice(-50)));
  } catch {
    /* ignore */
  }
}

function friendly(err, context = {}) {
  switch (err.code) {
    case "outside_pilot_area":
      return "Protest reports are only open in Massachusetts for now.";
    case "low_accuracy":
      return `Your location isn't precise enough${context.accuracy ? ` (about ${Math.round(context.accuracy)} m)` : ""}. Step outside or turn on precise location, then try again.`;
    case "duplicate_report":
      return "You already filed a report near here in the last 30 minutes.";
    case "contains_personal_info":
      return err.message || "Please remove emails, phone numbers, license plates and street addresses from your description.";
    case "not_publishable":
      return "We couldn't turn that into a factual summary. Describe what is happening (who is gathering, roughly how many, where) without opinions or personal details.";
    case "rate_limited":
      return "You've reached the limit for reports for now. Please try again later.";
    case "ai_unavailable":
    case "busy":
    case "capacity_reached":
    case "service_unavailable":
      return "The report service is busy right now. Please try again in a few minutes.";
    case "unauthorized":
      return "Please sign in again.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

export class ReportsPanel {
  /**
   * @param {HTMLElement} root
   * @param {{globe: object, onChange?: (count: number) => void}} deps
   */
  constructor(root, deps) {
    this.root = root;
    this.globe = deps.globe;
    this.onChange = deps.onChange;
    this.reports = [];
    this.fix = null; // { lat, lng, accuracy, at }
    this.message = null; // { kind, text }
    this.busy = false;
    this.flagging = null; // report id with the flag form open
    this.selected = null;
    this._timer = null;
    this.render();
  }

  // ----- Loading and the map ---------------------------------------------------------

  /** Start showing reports (signed in, on a pilot page). */
  async activate() {
    if (this._timer) return;
    await this.refresh();
    this._timer = setInterval(() => {
      if (document.visibilityState === "visible") this.refresh();
    }, POLL_MS);
  }

  /** Stop polling and take the dots off the map. */
  deactivate() {
    if (!this._timer && !this.reports.length) return; // nothing is showing
    clearInterval(this._timer);
    this._timer = null;
    this.reports = [];
    this.globe.setReports([]);
    this.render();
    this.onChange?.(0);
  }

  async refresh() {
    try {
      const rows = await rest(
        "protest_reports?select=id,lat,lng,intensity,summary,created_at,expires_at&order=created_at.desc&limit=200"
      );
      this.reports = Array.isArray(rows) ? rows : [];
      this.message = this.message && this.message.kind === "error" && this.message.sticky ? null : this.message;
    } catch (err) {
      if (err.code === "unauthorized") return;
      this.message = { kind: "error", text: "Couldn't load reports right now.", sticky: true };
    }
    this.globe.setReports(
      this.reports.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: { id: r.id, intensity: r.intensity },
      }))
    );
    this.onChange?.(this.reports.length);
    this.renderList();
  }

  /** A dot on the map was clicked. */
  openOnMap(id) {
    const r = this.reports.find((x) => x.id === id);
    if (!r) return;
    this.selected = id;
    this.globe.showReportPopup([r.lng, r.lat], this._popup(r), () => {
      this.selected = null;
      this.renderList();
    });
    this.renderList();
  }

  _popup(r) {
    const level = INTENSITY[r.intensity] || INTENSITY[1];
    return h(
      "div",
      { class: "rp" },
      h("p", { class: "rp-level" }, h("span", { class: "rp-dot", style: `background:${level.color}` }), h("strong", { text: level.label })),
      h("p", { class: "rp-text", text: r.summary || "No summary available." }),
      h("p", { class: "rp-time", text: `${timeAgo(r.created_at)}. Leaves the map in ${timeLeft(r.expires_at)}.` }),
      h("p", { class: "rp-note", text: "Written by AI from a user's report. Unverified." })
    );
  }

  // ----- Rendering --------------------------------------------------------------------

  render() {
    this.root.replaceChildren(
      h("h3", { class: "vi-title" }, ico("sign", 20), " Protest reports"),
      h("p", { class: "rep-lead", text: "See what other account holders report nearby, or report one yourself from where you are." }),
      h("p", { class: "rep-safety" }, ico("alert", 16), " If anyone is in danger, call 911. Reports are not emergency alerts."),
      this._form(),
      h("h4", { class: "layer-sub", text: "From the last 6 hours" }),
      (this.list = h("div", { class: "rep-list" })),
      h("p", {
        class: "rep-foot",
        text: "Reports are written up by AI from what account holders say. They are unverified and can be wrong. Don't use them to find or follow people.",
      })
    );
    this.renderList();
  }

  _form() {
    const fixOk = this.fix && Date.now() - this.fix.at < MAX_FIX_AGE_MS;
    const locateBtn = h("button", {
      class: "btn btn-glass",
      type: "button",
      onclick: () => this.locate(locateBtn),
    }, ico("locate", 18), fixOk ? " Update my location" : " Use my location");

    const text = h("textarea", {
      id: "repText",
      rows: "4",
      maxlength: String(MAX_TEXT),
      class: "ask-input",
      "aria-describedby": "repTextHelp",
      placeholder: "What is happening? How many people? Where exactly?",
    });
    const count = h("span", { class: "ask-count", text: `0/${MAX_TEXT}` });
    text.addEventListener("input", () => (count.textContent = `${text.value.length}/${MAX_TEXT}`));

    const levels = h(
      "fieldset",
      { class: "rep-levels" },
      h("legend", { text: "How intense is it?" }),
      Object.entries(INTENSITY).map(([value, lv]) =>
        h(
          "label",
          { class: "rep-level", for: `rep-int-${value}` },
          h("input", { type: "radio", name: "intensity", id: `rep-int-${value}`, value, required: true }),
          h("span", { class: "rep-level-dot", style: `background:${lv.color}`, "aria-hidden": "true" }),
          h("span", { class: "rep-level-text" }, h("strong", { text: lv.label }), h("small", { text: lv.blurb }))
        )
      )
    );

    const here = h("input", { type: "checkbox", id: "repHere" });
    const submit = h("button", { class: "btn btn-accent", type: "submit", text: "Send report" });

    const form = h(
      "form",
      {
        class: "rep-form",
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const picked = form.querySelector('input[name="intensity"]:checked');
          this.submit({ intensity: picked ? Number(picked.value) : 0, description: text.value.trim(), here: here.checked }, submit, form);
        },
      },
      h("h4", { class: "layer-sub", text: "Report a protest" }),
      h("div", { class: "rep-loc" }, locateBtn, h("span", { class: "rep-fix", role: "status", text: fixOk ? `Location found (within about ${Math.round(this.fix.accuracy)} m). We keep about 100 m.` : "Needs your current location." })),
      levels,
      h("label", { for: "repText", class: "ask-label", text: "What is happening?" }),
      text,
      h("p", {
        id: "repTextHelp",
        class: "ask-help",
        text: "Describe the protest, not what you think of it. AI writes a short neutral summary; your own words are never shown to others. Leave out names, license plates and addresses.",
      }),
      h("div", { class: "ask-row" }, count),
      h("label", { class: "rep-check", for: "repHere" }, here, h("span", { text: "I can see this protest right now." })),
      this.message && h("p", { class: `acct-msg acct-${this.message.kind}`, role: this.message.kind === "error" ? "alert" : "status", text: this.message.text }),
      submit
    );
    return form;
  }

  renderList() {
    if (!this.list) return;
    const mine = new Set(myIds());
    if (!this.reports.length) {
      this.list.replaceChildren(h("p", { class: "layer-empty", text: "No reports in the last 6 hours." }));
      return;
    }
    this.list.replaceChildren(
      ...this.reports.map((r) => {
        const level = INTENSITY[r.intensity] || INTENSITY[1];
        return h(
          "article",
          { class: `card rep-card${this.selected === r.id ? " is-selected" : ""}` },
          h("p", { class: "rp-level" }, h("span", { class: "rp-dot", style: `background:${level.color}` }), h("strong", { text: level.label }), h("span", { class: "rp-time", text: ` · ${timeAgo(r.created_at)}` })),
          h("p", { class: "card-desc", text: r.summary || "No summary available." }),
          h(
            "div",
            { class: "rep-actions" },
            h("button", {
              class: "btn btn-ghost",
              type: "button",
              onclick: () => {
                this.globe.map.flyTo({ center: [r.lng, r.lat], zoom: Math.max(this.globe.map.getZoom(), 14), duration: 1200 });
                this.openOnMap(r.id);
              },
            }, ico("pin", 16), " Show on map"),
            mine.has(r.id)
              ? h("button", { class: "btn btn-ghost", type: "button", onclick: () => this.remove(r.id), text: "Delete mine" })
              : h("button", { class: "btn btn-ghost", type: "button", onclick: () => { this.flagging = this.flagging === r.id ? null : r.id; this.renderList(); } }, ico("flag", 16), " Flag")
          ),
          this.flagging === r.id && this._flagForm(r.id)
        );
      })
    );
  }

  _flagForm(id) {
    const select = h(
      "select",
      { "aria-label": "Why are you flagging this report?" },
      FLAG_REASONS.map(([v, label]) => h("option", { value: v, text: label }))
    );
    return h(
      "form",
      {
        class: "rep-flag",
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            await rest("protest_flags", {
              method: "POST",
              headers: { Prefer: "return=minimal" },
              body: { report_id: id, user_id: auth.user.id, reason: select.value },
            });
            this.flagging = null;
            this.message = { kind: "info", text: "Thanks. Three flags hide a report." };
            await this.refresh();
          } catch (err) {
            this.flagging = null;
            this.message = { kind: err.status === 409 ? "info" : "error", text: err.status === 409 ? "You already flagged that report." : friendly(err) };
            this.render();
          }
        },
      },
      select,
      h("button", { class: "btn btn-accent", type: "submit", text: "Send flag" })
    );
  }

  // ----- Actions -----------------------------------------------------------------------

  async locate(button) {
    button.disabled = true;
    try {
      const pos = await getCurrentPosition({ timeout: 15000 });
      this.fix = { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, at: Date.now() };
      this.message = !inPilotBox(pos.lat, pos.lng)
        ? { kind: "error", text: "Protest reports are only open in Massachusetts for now." }
        : pos.accuracy > MAX_ACCURACY_M
        ? { kind: "error", text: friendly({ code: "low_accuracy" }, { accuracy: pos.accuracy }) }
        : null;
    } catch (err) {
      this.message = {
        kind: "error",
        text: err && err.code === 1 ? "Location permission was denied. Reports need your current location." : "We couldn't get your location. Try again outdoors.",
      };
    }
    this.render();
  }

  async submit({ intensity, description, here }, button, form) {
    if (this.busy) return;
    const fail = (text) => {
      this.message = { kind: "error", text };
      this.render();
      // Keep what they typed: re-render wiped the form, so put it back.
      const t = this.root.querySelector("#repText");
      if (t) t.value = description;
      const r = intensity && this.root.querySelector(`#rep-int-${intensity}`);
      if (r) r.checked = true;
    };
    if (!this.fix || Date.now() - this.fix.at > MAX_FIX_AGE_MS) return fail("Tap “Use my location” first so we know where you are.");
    if (!inPilotBox(this.fix.lat, this.fix.lng)) return fail(friendly({ code: "outside_pilot_area" }));
    if (this.fix.accuracy > MAX_ACCURACY_M) return fail(friendly({ code: "low_accuracy" }, { accuracy: this.fix.accuracy }));
    if (!intensity) return fail("Choose how intense it is.");
    if (description.length < 10) return fail("Tell us a little about what is happening (at least a sentence).");
    if (!here) return fail("Check the box to confirm you can see the protest right now.");

    this.busy = true;
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const res = await assistant("/v1/reports", {
        method: "POST",
        body: { lat: this.fix.lat, lng: this.fix.lng, accuracyM: this.fix.accuracy, intensity, description },
      });
      rememberMine(res.report.id);
      this.message = {
        kind: "info",
        text: res.report.summary ? "Thanks. Your report is on the map." : "Thanks. Your report is on the map without a written summary.",
      };
      this.fix = null;
      await this.refresh();
      this.render();
      this.globe.map.flyTo({ center: [res.report.lng, res.report.lat], zoom: Math.max(this.globe.map.getZoom(), 14), duration: 1200 });
      this.openOnMap(res.report.id);
    } catch (err) {
      fail(err instanceof ApiError ? friendly(err, { accuracy: this.fix && this.fix.accuracy }) : "Something went wrong. Please try again.");
    } finally {
      this.busy = false;
    }
  }

  async remove(id) {
    try {
      await assistant(`/v1/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
      this.globe.closeReportPopup();
      await this.refresh();
    } catch (err) {
      this.message = { kind: "error", text: friendly(err) };
      this.render();
    }
  }
}

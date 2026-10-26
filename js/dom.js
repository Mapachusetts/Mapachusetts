// js/dom.js
// Tiny DOM helpers for the account features. Text always goes in with
// textContent, never innerHTML, so nothing a user types can run as markup.
// The one exception is `html`, which is only for trusted icon markup from
// js/icons.js.

import { icon } from "./icons.js";

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** An icon element from the custom set. */
export function ico(name, size = 18) {
  return h("span", { class: "ico-slot", "aria-hidden": "true", html: icon(name, { size }) });
}

/** "5 min ago", "2 h ago". */
export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** "in 4 h", for things that expire. */
export function timeLeft(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((Date.parse(iso) - now) / 1000));
  if (s < 90) return "less than a minute";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

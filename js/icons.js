/*
 * Mapachusetts icon set
 * ---------------------
 * Design language: cartographic line icons with a map-node accent.
 *  - 24x24 grid, 2px safe padding, strokes only: currentColor, width 1.75,
 *    round caps and joins. Icons inherit the CSS `color` of their parent.
 *  - Duotone depth: each icon has ONE soft shape filled with currentColor at
 *    0.16 opacity (no stroke on that shape), readable on light and dark UI.
 *  - Signature accent: each icon has ONE small solid "node" dot (r 1.4 to 2),
 *    echoing a map pin or network node, placed with meaning (a clock, a seal,
 *    a speaker's desk, a satellite).
 *
 * Usage:
 *   import { icon, iconEl, ICON_NAMES } from "./icons.js";
 *   el.innerHTML = icon("ward", { size: 20 });             // SVG string
 *   el.append(iconEl("check", { size: 16, label: "Done" })); // DOM element
 *
 * Adding an icon: add an entry to ICONS below, using the helpers:
 *   fp(d)  soft fill + outline for a path     fc / fcirc  soft circle (+ outline)
 *   p(d)   plain stroked path                 c(x, y, r)  stroked circle
 *   f(d)   soft fill only                     n(x, y, r)  solid node dot
 * Keep one soft shape and one node per icon. The key becomes the CSS class
 * "ico-KEY". Unknown names fall back to the "pin" icon.
 */

const SOFT = 'fill="currentColor" fill-opacity="0.16" stroke="none"';

/** Soft filled path (no stroke). */
const f = (d) => `<path d="${d}" ${SOFT}/>`;
/** Stroked path. */
const p = (d) => `<path d="${d}"/>`;
/** Soft fill plus outline for the same path. */
const fp = (d) => f(d) + p(d);
/** Stroked circle. */
const c = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
/** Soft filled circle (no stroke). */
const fc = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" ${SOFT}/>`;
/** Soft filled circle plus outline. */
const fcirc = (x, y, r) => fc(x, y, r) + c(x, y, r);
/** Stroked rect. */
const r = (x, y, w, h, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
/** Soft filled rect (no stroke). */
const fr = (x, y, w, h, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${SOFT}/>`;
/** Soft filled rect plus outline. */
const frr = (x, y, w, h, rx = 0) => fr(x, y, w, h, rx) + r(x, y, w, h, rx);
/** The map-node accent: a small solid dot. */
const n = (x, y, rad = 1.6) =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="currentColor" stroke="none"/>`;

const ICONS = {
  /* ---------- Layers of government ---------- */

  // Ring with a star; node sits on the ring like a pin on a globe.
  country:
    fcirc(12, 12, 9) +
    p("M12 6.8L13.41 10.46L17.33 10.67L14.28 13.14L15.29 16.93L12 14.8L8.71 16.93L9.72 13.14L6.67 10.67L10.59 10.46Z") +
    n(18.4, 5.6, 1.7),

  // Blocky state outline; node is the capital.
  state:
    fp("M5 4.5H19V11L15.5 14.5V19.5H9L5 15.5Z") +
    n(10.5, 10.5, 1.7),

  // Capitol dome; node is the lantern light.
  congress:
    f("M7 15A5 5 0 0 1 17 15Z") +
    p("M7 15A5 5 0 0 1 17 15") +
    p("M12 10V7.2") +
    n(12, 5.6, 1.5) +
    p("M4.5 15H19.5") +
    p("M8 15V20.5M12 15V20.5M16 15V20.5") +
    p("M3.5 20.5H20.5"),

  // Columned chamber with pediment; node in the pediment.
  senate:
    fp("M3.5 9.5L12 3L20.5 9.5Z") +
    n(12, 7, 1.4) +
    p("M4.5 12.5H19.5") +
    p("M6.5 12.5V20.5M10.2 12.5V20.5M13.8 12.5V20.5M17.5 12.5V20.5") +
    p("M3.5 20.5H20.5"),

  // Hemicycle seating; node is the speaker's desk.
  house:
    fp("M2.5 20A9.5 9.5 0 0 1 21.5 20Z") +
    p("M6.5 20A5.5 5.5 0 0 1 17.5 20") +
    p("M12 10.5V14.5") +
    p("M18.72 13.28L15.89 16.11M5.28 13.28L8.11 16.11") +
    n(12, 17.6, 1.4),

  // Courthouse with cupola; node caps the cupola.
  county:
    fp("M3.5 12H20.5V20.5H3.5Z") +
    p("M9.5 12V9.5M14.5 12V9.5") +
    p("M8 9.5L12 5.8L16 9.5Z") +
    n(12, 4.4, 1.5) +
    p("M10.5 20.5V17A1.5 1.5 0 0 1 13.5 17V20.5") +
    p("M6.5 15.5V17.5M17.5 15.5V17.5"),

  // Skyline; node is a lit window in the tallest tower.
  city:
    f("M9 4.5H15V20.5H9Z") +
    p("M3.5 20.5V10H9V4.5H15V13H20.5V20.5") +
    p("M9 10V20.5M15 13V20.5") +
    p("M2.5 20.5H21.5") +
    p("M5.5 14H7M5.5 17H7M11 14H13M11 17.5H13M17 16.5H19") +
    n(12, 8.2, 1.5),

  // Schoolhouse with flag; node is the round window.
  school:
    fp("M4 20.5V12L12 7.5L20 12V20.5Z") +
    p("M12 7.5V3") +
    p("M12 3L16.5 4.5L12 6") +
    p("M9.5 20.5V17.5A2.5 2.5 0 0 1 14.5 17.5V20.5") +
    n(12, 11.8, 1.5),

  // Divided circle, one wedge highlighted; node marks the highlighted wedge.
  ward:
    f("M12 12V3A9 9 0 0 1 19.8 16.5Z") +
    c(12, 12, 9) +
    p("M12 12V3M12 12L19.8 16.5M12 12L4.2 16.5") +
    n(16.8, 9.2, 1.5),

  // Ballot box with a ballot in the slot; node is the seal.
  precinct:
    f("M3.5 9H16.5V20.5H3.5Z") +
    p("M3.5 9H16.5V20.5H3.5Z") +
    p("M3.5 9L7 5.5H20.5L16.5 9M20.5 5.5V17L16.5 20.5") +
    p("M9 7.2H15") +
    n(10, 14.8, 1.6),

  /* ---------- Event types ---------- */

  // Podium with microphone; node is the mic head.
  townhall:
    fp("M7 11.5H17L16 20.5H8Z") +
    p("M5.5 20.5H18.5") +
    p("M12 11.5V8") +
    n(12, 5.7, 1.7) +
    p("M8.2 4.2Q6.8 5.8 8.2 7.4M15.8 4.2Q17.2 5.8 15.8 7.4") +
    p("M10 15.5H14"),

  // Three people at a table; node is the chair of the meeting.
  meeting:
    fr(3, 13, 18, 3.5, 1.75) +
    r(3, 13, 18, 3.5, 1.75) +
    p("M3.5 13A2.5 2.5 0 0 1 8.5 13M15.5 13A2.5 2.5 0 0 1 20.5 13M9.5 13A2.5 2.5 0 0 1 14.5 13") +
    c(6, 7, 1.9) +
    c(18, 7, 1.9) +
    n(12, 7, 1.6) +
    p("M6.5 16.5V20.5M17.5 16.5V20.5"),

  // Two facing speech bubbles; node is a spoken thought in the first.
  debate:
    p("M5.5 3H13A2.5 2.5 0 0 1 15.5 5.5V7.5A2.5 2.5 0 0 1 13 10H9L5.5 12.8V10A2.5 2.5 0 0 1 3 7.5V5.5A2.5 2.5 0 0 1 5.5 3Z") +
    n(8.2, 6.5, 1.4) +
    fp("M12 13.5H18.5A2.5 2.5 0 0 1 21 16V17.5A2.5 2.5 0 0 1 18.5 20H18V22.2L15.2 20H12A2.5 2.5 0 0 1 9.5 17.5V16A2.5 2.5 0 0 1 12 13.5Z") +
    p("M13.2 16.8H17.3"),

  // Ballot dropping into a box; node is the box seal.
  voting:
    p("M7.5 14V4.5A1.5 1.5 0 0 1 9 3H15A1.5 1.5 0 0 1 16.5 4.5V14") +
    p("M9.8 8.4L11.5 10.1L14.3 6.8") +
    fp("M4 14H20V19A1.5 1.5 0 0 1 18.5 20.5H5.5A1.5 1.5 0 0 1 4 19Z") +
    n(12, 17.4, 1.4),

  // Gavel; node is the pommel.
  hearing:
    '<g transform="rotate(-45 12 12)">' +
    fr(7.5, 4, 9, 5, 1.5) +
    r(7.5, 4, 9, 5, 1.5) +
    p("M12 9V19.5") +
    "</g>" +
    p("M3.5 20.5H20.5") +
    n(17.3, 17.3, 1.6),

  // Two people joined at the shoulders; node is the link.
  community:
    f("M3 19A4.5 4.5 0 0 1 12 19ZM12 19A4.5 4.5 0 0 1 21 19Z") +
    c(7.5, 8, 2.5) +
    c(16.5, 8, 2.5) +
    p("M3 19A4.5 4.5 0 0 1 12 19M12 19A4.5 4.5 0 0 1 21 19") +
    n(12, 19, 1.5),

  /* ---------- Race categories ---------- */

  // Key to the office; node is the key hole.
  executive:
    fcirc(8, 16, 4.2) +
    n(8, 16, 1.4) +
    p("M11.2 12.8L20 4") +
    p("M16.5 7.5L19 10M13.7 10.3L15.7 12.3"),

  // Bill with folded corner; node is the wax seal.
  legislative:
    fp("M6 3.5H14L19 8.5V20.5H6Z") +
    p("M14 3.5V8.5H19") +
    p("M9 12.5H16M9 16H12") +
    n(16, 16.5, 1.6),

  // Town hall with clock tower; node is the clock.
  local:
    f("M8.5 7H15.5V20.5H8.5Z") +
    p("M8.5 20.5V7H15.5V20.5") +
    p("M7.5 7L12 3.5L16.5 7") +
    p("M3.5 20.5V13.5H8.5M20.5 20.5V13.5H15.5") +
    p("M2.5 20.5H21.5") +
    p("M10.5 16H13.5") +
    n(12, 10.8, 1.7),

  // Graduation cap; node is the tassel bead.
  education:
    fp("M3 9.5L11.5 5.5L20 9.5L11.5 13.5Z") +
    p("M6.5 11.5V15.5C6.5 17 9 18.5 11.5 18.5C14 18.5 16.5 17 16.5 15.5V11.5") +
    p("M20 9.5V15") +
    n(20, 16.6, 1.5),

  // Ballot question card with a check and a cross; node is the decision point.
  measure:
    frr(2.5, 5, 19, 14, 3) +
    p("M4.8 12.4L6.7 14.3L9.2 10.3") +
    p("M15.5 10.4L18.9 13.8M18.9 10.4L15.5 13.8") +
    n(12.1, 12.1, 1.4),

  /* ---------- Tabs ---------- */

  // Paper ballot with bubbles; the filled bubble is the node.
  ballot:
    frr(4.5, 3, 15, 18, 2.5) +
    c(9, 8.5, 1.7) +
    p("M13 8.5H16.5M13 15H16.5") +
    n(9, 15, 1.6),

  // Calendar; node is the marked date.
  events:
    frr(3.5, 5, 17, 15.5, 2.5) +
    p("M3.5 10H20.5") +
    p("M8 3V7M16 3V7") +
    p("M7.5 15.5H10.5") +
    n(15.5, 15.5, 1.6),

  // Newspaper; node is the photo.
  news:
    fp("M17.5 19.5H5.5A2 2 0 0 1 3.5 17.5V6.5A2 2 0 0 1 5.5 4.5H15.5A2 2 0 0 1 17.5 6.5Z") +
    p("M17.5 9.5H20.5V17.5A2 2 0 0 1 17.5 19.5") +
    p("M7 8.5H13.5M10.8 13.5H13.5M7 16.5H13.5") +
    n(8, 13.5, 1.5),

  // Stacked coins; node is the top coin mark.
  funding:
    '<ellipse cx="12" cy="7" rx="7" ry="3" ' + SOFT + "/>" +
    '<ellipse cx="12" cy="7" rx="7" ry="3"/>' +
    p("M5 7V12C5 13.7 8 15 12 15S19 13.7 19 12V7") +
    p("M5 12V16.5C5 18.2 8 19.5 12 19.5S19 18.2 19 16.5V12") +
    n(12, 7, 1.4),

  // Winding path from a start ring to a milestone node.
  career:
    fcirc(5.5, 18.5, 2) +
    p("M7.5 18.5H15A3 3 0 0 0 15 12.5H9A3 3 0 0 1 9 6.5H16") +
    n(18.4, 6.5, 1.7),

  // Speech bubble holding a list; node is the first bullet.
  issues:
    fp("M6 4H18A3 3 0 0 1 21 7V13A3 3 0 0 1 18 16H11L7 19.5V16H6A3 3 0 0 1 3 13V7A3 3 0 0 1 6 4Z") +
    n(7.8, 8.2, 1.4) +
    p("M11 8.2H17.5M7 12H14"),

  // Open book with a ribbon; node ends the ribbon.
  sources:
    fp("M12 6.5C10 5 7 4.5 3.5 5V18C7 17.5 10 18 12 19.5C14 18 17 17.5 20.5 18V5C17 4.5 14 5 12 6.5Z") +
    p("M12 6.5V19.5") +
    p("M6.5 9H9.2M6.5 12H9.2") +
    p("M16.5 5.2V10") +
    n(16.5, 11.6, 1.5),

  // Magnifier with a cross (claim debunked); node ends the handle.
  myths:
    fcirc(10.5, 10.5, 6.5) +
    p("M8 8L13 13M13 8L8 13") +
    p("M15.3 15.3L18.8 18.8") +
    n(20, 20, 1.5),

  /* ---------- Status ---------- */

  // Seated chair; node is the seat holder.
  incumbent:
    f("M7 12V5A2 2 0 0 1 9 3H15A2 2 0 0 1 17 5V12Z") +
    p("M7 12V5A2 2 0 0 1 9 3H15A2 2 0 0 1 17 5V12") +
    r(5, 12, 14, 3.5, 1.5) +
    p("M7 15.5V20.5M17 15.5V20.5") +
    n(12, 7.5, 1.5),

  // Megaphone; node is the sound.
  running:
    fp("M3.5 9.5H8L15.5 5.5V18.5L8 14.5H3.5Z") +
    p("M6 14.5L6.8 19") +
    n(19.5, 12, 1.5),

  // Archive box; node is the label.
  former:
    frr(3, 4.5, 18, 4.5, 1.5) +
    p("M4.5 9V19A1.5 1.5 0 0 0 6 20.5H18A1.5 1.5 0 0 0 19.5 19V9") +
    n(12, 14.5, 1.5),

  /* ---------- Issue topics ---------- */

  // Heart with pulse; node ends the pulse.
  healthcare:
    fp("M12 20.5C5 15.5 3 12 3 8.5C3 5.5 5.2 3.5 7.7 3.5C9.5 3.5 11 4.5 12 6C13 4.5 14.5 3.5 16.3 3.5C18.8 3.5 21 5.5 21 8.5C21 12 19 15.5 12 20.5Z") +
    p("M6 11.5H8.7L10.3 8.5L12.8 14.5L14.4 11.5") +
    n(17.4, 11.5, 1.4),

  // House; node is the gable window.
  housing:
    f("M5.5 20.5V10.3L12 4.8L18.5 10.3V20.5Z") +
    p("M3 11.5L12 4L21 11.5") +
    p("M5.5 9.5V20.5H18.5V9.5") +
    p("M10 20.5V16H14V20.5") +
    n(12, 11.6, 1.5),

  // Passport with an emblem; node is the emblem core.
  immigration:
    frr(5, 3, 14, 18, 2.5) +
    c(12, 10, 3.3) +
    n(12, 10, 1.3) +
    p("M8.5 16.5H15.5"),

  // Closed book; node is the title seal.
  education_topic:
    frr(5, 3.5, 14, 17, 2) +
    p("M8.5 3.5V20.5") +
    p("M11.5 8H16M11.5 11.5H14") +
    n(14.2, 16.3, 1.5),

  // Planet with an orbit; node is the satellite.
  "foreign-policy":
    fcirc(12, 12, 5.8) +
    '<ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(-25 12 12)"/>' +
    n(17.9, 6.55, 1.6),

  // Suspension bridge; node ties the main hanger.
  infrastructure:
    fr(2.5, 15, 19, 2.2) +
    p("M2.5 15H21.5") +
    p("M7 5.5V20.5M17 5.5V20.5") +
    p("M7 6Q12 15 17 6") +
    p("M2.5 15L7 6M17 6L21.5 15") +
    p("M12 10.5V15") +
    n(12, 10.5, 1.5),

  // Shield with a keyhole; node is the keyhole.
  "public-safety":
    fp("M12 3L19.5 6V11.5C19.5 16 16.5 19.5 12 21C7.5 19.5 4.5 16 4.5 11.5V6Z") +
    n(12, 10.5, 1.6) +
    p("M12 13V16"),

  // Rising bars with a trend line; node is the peak.
  economy:
    fp("M4 15H7V20.5H4ZM10.5 12H13.5V20.5H10.5ZM17 9H20V20.5H17Z") +
    p("M4.5 10.5L9 6.8L13 9.3L18.2 4.8") +
    n(19.3, 4.2, 1.6),

  // Leaf on a stem; node is the stem base.
  environment:
    fp("M5 19C4 11 9 5 20 4C20 13 16 20 5 19Z") +
    p("M5 19L13.5 10.5") +
    n(4.2, 19.8, 1.5),

  // Percent badge drawn with shapes; node is the first dot.
  taxes:
    fcirc(12, 12, 9.5) +
    n(8.8, 8.8, 1.7) +
    c(15.2, 15.2, 2.1) +
    p("M16 8L8 16"),

  // Chip with pins; node is the core.
  technology:
    fp("M8.5 6.5H15.5A2 2 0 0 1 17.5 8.5V15.5A2 2 0 0 1 15.5 17.5H8.5A2 2 0 0 1 6.5 15.5V8.5A2 2 0 0 1 8.5 6.5Z") +
    p("M9.5 3V6.5M14.5 3V6.5M9.5 17.5V21M14.5 17.5V21M3 9.5H6.5M3 14.5H6.5M17.5 9.5H21M17.5 14.5H21") +
    n(12, 12, 1.8),

  /* ---------- UI ---------- */

  // Monitor with a broadcast signal; node is the live dot.
  online:
    frr(3, 4, 18, 12, 2) +
    p("M9 7.8A3.2 3.2 0 0 0 9 12.2M15 7.8A3.2 3.2 0 0 1 15 12.2") +
    n(12, 10, 1.6) +
    p("M12 16V19.5M8.5 19.5H15.5"),

  // Map pin; node is the location.
  pin:
    fp("M12 21.5C12 21.5 5 15 5 9.5A7 7 0 0 1 19 9.5C19 15 12 21.5 12 21.5Z") +
    n(12, 9.5, 1.8),

  // Arrow leaving a box; node is the departure point.
  external:
    fr(4.5, 5, 14.5, 14.5, 2) +
    p("M10.5 5H6.5A2 2 0 0 0 4.5 7V17.5A2 2 0 0 0 6.5 19.5H17A2 2 0 0 0 19 17.5V13.5") +
    p("M13.5 10.5L20 4M15 4H20V9") +
    n(11.8, 12.2, 1.5),

  // Check mark; node is the tip.
  check:
    fc(12, 12, 9.5) +
    p("M6.8 12.6L10.3 16.1L16 9.5") +
    n(17.4, 8, 1.6),

  // Cross with a gap; node is the center.
  cross:
    fc(12, 12, 9.5) +
    p("M7.5 7.5L10.2 10.2M13.8 13.8L16.5 16.5M16.5 7.5L13.8 10.2M10.2 13.8L7.5 16.5") +
    n(12, 12, 1.5),

  // Arrow left; node is the origin.
  back:
    fc(12, 12, 9.5) +
    p("M12.5 7.5L8 12L12.5 16.5") +
    p("M8 12H15") +
    n(17.4, 12, 1.5),

  // Magnifier; node is the focus.
  search:
    fcirc(10.5, 10.5, 6.5) +
    p("M15.3 15.3L20.5 20.5") +
    n(10.5, 10.5, 1.6),

  // Target; node is the position.
  locate:
    fcirc(12, 12, 6) +
    p("M12 2.5V6M12 18V21.5M2.5 12H6M18 12H21.5") +
    n(12, 12, 1.8),

  // Crescent moon; node is a star.
  moon:
    fp("M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79Z") +
    n(17.3, 6.8, 1.4),

  // Sun with eight rays; node is the core.
  sun:
    fcirc(12, 12, 4.5) +
    p("M12 2.5V4.8M12 19.2V21.5M2.5 12H4.8M19.2 12H21.5") +
    p("M5.5 5.5L6.9 6.9M17.1 17.1L18.5 18.5M18.5 5.5L17.1 6.9M6.9 17.1L5.5 18.5") +
    n(12, 12, 1.5),

  // Menu tile with three lines; node is the toggle.
  menu:
    fr(3, 3, 18, 18, 5) +
    p("M7.5 8.5H16.5M7.5 12H12.5M7.5 15.5H16.5") +
    n(16, 12, 1.4),

  // Rising line over a soft chart tile; node is the latest reading.
  trend:
    fr(3, 4, 18, 16, 4) +
    p("M6.5 15.5L10.5 11.5L13.5 14L18 8.5") +
    p("M14.5 8.5H18V12") +
    n(10.5, 11.5, 1.5),
  /* ---------- Notices, accounts, reports ---------- */
  // Warning triangle; node is the exclamation dot.
  alert:
    fp("M12 3.8L21 19.5H3Z") +
    p("M12 9.5V14") +
    n(12, 16.7, 1.2),
  // Head and shoulders; node is the head.
  user:
    fcirc(12, 12, 9.5) +
    p("M6.2 18.6C7.6 16.3 9.6 15.3 12 15.3C14.4 15.3 16.4 16.3 17.8 18.6") +
    n(12, 9.4, 2.6),
  // Speech bubble; node is the typing dot.
  chat:
    fp("M4 6.5A2.5 2.5 0 0 1 6.5 4H17.5A2.5 2.5 0 0 1 20 6.5V13.5A2.5 2.5 0 0 1 17.5 16H11L6.5 20V16A2.5 2.5 0 0 1 4 13.5Z") +
    p("M8 8.8H16M8 11.8H13") +
    n(16.5, 11.8, 1.3),
  // Hand sign on a post; node is the post foot.
  sign:
    fr(5, 3.5, 14, 9, 2) +
    r(5, 3.5, 14, 9, 2) +
    p("M12 12.5V21M8.5 8H15.5") +
    n(12, 20, 1.4),
  // Envelope; node is the seal.
  mail:
    fr(3.5, 5.5, 17, 13, 2.5) +
    r(3.5, 5.5, 17, 13, 2.5) +
    p("M4.5 7.5L12 13L19.5 7.5") +
    n(12, 13, 1.3),
  // Circle with an i; node is the dot.
  info:
    fcirc(12, 12, 9.5) +
    p("M12 11V16.5") +
    n(12, 7.9, 1.4),
  // Flag on a pole; node is the pole base.
  flag:
    fp("M6 4.5H17L14.5 8.8L17 13H6Z") +
    p("M6 3.5V20.5") +
    n(6, 20, 1.3),
  // Globe with meridians; node is the center.
  globe:
    fcirc(12, 12, 9) +
    '<ellipse cx="12" cy="12" rx="4" ry="9"/>' +
    p("M3.94 8H20.06M3.94 16H20.06") +
    n(12, 12, 1.5),
};

export const ICON_NAMES = Object.keys(ICONS);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Returns an SVG string for the named icon. Unknown names fall back to "pin".
 * @param {string} name
 * @param {{ size?: number, label?: string }} [opts]
 */
export function icon(name, { size = 20, label = "" } = {}) {
  const key = has(ICONS, name) ? name : "pin";
  const px = Number(size) > 0 ? Number(size) : 20;
  const a11y = label
    ? `role="img" aria-label="${escapeAttr(label)}"`
    : 'aria-hidden="true"';
  return (
    `<svg class="ico ico-${key}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ` +
    `stroke-linejoin="round" focusable="false" ${a11y}>${ICONS[key]}</svg>`
  );
}

/**
 * Returns a DOM element for the named icon (browser only; returns null when
 * no document is available).
 */
export function iconEl(name, opts) {
  if (typeof document === "undefined") return null;
  const tpl = document.createElement("template");
  tpl.innerHTML = icon(name, opts);
  return tpl.content.firstElementChild;
}

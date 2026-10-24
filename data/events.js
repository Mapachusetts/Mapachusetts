// data/events.js
// Factory helpers for civic events (town halls, meetings, debates, voter
// registration drives, election days, ...).
//
// Event shape:
//   id          - unique-ish id
//   title       - short name
//   type        - key of EVENT_TYPES below
//   start       - ISO 8601 date-time string (local time of the event)
//   end         - optional ISO string
//   venue       - where it happens ("City Hall, Council Chambers")
//   virtual     - true if it can be joined online
//   description - one or two plain-language sentences
//   url         - optional link for details / RSVP
//   source      - "sample" for mock data; real feeds should set their own name
//
// The sample events use dates RELATIVE TO TODAY (see daysFromNow) so a demo
// never shows a stale calendar. Real feeds should return real dates.
// Election Day events use the real general-election date.

export const EVENT_TYPES = {
  townhall: { label: "Town hall", icon: "🎤", color: "#b45309" },
  meeting: { label: "Public meeting", icon: "🏛️", color: "#1d4ed8" },
  debate: { label: "Debate / forum", icon: "💬", color: "#7c3aed" },
  voting: { label: "Voting", icon: "🗳️", color: "#be123c" },
  hearing: { label: "Public hearing", icon: "📣", color: "#0e7490" },
  community: { label: "Community", icon: "🤝", color: "#15803d" },
};

let _seq = 0;
const uid = () => `evt-${++_seq}`;

// ISO string for N days from today at the given local hour/minute.
export function daysFromNow(days, hour = 18, minute = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return toLocalIso(d);
}

// Build an ISO-like local string without converting to UTC.
export function toLocalIso(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}:00`;
}

export function makeEvent(fields) {
  return {
    id: uid(),
    type: "meeting",
    virtual: false,
    source: "sample",
    ...fields,
  };
}

export function electionDayEvent(date = "2026-11-03", scopeLabel = "") {
  return makeEvent({
    title: `General Election Day${scopeLabel ? ` (${scopeLabel})` : ""}`,
    type: "voting",
    start: `${date}T07:00:00`,
    end: `${date}T20:00:00`,
    venue: "Your assigned polling place (check your local election office)",
    description:
      "Polls are open on Election Day. Hours vary by state, so confirm yours with your local election office.",
  });
}

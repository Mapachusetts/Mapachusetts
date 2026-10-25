// data/events.js
// Event types and the one event that applies to everyone.
//
// Event shape (full reference in data/types.js):
//   id          unique id
//   title       short name
//   kind        layer of government that holds it (key of KINDS in data/kinds.js)
//   type        key of EVENT_TYPES below
//   start       ISO 8601 local date-time, "2026-11-03T00:00:00"
//   end         optional ISO string
//   allDay      true when there is no specific start time
//   venue       where it happens
//   virtual     true if it can be joined online
//   description one or two sentences
//   url         link for details
//   source      who published it ("Boston City Council (Legistar)")
//
// REAL meetings come from data/events.generated.js (scripts/export_events.py,
// city council and committee calendars published through Legistar). This file
// used to hold invented sample events; they were removed.

// `icon` is a key into js/icons.js.
export const EVENT_TYPES = {
  townhall: { label: "Town hall", icon: "townhall", color: "#b45309" },
  meeting: { label: "Public meeting", icon: "meeting", color: "#1d4ed8" },
  debate: { label: "Debate / forum", icon: "debate", color: "#7c3aed" },
  voting: { label: "Voting", icon: "voting", color: "#be123c" },
  hearing: { label: "Public hearing", icon: "hearing", color: "#0e7490" },
  community: { label: "Community", icon: "community", color: "#15803d" },
};

/**
 * General Election Day. Deliberately has no opening/closing hours: polling
 * hours differ by state and sometimes by county, and we do not list them.
 */
export function electionDayEvent(date = "2026-11-03") {
  return {
    id: `election-day-${date}`,
    title: "General Election Day",
    type: "voting",
    kind: "country",
    start: `${date}T00:00:00`,
    allDay: true,
    venue: "Your polling place",
    virtual: false,
    description:
      "Polling hours differ by state. Confirm your hours, your polling place, and early or mail voting options with your local election office.",
    url: "https://www.usa.gov/election-office",
    source: "Election date: federal law (first Tuesday after the first Monday in November)",
  };
}

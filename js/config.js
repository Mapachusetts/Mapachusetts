// js/config.js
// Deployment settings. Everything here is PUBLIC (it ships to every browser),
// so it must never hold a secret. Secrets live only on the assistant server
// (see server/README.md).
//
//   supabaseUrl / supabaseAnonKey   Your Supabase project. The anon key is meant
//                                   to be public; Row Level Security
//                                   (supabase/accounts.sql) is what protects data.
//                                   Leave both empty and accounts stay switched
//                                   off (the site works fully without them).
//   assistantUrl                    Where server/assistant.py is served from, e.g.
//                                   "https://assistant.example.org". Needed for the
//                                   AI assistant and for filing protest reports.
//   pilotStates                     States that get the pilot features: every
//                                   ballot level, voting-change notices, account
//                                   features (assistant, protest reports).
export const CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  assistantUrl: "",
  pilotStates: ["MA"],
};

/** Is this USPS state code part of the pilot? */
export function isPilot(stateCode) {
  return !!stateCode && CONFIG.pilotStates.includes(stateCode);
}

/** Accounts need both Supabase values. */
export function accountsConfigured() {
  return !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

/** The assistant and protest reports also need the assistant server. */
export function assistantConfigured() {
  return accountsConfigured() && !!CONFIG.assistantUrl;
}

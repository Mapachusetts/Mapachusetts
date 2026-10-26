// js/api.js
// Calls to the two services behind accounts:
//   assistant(...)  the assistant server (server/assistant.py): AI answers and
//                   protest reports. It checks your login and does the safety work.
//   rest(...)       Supabase's table API, for reading reports and flagging them.
//                   Row Level Security (supabase/accounts.sql) limits what each
//                   signed-in user can see and do.
// Both send the signed-in user's access token. Neither is ever called when
// signed out.

import { CONFIG } from "./config.js";
import { auth } from "./auth.js";

/** An error from either service. `code` matches the server's error codes. */
export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

async function send(url, { method = "GET", body, headers = {} }) {
  const token = await auth.accessToken();
  if (!token) throw new ApiError("unauthorized", "Please sign in first.");
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network", "Couldn't connect. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const code = (data && (data.error || data.code)) || String(res.status);
    throw new ApiError(code, (data && (data.message || data.msg)) || "Something went wrong. Please try again.", {
      status: res.status,
      retryAfterSeconds: data && data.retryAfterSeconds,
    });
  }
  return data;
}

/** The assistant server, e.g. assistant("/v1/ask", { method: "POST", body }). */
export function assistant(path, opts = {}) {
  if (!CONFIG.assistantUrl) throw new ApiError("not_configured", "The assistant isn't set up on this copy of the site.");
  return send(`${CONFIG.assistantUrl.replace(/\/$/, "")}${path}`, opts);
}

/** Supabase's table API, e.g. rest("protest_reports?select=id,lat"). */
export function rest(path, opts = {}) {
  return send(`${CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: CONFIG.supabaseAnonKey, ...(opts.headers || {}) },
  });
}

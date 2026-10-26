// js/auth.js
// A small Supabase Auth (GoTrue) client for email + password accounts.
//
// Why not supabase-js? It would load third-party code into a page that holds a
// login session. These few REST calls are all we need, and they are easy to
// read and test. The anon key is public by design; the access token it returns
// is what proves who the user is to the assistant server and to Supabase.
//
// The session is kept in localStorage so a refresh doesn't sign you out. That
// is normal for single-page apps, and it is why this site renders all user text
// with textContent and loads no analytics or ad scripts.

import { CONFIG, accountsConfigured } from "./config.js";

const STORE_KEY = "mapachusetts-session";
const REFRESH_MARGIN_S = 60;

/** An error with a stable `code` the UI can turn into plain words. */
export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  invalid_credentials: "That email and password don't match. Check them and try again.",
  email_not_confirmed: "Please confirm your email first. We sent you a link.",
  user_already_exists: "An account with that email already exists. Try signing in instead.",
  email_exists: "An account with that email already exists. Try signing in instead.",
  weak_password: "That password is too easy to guess. Use at least 10 characters.",
  over_request_rate_limit: "Too many tries. Please wait a few minutes and try again.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a few minutes and try again.",
  signup_disabled: "New accounts are turned off right now.",
  validation_failed: "Please check the email address and try again.",
};

const listeners = new Set();
let session = null; // { access_token, refresh_token, expires_at, user }

function emit(event) {
  for (const fn of listeners) {
    try {
      fn(event, auth.user);
    } catch (err) {
      console.warn("auth listener failed", err);
    }
  }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (raw && raw.access_token && raw.refresh_token && raw.user && raw.user.id) return raw;
  } catch {
    /* corrupt or unavailable: start signed out */
  }
  return null;
}

function save(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the session lasts until the page closes */
  }
}

async function call(path, { method = "GET", body, token } = {}) {
  if (!accountsConfigured()) throw new AuthError("not_configured", "Accounts aren't set up on this copy of the site.");
  let res;
  try {
    res = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/, "")}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: CONFIG.supabaseAnonKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AuthError("network", "Couldn't reach the account service. Check your connection and try again.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* some endpoints return an empty body */
  }
  if (!res.ok) {
    const code = (data && (data.error_code || data.code)) || String(res.status);
    const known = MESSAGES[code] || (data && /password/i.test(data.msg || "") && MESSAGES.weak_password);
    throw new AuthError(code, known || (data && (data.msg || data.error_description || data.message)) || "Something went wrong. Please try again.");
  }
  return data;
}

function fromTokenResponse(d) {
  const expiresAt = d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: expiresAt, user: d.user };
}

export const auth = {
  get configured() {
    return accountsConfigured();
  },
  get user() {
    return session ? session.user : null;
  },
  get signedIn() {
    return !!session;
  },
  /** Listen for "signin" | "signout" | "recovery" | "refresh". Returns an unsubscribe function. */
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Call once on page load: restores the session and handles links from our emails. */
  async init() {
    session = load();
    if (!accountsConfigured()) return;

    // Links in confirmation / reset emails land here with tokens after "#".
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("access_token") && hash.get("refresh_token")) {
      const type = hash.get("type");
      try {
        const user = await call("user", { token: hash.get("access_token") });
        save({
          access_token: hash.get("access_token"),
          refresh_token: hash.get("refresh_token"),
          expires_at: Math.floor(Date.now() / 1000) + (Number(hash.get("expires_in")) || 3600),
          user,
        });
        history.replaceState(null, "", window.location.pathname + window.location.search);
        emit(type === "recovery" ? "recovery" : "signin");
        return;
      } catch (err) {
        console.warn("Could not use the link from your email:", err.message);
      }
    }
    if (session) {
      // Make sure the stored session still works; refresh quietly if it has expired.
      const token = await this.accessToken();
      if (token) emit("signin");
    }
  },

  async signUp({ email, password, displayName }) {
    const data = await call("signup", {
      method: "POST",
      body: { email, password, data: displayName ? { display_name: displayName.slice(0, 40) } : {} },
    });
    // With email confirmation on (recommended) there is no session yet.
    if (data && data.access_token) {
      save(fromTokenResponse(data));
      emit("signin");
      return { needsConfirmation: false };
    }
    return { needsConfirmation: true };
  },

  async signIn({ email, password }) {
    const data = await call("token?grant_type=password", { method: "POST", body: { email, password } });
    save(fromTokenResponse(data));
    emit("signin");
  },

  async signOut() {
    const token = session && session.access_token;
    save(null);
    emit("signout");
    if (token) {
      try {
        await call("logout", { method: "POST", token });
      } catch {
        /* we're signed out locally either way */
      }
    }
  },

  async resetPassword(email) {
    await call("recover", { method: "POST", body: { email } });
  },

  async updatePassword(password) {
    const token = await this.accessToken();
    if (!token) throw new AuthError("unauthorized", "Please sign in again.");
    await call("user", { method: "PUT", token, body: { password } });
  },

  /** A valid access token, refreshed if it is about to expire; null if signed out. */
  async accessToken() {
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at - now > REFRESH_MARGIN_S) return session.access_token;
    try {
      const data = await call("token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token } });
      save(fromTokenResponse(data));
      emit("refresh");
      return session.access_token;
    } catch (err) {
      // A rejected refresh token means the session is over; a network error doesn't.
      if (err.code !== "network") {
        save(null);
        emit("signout");
      }
      return null;
    }
  },
};

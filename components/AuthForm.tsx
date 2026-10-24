"use client";

import { useState } from "react";
import { useActionState } from "react";
import { signIn, signUp, type AuthResult } from "@/app/auth/actions";

const initial: AuthResult = {};

export default function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Sign in or create account">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("signin")}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("signup")}
        >
          Create Account
        </button>
      </div>

      <form action={formAction} className="auth-form">
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="auth-input"
          placeholder="you@example.com"
        />

        <label className="auth-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="auth-input"
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
        />

        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        {state.message && <p className="auth-success" role="status">{state.message}</p>}

        <button type="submit" className="btn auth-submit" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </button>
      </form>

      <p className="auth-switch">
        {mode === "signin" ? (
          <>
            New to Mapachusetts?{" "}
            <button type="button" className="auth-link" onClick={() => setMode("signup")}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" className="auth-link" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}

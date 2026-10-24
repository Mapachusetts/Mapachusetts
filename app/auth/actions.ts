"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/serverAuth";

export interface AuthResult {
  error?: string;
  message?: string;
}

/** Create a new account with email + password. */
export async function signUp(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // If email confirmation is on, there's no active session yet.
  if (!data.session) {
    return {
      message:
        "Account created. Check your email to confirm your address, then sign in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/map");
}

/** Sign in an existing user. */
export async function signIn(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/map");
}

/** Sign the current user out. */
export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

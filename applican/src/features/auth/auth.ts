import type { AuthError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

type LoginPayload = {
  email: string;
  password: string;
};

type SignupPayload = {
  email: string;
  name: string;
  jobRole: string;
  password: string;
};

const appRedirectUrl = `${window.location.origin}/app`;

export async function signInWithPassword({ email, password }: LoginPayload) {
  const normalizedEmail = email.trim().toLowerCase();
  return supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
}

export async function signUpWithPassword({ email, name, jobRole, password }: SignupPayload) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const normalizedJobRole = jobRole.trim();
  const signUpResult = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: appRedirectUrl,
      data: {
        full_name: normalizedName,
        job_role: normalizedJobRole,
      },
    },
  });

  if (signUpResult.error) {
    return signUpResult;
  }

  // If confirm-email is disabled, we have a session and can enforce metadata update.
  if (signUpResult.data.session) {
    const updateResult = await supabase.auth.updateUser({
      data: {
        full_name: normalizedName,
        job_role: normalizedJobRole,
      },
    });

    if (updateResult.error) {
      return { ...signUpResult, error: updateResult.error };
    }
  }

  return signUpResult;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: appRedirectUrl,
    },
  });
}

export function getAuthErrorMessage(error: AuthError | null) {
  if (!error) {
    return "";
  }
  return error.message;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getRequiredEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable. Tried: ${names.join(", ")}`);
}

export function createAdminSupabaseClient(): SupabaseClient {
  const url = getRequiredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceRoleKey = getRequiredEnv(["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SECRET_KEY"]);

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

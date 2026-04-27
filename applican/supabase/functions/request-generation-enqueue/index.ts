import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RUNS_TABLE = "resume_runs";
const STATUS = {
  EXTRACTED: "extracted",
  QUEUED_GENERATE: "queued_generate",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, "MISSING_ENV", `Missing environment variable: ${name}`);
  }

  return value;
}

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) {
    throw new HttpError(401, "MISSING_AUTH", "Missing Authorization header.");
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "INVALID_AUTH_HEADER", "Authorization header must be a Bearer token.");
  }

  return token;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST.");
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    const accessToken = parseBearerToken(authHeader);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? "",
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "INVALID_INPUT", "Expected a JSON object body.");
    }

    const runId = cleanString((body as { run_id?: unknown }).run_id);
    if (!runId) {
      throw new HttpError(400, "INVALID_INPUT", "run_id is required.");
    }

    const queuedAt = new Date().toISOString();
    const { data: updatedRun, error: updateError } = await userClient
      .from(RUNS_TABLE)
      .update({
        status: STATUS.QUEUED_GENERATE,
        generation_queued_at: queuedAt,
        error_code: null,
        error_message: null,
      })
      .eq("id", runId)
      .eq("user_id", user.id)
      .eq("status", STATUS.EXTRACTED)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new HttpError(500, "QUEUE_UPDATE_FAILED", updateError.message);
    }

    if (updatedRun) {
      return jsonResponse({
        run: updatedRun,
        enqueue_mode: "db_only",
        enqueued: true,
      });
    }

    const { data: existingRun, error: existingRunError } = await userClient
      .from(RUNS_TABLE)
      .select("*")
      .eq("id", runId)
      .eq("user_id", user.id)
      .single();

    if (existingRunError || !existingRun) {
      throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
    }

    return jsonResponse({
      run: existingRun,
      enqueue_mode: "db_only",
      enqueued: false,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          error_code: error.code,
          error_message: error.message,
        },
        error.status,
      );
    }

    return jsonResponse(
      {
        error_code: "INTERNAL_SERVER_ERROR",
        error_message: error instanceof Error ? error.message : "Unknown error.",
      },
      500,
    );
  }
});

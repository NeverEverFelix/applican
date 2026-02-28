import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESUME_BUCKET = "Resumes";
const APPLICATIONS_TABLE = "applications";

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

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, "MISSING_ENV", `Missing environment variable: ${name}`);
  }
  return value;
}

function parseBearerToken(authHeader: string | null) {
  if (!authHeader) {
    throw new HttpError(401, "MISSING_AUTH", "Missing Authorization header.");
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "INVALID_AUTH_HEADER", "Authorization header must be a Bearer token.");
  }

  return token;
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const applicationId = typeof body.application_id === "string" ? body.application_id.trim() : "";

    if (!applicationId) {
      throw new HttpError(400, "INVALID_INPUT", "application_id is required.");
    }

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
    }

    const { data: application, error: applicationError } = await userClient
      .from(APPLICATIONS_TABLE)
      .select("id, user_id, resume_path, resume_filename")
      .eq("id", applicationId)
      .single();

    if (applicationError || !application) {
      throw new HttpError(404, "APPLICATION_NOT_FOUND", "Application not found.");
    }

    if (application.user_id !== user.id) {
      throw new HttpError(403, "FORBIDDEN", "Application does not belong to authenticated user.");
    }

    if (!application.resume_path || typeof application.resume_path !== "string") {
      throw new HttpError(400, "MISSING_RESUME_PATH", "Application has no resume file.");
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(application.resume_path, 60);

    if (signedError || !signed?.signedUrl) {
      throw new HttpError(500, "SIGNED_URL_FAILED", signedError?.message ?? "Could not create download url.");
    }

    return jsonResponse(
      {
        signed_url: signed.signedUrl,
        filename: application.resume_filename ?? "resume",
      },
      200,
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = error instanceof HttpError ? error.message : "Unexpected function error.";

    return jsonResponse({ error_code: code, error_message: message }, status);
  }
});

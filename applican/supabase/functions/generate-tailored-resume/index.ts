import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as Sentry from "npm:@sentry/deno";
import { JAKES_RESUME_TEMPLATE } from "./templates/jakes-resume.template.ts";
import { buildLatexDocument, parseTailoredResumeInput, sanitizeNameForFile } from "./logic.ts";

const RUNS_TABLE = "resume_runs";
const DOCUMENTS_TABLE = "resume_documents";
const GENERATED_RESUMES_TABLE = "generated_resumes";
const FUNCTION_NAME = "generate-tailored-resume";
const STATUS = {
  EXTRACTED: "extracted",
  QUEUED_GENERATE: "queued_generate",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
};

const sentryDsn = Deno.env.get("SENTRY_DSN");
const sentryEnabled = Boolean(sentryDsn);
const sentryEnvironment = Deno.env.get("SENTRY_ENVIRONMENT") ?? Deno.env.get("SUPABASE_ENV") ?? "production";
const sentryRelease = Deno.env.get("SENTRY_RELEASE");
const sentryDebug = Deno.env.get("SENTRY_DEBUG") === "true";
const sentryTracesSampleRateRaw = Deno.env.get("SENTRY_TRACES_SAMPLE_RATE") ?? "0";
const sentryTracesSampleRate = Math.max(0, Math.min(1, Number.parseFloat(sentryTracesSampleRateRaw)));

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    tracesSampleRate: Number.isFinite(sentryTracesSampleRate) ? sentryTracesSampleRate : 0,
    debug: sentryDebug,
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.Authorization;
      }
      return event;
    },
  });
}

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

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown non-Error thrown.");
}

function isRunReadyForTailoredResume(status: unknown): boolean {
  return (
    status === STATUS.EXTRACTED ||
    status === STATUS.QUEUED_GENERATE ||
    status === STATUS.GENERATING ||
    status === STATUS.COMPLETED
  );
}

function getRequestContext(req: Request) {
  const url = new URL(req.url);
  const forwardedFor = req.headers.get("x-forwarded-for");
  return {
    method: req.method,
    url: req.url,
    path: url.pathname,
    host: url.host,
    user_agent: req.headers.get("user-agent"),
    request_id: req.headers.get("x-request-id"),
    forwarded_for: forwardedFor ? forwardedFor.split(",")[0]?.trim() : null,
  };
}

async function reportServerError(
  error: unknown,
  context: {
    req: Request;
    runId?: string;
    requestId?: string;
    userId?: string;
  },
) {
  if (!sentryEnabled) {
    return;
  }

  if (error instanceof HttpError && error.status < 500) {
    return;
  }

  Sentry.withScope((scope) => {
    const requestContext = getRequestContext(context.req);
    scope.setTag("supabase_function", FUNCTION_NAME);
    scope.setTag("http_method", requestContext.method);
    scope.setTag("http_path", requestContext.path);
    scope.setTag("runtime", "deno");
    scope.setTag("handled", "true");

    if (error instanceof HttpError) {
      scope.setTag("http_error_code", error.code);
      scope.setExtra("http_status", error.status);
    }

    if (context.runId) {
      scope.setExtra("run_id", context.runId);
    }

    if (context.requestId) {
      scope.setExtra("request_id", context.requestId);
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    scope.setContext("request", requestContext);
    scope.setExtra("timestamp", new Date().toISOString());
    Sentry.captureException(toError(error));
  });

  await Sentry.flush(2000);
}

function cleanString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

serve(async (req) => {
  let adminClient: ReturnType<typeof createClient> | null = null;
  let runId = "";
  let requestId = "";
  let authenticatedUserId = "";

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
    const isInternalInvocation = accessToken === serviceRoleKey;

    adminClient = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? "",
        },
      },
    });

    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "INVALID_INPUT", "Expected a JSON object body.");
    }

    runId = typeof body.run_id === "string" ? body.run_id.trim() : "";
    requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!runId) {
      throw new HttpError(400, "INVALID_INPUT", "run_id is required.");
    }

    const runClient = isInternalInvocation ? adminClient : userClient;

    if (!isInternalInvocation) {
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.getUser(accessToken);

      if (userError || !user) {
        throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
      }

      authenticatedUserId = user.id;
    }

    const { data: run, error: runError } = await runClient
      .from(RUNS_TABLE)
      .select("id, request_id, user_id, status, output")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
    }

    const runUserId = cleanString(run.user_id);
    const runRequestId = cleanString(run.request_id);

    if (isInternalInvocation) {
      authenticatedUserId = runUserId;
    }

    if (!runUserId || runUserId !== authenticatedUserId) {
      throw new HttpError(403, "FORBIDDEN", "Run does not belong to authenticated user.");
    }

    if (requestId && runRequestId && requestId !== runRequestId) {
      throw new HttpError(409, "REQUEST_ID_MISMATCH", "Provided request_id does not match the run.");
    }

    if (run.status === STATUS.FAILED) {
      throw new HttpError(409, "RUN_TERMINAL", "Run is in terminal failed state.");
    }

    if (!isRunReadyForTailoredResume(run.status)) {
      throw new HttpError(
        409,
        "RUN_NOT_READY",
        "Run is not ready for tailored resume generation yet.",
      );
    }

    if (!run.output || typeof run.output !== "object") {
      throw new HttpError(409, "RUN_OUTPUT_MISSING", "Run output is required before generating tailored resume.");
    }

    const { data: resumeDoc, error: resumeDocError } = await runClient
      .from(DOCUMENTS_TABLE)
      .select("text")
      .eq("run_id", runId)
      .maybeSingle();

    if (resumeDocError) {
      throw new HttpError(500, "RESUME_DOCUMENT_READ_FAILED", resumeDocError.message);
    }

    const resumeText = typeof resumeDoc?.text === "string" ? resumeDoc.text : "";

    const tailoredInput = parseTailoredResumeInput(run.output, resumeText);
    const latex = buildLatexDocument(tailoredInput, resumeText, JAKES_RESUME_TEMPLATE);
    const suggestedFilename = `${sanitizeNameForFile(tailoredInput.target_company)}-${sanitizeNameForFile(tailoredInput.target_role)}.tex`;

    const templateName = "jakes-resume";

    const { data: generatedResumeRow, error: generatedResumeError } = await adminClient
      .from(GENERATED_RESUMES_TABLE)
      .upsert(
        {
          user_id: authenticatedUserId,
          run_id: runId,
          request_id: requestId || runRequestId || null,
          template: templateName,
          filename: suggestedFilename,
          latex,
        },
        {
          onConflict: "run_id,template",
        },
      )
      .select("id, run_id, template, filename, created_at, updated_at")
      .single();

    if (generatedResumeError || !generatedResumeRow) {
      throw new HttpError(
        500,
        "GENERATED_RESUME_SAVE_FAILED",
        generatedResumeError?.message ?? "Could not save generated resume.",
      );
    }

    const mergedOutput = {
      ...(run.output as Record<string, unknown>),
      tailored_resume: {
        id: generatedResumeRow.id,
        template: templateName,
        generated_at: new Date().toISOString(),
        filename: suggestedFilename,
        latex,
      },
    };

    const { data: updatedRun, error: updateError } = await adminClient
      .from(RUNS_TABLE)
      .update({
        status: STATUS.COMPLETED,
        output: mergedOutput,
      })
      .eq("id", runId)
      .eq("user_id", authenticatedUserId)
      .select("id, request_id, status, output")
      .single();

    if (updateError || !updatedRun) {
      throw new HttpError(500, "RUN_UPDATE_FAILED", updateError?.message ?? "Could not update run output.");
    }

    return jsonResponse(
      {
        run: updatedRun,
        tailored_resume: {
          id: generatedResumeRow.id,
          filename: suggestedFilename,
          template: templateName,
          latex,
        },
      },
      200,
    );
  } catch (error) {
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = error instanceof HttpError ? error.message : "Unexpected function error.";
    const status = error instanceof HttpError ? error.status : 500;

    await reportServerError(error, {
      req,
      runId,
      requestId,
      userId: authenticatedUserId,
    });

    return jsonResponse(
      {
        error_code: code,
        error_message: message,
      },
      status,
    );
  }
});

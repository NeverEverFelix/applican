import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as Sentry from "npm:@sentry/deno";
import {
  type ResumeOptimizationPresentationSection,
} from "../../../src/lib/resumeOptimizations.ts";
import {
  cleanString,
  type ResumeStudioOutput,
} from "../../../src/server/generation/bulletOutput.ts";
import { executeGenerateBullets } from "../../../src/server/generation/executeGenerateBullets.ts";
import { normalizeModelOutput } from "../../../src/server/generation/normalizeModelOutput.ts";
import { buildGenerateBulletsOpenAiRequest } from "../../../src/server/generation/openAiRequest.ts";
import { buildParserDebug, parseExperienceSections } from "./parser.ts";

const RUNS_TABLE = "resume_runs";
const DOCUMENTS_TABLE = "resume_documents";
const APPLICATIONS_TABLE = "applications";
const ANALYSIS_RUNS_TABLE = "analysis_runs";
const CONSUME_ANALYSIS_CREDIT_RPC = "consume_analysis_credit";
const STATUS = {
  EXTRACTED: "extracted",
  QUEUED_GENERATE: "queued_generate",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
};
const FUNCTION_NAME = "generate-bullets";
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

function isRunReadyForBulletGeneration(status: unknown): boolean {
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

async function invokeGenerateTailoredResume(
  supabaseUrl: string,
  accessToken: string,
  runId: string,
  requestId: string,
): Promise<GenerateTailoredResumeResult | null> {
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-tailored-resume`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      run_id: runId,
      request_id: requestId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as GenerateTailoredResumeResult | null;
  if (!response.ok) {
    const message = typeof payload?.error_message === "string"
      ? payload.error_message
      : `generate-tailored-resume failed with HTTP ${response.status}.`;
    throw new HttpError(502, "TAILORED_RESUME_GENERATION_FAILED", message);
  }

  return payload;
}

type GenerateTailoredResumeResult = {
  run?: unknown;
  tailored_resume?: unknown;
  error_code?: unknown;
  error_message?: unknown;
};

type AnalysisCreditResult = {
  allowed: boolean;
  plan: string;
  analyses_used: number;
  analyses_limit: number | null;
};

function parseAnalysisCreditResult(value: unknown): AnalysisCreditResult {
  if (!value || typeof value !== "object") {
    throw new HttpError(500, "ANALYSIS_CREDIT_INVALID_RESPONSE", "Invalid analysis credit response.");
  }

  const row = value as Partial<AnalysisCreditResult>;
  if (
    typeof row.allowed !== "boolean" ||
    typeof row.plan !== "string" ||
    typeof row.analyses_used !== "number" ||
    !Number.isFinite(row.analyses_used) ||
    !Number.isInteger(row.analyses_used) ||
    (row.analyses_limit !== null &&
      row.analyses_limit !== undefined &&
      (typeof row.analyses_limit !== "number" ||
        !Number.isFinite(row.analyses_limit) ||
        !Number.isInteger(row.analyses_limit)))
  ) {
    throw new HttpError(500, "ANALYSIS_CREDIT_INVALID_RESPONSE", "Invalid analysis credit response.");
  }

  return {
    allowed: row.allowed,
    plan: row.plan,
    analyses_used: row.analyses_used,
    analyses_limit: row.analyses_limit ?? null,
  };
}

async function callOpenAI(
  openAiApiKey: string,
  jobDescription: string,
  resumeText: string,
  requestId: string,
): Promise<ResumeStudioOutput> {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
  const sourceExperienceSections = parseExperienceSections(resumeText);
  const parsedSourceExperienceSections = parseExperienceSections(resumeText);
  const parserDebug = buildParserDebug(resumeText, parsedSourceExperienceSections);

  try {
    const result = await executeGenerateBullets({
      openAiApiKey,
      model,
      jobDescription,
      resumeText,
      requestId,
      sourceExperienceSections: parsedSourceExperienceSections,
      parserDebug,
    });
    return result.output;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Model response was not a JSON object." || error.message === "Model response was not valid JSON.") {
        throw new HttpError(502, "OPENAI_INVALID_JSON", error.message);
      }
      if (error.message === "Model returned empty output.") {
        throw new HttpError(502, "OPENAI_EMPTY_RESPONSE", error.message);
      }
      throw new HttpError(502, "OPENAI_ERROR", error.message);
    }
    throw error;
  }
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
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openAiApiKey = getEnv("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const accessToken = parseBearerToken(authHeader);
    const isInternalInvocation = accessToken === supabaseServiceRoleKey;

    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? "",
        },
      },
    });

    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST.");
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "INVALID_INPUT", "Expected a JSON object body.");
    }

    runId = typeof body.run_id === "string" ? body.run_id.trim() : "";
    const requestIdInput = typeof body.request_id === "string" ? body.request_id.trim() : "";
    requestId = requestIdInput;
    if (!runId || !requestIdInput) {
      throw new HttpError(400, "INVALID_INPUT", "run_id and request_id are required.");
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
      .select("id, request_id, user_id, job_description, status, output")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
    }

    const runRequestId = typeof run.request_id === "string" ? run.request_id.trim() : "";
    const runUserId = typeof run.user_id === "string" ? run.user_id.trim() : "";
    const runJobDescription = typeof run.job_description === "string" ? run.job_description.trim() : "";

    if (!runRequestId || !runUserId || !runJobDescription) {
      throw new HttpError(409, "INVALID_RUN_STATE", "Run must include request_id, user_id, and job_description.");
    }

    if (runRequestId !== requestIdInput) {
      throw new HttpError(409, "REQUEST_ID_MISMATCH", "Provided request_id does not match the run.");
    }

    if (isInternalInvocation) {
      authenticatedUserId = runUserId;
    }

    if (runUserId !== authenticatedUserId) {
      throw new HttpError(403, "FORBIDDEN", "Run does not belong to authenticated user.");
    }

    if (run.output !== null && run.output !== undefined) {
      return jsonResponse({ run }, 200);
    }

    if (run.status === STATUS.FAILED) {
      throw new HttpError(409, "RUN_TERMINAL", "Run is in terminal failed state.");
    }

    if (!isRunReadyForBulletGeneration(run.status)) {
      throw new HttpError(409, "RUN_NOT_READY", "Run is not extracted yet.");
    }

    const { data: resumeDoc, error: resumeDocError } = await runClient
      .from(DOCUMENTS_TABLE)
      .select("text")
      .eq("run_id", runId)
      .maybeSingle();

    if (resumeDocError) {
      throw new HttpError(500, "RESUME_DOCUMENT_READ_FAILED", resumeDocError.message);
    }

    const resumeText = typeof resumeDoc?.text === "string" ? resumeDoc.text.trim() : "";
    if (!resumeText) {
      throw new HttpError(409, "RESUME_NOT_EXTRACTED", "Extracted resume text not found for run.");
    }

    const { data: rawCreditResult, error: creditError } = await adminClient.rpc(CONSUME_ANALYSIS_CREDIT_RPC, {
      p_user_id: authenticatedUserId,
      p_run_id: runId,
    });
    if (creditError) {
      throw new HttpError(500, "ANALYSIS_CREDIT_CHECK_FAILED", creditError.message);
    }

    const creditResult = parseAnalysisCreditResult(rawCreditResult);
    if (!creditResult.allowed) {
      const planName = (creditResult.plan || "free").trim().toLowerCase();
      const limitText = creditResult.analyses_limit ?? "current";
      const limitErrorCode = planName === "free" ? "FREE_PLAN_LIMIT_REACHED" : "ANALYSIS_LIMIT_REACHED";
      throw new HttpError(
        402,
        limitErrorCode,
        `${planName} plan analysis limit reached (${creditResult.analyses_used}/${limitText}).`,
      );
    }

    const output = await callOpenAI(openAiApiKey, runJobDescription, resumeText, runRequestId);

    const { data: updatedRun, error: updateError } = await adminClient
      .from(RUNS_TABLE)
      .update({
        status: STATUS.GENERATING,
        output,
        error_code: null,
        error_message: null,
      })
      .eq("id", runId)
      .eq("user_id", authenticatedUserId)
      .select("*")
      .single();

    if (updateError || !updatedRun) {
      throw new HttpError(500, "RUN_UPDATE_FAILED", updateError?.message ?? "Could not update run.");
    }

    const analysisRunPayload = {
      run_id: runId,
      user_id: authenticatedUserId,
      company: output.job.company,
      job_title: output.job.title,
      location: output.job.location,
      industry: output.job.industry,
      experience_needed: output.job.experience_needed,
      job_type: output.job.job_type,
      job_description: runJobDescription,
      score: output.match.score,
      analysis_summary: output.match.summary,
      positives: output.analysis.strengths,
      negatives: output.analysis.gaps,
    };

    let { error: analysisRunUpsertError } = await adminClient.from(ANALYSIS_RUNS_TABLE).upsert(
      analysisRunPayload,
      {
        onConflict: "run_id",
      },
    );

    if (analysisRunUpsertError?.message?.includes("industry")) {
      const legacyAnalysisRunPayload = { ...analysisRunPayload };
      delete legacyAnalysisRunPayload.industry;
      const fallbackResult = await adminClient.from(ANALYSIS_RUNS_TABLE).upsert(
        legacyAnalysisRunPayload,
        {
          onConflict: "run_id",
        },
      );
      analysisRunUpsertError = fallbackResult.error;
    }

    if (analysisRunUpsertError) {
      throw new HttpError(500, "ANALYSIS_RUN_SAVE_FAILED", analysisRunUpsertError.message);
    }

    const { data: updatedApplication, error: applicationUpdateError } = await adminClient
      .from(APPLICATIONS_TABLE)
      .update({
        company: output.job.company,
        position: output.job.title,
        location: output.job.location,
      })
      .eq("source_resume_run_id", runId)
      .eq("user_id", authenticatedUserId)
      .select("id")
      .maybeSingle();

    if (applicationUpdateError) {
      throw new HttpError(500, "APPLICATION_UPDATE_FAILED", applicationUpdateError.message);
    }

    // Keep analysis generation resilient even if the application sync path is missing or delayed.
    // The application row is expected to come from the resume_run trigger, but analysis/history
    // should still succeed if that linkage is absent in production.
    if (!updatedApplication) {
      console.warn(
        JSON.stringify({
          level: "warn",
          code: "APPLICATION_NOT_FOUND",
          message: "Application linked to this run was not found; skipping application sync.",
          run_id: runId,
          user_id: authenticatedUserId,
        }),
      );
    }

    let responseRun = updatedRun;
    try {
      const tailoredResult = await invokeGenerateTailoredResume(
        supabaseUrl,
        accessToken,
        runId,
        runRequestId,
      );

      const maybeRun = tailoredResult && typeof tailoredResult.run === "object" ? tailoredResult.run : null;
      if (maybeRun) {
        responseRun = maybeRun;
      }
    } catch (tailoredError) {
      await reportServerError(tailoredError, {
        req,
        runId,
        requestId: runRequestId,
        userId: authenticatedUserId,
      });
    }

    return jsonResponse({ run: responseRun }, 200);
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

    if (runId && adminClient && authenticatedUserId) {
      await adminClient
        .from(RUNS_TABLE)
        .update({
          error_code: code,
          error_message: message,
        })
        .eq("id", runId)
        .eq("user_id", authenticatedUserId);
    }

    return jsonResponse(
      {
        error_code: code,
        error_message: message,
      },
      status,
    );
  }
});

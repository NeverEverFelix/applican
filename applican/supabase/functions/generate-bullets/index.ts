import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RUNS_TABLE = "resume_runs";
const DOCUMENTS_TABLE = "resume_documents";
const STATUS = {
  EXTRACTED: "extracted",
  FAILED: "failed",
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

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part && "text" in part) {
          const value = (part as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

type ModelOptimizationBullet = {
  action: "replace" | "add";
  original: string;
  rewritten: string;
  reason: string;
};

type ModelOptimization = {
  experience_title: string;
  role_before: string;
  role_after: string;
  bullets: ModelOptimizationBullet[];
};

type ModelOutput = {
  company: string;
  title: string;
  match_score: number;
  match_summary: string;
  strengths: string[];
  gaps: string[];
  optimizations: ModelOptimization[];
};

type ResumeStudioOutput = {
  job: {
    company: string;
    title: string;
  };
  match: {
    score: number;
    label: string;
    summary: string;
  };
  analysis: {
    strengths: string[];
    gaps: string[];
  };
  optimizations: Array<{
    experience_title: string;
    role_before: string;
    role_after: string;
    bullets: Array<{
      original: string;
      rewritten: string;
      action: "replace" | "add";
      reason: string;
    }>;
  }>;
  meta: {
    model: string;
    generated_at: string;
    request_id: string;
  };
  // Backward-compatible fields used by older clients.
  summary: string;
  tailored_bullets: string[];
  skills: string[];
  missing_requirements: string[];
};

function cleanString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function normalizeFixedCount(items: string[], size: number): string[] {
  const result = items.slice(0, size);
  while (result.length < size) {
    result.push("No additional insight available.");
  }
  return result;
}

function normalizeOptimizations(value: unknown): ResumeStudioOutput["optimizations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as {
        experience_title?: unknown;
        role_before?: unknown;
        role_after?: unknown;
        bullets?: unknown;
      };

      const bullets = Array.isArray(row.bullets)
        ? row.bullets
            .map((bullet) => {
              if (!bullet || typeof bullet !== "object") {
                return null;
              }
              const b = bullet as {
                original?: unknown;
                rewritten?: unknown;
                action?: unknown;
                reason?: unknown;
              };
              const rewritten = cleanString(b.rewritten);
              if (!rewritten) {
                return null;
              }

              const action = b.action === "add" ? "add" : "replace";
              return {
                original: cleanString(b.original),
                rewritten,
                action,
                reason: cleanString(b.reason),
              };
            })
            .filter((bullet): bullet is NonNullable<typeof bullet> => Boolean(bullet))
        : [];

      if (!bullets.length) {
        return null;
      }

      return {
        experience_title: cleanString(row.experience_title, "Experience"),
        role_before: cleanString(row.role_before),
        role_after: cleanString(row.role_after),
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function normalizeModelOutput(raw: unknown, model: string, requestId: string): ResumeStudioOutput {
  if (!raw || typeof raw !== "object") {
    throw new HttpError(502, "OPENAI_INVALID_JSON", "Model response was not a JSON object.");
  }

  const data = raw as Partial<ModelOutput>;
  const strengths = normalizeFixedCount(normalizeList(data.strengths), 3);
  const gaps = normalizeFixedCount(normalizeList(data.gaps), 2);
  const optimizations = normalizeOptimizations(data.optimizations);
  const score = clampScore(data.match_score);
  const summary = cleanString(data.match_summary, "Resume has partial overlap with the job requirements.");

  const rewrittenBullets = optimizations.flatMap((opt) => opt.bullets.map((bullet) => bullet.rewritten));

  return {
    job: {
      company: cleanString(data.company, "Unknown Company"),
      title: cleanString(data.title, "Target Role"),
    },
    match: {
      score,
      label: `${score}% Match`,
      summary,
    },
    analysis: {
      strengths,
      gaps,
    },
    optimizations,
    meta: {
      model,
      generated_at: new Date().toISOString(),
      request_id: requestId,
    },
    summary,
    tailored_bullets: rewrittenBullets,
    skills: strengths,
    missing_requirements: gaps,
  };
}

function buildJsonSchema() {
  return {
    name: "resume_studio_output_v2",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        company: {
          type: "string",
        },
        title: {
          type: "string",
        },
        match_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        match_summary: {
          type: "string",
        },
        strengths: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "string",
          },
        },
        gaps: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "string",
          },
        },
        optimizations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              experience_title: {
                type: "string",
              },
              role_before: {
                type: "string",
              },
              role_after: {
                type: "string",
              },
              bullets: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    action: {
                      type: "string",
                      enum: ["replace", "add"],
                    },
                    original: {
                      type: "string",
                    },
                    rewritten: {
                      type: "string",
                    },
                    reason: {
                      type: "string",
                    },
                  },
                  required: ["action", "original", "rewritten", "reason"],
                },
              },
            },
            required: ["experience_title", "role_before", "role_after", "bullets"],
          },
        },
      },
      required: ["company", "title", "match_score", "match_summary", "strengths", "gaps", "optimizations"],
    },
  };
}

async function callOpenAI(
  openAiApiKey: string,
  jobDescription: string,
  resumeText: string,
  requestId: string,
): Promise<ResumeStudioOutput> {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: buildJsonSchema(),
      },
      messages: [
        {
          role: "system",
          content: [
            "You are a resume optimization assistant.",
            "Return only valid JSON matching the schema.",
            "Score how well resume text matches the job description from 0-100.",
            "Provide exactly 3 strengths and exactly 2 gaps.",
            "Provide structured optimization rewrites that are concise and ATS-friendly.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Job description:\n${jobDescription}`,
            `Resume text:\n${resumeText || "[No extractable text available]"}`,
            "Infer company and role title from the job description when possible.",
            "For optimization bullets, use action='replace' for edits to existing bullets and action='add' for new bullets.",
          ].join("\n\n"),
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload.error?.message ?? "OpenAI request failed.";
    throw new HttpError(502, "OPENAI_ERROR", message);
  }

  const content = extractAssistantText(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new HttpError(502, "OPENAI_EMPTY_RESPONSE", "Model returned empty output.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new HttpError(502, "OPENAI_INVALID_JSON", "Model response was not valid JSON.");
  }

  return normalizeModelOutput(raw, model, requestId);
}

serve(async (req) => {
  let adminClient: ReturnType<typeof createClient> | null = null;
  let runId = "";
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

    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
    }

    authenticatedUserId = user.id;

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
    if (!runId || !requestIdInput) {
      throw new HttpError(400, "INVALID_INPUT", "run_id and request_id are required.");
    }

    const { data: run, error: runError } = await userClient
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

    if (runUserId !== authenticatedUserId) {
      throw new HttpError(403, "FORBIDDEN", "Run does not belong to authenticated user.");
    }

    if (run.output !== null && run.output !== undefined) {
      return jsonResponse({ run }, 200);
    }

    if (run.status === STATUS.FAILED) {
      throw new HttpError(409, "RUN_TERMINAL", "Run is in terminal failed state.");
    }

    if (run.status !== STATUS.EXTRACTED) {
      throw new HttpError(409, "RUN_NOT_READY", "Run is not extracted yet.");
    }

    const { data: resumeDoc, error: resumeDocError } = await userClient
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

    const output = await callOpenAI(openAiApiKey, runJobDescription, resumeText, runRequestId);

    const { data: updatedRun, error: updateError } = await adminClient
      .from(RUNS_TABLE)
      .update({
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

    return jsonResponse({ run: updatedRun }, 200);
  } catch (error) {
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = error instanceof HttpError ? error.message : "Unexpected function error.";
    const status = error instanceof HttpError ? error.status : 500;

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

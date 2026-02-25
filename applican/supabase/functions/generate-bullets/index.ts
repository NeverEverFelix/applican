import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const RESUME_BUCKET = "Resumes";
const RUNS_TABLE = "resume_runs";
const STATUS = {
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed"
};
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
class HttpError extends Error {
  code;
  status;
  constructor(status, code, message){
    super(message);
    this.status = status;
    this.code = code;
  }
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function getEnv(name) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, "MISSING_ENV", `Missing environment variable: ${name}`);
  }
  return value;
}
function normalizeResumeText(bytes) {
  const decoded = new TextDecoder("utf-8", {
    fatal: false
  }).decode(bytes);
  return decoded.replace(/\u0000/g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000);
}
function extractAssistantText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part)=>{
      if (typeof part === "string") {
        return part;
      }
      if (typeof part === "object" && part && "text" in part) {
        const value = part.text;
        return typeof value === "string" ? value : "";
      }
      return "";
    }).join("\n").trim();
  }
  return "";
}
function buildJsonSchema() {
  return {
    name: "resume_run_output",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: {
          type: "string"
        },
        tailored_bullets: {
          type: "array",
          items: {
            type: "string"
          }
        },
        skills: {
          type: "array",
          items: {
            type: "string"
          }
        },
        missing_requirements: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },
      required: [
        "summary",
        "tailored_bullets",
        "skills",
        "missing_requirements"
      ]
    }
  };
}
async function callOpenAI(openAiApiKey, jobDescription, resumeText) {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: buildJsonSchema()
      },
      messages: [
        {
          role: "system",
          content: "You rewrite resumes to match job descriptions. Return only valid JSON that matches the schema."
        },
        {
          role: "user",
          content: [
            `Job description:\n${jobDescription}`,
            `Resume text:\n${resumeText || "[No extractable text available]"}`,
            "Create concise and ATS-friendly bullet points."
          ].join("\n\n")
        }
      ]
    })
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
  try {
    return JSON.parse(content);
  } catch  {
    throw new HttpError(502, "OPENAI_INVALID_JSON", "Model response was not valid JSON.");
  }
}
serve(async (req)=>{
  let adminClient = null;
  let runId = "";
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const openAiApiKey = getEnv("OPENAI_API_KEY");
    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? {
          Authorization: authHeader
        } : {}
      }
    });
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST.");
    }
    if (!authHeader) {
      throw new HttpError(401, "MISSING_AUTH", "Missing Authorization header.");
    }
    const body = await req.json();
    runId = body.run_id?.trim() ?? "";
    const resumePath = body.resume_path?.trim() ?? "";
    const jobDescriptionInput = body.job_description?.trim() ?? "";
    if (!runId || !resumePath || !jobDescriptionInput) {
      throw new HttpError(400, "INVALID_INPUT", "run_id, resume_path, and job_description are required.");
    }
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
    }
    const { data: run, error: runError } = await userClient.from(RUNS_TABLE).select("id, user_id, resume_path, job_description").eq("id", runId).single();
    if (runError || !run) {
      throw new HttpError(404, "RUN_NOT_FOUND", "Run not found.");
    }
    if (run.user_id !== user.id) {
      throw new HttpError(403, "FORBIDDEN", "Run does not belong to authenticated user.");
    }
    const canonicalResumePath = typeof run.resume_path === "string" && run.resume_path ? run.resume_path : resumePath;
    const canonicalJobDescription = typeof run.job_description === "string" && run.job_description.trim() ? run.job_description.trim() : jobDescriptionInput;
    const { data: fileBlob, error: downloadError } = await adminClient.storage.from(RESUME_BUCKET).download(canonicalResumePath);
    if (downloadError || !fileBlob) {
      throw new HttpError(500, "RESUME_DOWNLOAD_FAILED", downloadError?.message ?? "Could not read resume.");
    }
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const resumeText = normalizeResumeText(bytes);
    const output = await callOpenAI(openAiApiKey, canonicalJobDescription, resumeText);
    const { data: updatedRun, error: updateError } = await adminClient.from(RUNS_TABLE).update({
      status: STATUS.SUCCESS,
      output,
      error_code: null,
      error_message: null
    }).eq("id", runId).select("*").single();
    if (updateError || !updatedRun) {
      throw new HttpError(500, "RUN_UPDATE_FAILED", updateError?.message ?? "Could not update run.");
    }
    return jsonResponse({
      run: updatedRun
    }, 200);
  } catch (error) {
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = error instanceof HttpError ? error.message : "Unexpected function error.";
    const status = error instanceof HttpError ? error.status : 500;
    if (runId && adminClient) {
      await adminClient.from(RUNS_TABLE).update({
        status: STATUS.FAILED,
        error_code: code,
        error_message: message
      }).eq("id", runId);
    }
    return jsonResponse({
      error_code: code,
      error_message: message
    }, status);
  }
});

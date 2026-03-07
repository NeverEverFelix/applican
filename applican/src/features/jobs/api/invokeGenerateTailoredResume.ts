import { supabase } from "../../../lib/supabaseClient";
import type { GenerateTailoredResumeInput, GenerateTailoredResumeResponse } from "../model/types";

type EdgeFunctionErrorPayload = {
  error_code?: unknown;
  error_message?: unknown;
};

async function toGenerateTailoredResumeErrorMessage(error: unknown): Promise<string> {
  const fallback = "Failed to compile LaTeX.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const rawMessage = "message" in error && typeof error.message === "string" ? error.message : "";
  if (rawMessage.includes("Failed to send a request to the Edge Function")) {
    return "Failed to compile LaTeX: Edge Function unreachable. Deploy `generate-tailored-resume` and verify Supabase env values.";
  }

  const context = "context" in error ? error.context : null;
  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as EdgeFunctionErrorPayload | null;
    const errorCode = typeof payload?.error_code === "string" ? payload.error_code : "";
    const errorMessage = typeof payload?.error_message === "string" ? payload.error_message : "";

    if (errorCode === "RUN_NOT_FOUND") {
      return "Failed to compile LaTeX: run not found.";
    }

    if (errorCode === "RUN_OUTPUT_MISSING") {
      return "Failed to compile LaTeX: generate analysis output first.";
    }

    if (errorCode === "REQUEST_ID_MISMATCH") {
      return "Failed to compile LaTeX: stale request id for this run.";
    }

    if (errorMessage) {
      return `Failed to compile LaTeX: ${errorMessage}`;
    }

    if (rawMessage.trim()) {
      return `Failed to compile LaTeX: ${rawMessage}`;
    }

    return `${fallback} HTTP ${context.status}.`;
  }

  return rawMessage.trim() ? `Failed to compile LaTeX: ${rawMessage}` : fallback;
}

export async function invokeGenerateTailoredResume(
  payload: GenerateTailoredResumeInput,
): Promise<GenerateTailoredResumeResponse> {
  const runId = payload.runId.trim();
  const requestId = payload.requestId?.trim() ?? "";

  if (!runId) {
    throw new Error("Failed to compile LaTeX: run_id is required.");
  }

  const { data, error } = await supabase.functions.invoke("generate-tailored-resume", {
    body: {
      run_id: runId,
      request_id: requestId || undefined,
    },
  });

  if (error) {
    throw new Error(await toGenerateTailoredResumeErrorMessage(error));
  }

  if (!data || typeof data !== "object" || !("tailored_resume" in data)) {
    throw new Error("Failed to compile LaTeX: invalid response from function.");
  }

  return data as GenerateTailoredResumeResponse;
}

import { supabase } from "../../../lib/supabaseClient";

type CompileTailoredResumePdfInput = {
  latex: string;
  filename: string;
  runId?: string;
};

type CompileTailoredResumePdfResponse = {
  signed_url: string;
};

type CompileTailoredResumePdfErrorPayload = {
  error_code?: unknown;
  error_message?: unknown;
  compile_log?: unknown;
  compile?: unknown;
};

type CompileTailoredResumePdfError = Error & {
  errorCode?: string;
  compileLog?: string;
};

function extractCompileLog(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const root = payload as { compile_log?: unknown; compile?: unknown };
  if (typeof root.compile_log === "string" && root.compile_log.trim()) {
    return root.compile_log;
  }

  if (root.compile && typeof root.compile === "object") {
    const nested = root.compile as { compile_log?: unknown };
    if (typeof nested.compile_log === "string" && nested.compile_log.trim()) {
      return nested.compile_log;
    }
  }

  return "";
}

function toCompilePdfError(params: {
  message: string;
  errorCode?: string;
  compileLog?: string;
}): CompileTailoredResumePdfError {
  const error = new Error(params.message) as CompileTailoredResumePdfError;
  if (params.errorCode) {
    error.errorCode = params.errorCode;
  }
  if (params.compileLog) {
    error.compileLog = params.compileLog;
  }
  return error;
}

async function parseCompilePdfError(error: unknown): Promise<CompileTailoredResumePdfError> {
  const fallback = "Failed to compile PDF.";

  if (!error || typeof error !== "object") {
    return toCompilePdfError({ message: fallback });
  }

  const rawMessage = "message" in error && typeof error.message === "string" ? error.message.trim() : "";
  if (rawMessage.includes("Failed to send a request to the Edge Function")) {
    return toCompilePdfError({
      message: "Failed to compile PDF: Edge Function unreachable. Deploy `compile-tailored-resume-pdf` and verify Supabase env values.",
    });
  }

  const context = "context" in error ? error.context : null;
  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as CompileTailoredResumePdfErrorPayload | null;

    const errorCode = typeof payload?.error_code === "string" ? payload.error_code : "";
    const errorMessage = typeof payload?.error_message === "string" ? payload.error_message.trim() : "";
    const compileLog = extractCompileLog(payload);

    if (errorCode || errorMessage) {
      return toCompilePdfError({
        message: `Failed to compile PDF${errorCode ? ` (${errorCode})` : ""}: ${errorMessage || "Unknown compile error."}`,
        errorCode: errorCode || undefined,
        compileLog: compileLog || undefined,
      });
    }

    return toCompilePdfError({
      message: `${fallback} HTTP ${context.status}.`,
      compileLog: compileLog || undefined,
    });
  }

  return toCompilePdfError({
    message: rawMessage ? `Failed to compile PDF: ${rawMessage}` : fallback,
  });
}

export async function invokeCompileTailoredResumePdf(
  payload: CompileTailoredResumePdfInput,
): Promise<CompileTailoredResumePdfResponse> {
  const latex = payload.latex.trim();
  const filename = payload.filename.trim() || "tailored-resume.tex";
  const runId = payload.runId?.trim() || undefined;

  if (!latex) {
    throw toCompilePdfError({
      message: "Failed to compile PDF: editor is empty.",
    });
  }

  const { data, error } = await supabase.functions.invoke("compile-tailored-resume-pdf", {
    body: {
      latex,
      filename,
      run_id: runId,
    },
  });

  if (error) {
    throw await parseCompilePdfError(error);
  }

  if (!data || typeof data !== "object" || !("signed_url" in data) || typeof data.signed_url !== "string") {
    throw toCompilePdfError({
      message: "Failed to compile PDF: invalid function response.",
      compileLog: extractCompileLog(data),
    });
  }

  return data as CompileTailoredResumePdfResponse;
}

export type { CompileTailoredResumePdfError };

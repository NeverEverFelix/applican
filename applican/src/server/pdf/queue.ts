import type { SupabaseClient } from "@supabase/supabase-js";

export type PdfQueueRun = {
  id: string;
  request_id: string | null;
  user_id: string;
  status: string;
  output?: unknown;
  pdf_claimed_by?: string | null;
  pdf_claimed_at?: string | null;
  pdf_heartbeat_at?: string | null;
  pdf_attempt_count?: number | null;
};

export type PdfRunContext = {
  run: {
    id: string;
    request_id: string;
    user_id: string;
    status: string;
    output: unknown;
  };
};

export async function claimNextPdfRun(params: {
  supabase: SupabaseClient;
  claimedBy: string;
  leaseSeconds?: number;
}): Promise<PdfQueueRun | null> {
  const { supabase, claimedBy, leaseSeconds = 300 } = params;

  const { data, error } = await supabase.rpc("claim_next_pdf_run", {
    p_claimed_by: claimedBy,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    throw new Error(`Failed to claim PDF run: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as PdfQueueRun;
}

export async function resetStalePdfRuns(params: {
  supabase: SupabaseClient;
  staleSeconds?: number;
  limit?: number;
}): Promise<PdfQueueRun[]> {
  const { supabase, staleSeconds = 300, limit = 100 } = params;

  const { data, error } = await supabase.rpc("reset_stale_pdf_runs", {
    p_stale_seconds: staleSeconds,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to reset stale PDF runs: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data as PdfQueueRun[];
}

export async function heartbeatPdfRun(params: {
  supabase: SupabaseClient;
  runId: string;
  claimedBy: string;
}): Promise<void> {
  const { supabase, runId, claimedBy } = params;

  const { error } = await supabase
    .from("resume_runs")
    .update({
      pdf_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "compiling_pdf")
    .eq("pdf_claimed_by", claimedBy);

  if (error) {
    throw new Error(`Failed to heartbeat PDF run ${runId}: ${error.message}`);
  }
}

export async function loadPdfRunContext(params: {
  supabase: SupabaseClient;
  runId: string;
  claimedBy: string;
}): Promise<PdfRunContext> {
  const { supabase, runId, claimedBy } = params;

  const { data: run, error: runError } = await supabase
    .from("resume_runs")
    .select("id, request_id, user_id, status, output, pdf_claimed_by")
    .eq("id", runId)
    .eq("status", "compiling_pdf")
    .single();

  if (runError || !run) {
    throw new Error(`Failed to load PDF run ${runId}: ${runError?.message ?? "Run not found."}`);
  }

  if (run.pdf_claimed_by !== claimedBy) {
    throw new Error(`PDF run ${runId} is no longer claimed by ${claimedBy}.`);
  }

  return {
    run: {
      id: run.id,
      request_id: typeof run.request_id === "string" ? run.request_id : "",
      user_id: typeof run.user_id === "string" ? run.user_id : "",
      status: typeof run.status === "string" ? run.status : "",
      output: run.output ?? null,
    },
  };
}

export async function markPdfRunFailure(params: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
  errorCode: string;
  errorMessage: string;
}): Promise<void> {
  const { supabase, runId, userId, errorCode, errorMessage } = params;

  const { error } = await supabase
    .from("resume_runs")
    .update({
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to mark PDF run ${runId} failed: ${error.message}`);
  }
}

export async function savePdfStageMetrics(params: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
  existingOutput: unknown;
  metrics: {
    load_context_ms: number;
    prepare_inputs_ms: number;
    compile_pdf_ms: number;
  };
}): Promise<void> {
  const { supabase, runId, userId, existingOutput, metrics } = params;

  const baseOutput =
    existingOutput && typeof existingOutput === "object"
      ? { ...(existingOutput as Record<string, unknown>) }
      : {};

  const existingMeta =
    baseOutput.meta && typeof baseOutput.meta === "object"
      ? { ...(baseOutput.meta as Record<string, unknown>) }
      : {};

  const existingWorkerMetrics =
    existingMeta.worker_metrics && typeof existingMeta.worker_metrics === "object"
      ? { ...(existingMeta.worker_metrics as Record<string, unknown>) }
      : {};

  const nextOutput = {
    ...baseOutput,
    meta: {
      ...existingMeta,
      worker_metrics: {
        ...existingWorkerMetrics,
        pdf: {
          ...metrics,
          updated_at: new Date().toISOString(),
        },
      },
    },
  };

  const { error } = await supabase
    .from("resume_runs")
    .update({
      output: nextOutput,
      error_code: null,
      error_message: null,
    })
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to save PDF metrics for run ${runId}: ${error.message}`);
  }
}

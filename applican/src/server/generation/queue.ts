import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerationQueueRun = {
  id: string;
  request_id: string | null;
  user_id: string;
  status: string;
  job_description?: string | null;
  resume_path?: string | null;
  resume_filename?: string | null;
  output?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  generation_queued_at?: string | null;
  generation_claimed_by?: string | null;
  generation_claimed_at?: string | null;
  generation_heartbeat_at?: string | null;
  generation_attempt_count?: number | null;
};

export type GenerationRunContext = {
  run: {
    id: string;
    request_id: string;
    user_id: string;
    status: string;
    job_description: string;
    output: unknown;
    created_at: string;
    generation_queued_at: string | null;
    generation_claimed_at: string | null;
  };
  resumeDocument: {
    run_id: string;
    text: string;
  } | null;
};

export async function claimNextGenerateRun(params: {
  supabase: SupabaseClient;
  claimedBy: string;
  leaseSeconds?: number;
}): Promise<GenerationQueueRun | null> {
  const { supabase, claimedBy, leaseSeconds = 300 } = params;

  const { data, error } = await supabase.rpc("claim_next_generate_run", {
    p_claimed_by: claimedBy,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    throw new Error(`Failed to claim generate run: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as GenerationQueueRun;
}

export async function resetStaleGenerateRuns(params: {
  supabase: SupabaseClient;
  staleSeconds?: number;
  limit?: number;
}): Promise<GenerationQueueRun[]> {
  const { supabase, staleSeconds = 300, limit = 100 } = params;

  const { data, error } = await supabase.rpc("reset_stale_generate_runs", {
    p_stale_seconds: staleSeconds,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to reset stale generate runs: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data as GenerationQueueRun[];
}

export async function heartbeatGenerateRun(params: {
  supabase: SupabaseClient;
  runId: string;
  claimedBy: string;
}): Promise<void> {
  const { supabase, runId, claimedBy } = params;

  const { error } = await supabase
    .from("resume_runs")
    .update({
      generation_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "generating")
    .eq("generation_claimed_by", claimedBy);

  if (error) {
    throw new Error(`Failed to heartbeat generate run ${runId}: ${error.message}`);
  }
}

export type SavedGeneratedResume = {
  id: string;
  run_id: string;
  template: string;
  filename: string;
  created_at: string;
  updated_at: string;
};

export async function loadGenerationRunContext(params: {
  supabase: SupabaseClient;
  runId: string;
  claimedBy: string;
}): Promise<GenerationRunContext> {
  const { supabase, runId, claimedBy } = params;

  const { data: run, error: runError } = await supabase
    .from("resume_runs")
    .select(
      "id, request_id, user_id, status, job_description, output, created_at, generation_queued_at, generation_claimed_at, generation_claimed_by",
    )
    .eq("id", runId)
    .eq("status", "generating")
    .single();

  if (runError || !run) {
    throw new Error(`Failed to load generation run ${runId}: ${runError?.message ?? "Run not found."}`);
  }

  if (run.generation_claimed_by !== claimedBy) {
    throw new Error(`Generation run ${runId} is no longer claimed by ${claimedBy}.`);
  }

  const { data: resumeDocument, error: resumeDocumentError } = await supabase
    .from("resume_documents")
    .select("run_id, text")
    .eq("run_id", runId)
    .maybeSingle();

  if (resumeDocumentError) {
    throw new Error(
      `Failed to load resume document for generation run ${runId}: ${resumeDocumentError.message}`,
    );
  }

  return {
    run: {
      id: run.id,
      request_id: typeof run.request_id === "string" ? run.request_id : "",
      user_id: typeof run.user_id === "string" ? run.user_id : "",
      status: typeof run.status === "string" ? run.status : "",
      job_description: typeof run.job_description === "string" ? run.job_description : "",
      output: run.output ?? null,
      created_at: typeof run.created_at === "string" ? run.created_at : "",
      generation_queued_at:
        typeof run.generation_queued_at === "string" ? run.generation_queued_at : null,
      generation_claimed_at:
        typeof run.generation_claimed_at === "string" ? run.generation_claimed_at : null,
    },
    resumeDocument: resumeDocument
      ? {
          run_id: typeof resumeDocument.run_id === "string" ? resumeDocument.run_id : runId,
          text: typeof resumeDocument.text === "string" ? resumeDocument.text : "",
        }
      : null,
  };
}

export async function saveGeneratedRunOutput(params: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
  output: unknown;
}): Promise<void> {
  const { supabase, runId, userId, output } = params;

  const { error } = await supabase
    .from("resume_runs")
    .update({
      output,
      error_code: null,
      error_message: null,
    })
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to save generated output for run ${runId}: ${error.message}`);
  }
}

function buildCompletedRunOutput(params: {
  existingOutput: unknown;
  tailoredResume: {
    id: string;
    template: string;
    filename: string;
    latex: string;
  };
  metrics: {
    completed_by: string;
    queue_wait_ms: number | null;
    total_generation_ms: number | null;
    load_context_ms: number;
    prepare_inputs_ms: number;
    generate_bullets_ms: number;
    save_output_ms: number;
    build_tailored_resume_ms: number;
    save_generated_resume_ms: number;
  };
}): Record<string, unknown> {
  const { existingOutput, tailoredResume, metrics } = params;
  const baseOutput =
    existingOutput && typeof existingOutput === "object"
      ? { ...(existingOutput as Record<string, unknown>) }
      : {};

  const existingMeta =
    baseOutput.meta && typeof baseOutput.meta === "object"
      ? { ...(baseOutput.meta as Record<string, unknown>) }
      : {};

  return {
    ...baseOutput,
    tailored_resume: {
      id: tailoredResume.id,
      template: tailoredResume.template,
      generated_at: new Date().toISOString(),
      filename: tailoredResume.filename,
      latex: tailoredResume.latex,
    },
    meta: {
      ...existingMeta,
      worker_metrics: {
        generation: {
          ...metrics,
          updated_at: new Date().toISOString(),
        },
      },
    },
  };
}

export async function markGenerationRunFailure(params: {
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
    throw new Error(`Failed to mark generation run ${runId} failed: ${error.message}`);
  }
}

export async function completeGeneratedRun(params: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
  existingOutput: unknown;
  tailoredResume: {
    id: string;
    template: string;
    filename: string;
    latex: string;
  };
  metrics: {
    completed_by: string;
    queue_wait_ms: number | null;
    total_generation_ms: number | null;
    load_context_ms: number;
    prepare_inputs_ms: number;
    generate_bullets_ms: number;
    save_output_ms: number;
    build_tailored_resume_ms: number;
    save_generated_resume_ms: number;
  };
}): Promise<void> {
  const { supabase, runId, userId, existingOutput, tailoredResume, metrics } = params;

  const nextOutput = buildCompletedRunOutput({
    existingOutput,
    tailoredResume,
    metrics,
  });

  const { error } = await supabase
    .from("resume_runs")
    .update({
      status: "completed",
      output: nextOutput,
      error_code: null,
      error_message: null,
    })
    .eq("id", runId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to finalize completed generation run ${runId}: ${error.message}`);
  }
}

export async function saveGeneratedResumeArtifact(params: {
  supabase: SupabaseClient;
  runId: string;
  userId: string;
  requestId: string;
  template: string;
  filename: string;
  latex: string;
}): Promise<SavedGeneratedResume> {
  const { supabase, runId, userId, requestId, template, filename, latex } = params;

  const { data, error } = await supabase
    .from("generated_resumes")
    .upsert(
      {
        user_id: userId,
        run_id: runId,
        request_id: requestId || null,
        template,
        filename,
        latex,
      },
      {
        onConflict: "run_id,template",
      },
    )
    .select("id, run_id, template, filename, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save generated resume artifact for run ${runId}: ${error?.message ?? "Unknown error."}`,
    );
  }

  return data as SavedGeneratedResume;
}

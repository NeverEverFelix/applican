import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueGenerationJob } from "../queue/generationQueue.ts";

const STATUS_EXTRACTED = "extracted";
const STATUS_QUEUED_GENERATE = "queued_generate";

export type EnqueueGenerationRunResult = {
  run: {
    id: string;
    request_id: string;
    user_id: string;
    status: string;
    generation_queued_at: string | null;
  };
  enqueued: boolean;
};

export async function enqueueGenerationRun(params: {
  supabase: SupabaseClient;
  runId: string;
}): Promise<EnqueueGenerationRunResult> {
  const { supabase, runId } = params;
  const normalizedRunId = runId.trim();

  if (!normalizedRunId) {
    throw new Error("Failed to enqueue generation run: run id is required.");
  }

  const queuedAt = new Date().toISOString();
  const { data: updatedRun, error: updateError } = await supabase
    .from("resume_runs")
    .update({
      status: STATUS_QUEUED_GENERATE,
      generation_queued_at: queuedAt,
      error_code: null,
      error_message: null,
    })
    .eq("id", normalizedRunId)
    .eq("status", STATUS_EXTRACTED)
    .select("id, request_id, user_id, status, generation_queued_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to mark generation run queued: ${updateError.message}`);
  }

  if (updatedRun) {
    const requestId = typeof updatedRun.request_id === "string" ? updatedRun.request_id : "";
    const userId = typeof updatedRun.user_id === "string" ? updatedRun.user_id : "";
    const generationQueuedAt =
      typeof updatedRun.generation_queued_at === "string" ? updatedRun.generation_queued_at : queuedAt;

    await enqueueGenerationJob({
      runId: updatedRun.id,
      requestId,
      userId,
      enqueuedAt: generationQueuedAt,
    });

    return {
      run: {
        id: updatedRun.id,
        request_id: requestId,
        user_id: userId,
        status: typeof updatedRun.status === "string" ? updatedRun.status : STATUS_QUEUED_GENERATE,
        generation_queued_at: generationQueuedAt,
      },
      enqueued: true,
    };
  }

  const { data: existingRun, error: existingRunError } = await supabase
    .from("resume_runs")
    .select("id, request_id, user_id, status, generation_queued_at")
    .eq("id", normalizedRunId)
    .single();

  if (existingRunError || !existingRun) {
    throw new Error(
      `Failed to load generation run after enqueue attempt: ${existingRunError?.message ?? "Run not found."}`,
    );
  }

  return {
    run: {
      id: existingRun.id,
      request_id: typeof existingRun.request_id === "string" ? existingRun.request_id : "",
      user_id: typeof existingRun.user_id === "string" ? existingRun.user_id : "",
      status: typeof existingRun.status === "string" ? existingRun.status : "",
      generation_queued_at:
        typeof existingRun.generation_queued_at === "string" ? existingRun.generation_queued_at : null,
    },
    enqueued: false,
  };
}

import {
  completeGeneratedRun,
  heartbeatGenerateRun,
  loadGenerationRunContext,
  startGenerationRun,
  type GenerationFailureDetails,
  markGenerationRunFailure,
  saveGeneratedResumeArtifact,
} from "../../src/server/generation/queue.ts";
import {
  executeGenerateBullets,
  GenerateBulletsExecutionError,
} from "../../src/server/generation/executeGenerateBullets.ts";
import { executeTailoredResume } from "../../src/server/generation/executeTailoredResume.ts";
import { prepareGenerationInputs } from "../../src/server/generation/pipeline.ts";
import { measureStage } from "../../src/server/observability/timing.ts";
import {
  closeGenerationQueue,
  createGenerationWorker,
  type GenerationQueueJobData,
} from "../../src/server/queue/generationQueue.ts";
import { createAdminSupabaseClient } from "../../src/server/supabase/admin.ts";
import { buildParserDebug, parseExperienceSections } from "../../supabase/functions/generate-bullets/parser.ts";

function getWorkerIdentity(): string {
  return process.env.RENDER_INSTANCE_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    `local-${process.pid}`;
}

function buildWorkerSlotIdentity(slotIndex: number): string {
  const baseIdentity = getWorkerIdentity();
  if (slotIndex <= 0) {
    return `${baseIdentity}:${process.pid}`;
  }

  return `${baseIdentity}:${process.pid}:${slotIndex + 1}`;
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function diffMilliseconds(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) {
    return null;
  }

  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  return Math.max(0, endMs - startMs);
}

function diffMillisecondsFromNow(startedAt: string | null): number | null {
  if (!startedAt) {
    return null;
  }

  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) {
    return null;
  }

  return Math.max(0, Date.now() - startMs);
}

function buildFailureDetails(params: {
  error: unknown;
  claimedBy: string;
  requestId: string;
  queueWaitMs: number | null;
  totalGenerationMs: number | null;
}): GenerationFailureDetails {
  const { error, claimedBy, requestId, queueWaitMs, totalGenerationMs } = params;

  if (error instanceof GenerateBulletsExecutionError) {
    return {
      code: error.code,
      stage: error.stage,
      failed_by: claimedBy,
      request_id: requestId,
      queue_wait_ms: queueWaitMs,
      total_generation_ms: totalGenerationMs,
      http_status:
        typeof error.details.http_status === "number" ? error.details.http_status : null,
      http_status_text:
        typeof error.details.http_status_text === "string" ? error.details.http_status_text : null,
      provider_error_type:
        typeof error.details.provider_error_type === "string" ? error.details.provider_error_type : null,
      provider_error_code:
        typeof error.details.provider_error_code === "string" ? error.details.provider_error_code : null,
      content_length:
        typeof error.details.content_length === "number" ? error.details.content_length : null,
      content_preview:
        typeof error.details.content_preview === "string" ? error.details.content_preview : null,
      raw_type: typeof error.details.raw_type === "string" ? error.details.raw_type : null,
    };
  }

  return {
    code: "WORKER_GENERATION_FAILED",
    stage: "generation_worker",
    failed_by: claimedBy,
    request_id: requestId,
    queue_wait_ms: queueWaitMs,
    total_generation_ms: totalGenerationMs,
  };
}

function startHeartbeatLoop(params: {
  intervalMs: number;
  heartbeat: () => Promise<void>;
}): () => void {
  const timer = setInterval(() => {
    params.heartbeat().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown generation heartbeat failure.";
      console.error(`[generation-worker] ${message}`);
    });
  }, params.intervalMs);

  return () => {
    clearInterval(timer);
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function runBullMqGenerationJobOnce(params: {
  supabase: ReturnType<typeof createAdminSupabaseClient>;
  claimedBy: string;
  jobData: GenerationQueueJobData;
}): Promise<boolean> {
  const { supabase, claimedBy, jobData } = params;
  const heartbeatIntervalMs = getPositiveIntegerEnv("GENERATION_HEARTBEAT_INTERVAL_MS", 10_000);
  const normalizedRunId = jobData.runId.trim();

  if (!normalizedRunId) {
    throw new Error("Generation BullMQ job is missing runId.");
  }

  let activeRunId = "";
  let activeUserId = "";
  let activeRequestId = "";
  let activeGenerationClaimedAt: string | null = null;
  let activeQueueWaitMs: number | null = null;
  let activeOpenAiRoundtripMs: number | null = null;
  let activeModelNormalizeMs: number | null = null;

  const startedRun = await startGenerationRun({
    supabase,
    runId: normalizedRunId,
    claimedBy,
  });

  if (startedRun.kind === "noop") {
    console.info(
      `[generation-worker] Skipping BullMQ job for run ${normalizedRunId} because status is already ${startedRun.status}.`,
    );
    return false;
  }

  console.info(
    `[generation-worker] Started BullMQ run ${startedRun.run.id} for user ${startedRun.run.user_id} attempt ${startedRun.run.generation_attempt_count ?? "unknown"}.`,
  );

  activeRunId = startedRun.run.id;
  activeUserId = startedRun.run.user_id;
  activeRequestId = startedRun.run.request_id;
  activeGenerationClaimedAt = startedRun.run.generation_claimed_at;
  activeQueueWaitMs = diffMilliseconds(
    startedRun.run.generation_queued_at,
    startedRun.run.generation_claimed_at,
  );

  try {
    await heartbeatGenerateRun({
      supabase,
      runId: startedRun.run.id,
      claimedBy,
    });

    const stopHeartbeat = startHeartbeatLoop({
      intervalMs: heartbeatIntervalMs,
      heartbeat: () =>
        heartbeatGenerateRun({
          supabase,
          runId: startedRun.run.id,
          claimedBy,
        }),
    });

    try {
      const { result: context, durationMs: loadContextMs } = await measureStage(() =>
        loadGenerationRunContext({
          supabase,
          runId: startedRun.run.id,
          claimedBy,
        })
      );

      const queueWaitMs = diffMilliseconds(
        context.run.generation_queued_at,
        context.run.generation_claimed_at,
      );
      activeQueueWaitMs = queueWaitMs;

      console.info(
        `[generation-worker] Loaded BullMQ run ${context.run.id} context in ${loadContextMs}ms with queue wait ${queueWaitMs ?? "unknown"}ms.`,
      );

      const { result: preparedInputs, durationMs: prepareInputsMs } = await measureStage(() =>
        prepareGenerationInputs(context)
      );

      console.info(
        `[generation-worker] Prepared BullMQ run ${preparedInputs.runId} in ${prepareInputsMs}ms for request ${preparedInputs.requestId}.`,
      );

      const openAiApiKey = getRequiredEnv("OPENAI_API_KEY");
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
      const sourceExperienceSections = parseExperienceSections(preparedInputs.resumeText);
      const parserDebug = buildParserDebug(preparedInputs.resumeText, sourceExperienceSections);
      const { result: generatedBulletResult, durationMs: generateBulletsMs } = await measureStage(() =>
        executeGenerateBullets({
          openAiApiKey,
          model,
          jobDescription: preparedInputs.jobDescription,
          resumeText: preparedInputs.resumeText,
          requestId: preparedInputs.requestId,
          sourceExperienceSections,
          parserDebug,
        })
      );
      const generatedOutput = generatedBulletResult.output;
      const generationExecutionMetrics = generatedBulletResult.metrics;
      activeOpenAiRoundtripMs = generationExecutionMetrics.openai_roundtrip_ms;
      activeModelNormalizeMs = generationExecutionMetrics.model_normalize_ms;

      console.info(
        `[generation-worker] Generated BullMQ bullets for run ${preparedInputs.runId} in ${generateBulletsMs}ms (OpenAI ${generationExecutionMetrics.openai_roundtrip_ms}ms, normalize ${generationExecutionMetrics.model_normalize_ms}ms).`,
      );

      const { result: tailoredResume, durationMs: tailoredResumeMs } = await measureStage(() =>
        executeTailoredResume({
          runOutput: generatedOutput,
          resumeText: preparedInputs.resumeText,
        })
      );

      console.info(
        `[generation-worker] Built BullMQ tailored resume for run ${preparedInputs.runId} in ${tailoredResumeMs}ms as ${tailoredResume.filename}.`,
      );

      const { result: savedResume, durationMs: saveResumeMs } = await measureStage(() =>
        saveGeneratedResumeArtifact({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
          requestId: preparedInputs.requestId,
          template: tailoredResume.template,
          filename: tailoredResume.filename,
          latex: tailoredResume.latex,
        })
      );

      console.info(
        `[generation-worker] Saved BullMQ generated resume ${savedResume.id} for run ${preparedInputs.runId} in ${saveResumeMs}ms.`,
      );

      const totalGenerationMs = diffMillisecondsFromNow(context.run.generation_claimed_at);

      const { durationMs: completeRunMs } = await measureStage(() =>
        completeGeneratedRun({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
          existingOutput: generatedOutput,
          tailoredResume: {
            id: savedResume.id,
            template: tailoredResume.template,
            filename: tailoredResume.filename,
            latex: tailoredResume.latex,
          },
          metrics: {
            completed_by: claimedBy,
            queue_wait_ms: queueWaitMs,
            total_generation_ms: totalGenerationMs,
            load_context_ms: loadContextMs,
            prepare_inputs_ms: prepareInputsMs,
            generate_bullets_ms: generateBulletsMs,
            openai_roundtrip_ms: generationExecutionMetrics.openai_roundtrip_ms,
            model_normalize_ms: generationExecutionMetrics.model_normalize_ms,
            build_tailored_resume_ms: tailoredResumeMs,
            save_generated_resume_ms: saveResumeMs,
          },
        })
      );

      console.info(
        `[generation-worker] Completed BullMQ run ${preparedInputs.runId} in ${completeRunMs}ms with queue wait ${queueWaitMs ?? "unknown"}ms and total generation time ${totalGenerationMs ?? "unknown"}ms.`,
      );
    } finally {
      stopHeartbeat();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
    if (activeRunId && activeUserId) {
      const totalGenerationMs = diffMillisecondsFromNow(activeGenerationClaimedAt);
      const failureDetails = buildFailureDetails({
        error,
        claimedBy,
        requestId: activeRequestId,
        queueWaitMs: activeQueueWaitMs,
        totalGenerationMs,
      });
      if (activeOpenAiRoundtripMs !== null) {
        failureDetails.openai_roundtrip_ms = activeOpenAiRoundtripMs;
      }
      if (activeModelNormalizeMs !== null) {
        failureDetails.model_normalize_ms = activeModelNormalizeMs;
      }

      await markGenerationRunFailure({
        supabase,
        runId: activeRunId,
        userId: activeUserId,
        errorCode: failureDetails.code ?? "WORKER_GENERATION_FAILED",
        errorMessage: message,
        failureDetails,
      });
    }
    throw error;
  }

  return true;
}

async function startBullMqGenerationWorker(): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const claimedBy = buildWorkerSlotIdentity(0);
  const worker = createGenerationWorker(async (job) => {
    await runBullMqGenerationJobOnce({
      supabase,
      claimedBy,
      jobData: job.data,
    });
  });

  worker.on("active", (job) => {
    console.info(`[generation-worker] Processing BullMQ job ${job.id} for run ${job.data.runId}.`);
  });

  worker.on("completed", (job) => {
    console.info(`[generation-worker] Completed BullMQ job ${job.id} for run ${job.data.runId}.`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[generation-worker] BullMQ job ${job?.id ?? "unknown"} for run ${job?.data.runId ?? "unknown"} failed: ${error.message}`,
    );
  });

  const shutdown = async () => {
    await worker.close();
    await closeGenerationQueue();
  };

  process.once("SIGINT", () => {
    shutdown().catch((error) => {
      console.error(`[generation-worker] Failed BullMQ shutdown: ${error instanceof Error ? error.message : "Unknown error."}`);
    });
  });

  process.once("SIGTERM", () => {
    shutdown().catch((error) => {
      console.error(`[generation-worker] Failed BullMQ shutdown: ${error instanceof Error ? error.message : "Unknown error."}`);
    });
  });
}

export async function startGenerationWorker() {
  console.info("[generation-worker] Starting BullMQ generation worker.");
  await startBullMqGenerationWorker();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGenerationWorker().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
    console.error(`[generation-worker] ${message}`);
    process.exitCode = 1;
  });
}

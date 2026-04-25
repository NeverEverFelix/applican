import {
  claimNextGenerateRun,
  completeGeneratedRun,
  heartbeatGenerateRun,
  loadGenerationRunContext,
  type GenerationFailureDetails,
  markGenerationRunFailure,
  recordCompletionFinalizeMetric,
  requeueGenerationRun,
  resetStaleGenerateRuns,
  saveGeneratedResumeArtifact,
} from "../../src/server/generation/queue.ts";
import {
  executeGenerateBullets,
  GenerateBulletsExecutionError,
} from "../../src/server/generation/executeGenerateBullets.ts";
import { executeTailoredResume } from "../../src/server/generation/executeTailoredResume.ts";
import { prepareGenerationInputs } from "../../src/server/generation/pipeline.ts";
import { measureStage } from "../../src/server/observability/timing.ts";
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let activeGenerations = 0;

function getGenerationActiveCap(rawConcurrency: number): number {
  const configuredCap = getPositiveIntegerEnv("GENERATION_ACTIVE_CAP", rawConcurrency);
  return Math.max(1, Math.min(rawConcurrency, configuredCap));
}

function tryAcquireGenerationPermit(cap: number): boolean {
  if (activeGenerations >= cap) {
    return false;
  }

  activeGenerations += 1;
  return true;
}

function releaseGenerationPermit(): void {
  activeGenerations = Math.max(0, activeGenerations - 1);
}

function getCurrentActiveGenerations(): number {
  return activeGenerations;
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

function isRetryableGenerationFailure(error: unknown): boolean {
  if (!(error instanceof GenerateBulletsExecutionError)) {
    return false;
  }

  if (error.code === "OPENAI_NETWORK_ERROR") {
    return true;
  }

  if (error.code !== "OPENAI_HTTP_ERROR") {
    return false;
  }

  const httpStatus = typeof error.details.http_status === "number" ? error.details.http_status : null;
  return httpStatus === 429 || (httpStatus !== null && httpStatus >= 500 && httpStatus < 600);
}

function buildGenerationRetryDelayMs(attemptCount: number): number {
  const baseDelayMs = getPositiveIntegerEnv("GENERATION_RETRY_BASE_DELAY_MS", 5_000);
  return baseDelayMs * Math.max(1, attemptCount);
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

export async function runGenerationWorkerOnce() {
  const supabase = createAdminSupabaseClient();
  const claimedBy = buildWorkerSlotIdentity(0);
  return runGenerationWorkerSlotOnce({
    supabase,
    claimedBy,
  });
}

async function runGenerationWorkerSlotOnce(params: {
  supabase: ReturnType<typeof createAdminSupabaseClient>;
  claimedBy: string;
}): Promise<boolean> {
  const { supabase, claimedBy } = params;
  const staleSeconds = getPositiveIntegerEnv("GENERATION_STALE_SECONDS", 300);
  const staleLimit = getPositiveIntegerEnv("GENERATION_STALE_LIMIT", 25);
  const heartbeatIntervalMs = Math.max(1_000, Math.floor((staleSeconds * 1000) / 3));
  let activeRunId = "";
  let activeUserId = "";
  let activeRequestId = "";
  let activeGenerationClaimedAt: string | null = null;
  let activeQueueWaitMs: number | null = null;
  let activeOpenAiRoundtripMs: number | null = null;
  let activeModelNormalizeMs: number | null = null;
  let activeParserPrepMs: number | null = null;
  let activeSaveGeneratedResumeMs: number | null = null;
  let activeFinalizeRunMs: number | null = null;
  let activeGenerationAttemptCount: number | null = null;
  let activeGenerationsAtStart = getCurrentActiveGenerations();

  const resetRuns = await resetStaleGenerateRuns({
    supabase,
    staleSeconds,
    limit: staleLimit,
  });

  if (resetRuns.length > 0) {
    console.info(
      `[generation-worker] Reset ${resetRuns.length} stale generation run(s) before claiming new work.`,
    );
  }

  const run = await claimNextGenerateRun({
    supabase,
    claimedBy,
    leaseSeconds: staleSeconds,
  });

  if (!run) {
    return false;
  }

  console.info(
    `[generation-worker] Claimed run ${run.id} for user ${run.user_id} with status ${run.status}.`,
  );
  activeRunId = run.id;
  activeUserId = run.user_id;

  try {
    await heartbeatGenerateRun({
      supabase,
      runId: run.id,
      claimedBy,
    });

    console.info(`[generation-worker] Heartbeat recorded for run ${run.id}.`);
    const stopHeartbeat = startHeartbeatLoop({
      intervalMs: heartbeatIntervalMs,
      heartbeat: () =>
        heartbeatGenerateRun({
          supabase,
          runId: run.id,
          claimedBy,
        }),
    });

    try {
      const { result: context, durationMs: loadContextMs } = await measureStage(() =>
        loadGenerationRunContext({
          supabase,
          runId: run.id,
          claimedBy,
        })
      );

      activeUserId = context.run.user_id;
      activeRequestId = context.run.request_id;
      activeGenerationClaimedAt = context.run.generation_claimed_at;
      activeGenerationAttemptCount = context.run.generation_attempt_count;
      const queueWaitMs = diffMilliseconds(
        context.run.generation_queued_at,
        context.run.generation_claimed_at,
      );
      activeQueueWaitMs = queueWaitMs;

      console.info(
        `[generation-worker] Loaded run ${context.run.id} context in ${loadContextMs}ms with queue wait ${queueWaitMs ?? "unknown"}ms, job description length ${context.run.job_description.length}, and resume text length ${context.resumeDocument?.text.length ?? 0}.`,
      );

      const { result: preparedInputs, durationMs: prepareInputsMs } = await measureStage(() =>
        prepareGenerationInputs(context)
      );

      console.info(
        `[generation-worker] Prepared run ${preparedInputs.runId} for generation with request ${preparedInputs.requestId} in ${prepareInputsMs}ms.`,
      );

      const openAiApiKey = getRequiredEnv("OPENAI_API_KEY");
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1";
      const { result: parserInputs, durationMs: parserPrepMs } = await measureStage(() => {
        const sourceExperienceSections = parseExperienceSections(preparedInputs.resumeText);
        const parserDebug = buildParserDebug(preparedInputs.resumeText, sourceExperienceSections);
        return {
          sourceExperienceSections,
          parserDebug,
        };
      });
      activeParserPrepMs = parserPrepMs;
      const sourceExperienceSections = parserInputs.sourceExperienceSections;
      const parserDebug = parserInputs.parserDebug;
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
        `[generation-worker] Generated bullets for run ${preparedInputs.runId} in ${generateBulletsMs}ms (parser ${parserPrepMs}ms, OpenAI ${generationExecutionMetrics.openai_roundtrip_ms}ms, normalize ${generationExecutionMetrics.model_normalize_ms}ms) with match score ${generatedOutput.match.score} and active generations ${activeGenerationsAtStart}.`,
      );

      const { result: tailoredResume, durationMs: tailoredResumeMs } = await measureStage(() =>
        executeTailoredResume({
          runOutput: generatedOutput,
          resumeText: preparedInputs.resumeText,
        })
      );

      console.info(
        `[generation-worker] Built tailored resume for run ${preparedInputs.runId} in ${tailoredResumeMs}ms as ${tailoredResume.filename}.`,
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
      activeSaveGeneratedResumeMs = saveResumeMs;

      console.info(
        `[generation-worker] Saved generated resume ${savedResume.id} for run ${preparedInputs.runId} in ${saveResumeMs}ms.`,
      );

      const totalGenerationMs = diffMillisecondsFromNow(context.run.generation_claimed_at);

      const { result: completionResult, durationMs: completeRunMs } = await measureStage(() =>
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
            generation_attempt_count: context.run.generation_attempt_count,
            active_generations_at_start: activeGenerationsAtStart,
            queue_wait_ms: queueWaitMs,
            total_generation_ms: totalGenerationMs,
            load_context_ms: loadContextMs,
            prepare_inputs_ms: prepareInputsMs,
            parser_prep_ms: parserPrepMs,
            generate_bullets_ms: generateBulletsMs,
            openai_roundtrip_ms: generationExecutionMetrics.openai_roundtrip_ms,
            model_normalize_ms: generationExecutionMetrics.model_normalize_ms,
            build_tailored_resume_ms: tailoredResumeMs,
            save_generated_resume_ms: saveResumeMs,
          },
        })
      );
      activeFinalizeRunMs = completeRunMs;
      if (completionResult.applied) {
        await recordCompletionFinalizeMetric({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
          finalizeRunMs: completeRunMs,
        });
      }

      console.info(
        `[generation-worker] Finalized run ${preparedInputs.runId} in ${completeRunMs}ms with total generation time ${totalGenerationMs ?? "unknown"}ms${completionResult.applied ? "" : " (no-op finalization because run was already finalized)"}.`,
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
      if (activeParserPrepMs !== null) {
        failureDetails.parser_prep_ms = activeParserPrepMs;
      }
      if (activeSaveGeneratedResumeMs !== null) {
        failureDetails.save_generated_resume_ms = activeSaveGeneratedResumeMs;
      }
      if (activeFinalizeRunMs !== null) {
        failureDetails.finalize_run_ms = activeFinalizeRunMs;
      }
      if (activeGenerationAttemptCount !== null) {
        failureDetails.generation_attempt_count = activeGenerationAttemptCount;
      }

      console.error(
        JSON.stringify({
          level: "error",
          code: failureDetails.code ?? "WORKER_GENERATION_FAILED",
          message,
          run_id: activeRunId,
          user_id: activeUserId,
          request_id: activeRequestId || null,
          ...failureDetails,
        }),
      );

      const maxJobRetries = getPositiveIntegerEnv("GENERATION_MAX_JOB_RETRIES", 0);
      const attemptCount = activeGenerationAttemptCount ?? 1;
      if (isRetryableGenerationFailure(error) && attemptCount <= maxJobRetries) {
        const retryDelayMs = buildGenerationRetryDelayMs(attemptCount);
        const retryAt = new Date(Date.now() + retryDelayMs).toISOString();
        await requeueGenerationRun({
          supabase,
          runId: activeRunId,
          userId: activeUserId,
          errorCode: failureDetails.code ?? "WORKER_GENERATION_FAILED",
          errorMessage: message,
          retryAt,
          retryDetails: {
            code: failureDetails.code ?? "WORKER_GENERATION_FAILED",
            message,
            retry_scheduled_at: retryAt,
            retry_delay_ms: retryDelayMs,
            attempt_count: attemptCount,
          },
        });
      } else {
        await markGenerationRunFailure({
          supabase,
          runId: activeRunId,
          userId: activeUserId,
          errorCode: failureDetails.code ?? "WORKER_GENERATION_FAILED",
          errorMessage: message,
          failureDetails,
        });
      }
    }
    throw error;
  }

  return true;
}

async function startGenerationWorkerSlot(params: {
  slotIndex: number;
  pollIntervalMs: number;
  activeCap: number;
}): Promise<void> {
  const { slotIndex, pollIntervalMs, activeCap } = params;
  const supabase = createAdminSupabaseClient();
  const claimedBy = buildWorkerSlotIdentity(slotIndex);

  console.info(`[generation-worker] Started slot ${slotIndex + 1} as ${claimedBy}.`);

  while (true) {
    if (!tryAcquireGenerationPermit(activeCap)) {
      await delay(pollIntervalMs);
      continue;
    }

    try {
      const claimedWork = await runGenerationWorkerSlotOnce({
        supabase,
        claimedBy,
      });

      if (!claimedWork) {
        await delay(pollIntervalMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
      console.error(`[generation-worker] slot ${slotIndex + 1} ${message}`);
      await delay(pollIntervalMs);
    } finally {
      releaseGenerationPermit();
    }
  }
}

export async function startGenerationWorker() {
  const pollIntervalMs = getPositiveIntegerEnv("GENERATION_POLL_INTERVAL_MS", 5000);
  const concurrency = getPositiveIntegerEnv("GENERATION_WORKER_CONCURRENCY", 1);
  const activeCap = getGenerationActiveCap(concurrency);

  console.info(
    `[generation-worker] Starting ${concurrency} slot(s) with poll interval ${pollIntervalMs}ms and active cap ${activeCap}.`,
  );

  await Promise.all(
    Array.from({ length: concurrency }, (_, slotIndex) =>
      startGenerationWorkerSlot({
        slotIndex,
        pollIntervalMs,
        activeCap,
      })
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGenerationWorker().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
    console.error(`[generation-worker] ${message}`);
    process.exitCode = 1;
  });
}

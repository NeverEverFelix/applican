import {
  claimNextGenerateRun,
  heartbeatGenerateRun,
  loadGenerationRunContext,
  markRunCompleted,
  markGenerationRunFailure,
  mergeTailoredResumeIntoRunOutput,
  resetStaleGenerateRuns,
  saveGeneratedResumeArtifact,
  saveGenerationStageMetrics,
  saveGeneratedRunOutput,
} from "../../src/server/generation/queue.ts";
import { executeGenerateBullets } from "../../src/server/generation/executeGenerateBullets.ts";
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
  const claimedBy = getWorkerIdentity();
  const staleSeconds = getPositiveIntegerEnv("GENERATION_STALE_SECONDS", 300);
  const staleLimit = getPositiveIntegerEnv("GENERATION_STALE_LIMIT", 25);
  const heartbeatIntervalMs = Math.max(1_000, Math.floor((staleSeconds * 1000) / 3));
  let activeRunId = "";
  let activeUserId = "";

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
    console.info(`[generation-worker] No queued generation runs available for ${claimedBy}.`);
    return;
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

      console.info(
        `[generation-worker] Loaded run ${context.run.id} context in ${loadContextMs}ms with job description length ${context.run.job_description.length} and resume text length ${context.resumeDocument?.text.length ?? 0}.`,
      );

      const { result: preparedInputs, durationMs: prepareInputsMs } = await measureStage(() =>
        prepareGenerationInputs(context)
      );

      console.info(
        `[generation-worker] Prepared run ${preparedInputs.runId} for generation with request ${preparedInputs.requestId} in ${prepareInputsMs}ms.`,
      );

      const openAiApiKey = getRequiredEnv("OPENAI_API_KEY");
      const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
      const sourceExperienceSections = parseExperienceSections(preparedInputs.resumeText);
      const parserDebug = buildParserDebug(preparedInputs.resumeText, sourceExperienceSections);
      const { result: generatedOutput, durationMs: generateBulletsMs } = await measureStage(() =>
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

      console.info(
        `[generation-worker] Generated bullets for run ${preparedInputs.runId} in ${generateBulletsMs}ms with match score ${generatedOutput.match.score}.`,
      );

      const { durationMs: saveOutputMs } = await measureStage(() =>
        saveGeneratedRunOutput({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
          output: generatedOutput,
        })
      );

      console.info(
        `[generation-worker] Saved generated output for run ${preparedInputs.runId} in ${saveOutputMs}ms.`,
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

      console.info(
        `[generation-worker] Saved generated resume ${savedResume.id} for run ${preparedInputs.runId} in ${saveResumeMs}ms.`,
      );

      const { durationMs: mergeOutputMs } = await measureStage(() =>
        mergeTailoredResumeIntoRunOutput({
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
        })
      );

      console.info(
        `[generation-worker] Merged tailored resume metadata into run ${preparedInputs.runId} output in ${mergeOutputMs}ms.`,
      );

      const { durationMs: markCompletedMs } = await measureStage(() =>
        markRunCompleted({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
        })
      );

      console.info(
        `[generation-worker] Marked run ${preparedInputs.runId} completed in ${markCompletedMs}ms.`,
      );

      const { durationMs: saveMetricsMs } = await measureStage(() =>
        saveGenerationStageMetrics({
          supabase,
          runId: preparedInputs.runId,
          userId: preparedInputs.userId,
          existingOutput: {
            ...generatedOutput,
            tailored_resume: {
              id: savedResume.id,
              template: tailoredResume.template,
              generated_at: new Date().toISOString(),
              filename: tailoredResume.filename,
              latex: tailoredResume.latex,
            },
          },
          metrics: {
            load_context_ms: loadContextMs,
            prepare_inputs_ms: prepareInputsMs,
            generate_bullets_ms: generateBulletsMs,
            save_output_ms: saveOutputMs,
            build_tailored_resume_ms: tailoredResumeMs,
            save_generated_resume_ms: saveResumeMs,
            merge_tailored_resume_ms: mergeOutputMs,
            mark_completed_ms: markCompletedMs,
          },
        })
      );

      console.info(
        `[generation-worker] Saved generation stage metrics for run ${preparedInputs.runId} in ${saveMetricsMs}ms.`,
      );
    } finally {
      stopHeartbeat();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
    if (activeRunId && activeUserId) {
      await markGenerationRunFailure({
        supabase,
        runId: activeRunId,
        userId: activeUserId,
        errorCode: "WORKER_GENERATION_FAILED",
        errorMessage: message,
      });
    }
    throw error;
  }
}

export async function startGenerationWorker() {
  const pollIntervalMs = getPositiveIntegerEnv("GENERATION_POLL_INTERVAL_MS", 5000);

  while (true) {
    try {
      await runGenerationWorkerOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
      console.error(`[generation-worker] ${message}`);
    }
    await delay(pollIntervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGenerationWorker().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown generation worker failure.";
    console.error(`[generation-worker] ${message}`);
    process.exitCode = 1;
  });
}

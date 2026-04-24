import {
  claimNextPdfRun,
  heartbeatPdfRun,
  loadPdfRunContext,
  markPdfRunFailure,
  resetStalePdfRuns,
  savePdfStageMetrics,
} from "../../src/server/pdf/queue.ts";
import { executePdfCompile } from "../../src/server/pdf/executePdfCompile.ts";
import { preparePdfInputs } from "../../src/server/pdf/pipeline.ts";
import { measureStage } from "../../src/server/observability/timing.ts";
import { createAdminSupabaseClient } from "../../src/server/supabase/admin.ts";

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

export async function runPdfWorkerOnce() {
  const supabase = createAdminSupabaseClient();
  const claimedBy = getWorkerIdentity();
  const staleSeconds = getPositiveIntegerEnv("PDF_STALE_SECONDS", 300);
  const staleLimit = getPositiveIntegerEnv("PDF_STALE_LIMIT", 25);
  let activeRunId = "";
  let activeUserId = "";

  const resetRuns = await resetStalePdfRuns({
    supabase,
    staleSeconds,
    limit: staleLimit,
  });

  if (resetRuns.length > 0) {
    console.info(
      `[pdf-worker] Reset ${resetRuns.length} stale PDF run(s) before claiming new work.`,
    );
  }

  const run = await claimNextPdfRun({
    supabase,
    claimedBy,
    leaseSeconds: staleSeconds,
  });

  if (!run) {
    console.info(`[pdf-worker] No queued PDF runs available for ${claimedBy}.`);
    return;
  }

  console.info(
    `[pdf-worker] Claimed run ${run.id} for user ${run.user_id} with status ${run.status}.`,
  );
  activeRunId = run.id;
  activeUserId = run.user_id;

  try {
    await heartbeatPdfRun({
      supabase,
      runId: run.id,
      claimedBy,
    });

    console.info(`[pdf-worker] Heartbeat recorded for run ${run.id}.`);

    const { result: context, durationMs: loadContextMs } = await measureStage(() =>
      loadPdfRunContext({
        supabase,
        runId: run.id,
        claimedBy,
      })
    );

    activeUserId = context.run.user_id;

    console.info(
      `[pdf-worker] Loaded run ${context.run.id} context in ${loadContextMs}ms with output present: ${context.run.output != null}.`,
    );

    const { result: preparedInputs, durationMs: prepareInputsMs } = await measureStage(() =>
      preparePdfInputs(context)
    );

    console.info(
      `[pdf-worker] Prepared run ${preparedInputs.runId} for PDF compile with file ${preparedInputs.filename} in ${prepareInputsMs}ms.`,
    );

    const { result: compileResult, durationMs: compileMs } = await measureStage(() =>
      executePdfCompile({
        runId: preparedInputs.runId,
      })
    );

    console.info(
      `[pdf-worker] Compiled PDF for run ${preparedInputs.runId} in ${compileMs}ms to ${compileResult.path}.`,
    );

    const { durationMs: saveMetricsMs } = await measureStage(() =>
      savePdfStageMetrics({
        supabase,
        runId: preparedInputs.runId,
        userId: preparedInputs.userId,
        existingOutput: context.run.output,
        metrics: {
          load_context_ms: loadContextMs,
          prepare_inputs_ms: prepareInputsMs,
          compile_pdf_ms: compileMs,
        },
      })
    );

    console.info(
      `[pdf-worker] Saved PDF stage metrics for run ${preparedInputs.runId} in ${saveMetricsMs}ms.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF worker failure.";
    if (activeRunId && activeUserId) {
      await markPdfRunFailure({
        supabase,
        runId: activeRunId,
        userId: activeUserId,
        errorCode: "WORKER_PDF_FAILED",
        errorMessage: message,
      });
    }
    throw error;
  }
}

export async function startPdfWorker() {
  const pollIntervalMs = getPositiveIntegerEnv("PDF_POLL_INTERVAL_MS", 5000);

  while (true) {
    await runPdfWorkerOnce();
    await delay(pollIntervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startPdfWorker().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown PDF worker failure.";
    console.error(`[pdf-worker] ${message}`);
    process.exitCode = 1;
  });
}

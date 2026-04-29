import { listQueuedGenerationRuns } from "../../src/server/generation/queue.ts";
import { enqueueGenerationJob } from "../../src/server/queue/generationQueue.ts";
import { createAdminSupabaseClient } from "../../src/server/supabase/admin.ts";

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

async function enqueueQueuedRunsOnce(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const batchSize = getPositiveIntegerEnv("GENERATION_ENQUEUER_BATCH_SIZE", 25);
  const queuedRuns = await listQueuedGenerationRuns({
    supabase,
    limit: batchSize,
  });

  if (queuedRuns.length === 0) {
    return 0;
  }

  let enqueuedCount = 0;
  for (const run of queuedRuns) {
    const result = await enqueueGenerationJob({
      runId: run.id,
      userId: run.user_id,
      requestId: typeof run.request_id === "string" ? run.request_id : "",
      enqueuedAt: typeof run.generation_queued_at === "string" ? run.generation_queued_at : undefined,
    });
    if (result.created) {
      enqueuedCount += 1;
    }
  }

  if (enqueuedCount > 0) {
    console.info(
      `[generation-enqueuer] Enqueued ${enqueuedCount} queued generation run(s) into BullMQ.`,
    );
  }

  return enqueuedCount;
}

export async function startGenerationEnqueuer(): Promise<void> {
  const pollIntervalMs = getPositiveIntegerEnv("GENERATION_ENQUEUER_POLL_INTERVAL_MS", 1_000);

  console.info(
    `[generation-enqueuer] Starting with poll interval ${pollIntervalMs}ms.`,
  );

  while (true) {
    try {
      await enqueueQueuedRunsOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation enqueuer failure.";
      console.error(`[generation-enqueuer] ${message}`);
    }

    await delay(pollIntervalMs);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startGenerationEnqueuer().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown generation enqueuer failure.";
    console.error(`[generation-enqueuer] ${message}`);
    process.exitCode = 1;
  });
}

import { createAdminSupabaseClient } from "../src/server/supabase/admin.ts";

type GenerationMetrics = {
  completed_by?: string;
  queue_wait_ms?: number | null;
  total_generation_ms?: number | null;
  generate_bullets_ms?: number | null;
  openai_roundtrip_ms?: number | null;
  model_normalize_ms?: number | null;
};

type ResumeRunRow = {
  id: string;
  created_at: string;
  output: unknown;
};

function getNumberFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const rawValue = process.argv[index + 1];
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatMs(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value)}ms`;
}

function readGenerationMetrics(output: unknown): GenerationMetrics | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const meta = (output as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const workerMetrics = (meta as Record<string, unknown>).worker_metrics;
  if (!workerMetrics || typeof workerMetrics !== "object") {
    return null;
  }

  const generation = (workerMetrics as Record<string, unknown>).generation;
  if (!generation || typeof generation !== "object") {
    return null;
  }

  return generation as GenerationMetrics;
}

async function main() {
  const limit = getNumberFlag("--limit", 100);
  const slowest = getNumberFlag("--slowest", 10);
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("resume_runs")
    .select("id, created_at, output")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load completed runs: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as ResumeRunRow[]) : [];
  const runs = rows
    .map((row) => {
      const metrics = readGenerationMetrics(row.output);
      return metrics
        ? {
            id: row.id,
            created_at: row.created_at,
            completed_by: metrics.completed_by ?? "unknown",
            queue_wait_ms: metrics.queue_wait_ms ?? null,
            total_generation_ms: metrics.total_generation_ms ?? null,
            generate_bullets_ms: metrics.generate_bullets_ms ?? null,
            openai_roundtrip_ms: metrics.openai_roundtrip_ms ?? null,
            model_normalize_ms: metrics.model_normalize_ms ?? null,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const totalGenerationValues = runs
    .map((run) => run.total_generation_ms)
    .filter((value): value is number => typeof value === "number");
  const generateBulletsValues = runs
    .map((run) => run.generate_bullets_ms)
    .filter((value): value is number => typeof value === "number");
  const queueWaitValues = runs
    .map((run) => run.queue_wait_ms)
    .filter((value): value is number => typeof value === "number");
  const openAiRoundtripValues = runs
    .map((run) => run.openai_roundtrip_ms)
    .filter((value): value is number => typeof value === "number");
  const modelNormalizeValues = runs
    .map((run) => run.model_normalize_ms)
    .filter((value): value is number => typeof value === "number");

  console.log(`Completed runs scanned: ${rows.length}`);
  console.log(`Runs with generation metrics: ${runs.length}`);
  console.log(`Total generation: avg ${formatMs(average(totalGenerationValues))}, p50 ${formatMs(percentile(totalGenerationValues, 0.5))}, p95 ${formatMs(percentile(totalGenerationValues, 0.95))}`);
  console.log(`Generate bullets: avg ${formatMs(average(generateBulletsValues))}, p50 ${formatMs(percentile(generateBulletsValues, 0.5))}, p95 ${formatMs(percentile(generateBulletsValues, 0.95))}`);
  console.log(`OpenAI roundtrip: avg ${formatMs(average(openAiRoundtripValues))}, p50 ${formatMs(percentile(openAiRoundtripValues, 0.5))}, p95 ${formatMs(percentile(openAiRoundtripValues, 0.95))}`);
  console.log(`Model normalize: avg ${formatMs(average(modelNormalizeValues))}, p50 ${formatMs(percentile(modelNormalizeValues, 0.5))}, p95 ${formatMs(percentile(modelNormalizeValues, 0.95))}`);
  console.log(`Queue wait: avg ${formatMs(average(queueWaitValues))}, p50 ${formatMs(percentile(queueWaitValues, 0.5))}, p95 ${formatMs(percentile(queueWaitValues, 0.95))}`);

  const slowestRuns = runs
    .filter((run) => typeof run.total_generation_ms === "number")
    .sort((left, right) => (right.total_generation_ms ?? 0) - (left.total_generation_ms ?? 0))
    .slice(0, slowest);

  if (slowestRuns.length === 0) {
    return;
  }

  console.log("");
  console.log(`Slowest ${slowestRuns.length} runs by total_generation_ms:`);
  for (const run of slowestRuns) {
    console.log(
      `${run.id} ${formatMs(run.total_generation_ms)} bullets=${formatMs(run.generate_bullets_ms)} openai=${formatMs(run.openai_roundtrip_ms ?? null)} normalize=${formatMs(run.model_normalize_ms ?? null)} queue=${formatMs(run.queue_wait_ms)} completed_by=${run.completed_by} created_at=${run.created_at}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown generation metrics failure.";
  console.error(`[generation-metrics] ${message}`);
  process.exitCode = 1;
});

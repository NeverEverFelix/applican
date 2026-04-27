import type { JobsOptions } from "bullmq";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRedisUrl(): string {
  const redisUrl = readEnv("REDIS_URL");
  if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }

  return redisUrl;
}

export function getBullMqPrefix(): string {
  return readEnv("BULLMQ_PREFIX") ?? "applican";
}

export function getGenerationQueueDefaultJobOptions(): JobsOptions {
  return {
    attempts: readPositiveIntegerEnv("GENERATION_QUEUE_ATTEMPTS", 3),
    backoff: {
      type: "exponential",
      delay: readPositiveIntegerEnv("GENERATION_QUEUE_BACKOFF_MS", 5_000),
    },
    removeOnComplete: {
      count: readPositiveIntegerEnv("GENERATION_QUEUE_REMOVE_ON_COMPLETE_COUNT", 500),
    },
    removeOnFail: {
      count: readPositiveIntegerEnv("GENERATION_QUEUE_REMOVE_ON_FAIL_COUNT", 1_000),
    },
  };
}

export function getGenerationWorkerConcurrency(): number {
  return readPositiveIntegerEnv("GENERATION_WORKER_CONCURRENCY", 1);
}

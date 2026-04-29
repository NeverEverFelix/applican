import { Queue, type JobsOptions, type Processor, Worker } from "bullmq";
import {
  getBullMqPrefix,
  getGenerationQueueDefaultJobOptions,
  getGenerationWorkerConcurrency,
  getRedisUrl,
} from "./bullmq.ts";

export const GENERATION_QUEUE_NAME = "generation";

export type GenerationQueueJobData = {
  runId: string;
  userId?: string;
  requestId?: string;
  enqueuedAt?: string;
  schemaVersion?: number;
};

export type EnqueueGenerationJobResult = {
  created: boolean;
  jobId: string;
};

let generationQueue: Queue<GenerationQueueJobData> | null = null;

function getQueue() {
  if (!generationQueue) {
    generationQueue = new Queue<GenerationQueueJobData>(GENERATION_QUEUE_NAME, {
      connection: {
        url: getRedisUrl(),
      },
      prefix: getBullMqPrefix(),
      defaultJobOptions: getGenerationQueueDefaultJobOptions(),
    });
  }

  return generationQueue;
}

export async function enqueueGenerationJob(
  data: GenerationQueueJobData,
  options?: Omit<JobsOptions, "jobId">,
): Promise<EnqueueGenerationJobResult> {
  const runId = data.runId.trim();
  if (!runId) {
    throw new Error("Failed to enqueue generation job: run id is required.");
  }

  const queue = getQueue();
  const existingJob = await queue.getJob(runId);
  if (existingJob) {
    return {
      created: false,
      jobId: runId,
    };
  }

  const job = await queue.add(
    GENERATION_QUEUE_NAME,
    {
      ...data,
      runId,
      enqueuedAt: data.enqueuedAt ?? new Date().toISOString(),
      schemaVersion: data.schemaVersion ?? 1,
    },
    {
      ...options,
      jobId: runId,
    },
  );

  return {
    created: true,
    jobId: job.id ? String(job.id) : runId,
  };
}

export function createGenerationWorker(processor: Processor<GenerationQueueJobData>) {
  return new Worker<GenerationQueueJobData>(GENERATION_QUEUE_NAME, processor, {
    connection: {
      url: getRedisUrl(),
    },
    prefix: getBullMqPrefix(),
    concurrency: getGenerationWorkerConcurrency(),
  });
}

export async function closeGenerationQueue(): Promise<void> {
  if (!generationQueue) {
    return;
  }

  await generationQueue.close();
  generationQueue = null;
}

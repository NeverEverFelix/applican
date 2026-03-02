import { useCallback, useState } from "react";
import { createResumeRun } from "../api/createResumeRun";
import { invokeGenerateBullets } from "../api/invokeGenerateBullets";
import { waitForRunExtraction } from "../api/waitForRunExtraction";
import type { CreateResumeRunResult } from "../model/types";

type UseCreateResumeRunResult = {
  isSubmitting: boolean;
  errorMessage: string;
  progressMessage: string;
  createdRun: CreateResumeRunResult | null;
  submitResumeRun: (params: { file: File | null; jobDescription: string }) => Promise<SubmitResumeRunResult>;
};

type SubmitResumeRunResult =
  | { ok: true; createdRun: CreateResumeRunResult }
  | { ok: false; errorMessage: string };

function toErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Failed to submit resume run. Please try again.";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function invokeGenerateBulletsWithRetry(params: { runId: string; requestId: string }) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await invokeGenerateBullets(params);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "";
      const isExtractionRace = message.includes("still being extracted");
      const canRetry = isExtractionRace && attempt < maxAttempts;

      if (!canRetry) {
        throw error;
      }

      await delay(1_500);
    }
  }

  throw new Error("Failed to generate bullets after multiple retries.");
}

export function useCreateResumeRun(): UseCreateResumeRunResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [createdRun, setCreatedRun] = useState<CreateResumeRunResult | null>(null);

  const submitResumeRun = useCallback(
    async ({ file, jobDescription }: { file: File | null; jobDescription: string }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setProgressMessage("Uploading resume...");
      setCreatedRun(null);

      try {
        const created = await createResumeRun({ file, jobDescription });
        setProgressMessage("Waiting for extraction service...");
        await waitForRunExtraction({ runId: created.row.id });
        setProgressMessage("Generating bullets...");
        const generated = await invokeGenerateBulletsWithRetry({
          runId: created.row.id,
          requestId: created.requestId,
        });
        const nextRun = {
          requestId: created.requestId,
          row: generated.run,
        };
        setCreatedRun(nextRun);
        return { ok: true as const, createdRun: nextRun };
      } catch (error) {
        const message = toErrorMessage(error);
        setErrorMessage(message);
        return { ok: false as const, errorMessage: message };
      } finally {
        setProgressMessage("");
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    isSubmitting,
    errorMessage,
    progressMessage,
    createdRun,
    submitResumeRun,
  };
}

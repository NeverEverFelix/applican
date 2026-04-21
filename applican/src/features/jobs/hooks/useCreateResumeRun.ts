import * as Sentry from "@sentry/react";
import { useCallback, useState } from "react";
import { captureEvent } from "../../../posthog";
import { createResumeRun } from "../api/createResumeRun";
import { invokeGenerateBullets } from "../api/invokeGenerateBullets";
import { requeueResumeRun } from "../api/requeueResumeRun";
import { waitForRunExtraction } from "../api/waitForRunExtraction";
import type { CreateResumeRunResult } from "../model/types";

type UseCreateResumeRunResult = {
  isSubmitting: boolean;
  errorMessage: string;
  progressMessage: string;
  progressPercent: number;
  createdRun: CreateResumeRunResult | null;
  failedRun: CreateResumeRunResult | null;
  submitResumeRun: (params: { file: File | null; jobDescription: string }) => Promise<SubmitResumeRunResult>;
  retryResumeRun: () => Promise<SubmitResumeRunResult>;
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
        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "generate_bullets" },
          extra: params,
        });
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
  const [progressPercent, setProgressPercent] = useState(0);
  const [createdRun, setCreatedRun] = useState<CreateResumeRunResult | null>(null);
  const [failedRun, setFailedRun] = useState<CreateResumeRunResult | null>(null);

  const executeRun = useCallback(
    async (created: CreateResumeRunResult) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setProgressMessage("Waiting for extraction service...");
      setProgressPercent(28);
      setCreatedRun(null);

      try {
        setFailedRun(created);
        setProgressPercent(42);
        captureEvent("extract_started", {
          run_id: created.row.id,
          request_id: created.requestId,
        });
        try {
          await waitForRunExtraction({ runId: created.row.id });
          setProgressPercent(68);
          captureEvent("extract_succeeded", {
            run_id: created.row.id,
            request_id: created.requestId,
          });
        } catch (error) {
          captureEvent("extract_failed", {
            run_id: created.row.id,
            request_id: created.requestId,
            error_message: error instanceof Error ? error.message : "Unknown extraction error",
          });
          throw error;
        }

        setProgressMessage("Generating bullets...");
        setProgressPercent(78);
        captureEvent("rag_started", {
          run_id: created.row.id,
          request_id: created.requestId,
        });
        let generated: Awaited<ReturnType<typeof invokeGenerateBulletsWithRetry>>;
        try {
          generated = await invokeGenerateBulletsWithRetry({
            runId: created.row.id,
            requestId: created.requestId,
          });
          captureEvent("rag_succeeded", {
            run_id: created.row.id,
            request_id: created.requestId,
          });
        } catch (error) {
          captureEvent("rag_failed", {
            run_id: created.row.id,
            request_id: created.requestId,
            error_message: error instanceof Error ? error.message : "Unknown RAG error",
          });
          throw error;
        }
        const nextRun = {
          requestId: created.requestId,
          row: generated.run,
        };
        setProgressPercent(100);
        setCreatedRun(nextRun);
        setFailedRun(null);
        return { ok: true as const, createdRun: nextRun };
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "submit_resume_run" },
        });
        setFailedRun(created);
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

  const submitResumeRun = useCallback(
    async ({ file, jobDescription }: { file: File | null; jobDescription: string }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setProgressMessage("Uploading resume...");
      setProgressPercent(8);
      setCreatedRun(null);
      setFailedRun(null);

      try {
        const created = await createResumeRun({ file, jobDescription });
        captureEvent("run_created", {
          run_id: created.row.id,
          request_id: created.requestId,
          has_job_description: Boolean(jobDescription.trim()),
          has_resume_file: Boolean(file),
        });
        return await executeRun(created);
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "submit_resume_run" },
        });
        const message = toErrorMessage(error);
        setErrorMessage(message);
        setProgressMessage("");
        setIsSubmitting(false);
        return { ok: false as const, errorMessage: message };
      }
    },
    [executeRun],
  );

  const retryResumeRun = useCallback(async () => {
    if (!failedRun) {
      return {
        ok: false as const,
        errorMessage: "Failed to retry resume run: no previous run is available.",
      };
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setProgressMessage("Waiting for extraction service...");
    setProgressPercent(28);
    setCreatedRun(null);

    try {
      const retried = await requeueResumeRun({ runId: failedRun.row.id });
      return await executeRun(retried);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: "resume_studio", action: "retry_resume_run" },
      });
      const message = toErrorMessage(error);
      setErrorMessage(message);
      setProgressMessage("");
      setIsSubmitting(false);
      return { ok: false as const, errorMessage: message };
    }
  }, [executeRun, failedRun]);

  return {
    isSubmitting,
    errorMessage,
    progressMessage,
    progressPercent,
    createdRun,
    failedRun,
    submitResumeRun,
    retryResumeRun,
  };
}

import * as Sentry from "@sentry/react";
import { useCallback, useState } from "react";
import { captureEvent } from "../../../posthog";
import { createResumeRun } from "../api/createResumeRun";
import { getResumeRun } from "../api/getResumeRun";
import { invokeGenerateBullets } from "../api/invokeGenerateBullets";
import { requeueResumeRun } from "../api/requeueResumeRun";
import { waitForRunExtraction } from "../api/waitForRunExtraction";
import { RESUME_RUN_STATUS } from "../model/constants";
import type { CreateResumeRunResult } from "../model/types";

type UseCreateResumeRunResult = {
  isSubmitting: boolean;
  errorMessage: string;
  progressMessage: string;
  progressPercent: number;
  createdRun: CreateResumeRunResult | null;
  failedRun: CreateResumeRunResult | null;
  hasPersistedRunState: boolean;
  submitResumeRun: (params: { file: File | null; jobDescription: string }) => Promise<SubmitResumeRunResult>;
  retryResumeRun: () => Promise<SubmitResumeRunResult>;
  resumeStoredRun: () => Promise<SubmitResumeRunResult | null>;
  clearPersistedRunState: () => void;
};

type SubmitResumeRunResult =
  | { ok: true; createdRun: CreateResumeRunResult }
  | { ok: false; errorMessage: string };

type PersistedRunPhase = "extracting" | "generating" | "failed";

type PersistedRunSession = {
  requestId: string;
  row: CreateResumeRunResult["row"];
  phase: PersistedRunPhase;
  progressMessage: string;
  progressPercent: number;
  errorMessage: string;
};

const PERSISTED_RUN_SESSION_KEY = "applican:resume-studio:active-run-session";
const PERSISTED_RUN_OUTPUT_KEY = "applican:resume-studio:last-run-output";
const PERSISTED_SHOW_RESULTS_KEY = "applican:resume-studio:show-results";

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

function isPersistedRunSession(value: unknown): value is PersistedRunSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<PersistedRunSession>;
  return (
    typeof maybe.requestId === "string" &&
    Boolean(maybe.row && typeof maybe.row === "object") &&
    (maybe.phase === "extracting" || maybe.phase === "generating" || maybe.phase === "failed") &&
    typeof maybe.progressMessage === "string" &&
    typeof maybe.progressPercent === "number" &&
    typeof maybe.errorMessage === "string"
  );
}

function readPersistedRunSession(): PersistedRunSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PERSISTED_RUN_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isPersistedRunSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writePersistedRunSession(session: PersistedRunSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PERSISTED_RUN_SESSION_KEY, JSON.stringify(session));
}

function clearPersistedRunSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PERSISTED_RUN_SESSION_KEY);
}

function persistCompletedRunOutput(output: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PERSISTED_RUN_OUTPUT_KEY, JSON.stringify(output));
  window.localStorage.setItem(PERSISTED_SHOW_RESULTS_KEY, JSON.stringify(true));
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
  const initialSession = readPersistedRunSession();
  const initialFailedRun = initialSession
    ? {
        requestId: initialSession.requestId,
        row: initialSession.row,
      }
    : null;
  const [isSubmitting, setIsSubmitting] = useState(initialSession !== null && initialSession.phase !== "failed");
  const [errorMessage, setErrorMessage] = useState(initialSession?.errorMessage ?? "");
  const [progressMessage, setProgressMessage] = useState(initialSession?.progressMessage ?? "");
  const [progressPercent, setProgressPercent] = useState(initialSession?.progressPercent ?? 0);
  const [createdRun, setCreatedRun] = useState<CreateResumeRunResult | null>(null);
  const [failedRun, setFailedRun] = useState<CreateResumeRunResult | null>(initialFailedRun);
  const [hasPersistedRunState, setHasPersistedRunState] = useState(initialSession !== null);

  const clearPersistedRunState = useCallback(() => {
    clearPersistedRunSession();
    setHasPersistedRunState(false);
    setIsSubmitting(false);
    setErrorMessage("");
    setProgressMessage("");
    setProgressPercent(0);
    setCreatedRun(null);
    setFailedRun(null);
  }, []);

  const updatePersistedStage = useCallback(
    (created: CreateResumeRunResult, phase: Exclude<PersistedRunPhase, "failed">, nextMessage: string, nextPercent: number) => {
      writePersistedRunSession({
        requestId: created.requestId,
        row: created.row,
        phase,
        progressMessage: nextMessage,
        progressPercent: nextPercent,
        errorMessage: "",
      });
      setHasPersistedRunState(true);
      setProgressMessage(nextMessage);
      setProgressPercent(nextPercent);
    },
    [],
  );

  const finalizeFailure = useCallback((created: CreateResumeRunResult, message: string) => {
    setFailedRun(created);
    setErrorMessage(message);
    setProgressMessage("");
    setProgressPercent(0);
    setIsSubmitting(false);
    writePersistedRunSession({
      requestId: created.requestId,
      row: created.row,
      phase: "failed",
      progressMessage: "",
      progressPercent: 0,
      errorMessage: message,
    });
    setHasPersistedRunState(true);
  }, []);

  const finalizeSuccess = useCallback((nextRun: CreateResumeRunResult) => {
    setProgressPercent(100);
    setCreatedRun(nextRun);
    setFailedRun(null);
    setErrorMessage("");
    setProgressMessage("");
    setIsSubmitting(false);
    clearPersistedRunSession();
    setHasPersistedRunState(false);
    persistCompletedRunOutput(nextRun.row.output);
  }, []);

  const executeRun = useCallback(
    async (created: CreateResumeRunResult, options?: { startFromGenerating?: boolean }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setCreatedRun(null);
      setFailedRun(null);

      try {
        if (!options?.startFromGenerating) {
          updatePersistedStage(created, "extracting", "Waiting for extraction service...", 28);
          captureEvent("extract_started", {
            run_id: created.row.id,
            request_id: created.requestId,
          });

          try {
            updatePersistedStage(created, "extracting", "Waiting for extraction service...", 42);
            await waitForRunExtraction({ runId: created.row.id });
            updatePersistedStage(created, "extracting", "Waiting for extraction service...", 68);
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
        }

        updatePersistedStage(created, "generating", "Generating bullets...", 78);
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
        finalizeSuccess(nextRun);
        return { ok: true as const, createdRun: nextRun };
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "submit_resume_run" },
        });
        const message = toErrorMessage(error);
        finalizeFailure(created, message);
        return { ok: false as const, errorMessage: message };
      }
    },
    [finalizeFailure, finalizeSuccess, updatePersistedStage],
  );

  const submitResumeRun = useCallback(
    async ({ file, jobDescription }: { file: File | null; jobDescription: string }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setProgressMessage("Uploading resume...");
      setProgressPercent(8);
      setCreatedRun(null);
      setFailedRun(null);
      clearPersistedRunSession();
      setHasPersistedRunState(false);

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

  const resumeStoredRun = useCallback(async () => {
    const persisted = readPersistedRunSession();
    if (!persisted) {
      setHasPersistedRunState(false);
      return null;
    }

    const persistedRun = {
      requestId: persisted.requestId,
      row: persisted.row,
    };

    setHasPersistedRunState(true);
    setErrorMessage(persisted.errorMessage);
    setProgressMessage(persisted.progressMessage);
    setProgressPercent(persisted.progressPercent);
    setFailedRun(persistedRun);
    setIsSubmitting(persisted.phase !== "failed");

    try {
      const latestRow = await getResumeRun({ runId: persisted.row.id });
      const latestRun = {
        requestId: latestRow.request_id,
        row: latestRow,
      };

      if (latestRow.output !== null && latestRow.output !== undefined) {
        finalizeSuccess(latestRun);
        return { ok: true as const, createdRun: latestRun };
      }

      if (latestRow.status === RESUME_RUN_STATUS.FAILED) {
        const latestErrorMessage =
          typeof latestRow.error_message === "string" && latestRow.error_message.trim()
            ? latestRow.error_message.trim()
            : "Resume generation failed. Please try again.";
        finalizeFailure(latestRun, latestErrorMessage);
        return { ok: false as const, errorMessage: latestErrorMessage };
      }

      return await executeRun(latestRun, {
        startFromGenerating: latestRow.status === RESUME_RUN_STATUS.EXTRACTED,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      finalizeFailure(persistedRun, message);
      return { ok: false as const, errorMessage: message };
    }
  }, [executeRun, finalizeFailure, finalizeSuccess]);

  return {
    isSubmitting,
    errorMessage,
    progressMessage,
    progressPercent,
    createdRun,
    failedRun,
    hasPersistedRunState,
    submitResumeRun,
    retryResumeRun,
    resumeStoredRun,
    clearPersistedRunState,
  };
}

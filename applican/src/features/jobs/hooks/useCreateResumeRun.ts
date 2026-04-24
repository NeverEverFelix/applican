import * as Sentry from "@sentry/react";
import { useCallback, useRef, useState } from "react";
import { captureEvent } from "../../../posthog";
import { createResumeRun } from "../api/createResumeRun";
import { deleteResumeRun } from "../api/deleteResumeRun";
import { enqueueResumeRunForGeneration } from "../api/enqueueResumeRunForGeneration";
import { getResumeRun } from "../api/getResumeRun";
import { requeueResumeRun } from "../api/requeueResumeRun";
import { waitForRunCompletion } from "../api/waitForRunCompletion";
import { waitForRunExtraction } from "../api/waitForRunExtraction";
import { RESUME_RUN_STATUS, isResumeRunPastExtraction } from "../model/constants";
import type { CreateResumeRunResult, ResumeRunRow } from "../model/types";

type UseCreateResumeRunResult = {
  isSubmitting: boolean;
  errorKind: ResumeRunErrorKind | null;
  errorMessage: string;
  errorFeedback: ResumeRunErrorFeedback;
  progressMessage: string;
  progressPercent: number;
  createdRun: CreateResumeRunResult | null;
  failedRun: CreateResumeRunResult | null;
  hasPersistedRunState: boolean;
  submitResumeRun: (params: { file: File | null; jobDescription: string }) => Promise<SubmitResumeRunResult>;
  retryResumeRun: () => Promise<SubmitResumeRunResult>;
  resumeStoredRun: () => Promise<SubmitResumeRunResult | null>;
  cancelActiveRun: () => Promise<CancelActiveRunResult>;
  clearPersistedRunState: () => void;
};

type SubmitResumeRunResult =
  | { ok: true; createdRun: CreateResumeRunResult; cancelled?: false }
  | { ok: false; errorKind: ResumeRunErrorKind; errorMessage: string; cancelled?: false }
  | { ok: false; errorMessage: ""; cancelled: true };

type CancelActiveRunResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

export type ResumeRunErrorKind = "missing_run" | "retryable" | "validation" | "limit" | "unknown";
export type ResumeRunErrorFeedback = {
  tone: "error" | "warning";
  retryable: boolean;
  message: string;
};

type PersistedRunPhase = "extracting" | "generating" | "compiling" | "failed";

type PersistedRunSession = {
  runId?: string;
  requestId: string;
  row?: CreateResumeRunResult["row"];
  status?: ResumeRunRow["status"];
  phase: PersistedRunPhase;
  progressMessage: string;
  progressPercent: number;
  errorKind: ResumeRunErrorKind | null;
  errorMessage: string;
};

const PERSISTED_RUN_SESSION_KEY = "applican:resume-studio:active-run-session";
const PERSISTED_RUN_OUTPUT_KEY = "applican:resume-studio:last-run-output";
const PERSISTED_SHOW_RESULTS_KEY = "applican:resume-studio:show-results";
const CANCELLED_RESULT: SubmitResumeRunResult = { ok: false, errorMessage: "", cancelled: true };

export function classifyResumeRunErrorKind(message: string, errorCode?: string | null): ResumeRunErrorKind {
  const normalizedCode = typeof errorCode === "string" ? errorCode.trim().toUpperCase() : "";

  if (normalizedCode === "FREE_PLAN_LIMIT_REACHED" || normalizedCode === "ANALYSIS_LIMIT_REACHED") {
    return "limit";
  }

  if (
    normalizedCode === "RUN_NOT_READY" ||
    normalizedCode === "RESUME_NOT_EXTRACTED" ||
    normalizedCode === "WORKER_OFFLINE" ||
    normalizedCode === "EXTRACTION_WORKER_OFFLINE"
  ) {
    return "retryable";
  }

  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("could not be restored")) {
    return "missing_run";
  }

  if (normalized.includes("free plan limit reached") || normalized.includes("analysis limit reached")) {
    return "limit";
  }

  if (
    normalized.includes("please upload") ||
    normalized.includes("please provide") ||
    normalized.includes("required") ||
    normalized.includes("empty")
  ) {
    return "validation";
  }

  if (
    normalized.includes("network error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("edge function unreachable") ||
    normalized.includes("worker offline") ||
    normalized.includes("offline") ||
    normalized.includes("still queued") ||
    normalized.includes("still processing") ||
    normalized.includes("try again in a moment") ||
    normalized.includes("failed to upload resume") ||
    normalized.includes("failed to check resume extraction status") ||
    normalized.includes("failed to retry resume run")
  ) {
    return "retryable";
  }

  return "unknown";
}

export function getResumeRunErrorFeedback(
  errorMessage: string,
  errorKind: ResumeRunErrorKind | null,
): ResumeRunErrorFeedback {
  const normalized = errorMessage.trim();

  if (!normalized) {
    return {
      tone: "error",
      retryable: false,
      message: "",
    };
  }

  if (errorKind === "missing_run" || errorKind === "limit" || errorKind === "validation") {
    return {
      tone: "error",
      retryable: false,
      message: normalized,
    };
  }

  if (errorKind === "retryable") {
    return {
      tone: "warning",
      retryable: true,
      message: `${normalized} Your draft is still saved, so you can try again in a moment.`,
    };
  }

  return {
    tone: "warning",
    retryable: true,
    message: `${normalized} Your draft is still saved.`,
  };
}

function toErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Failed to submit resume run. Please try again.";
}

function createFailedResult(
  errorMessage: string,
  errorCode?: string | null,
): Extract<SubmitResumeRunResult, { ok: false; cancelled?: false }> {
  return {
    ok: false,
    errorKind: classifyResumeRunErrorKind(errorMessage, errorCode),
    errorMessage,
  };
}

function getRunProgressSnapshot(status: ResumeRunRow["status"] | undefined): {
  phase: Exclude<PersistedRunPhase, "failed">;
  message: string;
  percent: number;
} {
  if (status === RESUME_RUN_STATUS.QUEUED_PDF || status === RESUME_RUN_STATUS.COMPILING_PDF) {
    return {
      phase: "compiling",
      message: "Preparing PDF...",
      percent: 92,
    };
  }

  if (isResumeRunPastExtraction(status ?? "")) {
    return {
      phase: "generating",
      message: "Generating bullets...",
      percent: 78,
    };
  }

  return {
    phase: "extracting",
    message: "Waiting for extraction service...",
    percent: 42,
  };
}

function buildPersistedRunResult(session: PersistedRunSession): CreateResumeRunResult | null {
  const runId = session.runId?.trim() || session.row?.id;

  if (!runId) {
    return null;
  }

  return {
    requestId: session.requestId,
    row:
      session.row ??
      {
        id: runId,
        request_id: session.requestId,
        user_id: "",
        resume_path: "",
        resume_filename: "",
        job_description: "",
        status:
          session.status ??
          (session.phase === "failed"
            ? RESUME_RUN_STATUS.FAILED
            : RESUME_RUN_STATUS.EXTRACTING),
        error_code: null,
        error_message: session.errorMessage || null,
        output: null,
        created_at: "",
        updated_at: "",
      },
  };
}

function isPersistedRunSession(value: unknown): value is PersistedRunSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<PersistedRunSession>;
  return (
    (maybe.runId === undefined || typeof maybe.runId === "string") &&
    typeof maybe.requestId === "string" &&
    (maybe.row === undefined || Boolean(maybe.row && typeof maybe.row === "object")) &&
    (maybe.status === undefined || typeof maybe.status === "string") &&
    (maybe.phase === "extracting" ||
      maybe.phase === "generating" ||
      maybe.phase === "compiling" ||
      maybe.phase === "failed") &&
    typeof maybe.progressMessage === "string" &&
    typeof maybe.progressPercent === "number" &&
    (maybe.errorKind === undefined ||
      maybe.errorKind === null ||
      maybe.errorKind === "missing_run" ||
      maybe.errorKind === "retryable" ||
      maybe.errorKind === "validation" ||
      maybe.errorKind === "limit" ||
      maybe.errorKind === "unknown") &&
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

export function useCreateResumeRun(): UseCreateResumeRunResult {
  const initialSession = readPersistedRunSession();
  const initialRun = initialSession ? buildPersistedRunResult(initialSession) : null;
  const [isSubmitting, setIsSubmitting] = useState(initialSession !== null && initialSession.phase !== "failed");
  const [errorKind, setErrorKind] = useState<ResumeRunErrorKind | null>(
    initialSession?.errorKind ??
      (initialSession?.errorMessage
        ? classifyResumeRunErrorKind(initialSession.errorMessage, initialSession.row?.error_code)
        : null),
  );
  const [errorMessage, setErrorMessage] = useState(initialSession?.errorMessage ?? "");
  const [progressMessage, setProgressMessage] = useState(initialSession?.progressMessage ?? "");
  const [progressPercent, setProgressPercent] = useState(initialSession?.progressPercent ?? 0);
  const [createdRun, setCreatedRun] = useState<CreateResumeRunResult | null>(null);
  const [failedRun, setFailedRun] = useState<CreateResumeRunResult | null>(initialRun);
  const [hasPersistedRunState, setHasPersistedRunState] = useState(initialSession !== null);
  const currentExecutionIdRef = useRef(0);
  const cancelledExecutionIdsRef = useRef(new Set<number>());
  const activeRunRef = useRef<CreateResumeRunResult | null>(initialRun);

  const beginExecution = useCallback(() => {
    currentExecutionIdRef.current += 1;
    cancelledExecutionIdsRef.current.delete(currentExecutionIdRef.current);
    return currentExecutionIdRef.current;
  }, []);

  const isExecutionIgnored = useCallback((executionId: number) => {
    return executionId !== currentExecutionIdRef.current || cancelledExecutionIdsRef.current.has(executionId);
  }, []);

  const clearState = useCallback(() => {
    clearPersistedRunSession();
    activeRunRef.current = null;
    setHasPersistedRunState(false);
    setIsSubmitting(false);
    setErrorKind(null);
    setErrorMessage("");
    setProgressMessage("");
    setProgressPercent(0);
    setCreatedRun(null);
    setFailedRun(null);
  }, []);

  const clearPersistedRunState = useCallback(() => {
    clearState();
  }, [clearState]);

  const updatePersistedStage = useCallback(
    (
      executionId: number,
      created: CreateResumeRunResult,
      phase: Exclude<PersistedRunPhase, "failed">,
      nextMessage: string,
      nextPercent: number,
    ) => {
      if (isExecutionIgnored(executionId)) {
        return;
      }

      activeRunRef.current = created;
      writePersistedRunSession({
        runId: created.row.id,
        requestId: created.requestId,
        status: created.row.status,
        phase,
        progressMessage: nextMessage,
        progressPercent: nextPercent,
        errorKind: null,
        errorMessage: "",
      });
      setHasPersistedRunState(true);
      setProgressMessage(nextMessage);
      setProgressPercent(nextPercent);
    },
    [isExecutionIgnored],
  );

  const finalizeFailure = useCallback(
    (executionId: number, created: CreateResumeRunResult, message: string) => {
      if (isExecutionIgnored(executionId)) {
        return;
      }

      activeRunRef.current = created;
      setFailedRun(created);
      setErrorKind(classifyResumeRunErrorKind(message, created.row.error_code));
      setErrorMessage(message);
      setProgressMessage("");
      setProgressPercent(0);
      setIsSubmitting(false);
      writePersistedRunSession({
        runId: created.row.id,
        requestId: created.requestId,
        status: created.row.status,
        phase: "failed",
        progressMessage: "",
        progressPercent: 0,
        errorKind: classifyResumeRunErrorKind(message, created.row.error_code),
        errorMessage: message,
      });
      setHasPersistedRunState(true);
    },
    [isExecutionIgnored],
  );

  const finalizeSuccess = useCallback(
    (executionId: number, nextRun: CreateResumeRunResult) => {
      if (isExecutionIgnored(executionId)) {
        return;
      }

      activeRunRef.current = nextRun;
      setProgressPercent(100);
      setCreatedRun(nextRun);
      setFailedRun(null);
      setErrorKind(null);
      setErrorMessage("");
      setProgressMessage("");
      setIsSubmitting(false);
      clearPersistedRunSession();
      setHasPersistedRunState(false);
      persistCompletedRunOutput(nextRun.row.output);
    },
    [isExecutionIgnored],
  );

  const cancelCreatedRunIfNeeded = useCallback(
    async (executionId: number, created: CreateResumeRunResult) => {
      if (!isExecutionIgnored(executionId)) {
        return;
      }

      try {
        await deleteResumeRun({ runId: created.row.id });
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "cancel_resume_run_cleanup" },
          extra: { runId: created.row.id, requestId: created.requestId },
        });
      }
    },
    [isExecutionIgnored],
  );

  const executeRun = useCallback(
    async (executionId: number, created: CreateResumeRunResult, options?: { startFromGenerating?: boolean }) => {
      if (isExecutionIgnored(executionId)) {
        await cancelCreatedRunIfNeeded(executionId, created);
        return CANCELLED_RESULT;
      }

      activeRunRef.current = created;
      setIsSubmitting(true);
      setErrorKind(null);
      setErrorMessage("");
      setCreatedRun(null);
      setFailedRun(null);

      try {
        if (!options?.startFromGenerating) {
          updatePersistedStage(executionId, created, "extracting", "Waiting for extraction service...", 28);
          captureEvent("extract_started", {
            run_id: created.row.id,
            request_id: created.requestId,
          });

          try {
            updatePersistedStage(executionId, created, "extracting", "Waiting for extraction service...", 42);
            await waitForRunExtraction({ runId: created.row.id });
            if (isExecutionIgnored(executionId)) {
              await cancelCreatedRunIfNeeded(executionId, created);
              return CANCELLED_RESULT;
            }
            updatePersistedStage(executionId, created, "extracting", "Waiting for extraction service...", 68);
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

        if (isExecutionIgnored(executionId)) {
          await cancelCreatedRunIfNeeded(executionId, created);
          return CANCELLED_RESULT;
        }

        updatePersistedStage(executionId, created, "generating", "Queueing generation...", 74);
        captureEvent("rag_started", {
          run_id: created.row.id,
          request_id: created.requestId,
        });

        let generatedRow: ResumeRunRow;
        try {
          const enqueued = await enqueueResumeRunForGeneration({
            runId: created.row.id,
          });
          if (isExecutionIgnored(executionId)) {
            await cancelCreatedRunIfNeeded(executionId, created);
            return CANCELLED_RESULT;
          }

          updatePersistedStage(
            executionId,
            { requestId: created.requestId, row: enqueued },
            "generating",
            "Waiting for generation worker...",
            78,
          );

          generatedRow = await waitForRunCompletion({
            runId: created.row.id,
            onProgress: (row) => {
              const snapshot = getRunProgressSnapshot(row.status);
              updatePersistedStage(executionId, { requestId: created.requestId, row }, snapshot.phase, snapshot.message, snapshot.percent);
            },
          });
          if (isExecutionIgnored(executionId)) {
            await cancelCreatedRunIfNeeded(executionId, created);
            return CANCELLED_RESULT;
          }
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
          row: generatedRow,
        };
        finalizeSuccess(executionId, nextRun);
        return { ok: true as const, createdRun: nextRun };
      } catch (error) {
        if (isExecutionIgnored(executionId)) {
          await cancelCreatedRunIfNeeded(executionId, created);
          return CANCELLED_RESULT;
        }

        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "submit_resume_run" },
        });
        const message = toErrorMessage(error);
        finalizeFailure(executionId, created, message);
        return createFailedResult(message);
      }
    },
    [cancelCreatedRunIfNeeded, finalizeFailure, finalizeSuccess, isExecutionIgnored, updatePersistedStage],
  );

  const submitResumeRun = useCallback(
    async ({ file, jobDescription }: { file: File | null; jobDescription: string }) => {
      const executionId = beginExecution();
      setIsSubmitting(true);
      setErrorKind(null);
      setErrorMessage("");
      setProgressMessage("Uploading resume...");
      setProgressPercent(8);
      setCreatedRun(null);
      setFailedRun(null);
      clearPersistedRunSession();
      setHasPersistedRunState(false);
      activeRunRef.current = null;

      try {
        const created = await createResumeRun({ file, jobDescription });
        activeRunRef.current = created;
        if (isExecutionIgnored(executionId)) {
          await cancelCreatedRunIfNeeded(executionId, created);
          return CANCELLED_RESULT;
        }

        captureEvent("run_created", {
          run_id: created.row.id,
          request_id: created.requestId,
          has_job_description: Boolean(jobDescription.trim()),
          has_resume_file: Boolean(file),
        });
        return await executeRun(executionId, created);
      } catch (error) {
        if (isExecutionIgnored(executionId)) {
          return CANCELLED_RESULT;
        }

        Sentry.captureException(error, {
          tags: { feature: "resume_studio", action: "submit_resume_run" },
        });
        const message = toErrorMessage(error);
        setErrorKind(classifyResumeRunErrorKind(message));
        setErrorMessage(message);
        setProgressMessage("");
        setProgressPercent(0);
        setIsSubmitting(false);
        return createFailedResult(message);
      }
    },
    [beginExecution, cancelCreatedRunIfNeeded, executeRun, isExecutionIgnored],
  );

  const retryResumeRun = useCallback(async () => {
    if (!failedRun) {
      return createFailedResult("Failed to retry resume run: no previous run is available.");
    }

    const executionId = beginExecution();
    setIsSubmitting(true);
    setErrorKind(null);
    setErrorMessage("");
    setProgressMessage("");
    setProgressPercent(0);
    setCreatedRun(null);
    setFailedRun(null);
    clearPersistedRunSession();
    setHasPersistedRunState(false);
    activeRunRef.current = failedRun;

    try {
      const retried = await requeueResumeRun({ runId: failedRun.row.id });
      activeRunRef.current = retried;
      if (isExecutionIgnored(executionId)) {
        await cancelCreatedRunIfNeeded(executionId, retried);
        return CANCELLED_RESULT;
      }

      return await executeRun(executionId, retried);
    } catch (error) {
      if (isExecutionIgnored(executionId)) {
        return CANCELLED_RESULT;
      }

      Sentry.captureException(error, {
        tags: { feature: "resume_studio", action: "retry_resume_run" },
      });
      const message = toErrorMessage(error);
      setErrorKind(classifyResumeRunErrorKind(message));
      setErrorMessage(message);
      setProgressMessage("");
      setIsSubmitting(false);
      return createFailedResult(message);
    }
  }, [beginExecution, cancelCreatedRunIfNeeded, executeRun, failedRun, isExecutionIgnored]);

  const resumeStoredRun = useCallback(async () => {
    const persisted = readPersistedRunSession();
    if (!persisted) {
      setHasPersistedRunState(false);
      return null;
    }

    const executionId = beginExecution();
    const persistedRun = buildPersistedRunResult(persisted);

    if (!persistedRun) {
      clearState();
      return createFailedResult("Your previous run could not be restored. Start a new analysis.");
    }

    activeRunRef.current = persistedRun;
    setHasPersistedRunState(true);
    setErrorKind(
      persisted.errorKind ??
        (persisted.errorMessage ? classifyResumeRunErrorKind(persisted.errorMessage, persisted.row?.error_code) : null),
    );
    setErrorMessage(persisted.errorMessage);
    setProgressMessage(persisted.progressMessage);
    setProgressPercent(persisted.progressPercent);
    setFailedRun(persistedRun);
    setIsSubmitting(persisted.phase !== "failed");

    if (persisted.phase === "failed") {
      return createFailedResult(persisted.errorMessage);
    }

    try {
      const persistedRunId = persisted.runId?.trim() || persisted.row?.id;
      if (!persistedRunId) {
        clearState();
        return createFailedResult("Your previous run could not be restored. Start a new analysis.");
      }
      const latestRow = await getResumeRun({ runId: persistedRunId });
      if (isExecutionIgnored(executionId)) {
        return CANCELLED_RESULT;
      }

      if (!latestRow) {
        clearState();
        return createFailedResult("Your previous run could not be restored. Start a new analysis.");
      }

      const latestRun = {
        requestId: latestRow.request_id,
        row: latestRow,
      };
      activeRunRef.current = latestRun;

      if (latestRow.status !== RESUME_RUN_STATUS.FAILED && latestRow.output == null) {
        const snapshot = getRunProgressSnapshot(latestRow.status);
        updatePersistedStage(executionId, latestRun, snapshot.phase, snapshot.message, snapshot.percent);
      }

      if (latestRow.output !== null && latestRow.output !== undefined) {
        finalizeSuccess(executionId, latestRun);
        return { ok: true as const, createdRun: latestRun };
      }

      if (latestRow.status === RESUME_RUN_STATUS.FAILED) {
        const latestErrorMessage =
          typeof latestRow.error_message === "string" && latestRow.error_message.trim()
            ? latestRow.error_message.trim()
            : "Resume generation failed. Please try again.";
        finalizeFailure(executionId, latestRun, latestErrorMessage);
        return createFailedResult(latestErrorMessage, latestRow.error_code);
      }

      return await executeRun(executionId, latestRun, {
        startFromGenerating: isResumeRunPastExtraction(latestRow.status ?? ""),
      });
    } catch (error) {
      if (isExecutionIgnored(executionId)) {
        return CANCELLED_RESULT;
      }

      const message = toErrorMessage(error);
      finalizeFailure(executionId, persistedRun, message);
      return createFailedResult(message);
    }
  }, [beginExecution, clearState, executeRun, finalizeFailure, finalizeSuccess, isExecutionIgnored, updatePersistedStage]);

  const cancelActiveRun = useCallback(async (): Promise<CancelActiveRunResult> => {
    const executionId = currentExecutionIdRef.current;
    cancelledExecutionIdsRef.current.add(executionId);
    const runToCancel = activeRunRef.current;

    if (!runToCancel) {
      clearState();
      return { ok: true };
    }

    try {
      await deleteResumeRun({ runId: runToCancel.row.id });
      captureEvent("run_cancelled", {
        run_id: runToCancel.row.id,
        request_id: runToCancel.requestId,
      });
      clearState();
      return { ok: true };
    } catch (error) {
      cancelledExecutionIdsRef.current.delete(executionId);
      Sentry.captureException(error, {
        tags: { feature: "resume_studio", action: "cancel_resume_run" },
        extra: { runId: runToCancel.row.id, requestId: runToCancel.requestId },
      });
      return { ok: false, errorMessage: toErrorMessage(error) };
    }
  }, [clearState]);

  return {
    isSubmitting,
    errorKind,
    errorMessage,
    errorFeedback: getResumeRunErrorFeedback(errorMessage, errorKind),
    progressMessage,
    progressPercent,
    createdRun,
    failedRun,
    hasPersistedRunState,
    submitResumeRun,
    retryResumeRun,
    resumeStoredRun,
    cancelActiveRun,
    clearPersistedRunState,
  };
}

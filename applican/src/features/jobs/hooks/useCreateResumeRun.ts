import { useCallback, useState } from "react";
import { createResumeRun } from "../api/createResumeRun";
import { invokeGenerateBullets } from "../api/invokeGenerateBullets";
import type { CreateResumeRunResult } from "../model/types";

type UseCreateResumeRunResult = {
  isSubmitting: boolean;
  errorMessage: string;
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

export function useCreateResumeRun(): UseCreateResumeRunResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdRun, setCreatedRun] = useState<CreateResumeRunResult | null>(null);

  const submitResumeRun = useCallback(
    async ({ file, jobDescription }: { file: File | null; jobDescription: string }) => {
      setIsSubmitting(true);
      setErrorMessage("");
      setCreatedRun(null);

      try {
        const created = await createResumeRun({ file, jobDescription });
        const generated = await invokeGenerateBullets({
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
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    isSubmitting,
    errorMessage,
    createdRun,
    submitResumeRun,
  };
}

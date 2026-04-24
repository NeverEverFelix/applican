import { getResumeRun } from "./getResumeRun";
import { RESUME_RUN_STATUS } from "../model/constants";
import type { ResumeRunRow } from "../model/types";

type WaitForRunCompletionInput = {
  runId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (row: ResumeRunRow) => void;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForRunCompletion({
  runId,
  timeoutMs = 180_000,
  pollIntervalMs = 2_000,
  onProgress,
}: WaitForRunCompletionInput): Promise<ResumeRunRow> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to wait for resume run completion: run id is required.");
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const row = await getResumeRun({ runId: normalizedRunId });
    if (!row) {
      throw new Error("Resume run could not be found while waiting for completion.");
    }

    onProgress?.(row);

    if (row.output !== null && row.output !== undefined) {
      if (row.status === RESUME_RUN_STATUS.FAILED) {
        const message =
          typeof row.error_message === "string" && row.error_message.trim()
            ? row.error_message.trim()
            : "Resume generation failed.";
        throw new Error(message);
      }
      return row;
    }

    if (row.status === RESUME_RUN_STATUS.FAILED) {
      const message =
        typeof row.error_message === "string" && row.error_message.trim()
          ? row.error_message.trim()
          : "Resume generation failed.";
      throw new Error(message);
    }

    await delay(pollIntervalMs);
  }

  throw new Error("Resume run is still processing. Check worker status and try again.");
}

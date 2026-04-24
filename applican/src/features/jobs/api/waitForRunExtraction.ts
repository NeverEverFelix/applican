import { supabase } from "../../../lib/supabaseClient";
import {
  RESUME_RUN_STATUS,
  RESUME_RUNS_TABLE,
  isResumeRunPastExtraction,
} from "../model/constants";

type WaitForRunExtractionInput = {
  runId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  queuedTimeoutMs?: number;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForRunExtraction({
  runId,
  timeoutMs = 45_000,
  pollIntervalMs = 1_500,
  queuedTimeoutMs = 15_000,
}: WaitForRunExtractionInput): Promise<void> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("Failed to check resume extraction: run id is required.");
  }

  const deadline = Date.now() + timeoutMs;
  const queuedDeadline = Date.now() + queuedTimeoutMs;
  let reachedExtracting = false;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from(RESUME_RUNS_TABLE)
      .select("status, error_code, error_message, output")
      .eq("id", normalizedRunId)
      .single();

    if (error) {
      throw new Error(`Failed to check resume extraction status: ${error.message}`);
    }

    const status = typeof data?.status === "string" ? data.status : "";
    const errorMessage = typeof data?.error_message === "string" ? data.error_message.trim() : "";

    // If output already exists, the run is effectively ready for result rendering.
    if (data?.output !== null && data?.output !== undefined) {
      return;
    }

    if (isResumeRunPastExtraction(status)) {
      return;
    }

    if (status === RESUME_RUN_STATUS.FAILED) {
      throw new Error(
        errorMessage || "Resume extraction failed. Re-upload the file and try again.",
      );
    }

    if (status === RESUME_RUN_STATUS.EXTRACTING) {
      reachedExtracting = true;
    }

    if (
      status === RESUME_RUN_STATUS.QUEUED &&
      !reachedExtracting &&
      Date.now() >= queuedDeadline
    ) {
      throw new Error(
        "Resume is still queued. Extraction service may be offline. Start the extractor service, then try again.",
      );
    }

    await delay(pollIntervalMs);
  }

  throw new Error(
    "Resume is still processing. Ensure your extraction worker is running, then try again in a moment.",
  );
}

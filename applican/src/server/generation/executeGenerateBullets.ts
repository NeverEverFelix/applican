import type { ResumeStudioOutput } from "./bulletOutput.ts";
import { normalizeModelOutput, type ParsedExperienceSection } from "./normalizeModelOutput.ts";
import { buildGenerateBulletsOpenAiRequest } from "./openAiRequest.ts";
import { measureStage } from "../observability/timing.ts";

type FetchLike = typeof fetch;

export type GenerateBulletsExecutionMetrics = {
  openai_roundtrip_ms: number;
  model_normalize_ms: number;
};

export type GenerateBulletsExecutionResult = {
  output: ResumeStudioOutput;
  metrics: GenerateBulletsExecutionMetrics;
};

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part && "text" in part) {
          const value = (part as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export async function executeGenerateBullets(params: {
  openAiApiKey: string;
  model: string;
  jobDescription: string;
  resumeText: string;
  requestId: string;
  sourceExperienceSections: ParsedExperienceSection[];
  parserDebug: NonNullable<ResumeStudioOutput["debug"]>["parser"];
  fetchImpl?: FetchLike;
}): Promise<GenerateBulletsExecutionResult> {
  const {
    openAiApiKey,
    model,
    jobDescription,
    resumeText,
    requestId,
    sourceExperienceSections,
    parserDebug,
    fetchImpl = fetch,
  } = params;

  const requestBody = buildGenerateBulletsOpenAiRequest({
    model,
    jobDescription,
    resumeText,
    sourceExperienceSections,
  });

  const { result: responsePayload, durationMs: openAiRoundtripMs } = await measureStage(async () => {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await response.json();
    return { response, payload };
  });

  const { response, payload } = responsePayload;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error &&
        typeof payload.error === "object" && "message" in payload.error &&
        typeof payload.error.message === "string"
        ? payload.error.message
        : "OpenAI request failed.";
    throw new Error(message);
  }

  const content =
    payload && typeof payload === "object" && "choices" in payload
      ? extractAssistantText((payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content)
      : "";

  if (!content) {
    throw new Error("Model returned empty output.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("Model response was not valid JSON.");
  }

  try {
    const { result: output, durationMs: modelNormalizeMs } = await measureStage(() =>
      normalizeModelOutput({
        raw,
        model,
        requestId,
        parsedSourceExperienceSections: sourceExperienceSections,
        parserDebug,
      })
    );

    return {
      output,
      metrics: {
        openai_roundtrip_ms: openAiRoundtripMs,
        model_normalize_ms: modelNormalizeMs,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Model response was not a JSON object.") {
      throw new Error(error.message);
    }
    throw error;
  }
}

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

export class GenerateBulletsExecutionError extends Error {
  readonly code: string;
  readonly stage: string;
  readonly details: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    stage: string;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "GenerateBulletsExecutionError";
    this.code = params.code;
    this.stage = params.stage;
    this.details = params.details ?? {};
  }
}

function buildContentPreview(value: string, limit = 500): string {
  return value.slice(0, limit);
}

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
    throw new GenerateBulletsExecutionError({
      code: "OPENAI_HTTP_ERROR",
      message,
      stage: "openai_request",
      details: {
        http_status: response.status,
        http_status_text: response.statusText,
        provider_error_type:
          payload && typeof payload === "object" && "error" in payload &&
            payload.error && typeof payload.error === "object" && "type" in payload.error &&
            typeof payload.error.type === "string"
            ? payload.error.type
            : null,
        provider_error_code:
          payload && typeof payload === "object" && "error" in payload &&
            payload.error && typeof payload.error === "object" && "code" in payload.error &&
            typeof payload.error.code === "string"
            ? payload.error.code
            : null,
      },
    });
  }

  const content =
    payload && typeof payload === "object" && "choices" in payload
      ? extractAssistantText((payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content)
      : "";

  if (!content) {
    throw new GenerateBulletsExecutionError({
      code: "OPENAI_EMPTY_RESPONSE",
      message: "Model returned empty output.",
      stage: "openai_response",
      details: {
        content_length: 0,
      },
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new GenerateBulletsExecutionError({
      code: "OPENAI_INVALID_JSON",
      message: "Model response was not valid JSON.",
      stage: "openai_response_parse",
      details: {
        content_length: content.length,
        content_preview: buildContentPreview(content),
      },
    });
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
      throw new GenerateBulletsExecutionError({
        code: "OPENAI_INVALID_JSON_OBJECT",
        message: error.message,
        stage: "model_normalize",
        details: {
          raw_type: Array.isArray(raw) ? "array" : typeof raw,
        },
      });
    }
    if (error instanceof GenerateBulletsExecutionError) {
      throw error;
    }
    throw new GenerateBulletsExecutionError({
      code: "MODEL_NORMALIZE_FAILED",
      message: error instanceof Error ? error.message : "Model output normalization failed.",
      stage: "model_normalize",
      details: {
        raw_type: Array.isArray(raw) ? "array" : typeof raw,
      },
    });
  }
}

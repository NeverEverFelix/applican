import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  executeGenerateBullets,
  GenerateBulletsExecutionError,
} from "./executeGenerateBullets.ts";

const SOURCE_EXPERIENCE_SECTIONS = [
  {
    title: "Software Engineer",
    bullets: ["Built backend APIs for internal tools."],
  },
];

const PARSER_DEBUG = {
  experience_sections_found: 1,
  section_titles: ["Software Engineer"],
  ignored_headings: [],
};

describe("executeGenerateBullets retries", () => {
  const originalRetries = process.env.OPENAI_RATE_LIMIT_MAX_RETRIES;
  const originalBaseDelay = process.env.OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS;

  beforeEach(() => {
    process.env.OPENAI_RATE_LIMIT_MAX_RETRIES = "2";
    process.env.OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS = "0";
  });

  afterEach(() => {
    if (originalRetries === undefined) {
      delete process.env.OPENAI_RATE_LIMIT_MAX_RETRIES;
    } else {
      process.env.OPENAI_RATE_LIMIT_MAX_RETRIES = originalRetries;
    }

    if (originalBaseDelay === undefined) {
      delete process.env.OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS;
    } else {
      process.env.OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS = originalBaseDelay;
    }
  });

  it("retries transient 5xx responses before failing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "temporary upstream error",
            type: "server_error",
            code: "temporary_unavailable",
          },
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    );

    await expect(
      executeGenerateBullets({
        openAiApiKey: "test-key",
        model: "gpt-4.1",
        jobDescription: "Backend engineer role focused on APIs and reliability.",
        resumeText: "Software Engineer\nBuilt backend APIs for internal tools.",
        requestId: "request-1",
        sourceExperienceSections: SOURCE_EXPERIENCE_SECTIONS,
        parserDebug: PARSER_DEBUG,
        fetchImpl,
      })
    ).rejects.toMatchObject<Partial<GenerateBulletsExecutionError>>({
      code: "OPENAI_HTTP_ERROR",
      stage: "openai_request",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries network failures before surfacing an OpenAI network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      executeGenerateBullets({
        openAiApiKey: "test-key",
        model: "gpt-4.1",
        jobDescription: "Backend engineer role focused on APIs and reliability.",
        resumeText: "Software Engineer\nBuilt backend APIs for internal tools.",
        requestId: "request-2",
        sourceExperienceSections: SOURCE_EXPERIENCE_SECTIONS,
        parserDebug: PARSER_DEBUG,
        fetchImpl,
      })
    ).rejects.toMatchObject<Partial<GenerateBulletsExecutionError>>({
      code: "OPENAI_NETWORK_ERROR",
      stage: "openai_request",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

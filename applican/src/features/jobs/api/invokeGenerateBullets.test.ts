import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { invokeGenerateBullets } from "./invokeGenerateBullets";

describe("invokeGenerateBullets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects blank run or request ids", async () => {
    await expect(
      invokeGenerateBullets({ runId: " ", requestId: "request-1" }),
    ).rejects.toThrow("Failed to generate bullets: run_id and request_id are required.");

    await expect(
      invokeGenerateBullets({ runId: "run-1", requestId: " " }),
    ).rejects.toThrow("Failed to generate bullets: run_id and request_id are required.");
  });

  it("invokes the edge function with trimmed ids", async () => {
    const response = {
      run: {
        id: "run-1",
      },
    };
    invokeMock.mockResolvedValue({
      data: response,
      error: null,
    });

    await expect(
      invokeGenerateBullets({ runId: " run-1 ", requestId: " request-1 " }),
    ).resolves.toEqual(response);

    expect(invokeMock).toHaveBeenCalledWith("generate-bullets", {
      body: {
        run_id: "run-1",
        request_id: "request-1",
      },
    });
  });

  it("maps known edge-function error codes into user-facing messages", async () => {
    const context = new Response(
      JSON.stringify({ error_code: "RUN_NOT_READY", error_message: "still extracting" }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );

    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "function failed",
        context,
      },
    });

    await expect(
      invokeGenerateBullets({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow(
      "Failed to generate bullets: Resume is still being extracted. Wait a few seconds, then try again.",
    );
  });

  it("maps unreachable edge-function errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
      },
    });

    await expect(
      invokeGenerateBullets({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow(
      "Failed to generate bullets: Edge Function unreachable. Deploy `generate-bullets` and verify Supabase env values.",
    );
  });

  it("falls back to payload error messages and invalid response handling", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "function failed",
          context: new Response(
            JSON.stringify({ error_message: "custom backend failure" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
        },
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(
      invokeGenerateBullets({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow("Failed to generate bullets: custom backend failure");

    await expect(
      invokeGenerateBullets({ runId: "run-1", requestId: "request-1" }),
    ).rejects.toThrow("Failed to generate bullets: invalid response from function.");
  });
});

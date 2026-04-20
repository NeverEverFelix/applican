import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { cancelSubscription } from "./cancelSubscription";

describe("cancelSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves when cancellation is scheduled", async () => {
    invokeMock.mockResolvedValue({
      data: { canceled_at_period_end: true },
      error: null,
    });

    await expect(cancelSubscription()).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith("cancel-subscription", {
      body: {},
    });
  });

  it("maps structured backend errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "function failed",
        context: new Response(
          JSON.stringify({
            error_code: "SUBSCRIPTION_NOT_FOUND",
            error_message: "No active subscription found for this user.",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      },
    });

    await expect(cancelSubscription()).rejects.toThrow(
      "SUBSCRIPTION_NOT_FOUND: No active subscription found for this user.",
    );
  });

  it("falls back to the raw function error message", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "upstream timeout",
      },
    });

    await expect(cancelSubscription()).rejects.toThrow("upstream timeout");
  });

  it("rejects invalid response payloads", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { error_message: "Cancellation was not scheduled" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(cancelSubscription()).rejects.toThrow(
      "Failed to cancel subscription: Cancellation was not scheduled",
    );

    await expect(cancelSubscription()).rejects.toThrow(
      "Failed to cancel subscription: Invalid response from cancel subscription endpoint.",
    );
  });
});

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

import { createCheckoutSession } from "./createCheckoutSession";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the checkout url on success", async () => {
    invokeMock.mockResolvedValue({
      data: { url: "https://billing.example/checkout" },
      error: null,
    });

    await expect(createCheckoutSession()).resolves.toBe("https://billing.example/checkout");

    expect(invokeMock).toHaveBeenCalledWith("create-checkout-session", {
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
            error_code: "CUSTOMER_NOT_FOUND",
            error_message: "No Stripe customer exists for this user.",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
      },
    });

    await expect(createCheckoutSession()).rejects.toThrow(
      "CUSTOMER_NOT_FOUND: No Stripe customer exists for this user.",
    );
  });

  it("falls back to the raw function error message", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "upstream timeout",
      },
    });

    await expect(createCheckoutSession()).rejects.toThrow("upstream timeout");
  });

  it("rejects invalid response payloads", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { error_message: "Missing checkout URL" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(createCheckoutSession()).rejects.toThrow(
      "Failed to create checkout session: Missing checkout URL",
    );

    await expect(createCheckoutSession()).rejects.toThrow(
      "Failed to create checkout session: Invalid response from checkout endpoint.",
    );
  });
});

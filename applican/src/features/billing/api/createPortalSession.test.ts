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

import { createPortalSession } from "./createPortalSession";

describe("createPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the portal url on success", async () => {
    invokeMock.mockResolvedValue({
      data: { url: "https://billing.example/portal" },
      error: null,
    });

    await expect(createPortalSession()).resolves.toBe("https://billing.example/portal");

    expect(invokeMock).toHaveBeenCalledWith("create-portal-session", {
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
            error_code: "PORTAL_DISABLED",
            error_message: "Billing portal is disabled.",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      },
    });

    await expect(createPortalSession()).rejects.toThrow(
      "PORTAL_DISABLED: Billing portal is disabled.",
    );
  });

  it("falls back to the raw function error message", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "portal request failed",
      },
    });

    await expect(createPortalSession()).rejects.toThrow("portal request failed");
  });

  it("rejects invalid response payloads", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { error_message: "Missing portal URL" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {},
        error: null,
      });

    await expect(createPortalSession()).rejects.toThrow(
      "Failed to create billing portal session: Missing portal URL",
    );

    await expect(createPortalSession()).rejects.toThrow(
      "Failed to create billing portal session: Invalid response from portal endpoint.",
    );
  });
});

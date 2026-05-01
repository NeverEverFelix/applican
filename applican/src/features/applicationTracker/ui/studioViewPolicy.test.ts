import { describe, expect, it } from "vitest";
import {
  getStudioViewAvailabilityLabel,
  getStudioViewPolicy,
  isStudioViewSupportedOn,
  resolveStudioViewAccess,
  resolveSupportedStudioView,
} from "./studioViewPolicy";

describe("studioViewPolicy", () => {
  it("marks editor as desktop-only", () => {
    expect(isStudioViewSupportedOn("Editor", "desktop")).toBe(true);
    expect(isStudioViewSupportedOn("Editor", "tablet")).toBe(false);
    expect(isStudioViewSupportedOn("Editor", "mobile")).toBe(false);
  });

  it("marks career path and resources as unavailable on every device", () => {
    expect(isStudioViewSupportedOn("Career Path", "desktop")).toBe(false);
    expect(isStudioViewSupportedOn("Career Path", "tablet")).toBe(false);
    expect(isStudioViewSupportedOn("Resources", "desktop")).toBe(false);
    expect(isStudioViewSupportedOn("Resources", "mobile")).toBe(false);
  });

  it("returns fallback metadata for unsupported views", () => {
    const access = resolveStudioViewAccess("Editor", "tablet");

    expect(access.isSupported).toBe(false);
    expect(access.policy.fallbackView).toBe("Resume Studio");
    expect(access.policy.unavailableTitle).toBe("Editor unavailable on this device");
    expect(access.policy.fallbackActionLabel).toBe("Return to Resume Studio");
  });

  it("keeps resume studio available everywhere", () => {
    const policy = getStudioViewPolicy("Resume Studio");

    expect(policy.supportedOn).toEqual(["mobile", "tablet", "desktop"]);
  });

  it("resolves unsupported views back to a supported fallback", () => {
    expect(resolveSupportedStudioView("Editor", "mobile")).toBe("Resume Studio");
    expect(resolveSupportedStudioView("Resume Studio", "mobile")).toBe("Resume Studio");
  });

  it("exposes availability labels for unsupported views", () => {
    expect(getStudioViewAvailabilityLabel("Editor", "tablet")).toBe("Desktop only");
    expect(getStudioViewAvailabilityLabel("Career Path", "desktop")).toBe("Coming soon");
    expect(getStudioViewAvailabilityLabel("Resume Studio", "tablet")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  BREAKPOINTS,
  getViewportBucket,
  isDesktopWidth,
  isMobileWidth,
  isTabletOrBelowWidth,
  isTabletWidth,
  MEDIA_QUERIES,
} from "./responsive";

describe("responsive", () => {
  it("exposes the shared breakpoint values", () => {
    expect(BREAKPOINTS.mobileMax).toBe(767);
    expect(BREAKPOINTS.tabletMax).toBe(1279);
    expect(MEDIA_QUERIES.mobile).toBe("(max-width: 767px)");
    expect(MEDIA_QUERIES.desktop).toBe("(min-width: 1280px)");
  });

  it("classifies widths into viewport buckets", () => {
    expect(getViewportBucket(320)).toBe("mobile");
    expect(getViewportBucket(767)).toBe("mobile");
    expect(getViewportBucket(768)).toBe("tablet");
    expect(getViewportBucket(1279)).toBe("tablet");
    expect(getViewportBucket(1280)).toBe("desktop");
  });

  it("exposes boolean helpers for future behavior gates", () => {
    expect(isMobileWidth(767)).toBe(true);
    expect(isTabletWidth(900)).toBe(true);
    expect(isTabletOrBelowWidth(1279)).toBe(true);
    expect(isTabletOrBelowWidth(1280)).toBe(false);
    expect(isDesktopWidth(1600)).toBe(true);
  });
});

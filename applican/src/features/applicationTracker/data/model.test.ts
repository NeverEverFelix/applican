import { describe, expect, it } from "vitest";

import {
  APPLICATION_APPLIED_STATUSES,
  APPLICATION_INTERVIEW_STATUSES,
  APPLICATION_STATUS,
  formatAppliedDate,
  getApplicationFilterBucket,
  getNextApplicationStatus,
} from "./model";

describe("applicationTracker model", () => {
  it("maps statuses into filter buckets", () => {
    for (const status of APPLICATION_APPLIED_STATUSES) {
      expect(getApplicationFilterBucket(status)).toBe("applied");
    }
    for (const status of APPLICATION_INTERVIEW_STATUSES) {
      expect(getApplicationFilterBucket(status)).toBe("interview");
    }
    expect(getApplicationFilterBucket(APPLICATION_STATUS.REJECTED)).toBe("rejected");
  });

  it("formats valid applied dates", () => {
    expect(formatAppliedDate("2026-04-16T12:00:00.000Z")).toBe("Apr 16, 2026");
  });

  it("returns placeholder for missing, invalid, or epoch-like dates", () => {
    expect(formatAppliedDate(null)).toBe("---");
    expect(formatAppliedDate("not-a-date")).toBe("---");
    expect(formatAppliedDate("1970-01-01T00:00:00.000Z")).toBe("---");
  });

  it("advances to the next application status and clamps at rejected", () => {
    expect(getNextApplicationStatus(APPLICATION_STATUS.READY_TO_APPLY)).toBe(
      APPLICATION_STATUS.APPLIED,
    );
    expect(getNextApplicationStatus(APPLICATION_STATUS.APPLIED)).toBe(
      APPLICATION_STATUS.INTERVIEW_1,
    );
    expect(getNextApplicationStatus(APPLICATION_STATUS.OFFER)).toBe(
      APPLICATION_STATUS.OFFER,
    );
    APPLICATION_INTERVIEW_STATUSES.forEach((status, index) => {
      const expected =
        index === APPLICATION_INTERVIEW_STATUSES.length - 1
          ? APPLICATION_STATUS.REJECTED
          : APPLICATION_INTERVIEW_STATUSES[index + 1];
      expect(getNextApplicationStatus(status)).toBe(expected);
    });
    expect(getNextApplicationStatus(APPLICATION_STATUS.REJECTED)).toBe(
      APPLICATION_STATUS.REJECTED,
    );
  });
});

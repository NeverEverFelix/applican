import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_LOADING_MIN_MS,
  ensureMinimumLoadingDuration,
  useMinimumLoading,
} from "./useMinimumLoading";

describe("ensureMinimumLoadingDuration", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns immediately when the minimum duration has already elapsed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);

    await expect(ensureMinimumLoadingDuration(0, 1_000)).resolves.toBeUndefined();
  });

  it("waits only for the remaining duration", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now").mockReturnValue(1_200);

    const promise = ensureMinimumLoadingDuration(1_000, 500);
    await vi.advanceTimersByTimeAsync(299);
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });
});

describe("useMinimumLoading", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the loading state visible until the minimum duration passes", async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ isActive, minDurationMs }) => useMinimumLoading(isActive, minDurationMs),
      {
        initialProps: {
          isActive: true,
          minDurationMs: 500,
        },
      },
    );

    expect(result.current).toBe(true);

    rerender({ isActive: false, minDurationMs: 500 });
    expect(result.current).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(result.current).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toBe(false);
  });

  it("becomes visible again when reactivated before the hide timer finishes", async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ isActive, minDurationMs }) => useMinimumLoading(isActive, minDurationMs),
      {
        initialProps: {
          isActive: true,
          minDurationMs: AUTH_LOADING_MIN_MS,
        },
      },
    );

    rerender({ isActive: false, minDurationMs: AUTH_LOADING_MIN_MS });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe(true);

    rerender({ isActive: true, minDurationMs: AUTH_LOADING_MIN_MS });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_LOADING_MIN_MS);
    });
    expect(result.current).toBe(true);
  });
});

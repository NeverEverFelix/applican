import { useEffect, useRef, useState } from "react";

export const AUTH_LOADING_MIN_MS = 1688;

export async function ensureMinimumLoadingDuration(
  startedAtMs: number,
  minDurationMs = AUTH_LOADING_MIN_MS,
) {
  const elapsed = Date.now() - startedAtMs;
  const remaining = Math.max(0, minDurationMs - elapsed);
  if (remaining <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

export function useMinimumLoading(isActive: boolean, minDurationMs = AUTH_LOADING_MIN_MS) {
  const [isVisible, setIsVisible] = useState(isActive);
  const startedAtRef = useRef<number | null>(isActive ? Date.now() : null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      startedAtRef.current = Date.now();
      setIsVisible(true);
      return;
    }

    if (!isVisible) {
      return;
    }

    const startedAt = startedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, minDurationMs - elapsed);

    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      timeoutRef.current = null;
      startedAtRef.current = null;
    }, remaining);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActive, isVisible, minDurationMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return isVisible;
}

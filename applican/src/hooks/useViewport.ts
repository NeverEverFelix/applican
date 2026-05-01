import { useSyncExternalStore } from "react";
import {
  getViewportBucket,
  isDesktopWidth,
  isMobileWidth,
  isTabletOrBelowWidth,
  isTabletWidth,
  type ViewportBucket,
} from "../lib/responsive";

type ViewportSnapshot = {
  width: number;
  bucket: ViewportBucket;
  isMobile: boolean;
  isTablet: boolean;
  isTabletOrBelow: boolean;
  isDesktop: boolean;
};

let cachedSnapshot: ViewportSnapshot | null = null;

function getWindowWidth(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return window.innerWidth;
}

function getSnapshot(): ViewportSnapshot {
  const width = getWindowWidth();
  if (cachedSnapshot && cachedSnapshot.width === width) {
    return cachedSnapshot;
  }

  cachedSnapshot = {
    width,
    bucket: getViewportBucket(width),
    isMobile: isMobileWidth(width),
    isTablet: isTabletWidth(width),
    isTabletOrBelow: isTabletOrBelowWidth(width),
    isDesktop: isDesktopWidth(width),
  };

  return cachedSnapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);

  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

export function useViewport(): ViewportSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

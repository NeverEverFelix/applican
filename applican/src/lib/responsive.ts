export const BREAKPOINTS = {
  mobileMax: 767,
  tabletMax: 1279,
} as const;

export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobileMax}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobileMax + 1}px) and (max-width: ${BREAKPOINTS.tabletMax}px)`,
  tabletAndBelow: `(max-width: ${BREAKPOINTS.tabletMax}px)`,
  desktop: `(min-width: ${BREAKPOINTS.tabletMax + 1}px)`,
} as const;

export type ViewportBucket = "mobile" | "tablet" | "desktop";

export function getViewportBucket(width: number): ViewportBucket {
  if (width <= BREAKPOINTS.mobileMax) {
    return "mobile";
  }

  if (width <= BREAKPOINTS.tabletMax) {
    return "tablet";
  }

  return "desktop";
}

export function isMobileWidth(width: number): boolean {
  return getViewportBucket(width) === "mobile";
}

export function isTabletWidth(width: number): boolean {
  return getViewportBucket(width) === "tablet";
}

export function isTabletOrBelowWidth(width: number): boolean {
  return width <= BREAKPOINTS.tabletMax;
}

export function isDesktopWidth(width: number): boolean {
  return getViewportBucket(width) === "desktop";
}

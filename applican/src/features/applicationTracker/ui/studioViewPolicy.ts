import type { ViewportBucket } from "../../../lib/responsive";
import type { PickerView } from "./studioContainerView";

type ViewSupportPolicy = {
  supportedOn: ViewportBucket[];
  fallbackView?: PickerView;
  unavailableTitle?: string;
  unavailableCopy?: string;
  availabilityLabel?: string;
  fallbackActionLabel?: string;
};

export type StudioViewAccess = {
  isSupported: boolean;
  policy: ViewSupportPolicy;
};

const ALL_VIEWPORTS: ViewportBucket[] = ["mobile", "tablet", "desktop"];

export const STUDIO_VIEW_POLICIES: Record<PickerView, ViewSupportPolicy> = {
  "Resume Studio": {
    supportedOn: ALL_VIEWPORTS,
  },
  "Application Tracker": {
    supportedOn: ALL_VIEWPORTS,
  },
  Profile: {
    supportedOn: ALL_VIEWPORTS,
  },
  History: {
    supportedOn: ALL_VIEWPORTS,
  },
  Editor: {
    supportedOn: ["desktop"],
    fallbackView: "Resume Studio",
    unavailableTitle: "Editor unavailable on this device",
    unavailableCopy:
      "The Editor is desktop-only for now. Switch to a larger screen to edit generated resumes, or return to Resume Studio on this device.",
    availabilityLabel: "Desktop only",
    fallbackActionLabel: "Return to Resume Studio",
  },
  "Career Path": {
    supportedOn: [],
    fallbackView: "Resume Studio",
    unavailableTitle: "Career Path coming soon",
    unavailableCopy: "Career Path is not available yet on any device.",
    availabilityLabel: "Coming soon",
    fallbackActionLabel: "Return to Resume Studio",
  },
  Resources: {
    supportedOn: [],
    fallbackView: "Resume Studio",
    unavailableTitle: "Resources coming soon",
    unavailableCopy: "Resources are not available yet on any device.",
    availabilityLabel: "Coming soon",
    fallbackActionLabel: "Return to Resume Studio",
  },
};

export function getStudioViewPolicy(view: PickerView): ViewSupportPolicy {
  return STUDIO_VIEW_POLICIES[view];
}

export function isStudioViewSupportedOn(view: PickerView, viewport: ViewportBucket): boolean {
  return getStudioViewPolicy(view).supportedOn.includes(viewport);
}

export function resolveStudioViewAccess(view: PickerView, viewport: ViewportBucket): StudioViewAccess {
  const policy = getStudioViewPolicy(view);
  return {
    isSupported: policy.supportedOn.includes(viewport),
    policy,
  };
}

export function resolveSupportedStudioView(view: PickerView, viewport: ViewportBucket): PickerView {
  const access = resolveStudioViewAccess(view, viewport);
  if (access.isSupported) {
    return view;
  }

  return access.policy.fallbackView ?? "Resume Studio";
}

export function getStudioViewAvailabilityLabel(view: PickerView, viewport: ViewportBucket): string | null {
  const access = resolveStudioViewAccess(view, viewport);
  if (!access.isSupported) {
    return access.policy.availabilityLabel ?? null;
  }

  return null;
}

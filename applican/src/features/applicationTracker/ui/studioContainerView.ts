export const STUDIO_VIEWS = [
  "Resume Studio",
  "Application Tracker",
  "Career Path",
  "Editor",
  "Resources",
] as const;

export type PickerView = (typeof STUDIO_VIEWS)[number];

export type StudioContainerVariant =
  | "resumeStudio"
  | "applicationTracker"
  | "careerPath"
  | "editor"
  | "resources";

const VARIANT_BY_VIEW: Record<PickerView, StudioContainerVariant> = {
  "Resume Studio": "resumeStudio",
  "Application Tracker": "applicationTracker",
  "Career Path": "careerPath",
  Editor: "editor",
  Resources: "resources",
};

export function getStudioContainerVariant(selectedView: PickerView): StudioContainerVariant {
  return VARIANT_BY_VIEW[selectedView];
}

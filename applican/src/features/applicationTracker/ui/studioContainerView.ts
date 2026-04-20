export const STUDIO_VIEWS = [
  "Resume Studio",
  "Application Tracker",
  "Profile",
  "History",
  "Editor",
  "Career Path",
  "Resources",
] as const;

export type PickerView = (typeof STUDIO_VIEWS)[number];

export type StudioContainerVariant =
  | "resumeStudio"
  | "applicationTracker"
  | "profile"
  | "history"
  | "careerPath"
  | "editor"
  | "resources";

const VARIANT_BY_VIEW: Record<PickerView, StudioContainerVariant> = {
  "Resume Studio": "resumeStudio",
  "Application Tracker": "applicationTracker",
  Profile: "profile",
  History: "history",
  "Career Path": "careerPath",
  Editor: "editor",
  Resources: "resources",
};

export function getStudioContainerVariant(selectedView: PickerView): StudioContainerVariant {
  return VARIANT_BY_VIEW[selectedView];
}

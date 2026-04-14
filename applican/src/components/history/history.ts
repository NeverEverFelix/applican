export type HistoryCardData = {
  historyEntryId: string;
  resumeRunId: string;
  role: string;
  company: string;
  location: string;
  createdAt: string;
  submittedAtIso?: string;
  score: number;
  experienceNeeded: string;
  jobType: string;
  analysisSummary: string;
  sourceApplicationId?: string;
  resumeFilename?: string;
};

// Placeholder shape for UI work. Replace with Supabase-backed data later.
export const historyCardSeed: HistoryCardData = {
  historyEntryId: "seed-history-entry",
  resumeRunId: "seed-history-entry",
  role: "Senior Product Designer",
  company: "Figma",
  location: "San Francisco, CA",
  createdAt: "Mar 11, 2026",
  score: 92,
  experienceNeeded: "5 years",
  jobType: "Hybrid",
  analysisSummary:
    "Your resume aligns strongly with core product design requirements, but the job description emphasizes stakeholder management and experimentation metrics more than your current bullets.",
};

export const historyCardsMock: HistoryCardData[] = [
  historyCardSeed,
  {
    historyEntryId: "seed-history-entry-2",
    resumeRunId: "seed-history-entry-2",
    role: "Product Designer",
    company: "Notion",
    location: "New York, NY",
    createdAt: "Mar 9, 2026",
    score: 88,
    experienceNeeded: "4 years",
    jobType: "Remote",
    analysisSummary:
      "Strong product thinking and UX work. Add more measurable business impact and cross-functional collaboration outcomes to improve match confidence.",
  },
  {
    historyEntryId: "seed-history-entry-3",
    resumeRunId: "seed-history-entry-3",
    role: "Senior UX Designer",
    company: "Airbnb",
    location: "San Francisco, CA",
    createdAt: "Mar 7, 2026",
    score: 90,
    experienceNeeded: "6 years",
    jobType: "Onsite",
    analysisSummary:
      "Portfolio depth and interaction design are strong. Highlight accessibility and design-system leadership to better align with role expectations.",
  },
];

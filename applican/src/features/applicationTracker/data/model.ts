export const APPLICATION_STATUS = {
  APPLIED: "Applied",
  INTERVIEW_1: "Interview #1",
  INTERVIEW_2: "Interview #2",
  REJECTED: "Rejected",
  READY_TO_APPLY: "Ready To Apply",
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];
export const APPLICATION_STATUS_FLOW: ApplicationStatus[] = [
  APPLICATION_STATUS.READY_TO_APPLY,
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.INTERVIEW_1,
  APPLICATION_STATUS.INTERVIEW_2,
  APPLICATION_STATUS.REJECTED,
];

export type ApplicationRow = {
  id: string;
  user_id: string;
  company: string;
  date_applied: string | null;
  status: ApplicationStatus;
  position: string;
  location: string;
  resume_filename: string | null;
  resume_path: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationFilter = "all" | "applied" | "interview" | "rejected";

export function getApplicationFilterBucket(status: string): Exclude<ApplicationFilter, "all"> {
  if (status === APPLICATION_STATUS.REJECTED) {
    return "rejected";
  }
  if (status === APPLICATION_STATUS.INTERVIEW_1 || status === APPLICATION_STATUS.INTERVIEW_2) {
    return "interview";
  }
  return "applied";
}

export function formatAppliedDate(value: string | null): string {
  if (!value) {
    return "---";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "---";
  }

  // Hide epoch-like fallback dates (e.g., Dec 31 1969 in local time zones).
  if (date.getUTCFullYear() <= 1970) {
    return "---";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getNextApplicationStatus(status: ApplicationStatus): ApplicationStatus {
  const index = APPLICATION_STATUS_FLOW.indexOf(status);
  if (index === -1) {
    return APPLICATION_STATUS.READY_TO_APPLY;
  }
  if (index === APPLICATION_STATUS_FLOW.length - 1) {
    return APPLICATION_STATUS.REJECTED;
  }
  return APPLICATION_STATUS_FLOW[index + 1];
}

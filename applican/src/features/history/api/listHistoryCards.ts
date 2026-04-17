import { supabase } from "../../../lib/supabaseClient";
import type { HistoryCardData } from "../../../components/history/history";

type HistoryQueryRow = {
  run_id: string;
  company: string;
  job_title: string;
  location: string;
  industry?: string | null;
  experience_needed: string;
  job_type: string;
  score: number;
  analysis_summary: string;
  created_at: string;
};

type ApplicationRow = {
  id: string;
  source_resume_run_id: string | null;
  date_applied?: string | null;
  resume_filename: string | null;
};

function toTitleCase(value: string): string {
  if (!value.trim()) {
    return "Unknown";
  }
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatOptionalDate(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.trim()) {
    return "---";
  }
  return formatDate(value);
}

function formatLocationDisplay(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "Location: N/A";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "Location: N/A";
  }

  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === "unknown" || normalizedLower === "unknown location" || normalizedLower === "n/a") {
    return "Location: N/A";
  }

  return normalized;
}

function toHistoryCardData(
  row: HistoryQueryRow,
  applicationByRunId: Map<string, { applicationId: string; appliedAt: string; resumeFilename: string | null }>,
): HistoryCardData {
  const normalizedJobType = row.job_type.trim().toLowerCase();
  const displayJobType =
    normalizedJobType === "remote" || normalizedJobType === "hybrid" || normalizedJobType === "onsite"
      ? toTitleCase(normalizedJobType)
      : "Unknown";
  const application = applicationByRunId.get(row.run_id);

  return {
    historyEntryId: row.run_id,
    resumeRunId: row.run_id,
    role: row.job_title || "Target Role",
    company: row.company || "Unknown Company",
    location: formatLocationDisplay(row.location),
    industry: row.industry || "Not specified",
    createdAt: formatDate(row.created_at),
    appliedAt: application?.appliedAt ?? "---",
    submittedAtIso: row.created_at,
    score: Number.isFinite(row.score) ? Math.max(0, Math.min(100, Math.round(row.score))) : 0,
    experienceNeeded: row.experience_needed || "Not specified",
    jobType: displayJobType,
    analysisSummary: row.analysis_summary || "No analysis summary available.",
    sourceApplicationId: application?.applicationId,
    resumeFilename: application?.resumeFilename ?? undefined,
  };
}

export type HistoryCardsPage = {
  cards: HistoryCardData[];
  hasMore: boolean;
};

export async function listHistoryCards(limit = 20, offset = 0): Promise<HistoryCardsPage> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const safeOffset = Math.max(0, Math.floor(offset));
  const queryLimit = safeLimit + 1;

  let data: HistoryQueryRow[] | null = null;
  let error: { message: string } | null = null;

  const primaryQuery = await supabase
    .from("analysis_runs")
    .select("run_id, company, job_title, location, industry, experience_needed, job_type, score, analysis_summary, created_at")
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + queryLimit - 1);

  if (primaryQuery.error?.message.includes("column analysis_runs.industry does not exist")) {
    const fallbackQuery = await supabase
      .from("analysis_runs")
      .select("run_id, company, job_title, location, experience_needed, job_type, score, analysis_summary, created_at")
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + queryLimit - 1);

    data = Array.isArray(fallbackQuery.data)
      ? (fallbackQuery.data as HistoryQueryRow[]).map((row) => ({ ...row, industry: "Not specified" }))
      : null;
    error = fallbackQuery.error ? { message: fallbackQuery.error.message } : null;
  } else {
    data = primaryQuery.data as HistoryQueryRow[] | null;
    error = primaryQuery.error ? { message: primaryQuery.error.message } : null;
  }

  if (error) {
    throw new Error(`Failed to load history: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return { cards: [], hasMore: false };
  }

  const historyRows = (data as HistoryQueryRow[]).slice(0, safeLimit);
  const hasMore = data.length > safeLimit;
  const runIds = historyRows.map((row) => row.run_id).filter(Boolean);
  const applicationByRunId = new Map<string, { applicationId: string; appliedAt: string; resumeFilename: string | null }>();

  if (runIds.length > 0) {
    const { data: applicationRows, error: applicationError } = await supabase
      .from("applications")
      .select("id, source_resume_run_id, date_applied, resume_filename")
      .in("source_resume_run_id", runIds);

    if (applicationError) {
      throw new Error(`Failed to load history resumes: ${applicationError.message}`);
    }

    if (Array.isArray(applicationRows)) {
      (applicationRows as ApplicationRow[]).forEach((row) => {
        if (row.source_resume_run_id) {
          applicationByRunId.set(row.source_resume_run_id, {
            applicationId: row.id,
            appliedAt: formatOptionalDate(row.date_applied),
            resumeFilename: row.resume_filename,
          });
        }
      });
    }
  }

  return {
    cards: historyRows.map((row) => toHistoryCardData(row, applicationByRunId)),
    hasMore,
  };
}

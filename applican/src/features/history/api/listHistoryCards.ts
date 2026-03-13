import { supabase } from "../../../lib/supabaseClient";
import type { HistoryCardData } from "../../../components/history/history";

type HistoryQueryRow = {
  run_id: string;
  company: string;
  job_title: string;
  location: string;
  experience_needed: string;
  job_type: string;
  score: number;
  analysis_summary: string;
  created_at: string;
};

type ApplicationRow = {
  id: string;
  source_resume_run_id: string | null;
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

function toHistoryCardData(
  row: HistoryQueryRow,
  applicationByRunId: Map<string, { applicationId: string; resumeFilename: string | null }>,
): HistoryCardData {
  const normalizedJobType = row.job_type.trim().toLowerCase();
  const displayJobType =
    normalizedJobType === "remote" || normalizedJobType === "hybrid" || normalizedJobType === "onsite"
      ? toTitleCase(normalizedJobType)
      : "Unknown";
  const application = applicationByRunId.get(row.run_id);

  return {
    role: row.job_title || "Target Role",
    company: row.company || "Unknown Company",
    location: row.location || "Unknown Location",
    createdAt: formatDate(row.created_at),
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

  const { data, error } = await supabase
    .from("analysis_runs")
    .select("run_id, company, job_title, location, experience_needed, job_type, score, analysis_summary, created_at")
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + queryLimit - 1);

  if (error) {
    throw new Error(`Failed to load history: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    return { cards: [], hasMore: false };
  }

  const historyRows = (data as HistoryQueryRow[]).slice(0, safeLimit);
  const hasMore = data.length > safeLimit;
  const runIds = historyRows.map((row) => row.run_id).filter(Boolean);
  const applicationByRunId = new Map<string, { applicationId: string; resumeFilename: string | null }>();

  if (runIds.length > 0) {
    const { data: applicationRows, error: applicationError } = await supabase
      .from("applications")
      .select("id, source_resume_run_id, resume_filename")
      .in("source_resume_run_id", runIds);

    if (applicationError) {
      throw new Error(`Failed to load history resumes: ${applicationError.message}`);
    }

    if (Array.isArray(applicationRows)) {
      (applicationRows as ApplicationRow[]).forEach((row) => {
        if (row.source_resume_run_id) {
          applicationByRunId.set(row.source_resume_run_id, {
            applicationId: row.id,
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

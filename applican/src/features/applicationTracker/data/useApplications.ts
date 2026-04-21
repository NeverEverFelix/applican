import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabaseClient";
import {
  APPLICATION_STATUS,
  type ApplicationFilter,
  type ApplicationRow,
  type ApplicationStatus,
} from "./model";

type UseApplicationsResult = {
  applications: ApplicationRow[];
  counts: Record<ApplicationFilter, number>;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  retryLoad: () => void;
  loadMore: () => void;
  updateApplicationStatus: (applicationId: string, nextStatus: ApplicationStatus) => Promise<void>;
  deleteApplications: (applicationIds: string[]) => Promise<boolean>;
  isUpdating: (applicationId: string) => boolean;
  isDeleting: boolean;
};

const APPLICATIONS_PAGE_SIZE = 25;

type FilterableApplicationsQuery<T> = {
  eq: (column: string, value: string) => T;
  or: (filters: string) => T;
};

function applyFilterToApplicationsQuery<T extends FilterableApplicationsQuery<T>>(query: T, filter: ApplicationFilter) {
  if (filter === "applied") {
    return query.eq("status", APPLICATION_STATUS.APPLIED);
  }
  if (filter === "interview") {
    return query.or(`status.eq.${APPLICATION_STATUS.INTERVIEW_1},status.eq.${APPLICATION_STATUS.INTERVIEW_2}`);
  }
  if (filter === "rejected") {
    return query.eq("status", APPLICATION_STATUS.REJECTED);
  }
  return query;
}

export function useApplications(filter: ApplicationFilter = "all"): UseApplicationsResult {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [counts, setCounts] = useState<Record<ApplicationFilter, number>>({
    all: 0,
    applied: 0,
    interview: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingById, setUpdatingById] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const nextFromRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const isRequestInFlightRef = useRef(false);
  const hasMoreRef = useRef(true);

  const isMissingAppliedDate = (value: string | null) => {
    if (!value) return true;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed.getUTCFullYear() <= 1970;
  };

  const loadPage = useCallback(async (reset: boolean) => {
    if (isRequestInFlightRef.current) {
      return;
    }

    if (!reset && !hasMoreRef.current) {
      return;
    }

    isRequestInFlightRef.current = true;
    if (reset) {
      setIsLoading(true);
      setErrorMessage(null);
      setHasMore(true);
      hasMoreRef.current = true;
      nextFromRef.current = 0;
    } else {
      setIsFetchingMore(true);
    }

    try {
      let userId = userIdRef.current;
      if (reset || !userId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          setErrorMessage(`Failed to load user: ${userError.message}`);
          setApplications([]);
          setHasMore(false);
          hasMoreRef.current = false;
          return;
        }

        if (!user) {
          userIdRef.current = null;
          setApplications([]);
          setHasMore(false);
          hasMoreRef.current = false;
          return;
        }

        userId = user.id;
        userIdRef.current = user.id;
      }

      const from = nextFromRef.current;
      const to = from + APPLICATIONS_PAGE_SIZE - 1;
      const countsPromise =
        reset && userId
          ? Promise.all([
              supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId),
              supabase
                .from("applications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("status", APPLICATION_STATUS.APPLIED),
              supabase
                .from("applications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .or(`status.eq.${APPLICATION_STATUS.INTERVIEW_1},status.eq.${APPLICATION_STATUS.INTERVIEW_2}`),
              supabase
                .from("applications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("status", APPLICATION_STATUS.REJECTED),
            ])
          : null;

      const applicationsQuery = applyFilterToApplicationsQuery(
        supabase.from("applications").select("*", { count: "exact" }).eq("user_id", userId),
        filter,
      );
      const { data, error } = await applicationsQuery.order("created_at", { ascending: false }).range(from, to);

      if (error) {
        setErrorMessage(`Failed to load applications: ${error.message}`);
        if (reset) {
          setApplications([]);
        }
        return;
      }

      const rows = (data ?? []) as ApplicationRow[];
      if (countsPromise) {
        const [allResult, appliedResult, interviewResult, rejectedResult] = await countsPromise;
        setCounts({
          all: allResult.count ?? rows.length,
          applied: appliedResult.count ?? 0,
          interview: interviewResult.count ?? 0,
          rejected: rejectedResult.count ?? 0,
        });
      }
      setApplications((prev) => (reset ? rows : [...prev, ...rows]));
      nextFromRef.current = from + rows.length;
      const nextHasMore = rows.length === APPLICATIONS_PAGE_SIZE;
      setHasMore(nextHasMore);
      hasMoreRef.current = nextHasMore;
    } finally {
      isRequestInFlightRef.current = false;
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;

    const loadInitial = async () => {
      if (!active) return;
      await loadPage(true);
    };

    void loadInitial();

    channel = supabase
      .channel("applications-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        void loadInitial();
      })
      .subscribe();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadPage, reloadNonce]);

  const updateApplicationStatus = useCallback(async (applicationId: string, nextStatus: ApplicationStatus) => {
    const target = applications.find((item) => item.id === applicationId);
    if (!target || target.status === nextStatus) {
      return;
    }

    const shouldSetAppliedDate =
      target.status === APPLICATION_STATUS.READY_TO_APPLY &&
      nextStatus === APPLICATION_STATUS.APPLIED &&
      isMissingAppliedDate(target.date_applied);
    const appliedNow = shouldSetAppliedDate ? new Date().toISOString() : target.date_applied;

    const previousStatus = target.status;
    const previousDateApplied = target.date_applied;
    const previousCounts = counts;
    setErrorMessage(null);
    setUpdatingById((prev) => ({ ...prev, [applicationId]: true }));
    setApplications((prev) =>
      prev.map((item) =>
        item.id === applicationId ? { ...item, status: nextStatus, date_applied: appliedNow } : item,
      ),
    );
    setCounts((prev) => {
      const nextCounts = { ...prev };
      if (previousStatus === APPLICATION_STATUS.APPLIED) nextCounts.applied = Math.max(0, nextCounts.applied - 1);
      if (previousStatus === APPLICATION_STATUS.INTERVIEW_1 || previousStatus === APPLICATION_STATUS.INTERVIEW_2) {
        nextCounts.interview = Math.max(0, nextCounts.interview - 1);
      }
      if (previousStatus === APPLICATION_STATUS.REJECTED) nextCounts.rejected = Math.max(0, nextCounts.rejected - 1);

      if (nextStatus === APPLICATION_STATUS.APPLIED) nextCounts.applied += 1;
      if (nextStatus === APPLICATION_STATUS.INTERVIEW_1 || nextStatus === APPLICATION_STATUS.INTERVIEW_2) {
        nextCounts.interview += 1;
      }
      if (nextStatus === APPLICATION_STATUS.REJECTED) nextCounts.rejected += 1;
      return nextCounts;
    });

    const updatePayload: { status: ApplicationStatus; date_applied?: string } = { status: nextStatus };
    if (shouldSetAppliedDate && appliedNow) {
      updatePayload.date_applied = appliedNow;
    }

    const { error } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("id", applicationId)
      .eq("user_id", target.user_id);

    if (error) {
      setApplications((prev) =>
        prev.map((item) =>
          item.id === applicationId
            ? { ...item, status: previousStatus, date_applied: previousDateApplied }
            : item,
        ),
      );
      setCounts(previousCounts);
      setErrorMessage(`Failed to update status: ${error.message}`);
    }

    setUpdatingById((prev) => ({ ...prev, [applicationId]: false }));
  }, [applications, counts]);

  const isUpdating = useCallback(
    (applicationId: string) => Boolean(updatingById[applicationId]),
    [updatingById],
  );

  const deleteApplications = useCallback(async (applicationIds: string[]) => {
    const idsToDelete = Array.from(new Set(applicationIds));
    if (idsToDelete.length === 0 || isDeleting) {
      return false;
    }

    const previousApplications = applications;
    const previousCounts = counts;
    const nextApplications = applications.filter((application) => !idsToDelete.includes(application.id));
    const deletedApplications = applications.filter((application) => idsToDelete.includes(application.id));

    setErrorMessage(null);
    setIsDeleting(true);
    setApplications(nextApplications);
    setCounts((prev) => ({
      all: Math.max(0, prev.all - idsToDelete.length),
      applied: Math.max(
        0,
        prev.applied - deletedApplications.filter((application) => application.status === APPLICATION_STATUS.APPLIED).length,
      ),
      interview: Math.max(
        0,
        prev.interview -
          deletedApplications.filter(
            (application) =>
              application.status === APPLICATION_STATUS.INTERVIEW_1 || application.status === APPLICATION_STATUS.INTERVIEW_2,
          ).length,
      ),
      rejected: Math.max(
        0,
        prev.rejected - deletedApplications.filter((application) => application.status === APPLICATION_STATUS.REJECTED).length,
      ),
    }));
    nextFromRef.current = nextApplications.length;

    const { error } = await supabase
      .from("applications")
      .delete()
      .in("id", idsToDelete)
      .eq("user_id", userIdRef.current);

    if (error) {
      setApplications(previousApplications);
      setCounts(previousCounts);
      nextFromRef.current = previousApplications.length;
      setErrorMessage(`Failed to delete applications: ${error.message}`);
      setIsDeleting(false);
      return false;
    }

    setIsDeleting(false);
    return true;
  }, [applications, counts, isDeleting]);

  const retryLoad = useCallback(() => {
    setReloadNonce((value) => value + 1);
  }, []);

  const loadMore = useCallback(() => {
    void loadPage(false);
  }, [loadPage]);

  return {
    applications,
    counts,
    isLoading,
    isFetchingMore,
    hasMore,
    errorMessage,
    retryLoad,
    loadMore,
    updateApplicationStatus,
    isUpdating,
    deleteApplications,
    isDeleting,
  };
}

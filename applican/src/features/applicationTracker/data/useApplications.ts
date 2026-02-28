import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabaseClient";
import {
  APPLICATION_STATUS,
  getApplicationFilterBucket,
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
  isUpdating: (applicationId: string) => boolean;
};

const APPLICATIONS_PAGE_SIZE = 25;

export function useApplications(): UseApplicationsResult {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingById, setUpdatingById] = useState<Record<string, boolean>>({});
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
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        setErrorMessage(`Failed to load applications: ${error.message}`);
        if (reset) {
          setApplications([]);
        }
        return;
      }

      const rows = (data ?? []) as ApplicationRow[];
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
  }, []);

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

  const counts = useMemo<Record<ApplicationFilter, number>>(() => {
    const applied = applications.filter((item) => getApplicationFilterBucket(item.status) === "applied").length;
    const interview = applications.filter((item) => getApplicationFilterBucket(item.status) === "interview").length;
    const rejected = applications.filter((item) => getApplicationFilterBucket(item.status) === "rejected").length;
    return {
      all: applications.length,
      applied,
      interview,
      rejected,
    };
  }, [applications]);

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
    setErrorMessage(null);
    setUpdatingById((prev) => ({ ...prev, [applicationId]: true }));
    setApplications((prev) =>
      prev.map((item) =>
        item.id === applicationId ? { ...item, status: nextStatus, date_applied: appliedNow } : item,
      ),
    );

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
      setErrorMessage(`Failed to update status: ${error.message}`);
    }

    setUpdatingById((prev) => ({ ...prev, [applicationId]: false }));
  }, [applications]);

  const isUpdating = useCallback(
    (applicationId: string) => Boolean(updatingById[applicationId]),
    [updatingById],
  );

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
  };
}

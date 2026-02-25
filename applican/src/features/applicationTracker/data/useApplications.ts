import { useCallback, useEffect, useMemo, useState } from "react";
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
  errorMessage: string | null;
  updateApplicationStatus: (applicationId: string, nextStatus: ApplicationStatus) => Promise<void>;
  isUpdating: (applicationId: string) => boolean;
};

export function useApplications(): UseApplicationsResult {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingById, setUpdatingById] = useState<Record<string, boolean>>({});

  const isMissingAppliedDate = (value: string | null) => {
    if (!value) return true;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed.getUTCFullYear() <= 1970;
  };

  useEffect(() => {
    let active = true;
    let channel: RealtimeChannel | null = null;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError) {
        setErrorMessage(`Failed to load user: ${userError.message}`);
        setApplications([]);
        setIsLoading(false);
        return;
      }

      if (!user) {
        setApplications([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setErrorMessage(`Failed to load applications: ${error.message}`);
        setApplications([]);
        setIsLoading(false);
        return;
      }

      setApplications((data ?? []) as ApplicationRow[]);
      setIsLoading(false);
    };

    void load();

    channel = supabase
      .channel("applications-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

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

  return { applications, counts, isLoading, errorMessage, updateApplicationStatus, isUpdating };
}

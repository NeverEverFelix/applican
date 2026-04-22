import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export const PROFESSIONAL_SUMMARY_LIMIT = 325;

type ProfileRow = {
  professional_summary: string | null;
};

export function isProfessionalSummaryOverLimit(value: string) {
  return value.length > PROFESSIONAL_SUMMARY_LIMIT;
}

async function loadProfessionalSummary(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("professional_summary")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(`Failed to load professional summary: ${error.message}`);
  }

  return data?.professional_summary ?? "";
}

async function saveProfessionalSummary(userId: string, value: string) {
  const professionalSummary = value.trim();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      professional_summary: professionalSummary || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Failed to save professional summary: ${error.message}`);
  }
}

export function useProfessionalSummary(userId: string | null) {
  const [summary, setSummary] = useState("");
  const [savedSummary, setSavedSummary] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      hasLoadedRef.current = false;
      setStatusMessage("");
      setErrorMessage("");
      return;
    }

    let cancelled = false;

    void loadProfessionalSummary(userId)
      .then((value) => {
        if (cancelled) {
          return;
        }

        setSummary(value);
        setSavedSummary(value);
        setStatusMessage("");
        setErrorMessage("");
        hasLoadedRef.current = true;
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSummary("");
        setSavedSummary("");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load professional summary.");
        hasLoadedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const visibleSummary = userId ? summary : "";
  const isOverLimit = isProfessionalSummaryOverLimit(visibleSummary);

  const persistSummary = async () => {
    if (!userId || !hasLoadedRef.current || isOverLimit || summary === savedSummary) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      await saveProfessionalSummary(userId, summary);
      setSavedSummary(summary);
      setStatusMessage("Professional summary saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save professional summary.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    summary: visibleSummary,
    setSummary,
    persistSummary,
    isOverLimit,
    isSaving,
    statusMessage,
    errorMessage,
  };
}

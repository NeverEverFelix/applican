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
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setSummary("");
      setSavedSummary("");
      hasLoadedRef.current = false;
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
        hasLoadedRef.current = true;
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSummary("");
        setSavedSummary("");
        hasLoadedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isOverLimit = isProfessionalSummaryOverLimit(summary);

  const persistSummary = async () => {
    if (!userId || !hasLoadedRef.current || isOverLimit || summary === savedSummary) {
      return;
    }

    await saveProfessionalSummary(userId, summary);
    setSavedSummary(summary);
  };

  return {
    summary,
    setSummary,
    persistSummary,
    isOverLimit,
  };
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuthSession } from "../../features/auth/useAuthSession";

function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildFullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

async function requestNameChange(firstName: string, lastName: string) {
  const normalizedFirstName = normalizeNamePart(firstName);
  const normalizedLastName = normalizeNamePart(lastName);
  const nextFullName = buildFullName(normalizedFirstName, normalizedLastName);

  if (!nextFullName) {
    throw new Error("Please enter a first or last name.");
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: nextFullName,
      name: nextFullName,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to update name.");
  }

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
  };
}

export function useChangeName(currentFirstName: string, currentLastName: string) {
  const { refreshSession } = useAuthSession();
  const [firstNameDraft, setFirstNameDraft] = useState(currentFirstName);
  const [lastNameDraft, setLastNameDraft] = useState(currentLastName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setFirstNameDraft(currentFirstName);
  }, [currentFirstName]);

  useEffect(() => {
    setLastNameDraft(currentLastName);
  }, [currentLastName]);

  const normalizedCurrentFirstName = useMemo(() => normalizeNamePart(currentFirstName), [currentFirstName]);
  const normalizedCurrentLastName = useMemo(() => normalizeNamePart(currentLastName), [currentLastName]);
  const normalizedDraftFirstName = useMemo(() => normalizeNamePart(firstNameDraft), [firstNameDraft]);
  const normalizedDraftLastName = useMemo(() => normalizeNamePart(lastNameDraft), [lastNameDraft]);
  const hasChanged =
    normalizedDraftFirstName !== normalizedCurrentFirstName || normalizedDraftLastName !== normalizedCurrentLastName;
  const canSubmit =
    hasChanged && Boolean(buildFullName(normalizedDraftFirstName, normalizedDraftLastName)) && !isSubmitting;

  const submitChange = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const nextName = await requestNameChange(normalizedDraftFirstName, normalizedDraftLastName);
      await refreshSession();
      setFirstNameDraft(nextName.firstName);
      setLastNameDraft(nextName.lastName);
      setStatusMessage("Name updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update name.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    firstNameDraft,
    setFirstNameDraft,
    lastNameDraft,
    setLastNameDraft,
    submitChange,
    isSubmitting,
    canSubmit,
    statusMessage,
    errorMessage,
  };
}

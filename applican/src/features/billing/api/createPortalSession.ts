import { supabase } from "../../../lib/supabaseClient";

type CreatePortalSessionResponse = {
  url?: unknown;
  error_code?: unknown;
  error_message?: unknown;
};

type EdgeFunctionErrorPayload = {
  error_code?: unknown;
  error_message?: unknown;
};

async function toPortalErrorMessage(error: unknown): Promise<string> {
  const fallback = "Failed to create billing portal session.";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const rawMessage = "message" in error && typeof error.message === "string" ? error.message : "";
  const context = "context" in error ? error.context : null;
  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as EdgeFunctionErrorPayload | null;

    const errorCode = typeof payload?.error_code === "string" ? payload.error_code : "";
    const errorMessage = typeof payload?.error_message === "string" ? payload.error_message : "";
    if (errorMessage) {
      return `${errorCode ? `${errorCode}: ` : ""}${errorMessage}`;
    }
  }

  return rawMessage.trim() || fallback;
}

export async function createPortalSession(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: {},
  });

  if (error) {
    throw new Error(await toPortalErrorMessage(error));
  }

  const payload = (data ?? {}) as CreatePortalSessionResponse;
  if (typeof payload.url !== "string" || !payload.url.trim()) {
    const errorMessage =
      typeof payload.error_message === "string" ? payload.error_message : "Invalid response from portal endpoint.";
    throw new Error(`Failed to create billing portal session: ${errorMessage}`);
  }

  return payload.url;
}

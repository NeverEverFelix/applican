import { supabase } from "../../../lib/supabaseClient";

type CancelSubscriptionResponse = {
  canceled_at_period_end?: unknown;
  current_period_end?: unknown;
  error_code?: unknown;
  error_message?: unknown;
};

type EdgeFunctionErrorPayload = {
  error_code?: unknown;
  error_message?: unknown;
};

async function toCancelSubscriptionErrorMessage(error: unknown): Promise<string> {
  const fallback = "Failed to cancel subscription.";

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

export async function cancelSubscription(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("cancel-subscription", {
    body: {},
  });

  if (error) {
    throw new Error(await toCancelSubscriptionErrorMessage(error));
  }

  const payload = (data ?? {}) as CancelSubscriptionResponse;
  if (payload.canceled_at_period_end !== true) {
    const errorMessage =
      typeof payload.error_message === "string" ? payload.error_message : "Invalid response from cancel subscription endpoint.";
    throw new Error(`Failed to cancel subscription: ${errorMessage}`);
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@18.0.0";

const FUNCTION_NAME = "cancel-subscription";
const BILLING_CUSTOMERS_TABLE = "billing_customers";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, "MISSING_ENV", `Missing environment variable: ${name}`);
  }
  return value;
}

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) {
    throw new HttpError(401, "MISSING_AUTH", "Missing Authorization header.");
  }

  const [scheme, token] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "INVALID_AUTH_HEADER", "Authorization header must be a Bearer token.");
  }

  return token;
}

function getCancelableSubscription(subscriptions: Stripe.Subscription[]) {
  return subscriptions.find((subscription) => {
    if (subscription.cancel_at_period_end) {
      return false;
    }

    return (
      subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due" ||
      subscription.status === "unpaid" ||
      subscription.status === "incomplete"
    );
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "METHOD_NOT_ALLOWED", "Use POST.");
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = getEnv("STRIPE_SECRET_KEY");
    const authHeader = req.headers.get("Authorization");
    const accessToken = parseBearerToken(authHeader);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecretKey);

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired user token.");
    }

    const { data: customerRow, error: customerError } = await adminClient
      .from(BILLING_CUSTOMERS_TABLE)
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerError) {
      throw new HttpError(500, "BILLING_CUSTOMER_LOOKUP_FAILED", customerError.message);
    }

    const stripeCustomerId =
      typeof customerRow?.stripe_customer_id === "string" ? customerRow.stripe_customer_id.trim() : "";

    if (!stripeCustomerId) {
      throw new HttpError(404, "BILLING_CUSTOMER_NOT_FOUND", "No Stripe customer found for this user.");
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 10,
    });
    const subscription = getCancelableSubscription(subscriptions.data);

    if (!subscription) {
      throw new HttpError(404, "SUBSCRIPTION_NOT_FOUND", "No active subscription found for this user.");
    }

    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return jsonResponse(
      {
        canceled_at_period_end: updatedSubscription.cancel_at_period_end,
        current_period_end: updatedSubscription.current_period_end,
        subscription_id: updatedSubscription.id,
        function: FUNCTION_NAME,
      },
      200,
    );
  } catch (error) {
    if (!(error instanceof HttpError) && error && typeof error === "object") {
      const stripeMessage = "message" in error && typeof error.message === "string" ? error.message : "";
      const stripeCode = "code" in error && typeof error.code === "string" ? error.code : "";
      if (stripeMessage) {
        return jsonResponse(
          {
            error_code: "STRIPE_API_ERROR",
            error_message: stripeMessage,
            stripe_code: stripeCode || null,
            function: FUNCTION_NAME,
          },
          400,
        );
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = error instanceof HttpError ? error.message : "Unexpected function error.";

    return jsonResponse({ error_code: code, error_message: message, function: FUNCTION_NAME }, status);
  }
});

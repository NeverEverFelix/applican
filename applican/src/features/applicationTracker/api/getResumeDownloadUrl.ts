import { supabase } from "../../../lib/supabaseClient";

type GetResumeDownloadUrlResponse = {
  signed_url: string;
  filename: string;
};

export async function getResumeDownloadUrl(applicationId: string): Promise<GetResumeDownloadUrlResponse> {
  const { data, error } = await supabase.functions.invoke("get-resume-download-url", {
    body: {
      application_id: applicationId,
    },
  });

  if (error) {
    const rawMessage = typeof error.message === "string" ? error.message : "Unknown edge function error.";
    if (rawMessage.includes("Failed to send a request to the Edge Function")) {
      throw new Error(
        "Edge Function unreachable. Deploy `get-resume-download-url`, verify VITE_SUPABASE_URL points to that project, and confirm the function is active.",
      );
    }
    throw new Error(`Failed to fetch download URL: ${rawMessage}`);
  }

  if (!data || typeof data !== "object" || !("signed_url" in data) || typeof data.signed_url !== "string") {
    throw new Error("Failed to fetch download URL: invalid function response.");
  }

  return data as GetResumeDownloadUrlResponse;
}

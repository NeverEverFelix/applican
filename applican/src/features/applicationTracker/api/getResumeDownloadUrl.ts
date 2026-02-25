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
    throw new Error(`Failed to fetch download URL: ${error.message}`);
  }

  if (!data || typeof data !== "object" || !("signed_url" in data) || typeof data.signed_url !== "string") {
    throw new Error("Failed to fetch download URL: invalid function response.");
  }

  return data as GetResumeDownloadUrlResponse;
}

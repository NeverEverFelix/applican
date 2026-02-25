import { supabase } from "../../../lib/supabaseClient";
import { RESUME_BUCKET_NAME } from "../model/constants";
import type { UploadResumeInput, UploadResumeResult } from "../model/types";

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function uploadResumeToStorage({
  file,
  userId,
  requestId,
}: UploadResumeInput): Promise<UploadResumeResult> {
  const filename = sanitizeFilename(file.name);
  const path = `${userId}/${requestId}/${filename}`;

  const { error } = await supabase.storage.from(RESUME_BUCKET_NAME).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload resume: ${error.message}`);
  }

  return {
    bucket: RESUME_BUCKET_NAME,
    path,
    filename,
  };
}

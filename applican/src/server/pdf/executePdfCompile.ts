function getRequiredEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable. Tried: ${names.join(", ")}`);
}

export type PdfCompileResult = {
  ok: boolean;
  filename: string;
  path: string;
  signed_url: string;
  bucket: string;
  run_id: string | null;
  generated_resume_id: string | null;
  compile?: {
    engine?: unknown;
    duration_ms?: unknown;
    input_hash?: unknown;
    cache_hit?: unknown;
    compile_log?: unknown;
  };
};

export async function executePdfCompile(params: {
  runId: string;
  fetchImpl?: typeof fetch;
}): Promise<PdfCompileResult> {
  const { runId, fetchImpl = fetch } = params;
  const supabaseUrl = getRequiredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const serviceRoleKey = getRequiredEnv(["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SECRET_KEY"]);

  const response = await fetchImpl(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/compile-tailored-resume-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      run_id: runId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (PdfCompileResult & { error_code?: string; error_message?: string })
    | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const errorMessage = typeof payload?.error_message === "string"
      ? payload.error_message
      : `compile-tailored-resume-pdf failed with HTTP ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload;
}

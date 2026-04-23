import type { Page } from "@playwright/test";

type MockedRunMode = "retryable_failure" | "success" | "retry_then_success";

type MockedRunOptions = {
  email: string;
  fullName: string;
  mode: MockedRunMode;
};

type ResumeRunPostPayload = {
  request_id?: string;
  job_description?: string;
  resume_path?: string;
  resume_filename?: string;
  user_id?: string;
};

export async function mockResumeRun(page: Page, options: MockedRunOptions) {
  const userId =
    options.mode === "success"
      ? "00000000-0000-4000-8000-000000000222"
      : "00000000-0000-4000-8000-000000000111";
  let createdRunId =
    options.mode === "success" ? "playwright-success-run-id" : "playwright-run-id";
  let createdRequestId =
    options.mode === "success"
      ? "playwright-success-request-id"
      : "playwright-request-id";
  let generateBulletsAttempt = 0;

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: options.email,
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: "email", providers: ["email"], plan: "pro" },
        user_metadata: { full_name: options.fullName },
      }),
    });
  });

  await page.route("**/storage/v1/object/Resumes/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ Key: `${userId}/${createdRequestId}/resume.pdf` }),
    });
  });

  await page.route("**/rest/v1/resume_runs**", async (route) => {
    const request = route.request();

    if (request.method() === "POST") {
      const payload = request.postDataJSON() as ResumeRunPostPayload;
      createdRequestId = payload.request_id ?? createdRequestId;
      createdRunId =
        options.mode === "success" ? "playwright-success-run-id" : "playwright-run-id";

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: createdRunId,
          request_id: createdRequestId,
          user_id: payload.user_id ?? userId,
          resume_path:
            payload.resume_path ?? `${userId}/${createdRequestId}/resume.pdf`,
          resume_filename: payload.resume_filename ?? "resume.pdf",
          job_description: payload.job_description ?? "",
          status: "queued",
          error_code: null,
          error_message: null,
          output: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: createdRunId,
          request_id: createdRequestId,
          user_id: userId,
          resume_path: `${userId}/${createdRequestId}/resume.pdf`,
          resume_filename: "resume.pdf",
          job_description: "Mocked job description",
          status: "queued",
          error_code: null,
          error_message: null,
          output: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "extracted",
          error_code: null,
          error_message: null,
          output: null,
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/functions/v1/generate-bullets", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    generateBulletsAttempt += 1;

    if (
      options.mode === "retryable_failure" ||
      (options.mode === "retry_then_success" && generateBulletsAttempt === 1)
    ) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error_code: "WORKER_OFFLINE",
          error_message: "Worker offline",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        run: {
          id: createdRunId,
          request_id: createdRequestId,
          user_id: userId,
          resume_path: `${userId}/${createdRequestId}/resume.pdf`,
          resume_filename: "resume.pdf",
          job_description: "Mocked job description",
          status: "extracted",
          error_code: null,
          error_message: null,
          output: {
            job: {
              company: "Acme",
              title: "Frontend Engineer",
            },
            match: {
              score: 91,
              label: "91% Match",
              summary: "Strong alignment with frontend platform work.",
            },
            analysis: {
              strengths: ["Strong React and TypeScript background"],
              gaps: ["Needs more explicit accessibility metrics"],
            },
            optimization_sections: [
              {
                id: "exp:0",
                kind: "experience",
                source_index: 0,
                display_title: "Frontend Experience",
                bullets: [
                  {
                    id: "exp:0:0",
                    source_index: 0,
                    original: "Built component libraries for internal teams",
                    optimized:
                      "Built component libraries for internal teams, improving delivery consistency across frontend squads",
                    action: "replace",
                  },
                ],
              },
            ],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    });
  });
}

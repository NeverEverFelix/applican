import { afterEach, describe, expect, it } from "vitest";

import { buildGenerateBulletsOpenAiRequest } from "./openAiRequest.ts";

const SOURCE_EXPERIENCE_SECTIONS = [
  {
    title: "Software Engineer",
    bullets: [
      "Built internal tooling for recruiters.",
      "Improved resume parsing reliability.",
    ],
  },
];

function getUserPrompt(request: ReturnType<typeof buildGenerateBulletsOpenAiRequest>): string {
  return request.messages.find((message) => message.role === "user")?.content ?? "";
}

describe("buildGenerateBulletsOpenAiRequest", () => {
  afterEach(() => {
    delete process.env.OPENAI_PROMPT_JOB_DESCRIPTION_MAX_CHARS;
    delete process.env.OPENAI_PROMPT_RESUME_CONTEXT_MAX_CHARS;
  });

  it("trims noisy job description content to a bounded prompt payload", () => {
    process.env.OPENAI_PROMPT_JOB_DESCRIPTION_MAX_CHARS = "800";

    const noisyJobDescription = [
      "Senior Software Engineer",
      "Responsibilities",
      ...Array.from({ length: 40 }, (_, index) => `Build distributed systems feature ${index + 1}.`),
      "Benefits include medical, dental, and vision.",
      ...Array.from({ length: 40 }, (_, index) => `Additional generic line ${index + 1}.`),
    ].join("\n");

    const request = buildGenerateBulletsOpenAiRequest({
      model: "gpt-4.1-mini",
      jobDescription: noisyJobDescription,
      resumeText: "Summary\nBuilt recruiter tooling.\nExperience\nDid work.\nEducation\nBS Computer Science",
      sourceExperienceSections: SOURCE_EXPERIENCE_SECTIONS,
    });

    const userPrompt = getUserPrompt(request);
    expect(userPrompt).toContain("Responsibilities");
    expect(userPrompt).not.toContain("Benefits include medical, dental, and vision.");
    expect(userPrompt.length).toBeLessThan(2500);
  });

  it("limits non-experience resume context while preserving high-signal sections", () => {
    process.env.OPENAI_PROMPT_RESUME_CONTEXT_MAX_CHARS = "700";

    const resumeText = [
      "Summary",
      ...Array.from({ length: 10 }, (_, index) => `Summary line ${index + 1}`),
      "Projects",
      ...Array.from({ length: 12 }, (_, index) => `Project line ${index + 1}`),
      "Experience",
      "Company A",
      "Did a lot of work.",
      "Skills",
      ...Array.from({ length: 12 }, (_, index) => `Skill ${index + 1}`),
      "Education",
      "State University",
      "BS Computer Science",
    ].join("\n");

    const request = buildGenerateBulletsOpenAiRequest({
      model: "gpt-4.1-mini",
      jobDescription: "Responsibilities\nBuild resume tooling.",
      resumeText,
      sourceExperienceSections: SOURCE_EXPERIENCE_SECTIONS,
    });

    const userPrompt = getUserPrompt(request);
    expect(userPrompt).toContain("Summary");
    expect(userPrompt).toContain("Projects");
    expect(userPrompt).toContain("Skills");
    expect(userPrompt).toContain("Education");
    expect(userPrompt).not.toContain("Project line 12");
    expect(userPrompt).not.toContain("Skill 12");
    expect(userPrompt.length).toBeLessThan(2500);
  });
});

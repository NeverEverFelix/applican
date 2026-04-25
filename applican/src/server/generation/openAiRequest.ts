import type { ParsedExperienceSection } from "./normalizeModelOutput.ts";

type OpenAiChatCompletionRequest = {
  model: string;
  temperature: number;
  response_format: {
    type: "json_schema";
    json_schema: ReturnType<typeof buildJsonSchema>;
  };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
};

const EXPERIENCE_SECTION_HEADERS = new Set([
  "experience",
  "professional experience",
  "work experience",
  "relevant experience",
  "employment history",
  "career history",
]);

const NON_EXPERIENCE_SECTION_HEADERS = new Set([
  "summary",
  "professional summary",
  "projects",
  "project experience",
  "technical skills",
  "skills",
  "education",
  "certifications",
  "awards",
  "publications",
  "leadership",
  "activities",
  "volunteer experience",
  "community involvement",
]);

const HIGH_SIGNAL_JOB_DESCRIPTION_HEADERS = new Set([
  "job description",
  "about the role",
  "responsibilities",
  "key responsibilities",
  "what you ll do",
  "what you will do",
  "requirements",
  "minimum qualifications",
  "preferred qualifications",
  "qualifications",
  "what we re looking for",
  "what we are looking for",
  "skills",
  "preferred skills",
  "experience",
  "about you",
]);

const HIGH_SIGNAL_RESUME_HEADERS = new Set([
  "summary",
  "professional summary",
  "projects",
  "project experience",
  "technical skills",
  "skills",
  "education",
  "certifications",
]);

function normalizeHeadingText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function compactPromptText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getPromptCharacterLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : fallback;
}

function trimLinesToCharacterBudget(
  lines: string[],
  maxChars: number,
): string[] {
  const kept: string[] = [];
  let totalChars = 0;

  for (const line of lines) {
    const nextChars = totalChars + line.length + (kept.length > 0 ? 1 : 0);
    if (nextChars > maxChars) {
      break;
    }
    kept.push(line);
    totalChars = nextChars;
  }

  while (kept[kept.length - 1] === "") {
    kept.pop();
  }

  return kept;
}

function isBoilerplateJobDescriptionLine(normalized: string): boolean {
  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith("benefits include") ||
    normalized.startsWith("in addition to our open door policy") ||
    normalized.startsWith("tjx considers all applicants") ||
    normalized.startsWith("applicants with arrest or conviction records") ||
    normalized.startsWith("address") ||
    normalized.startsWith("location") ||
    normalized.startsWith("this position has a starting pay range") ||
    normalized.startsWith("report this listing")
  ) {
    return true;
  }

  return false;
}

function buildPromptJobDescription(jobDescription: string): string {
  const maxChars = getPromptCharacterLimit("OPENAI_PROMPT_JOB_DESCRIPTION_MAX_CHARS", 4500);
  const lines = jobDescription
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const keptLines: string[] = [];
  let skippingBoilerplateBlock = false;
  let insideHighSignalBlock = false;

  for (const line of lines) {
    if (!line) {
      if (!skippingBoilerplateBlock && keptLines[keptLines.length - 1] !== "") {
        keptLines.push("");
      }
      continue;
    }

    const normalized = normalizeHeadingText(line);
    if (HIGH_SIGNAL_JOB_DESCRIPTION_HEADERS.has(normalized)) {
      insideHighSignalBlock = true;
      keptLines.push(line);
      continue;
    }

    if (insideHighSignalBlock && normalized && NON_EXPERIENCE_SECTION_HEADERS.has(normalized)) {
      insideHighSignalBlock = false;
    }

    if (isBoilerplateJobDescriptionLine(normalized)) {
      skippingBoilerplateBlock = true;
      continue;
    }

    if (skippingBoilerplateBlock) {
      if (
        normalized.startsWith("job description") ||
        normalized.startsWith("opportunity grow your career") ||
        normalized.startsWith("who we re looking for you")
      ) {
        skippingBoilerplateBlock = false;
      } else {
        continue;
      }
    }

    if (insideHighSignalBlock || keptLines.length < 40) {
      keptLines.push(line);
    }
  }

  const compacted = compactPromptText(trimLinesToCharacterBudget(keptLines, maxChars).join("\n"));
  return compacted || compactPromptText(jobDescription);
}

function buildPromptExperienceSections(sourceExperienceSections: ParsedExperienceSection[]) {
  return sourceExperienceSections.map((section) => ({
    title: section.title,
    bullets: section.bullets,
  }));
}

function buildPromptResumeContext(resumeText: string): string {
  const maxChars = getPromptCharacterLimit("OPENAI_PROMPT_RESUME_CONTEXT_MAX_CHARS", 3500);
  const lines = resumeText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const filteredLines: string[] = [];
  let insideExperienceSection = false;
  let currentHeader = "";
  let linesKeptForCurrentHeader = 0;

  for (const line of lines) {
    if (!line) {
      if (filteredLines[filteredLines.length - 1] !== "") {
        filteredLines.push("");
      }
      continue;
    }

    const normalized = normalizeHeadingText(line);
    if (EXPERIENCE_SECTION_HEADERS.has(normalized)) {
      insideExperienceSection = true;
      continue;
    }

    if (insideExperienceSection && NON_EXPERIENCE_SECTION_HEADERS.has(normalized)) {
      insideExperienceSection = false;
    }

    if (!insideExperienceSection) {
      if (NON_EXPERIENCE_SECTION_HEADERS.has(normalized)) {
        currentHeader = normalized;
        linesKeptForCurrentHeader = 0;
        filteredLines.push(line);
        continue;
      }

      const sectionLineLimit = HIGH_SIGNAL_RESUME_HEADERS.has(currentHeader) ? 8 : 4;
      if (linesKeptForCurrentHeader < sectionLineLimit) {
        filteredLines.push(line);
        linesKeptForCurrentHeader += 1;
      }
    }
  }

  const compacted = compactPromptText(trimLinesToCharacterBudget(filteredLines, maxChars).join("\n"));
  return compacted || compactPromptText(resumeText);
}

function buildJsonSchema() {
  return {
    name: "resume_studio_output_v2",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        company: {
          type: "string",
        },
        title: {
          type: "string",
        },
        location: {
          type: "string",
        },
        industry: {
          type: "string",
        },
        experience_needed: {
          type: "string",
        },
        job_type: {
          type: "string",
          enum: ["remote", "hybrid", "onsite", "unknown"],
        },
        match_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        match_summary: {
          type: "string",
        },
        strengths: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "string",
          },
        },
        gaps: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: {
            type: "string",
          },
        },
        optimizations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              experience_title: {
                type: "string",
              },
              role_before: {
                type: "string",
              },
              role_after: {
                type: "string",
              },
              bullets: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    action: {
                      type: "string",
                      enum: ["replace", "add"],
                    },
                    original: {
                      type: "string",
                    },
                    rewritten: {
                      type: "string",
                    },
                    reason: {
                      type: "string",
                    },
                  },
                  required: ["action", "original", "rewritten", "reason"],
                },
              },
            },
            required: ["experience_title", "role_before", "role_after", "bullets"],
          },
        },
        project_optimizations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: {
                type: "string",
              },
              bullets: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    action: {
                      type: "string",
                      enum: ["replace", "add"],
                    },
                    original: {
                      type: "string",
                    },
                    rewritten: {
                      type: "string",
                    },
                    reason: {
                      type: "string",
                    },
                  },
                  required: ["action", "original", "rewritten", "reason"],
                },
              },
            },
            required: ["name", "bullets"],
          },
        },
        selected_skills: {
          type: "array",
          items: {
            type: "string",
          },
        },
        experience_rewrites: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              company: {
                type: "string",
              },
              title: {
                type: "string",
              },
              bullets: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                },
              },
            },
            required: ["company", "title", "bullets"],
          },
        },
        projects_rewrites: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: {
                type: "string",
              },
              bullets: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                },
              },
            },
            required: ["name", "bullets"],
          },
        },
        education: {
          type: "object",
          additionalProperties: false,
          properties: {
            school: {
              type: "string",
            },
            degree: {
              type: "string",
            },
            grad_date: {
              type: "string",
            },
          },
          required: ["school", "degree", "grad_date"],
        },
      },
      required: [
        "company",
        "title",
        "location",
        "industry",
        "experience_needed",
        "job_type",
        "match_score",
        "match_summary",
        "strengths",
        "gaps",
        "optimizations",
        "project_optimizations",
        "selected_skills",
        "experience_rewrites",
        "projects_rewrites",
        "education",
      ],
    },
  };
}

export function buildGenerateBulletsOpenAiRequest(params: {
  model: string;
  jobDescription: string;
  resumeText: string;
  sourceExperienceSections: ParsedExperienceSection[];
}): OpenAiChatCompletionRequest {
  const { model, jobDescription, resumeText, sourceExperienceSections } = params;
  const compactJobDescription = buildPromptJobDescription(jobDescription);
  const promptResumeContext = buildPromptResumeContext(resumeText);
  const promptExperienceSections = buildPromptExperienceSections(sourceExperienceSections);

  return {
    model,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: buildJsonSchema(),
    },
    messages: [
      {
        role: "system",
        content: [
          "You are a resume optimization assistant.",
          "Return only valid JSON matching the schema.",
          "Score how well the resume matches the job from 0-100.",
          "Extract company, title, location, industry, required experience, and job type from the job description.",
          "Provide exactly 3 strengths and exactly 2 gaps.",
          "Provide structured optimization rewrites that are concise and ATS-friendly.",
          "Keep rewritten bullets concise, specific, measurable, and generally one sentence between 18 and 30 words.",
          "Avoid filler, repeated context, stacked adjectives, and unnecessary lead-ins.",
          "Preserve every source experience section in the same order they are provided unless a section is truly empty.",
          "For each experience optimization, keep role_before equal to the source section title and copy original values exactly when action='replace'.",
          "Also return selected_skills, experience_rewrites, project_optimizations, projects_rewrites, and education for LaTeX generation.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Job description:\n${compactJobDescription}`,
          `Resume context (summary, projects, skills, education, and other non-experience sections):\n${promptResumeContext || "[No extractable text available]"}`,
          `Source experience sections JSON:\n${JSON.stringify(promptExperienceSections)}`,
          "For optimization bullets and project_optimizations bullets, use action='replace' for edits to existing bullets and action='add' for new bullets.",
          "Return one experience optimization entry for each source experience section, in the same order as the source experience sections JSON.",
          "When action='replace', original must exactly match one source bullet from the corresponding source experience section.",
          "Do not invent extra experience sections. If a source bullet should remain mostly unchanged, still return it mapped to the same source section instead of moving it elsewhere.",
          "Each project_optimizations entry must preserve the source project name and pair each original project bullet with its improved rewritten version.",
          "For experience_rewrites and projects_rewrites, provide concise, measurable, ATS-friendly bullets.",
          "Do not pad bullets with soft skills or generic corporate phrasing unless the job description clearly requires it.",
          "If education details are missing in resume text, return empty strings for school/degree/grad_date.",
        ].join("\n\n"),
      },
    ],
  };
}

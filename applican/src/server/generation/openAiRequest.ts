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
  const lines = jobDescription
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const keptLines: string[] = [];
  let skippingBoilerplateBlock = false;

  for (const line of lines) {
    if (!line) {
      if (!skippingBoilerplateBlock && keptLines[keptLines.length - 1] !== "") {
        keptLines.push("");
      }
      continue;
    }

    const normalized = normalizeHeadingText(line);
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

    keptLines.push(line);
  }

  const compacted = compactPromptText(keptLines.join("\n"));
  return compacted || compactPromptText(jobDescription);
}

function buildPromptExperienceSections(sourceExperienceSections: ParsedExperienceSection[]) {
  return sourceExperienceSections.map((section) => ({
    title: section.title,
    bullets: section.bullets,
  }));
}

function buildPromptResumeContext(resumeText: string): string {
  const lines = resumeText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const filteredLines: string[] = [];
  let insideExperienceSection = false;

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
      filteredLines.push(line);
    }
  }

  const compacted = compactPromptText(filteredLines.join("\n"));
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
          "Score how well resume text matches the job description from 0-100.",
          "Extract the company name, role title, location, and industry from the job description.",
          "Extract the required experience (for example, '5+ years') and job type (remote, hybrid, onsite, unknown).",
          "Provide exactly 3 strengths and exactly 2 gaps.",
          "Provide structured optimization rewrites that are concise and ATS-friendly.",
          "Preserve every source experience section in the same order they are provided unless a section is truly empty.",
          "For each experience optimization, keep role_before equal to the source section title and use original values copied exactly from the provided source bullet text when action='replace'.",
          "Also return selected_skills, experience_rewrites, project_optimizations, projects_rewrites, and education to support resume LaTeX generation.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Job description:\n${compactJobDescription}`,
          `Resume context (summary, projects, skills, education, and other non-experience sections):\n${promptResumeContext || "[No extractable text available]"}`,
          `Source experience sections JSON:\n${JSON.stringify(promptExperienceSections)}`,
          "Infer company, role title, and industry from the job description when possible.",
          "For optimization bullets and project_optimizations bullets, use action='replace' for edits to existing bullets and action='add' for new bullets.",
          "Return one experience optimization entry for each source experience section, in the same order as the source experience sections JSON.",
          "When action='replace', original must exactly match one source bullet from the corresponding source experience section.",
          "Do not invent extra experience sections. If a source bullet should remain mostly unchanged, still return it mapped to the same source section instead of moving it elsewhere.",
          "Each project_optimizations entry must preserve the source project name and pair each original project bullet with its improved rewritten version.",
          "For experience_rewrites and projects_rewrites, provide concise, measurable, ATS-friendly bullets.",
          "If education details are missing in resume text, return empty strings for school/degree/grad_date.",
        ].join("\n\n"),
      },
    ],
  };
}

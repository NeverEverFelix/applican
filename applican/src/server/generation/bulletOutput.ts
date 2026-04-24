import {
  cleanOptimizationBulletText as cleanBulletText,
  cleanOptimizationSectionTitle,
  looksLikeSerializedPayload,
  type ResumeOptimizationPresentationSection,
} from "../../lib/resumeOptimizations.ts";
import type { TailoredResumeInput } from "./tailoredResume.ts";

export type ModelOptimizationBullet = {
  action: "replace" | "add";
  original: string;
  rewritten: string;
  reason: string;
};

export type ModelOptimization = {
  experience_title: string;
  role_before: string;
  role_after: string;
  bullets: ModelOptimizationBullet[];
};

export type ModelExperienceRewrite = {
  company: string;
  title: string;
  bullets: string[];
};

export type ModelProjectRewrite = {
  name: string;
  bullets: string[];
};

export type ModelProjectOptimizationBullet = {
  action: "replace" | "add";
  original: string;
  rewritten: string;
  reason: string;
};

export type ModelProjectOptimization = {
  name: string;
  bullets: ModelProjectOptimizationBullet[];
};

export type ModelEducation = {
  school: string;
  degree: string;
  grad_date: string;
};

export type ModelOutput = {
  company: string;
  title: string;
  location: string;
  industry: string;
  experience_needed: string;
  job_type: string;
  match_score: number;
  match_summary: string;
  strengths: string[];
  gaps: string[];
  optimizations: ModelOptimization[];
  project_optimizations?: ModelProjectOptimization[];
  selected_skills?: string[];
  experience_rewrites?: ModelExperienceRewrite[];
  projects_rewrites?: ModelProjectRewrite[];
  education?: ModelEducation;
};

export type ResumeStudioOutput = {
  job: {
    company: string;
    title: string;
    location: string;
    industry: string;
    experience_needed: string;
    job_type: "remote" | "hybrid" | "onsite" | "unknown";
  };
  match: {
    score: number;
    label: string;
    summary: string;
  };
  analysis: {
    strengths: string[];
    gaps: string[];
  };
  optimizations: Array<{
    experience_title: string;
    role_before: string;
    role_after: string;
    bullets: Array<{
      original: string;
      rewritten: string;
      action: "replace" | "add";
      reason: string;
    }>;
  }>;
  project_optimizations: Array<{
    name: string;
    bullets: Array<{
      original: string;
      rewritten: string;
      action: "replace" | "add";
      reason: string;
    }>;
  }>;
  source_experience_sections: Array<{
    title: string;
    bullets: string[];
    header_lines?: string[];
  }>;
  optimization_sections: ResumeOptimizationPresentationSection[];
  meta: {
    model: string;
    generated_at: string;
    request_id: string;
    parser_version?: string;
  };
  debug?: {
    parser: {
      experience_header_found: boolean;
      section_count: number;
      experience_slice_preview: string[];
      source_experience_sections: Array<{
        title: string;
        bullets: string[];
        header_lines: string[];
      }>;
    };
    model: {
      raw_response: unknown;
    };
  };
  tailored_resume_input: TailoredResumeInput;
  summary: string;
  tailored_bullets: string[];
  skills: string[];
  missing_requirements: string[];
};

export function cleanString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
}

export function normalizeJobType(value: unknown): ResumeStudioOutput["job"]["job_type"] {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === "remote" || normalized === "hybrid" || normalized === "onsite") {
    return normalized;
  }
  return "unknown";
}

export function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => cleanString(item))
    .filter((item) => item && !looksLikeSerializedPayload(item));
}

export function normalizeFixedCount(items: string[], size: number): string[] {
  const result = items.slice(0, size);
  while (result.length < size) {
    result.push("No additional insight available.");
  }
  return result;
}

export function normalizeOptimizations(value: unknown): ResumeStudioOutput["optimizations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as {
        experience_title?: unknown;
        role_before?: unknown;
        role_after?: unknown;
        bullets?: unknown;
      };

      const bullets = Array.isArray(row.bullets)
        ? row.bullets
            .map((bullet) => {
              if (!bullet || typeof bullet !== "object") {
                return null;
              }
              const b = bullet as {
                original?: unknown;
                rewritten?: unknown;
                action?: unknown;
                reason?: unknown;
              };
              const rewritten = cleanBulletText(b.rewritten);
              if (!rewritten) {
                return null;
              }

              const action: "replace" | "add" = b.action === "add" ? "add" : "replace";
              return {
                original: cleanBulletText(b.original),
                rewritten,
                action,
                reason: cleanString(b.reason),
              };
            })
            .filter((bullet): bullet is NonNullable<typeof bullet> => Boolean(bullet))
        : [];

      if (!bullets.length) {
        return null;
      }

      const experienceTitle = cleanOptimizationSectionTitle(row.experience_title);
      const roleBefore = cleanOptimizationSectionTitle(row.role_before);
      const roleAfter = cleanOptimizationSectionTitle(row.role_after);
      const stableTitle = experienceTitle || roleBefore || roleAfter || "Experience";

      return {
        experience_title: stableTitle,
        role_before: roleBefore || stableTitle,
        role_after: roleAfter || roleBefore || stableTitle,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function normalizeSkills(value: unknown): string[] {
  const normalized = normalizeList(value);
  const deduped = Array.from(new Set(normalized.map((item) => item.trim()).filter(Boolean)));
  return deduped.slice(0, 12);
}

export function normalizeStringBullets(value: unknown, maxItems = 8): string[] {
  return normalizeList(value).slice(0, maxItems);
}

export function normalizeProjectOptimizations(
  value: unknown,
): ResumeStudioOutput["project_optimizations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as {
        name?: unknown;
        bullets?: unknown;
      };
      const name = cleanString(row.name, "Project");
      const bullets = Array.isArray(row.bullets)
        ? row.bullets
            .map((bullet) => {
              if (!bullet || typeof bullet !== "object") {
                return null;
              }
              const b = bullet as {
                action?: unknown;
                original?: unknown;
                rewritten?: unknown;
                reason?: unknown;
              };
              const action: "replace" | "add" = b.action === "add" ? "add" : "replace";
              const original = cleanBulletText(b.original);
              const rewritten = cleanBulletText(b.rewritten);
              const reason = cleanString(b.reason);
              if (!original && !rewritten) {
                return null;
              }
              return {
                action,
                original: original || rewritten,
                rewritten: rewritten || original,
                reason,
              };
            })
            .filter((bullet): bullet is NonNullable<typeof bullet> => Boolean(bullet))
        : [];

      if (!bullets.length) {
        return null;
      }

      return {
        name,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function normalizeExperienceRewrites(value: unknown): TailoredResumeInput["experience_rewrites"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Partial<ModelExperienceRewrite>;
      const company = cleanString(row.company);
      const title = cleanString(row.title);
      const bullets = normalizeStringBullets(row.bullets, 8);
      if (!title || bullets.length === 0) {
        return null;
      }

      return {
        company: company || "Unknown Company",
        title,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function normalizeProjectsRewrites(value: unknown): TailoredResumeInput["projects_rewrites"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const row = entry as Partial<ModelProjectRewrite>;
      const name = cleanString(row.name);
      const bullets = normalizeStringBullets(row.bullets, 6);
      if (!name || bullets.length === 0) {
        return null;
      }

      return {
        name,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function normalizeEducation(value: unknown): TailoredResumeInput["education"] {
  if (!value || typeof value !== "object") {
    return {
      school: "",
      degree: "",
      grad_date: "",
    };
  }

  const row = value as Partial<ModelEducation>;
  return {
    school: cleanString(row.school),
    degree: cleanString(row.degree),
    grad_date: cleanString(row.grad_date),
  };
}

export function deriveExperienceRewritesFromOptimizations(
  optimizations: ResumeStudioOutput["optimizations"],
  fallbackCompany: string,
): TailoredResumeInput["experience_rewrites"] {
  return optimizations
    .map((optimization) => {
      const bullets = optimization.bullets.map((bullet) => bullet.rewritten).filter(Boolean);
      if (bullets.length === 0) {
        return null;
      }
      return {
        company: fallbackCompany || "Unknown Company",
        title:
          cleanOptimizationSectionTitle(optimization.role_after) ||
          cleanOptimizationSectionTitle(optimization.role_before) ||
          cleanOptimizationSectionTitle(optimization.experience_title) ||
          "Experience",
        bullets: bullets.slice(0, 8),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

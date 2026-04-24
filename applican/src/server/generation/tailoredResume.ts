export type TailoredResumeInput = {
  target_role: string;
  target_company: string;
  summary: string;
  selected_skills: string[];
  experience_rewrites: Array<{
    company: string;
    title: string;
    bullets: string[];
  }>;
  projects_rewrites: Array<{
    name: string;
    bullets: string[];
  }>;
  education: {
    school: string;
    degree: string;
    grad_date: string;
  };
};

function cleanString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeHeadingText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikeBulletBlock(value: string): boolean {
  return value.includes("\n") || /^\s*[-*•]/.test(value);
}

function cleanExperienceTitle(value: unknown): string {
  const text = cleanString(value);
  if (!text || looksLikeBulletBlock(text)) {
    return "";
  }

  return text.replace(/\s+at\s+[A-Z].*$/i, "").trim();
}

function normalizeExperienceIdentity(value: unknown): string {
  return normalizeHeadingText(cleanExperienceTitle(value) || cleanString(value));
}

function normalizeList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => cleanString(item))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function normalizeExperienceRewrites(value: unknown): TailoredResumeInput["experience_rewrites"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const row = entry as { company?: unknown; title?: unknown; bullets?: unknown };
      const title = cleanString(row.title);
      const bullets = normalizeList(row.bullets, 8);
      if (!title || bullets.length === 0) {
        return null;
      }

      return {
        company: cleanString(row.company, "Unknown Company"),
        title,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function normalizeProjectsRewrites(value: unknown): TailoredResumeInput["projects_rewrites"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const row = entry as { name?: unknown; bullets?: unknown };
      const name = cleanString(row.name);
      const bullets = normalizeList(row.bullets, 6);
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

function normalizeEducation(value: unknown): TailoredResumeInput["education"] {
  if (!value || typeof value !== "object") {
    return {
      school: "",
      degree: "",
      grad_date: "",
    };
  }

  const row = value as { school?: unknown; degree?: unknown; grad_date?: unknown };
  return {
    school: cleanString(row.school),
    degree: cleanString(row.degree),
    grad_date: cleanString(row.grad_date),
  };
}

function deriveExperienceFromOptimizations(
  value: unknown,
  fallbackCompany: string,
): TailoredResumeInput["experience_rewrites"] {
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

      if (!Array.isArray(row.bullets)) {
        return null;
      }

      const bullets = row.bullets
        .map((bullet) => {
          if (!bullet || typeof bullet !== "object") {
            return "";
          }
          const b = bullet as { rewritten?: unknown };
          return cleanString(b.rewritten);
        })
        .filter(Boolean)
        .slice(0, 8);

      if (bullets.length === 0) {
        return null;
      }

      const title =
        cleanExperienceTitle(row.role_after) ||
        cleanExperienceTitle(row.role_before) ||
        cleanExperienceTitle(row.experience_title);
      if (!title) {
        return null;
      }

      return {
        company: fallbackCompany || "Unknown Company",
        title,
        bullets,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function mergeExperienceRewrites(
  modelExperience: TailoredResumeInput["experience_rewrites"],
  optimizationExperience: TailoredResumeInput["experience_rewrites"],
): TailoredResumeInput["experience_rewrites"] {
  if (modelExperience.length === 0) {
    return optimizationExperience;
  }

  if (optimizationExperience.length === 0) {
    return modelExperience;
  }

  const modelByNormalizedTitle = new Map(
    modelExperience.map((entry) => [normalizeExperienceIdentity(entry.title), entry] as const),
  );

  const merged = optimizationExperience.map((entry) => {
    const normalizedTitle = normalizeExperienceIdentity(entry.title);
    const modelEntry = modelByNormalizedTitle.get(normalizedTitle);
    if (!modelEntry) {
      return entry;
    }

    return {
      company: modelEntry.company || entry.company,
      title: modelEntry.title || entry.title,
      bullets: modelEntry.bullets.length > 0 ? modelEntry.bullets : entry.bullets,
    };
  });

  const mergedTitles = new Set(merged.map((entry) => normalizeExperienceIdentity(entry.title)));
  const unmatchedModelEntries = modelExperience.filter(
    (entry) => !mergedTitles.has(normalizeExperienceIdentity(entry.title)),
  );

  return [...merged, ...unmatchedModelEntries];
}

export function parseTailoredResumeInput(runOutput: unknown, resumeText: string): TailoredResumeInput {
  const output = runOutput && typeof runOutput === "object" ? (runOutput as Record<string, unknown>) : {};
  const tailored = output.tailored_resume_input && typeof output.tailored_resume_input === "object"
    ? (output.tailored_resume_input as Record<string, unknown>)
    : {};

  const fallbackJob = output.job && typeof output.job === "object" ? (output.job as Record<string, unknown>) : {};
  const fallbackMatch = output.match && typeof output.match === "object" ? (output.match as Record<string, unknown>) : {};

  const targetRole = cleanString(tailored.target_role, cleanString(fallbackJob.title, "Target Role"));
  const targetCompany = cleanString(tailored.target_company, cleanString(fallbackJob.company, "Unknown Company"));

  const summaryFallback = cleanString(fallbackMatch.summary, cleanString(output.summary, ""));
  const inferredSummary = summaryFallback || cleanString(resumeText.split("\n").slice(0, 3).join(" "));
  const summary = cleanString(tailored.summary, inferredSummary || "Resume tailored for the target role.");

  const selectedSkills = normalizeList(tailored.selected_skills ?? output.skills, 14);

  const modelExperience = normalizeExperienceRewrites(tailored.experience_rewrites);
  const fallbackOptimizations = deriveExperienceFromOptimizations(output.optimizations, targetCompany);
  const experienceRewrites = mergeExperienceRewrites(modelExperience, fallbackOptimizations);

  return {
    target_role: targetRole,
    target_company: targetCompany,
    summary,
    selected_skills: selectedSkills,
    experience_rewrites: experienceRewrites,
    projects_rewrites: normalizeProjectsRewrites(tailored.projects_rewrites),
    education: normalizeEducation(tailored.education),
  };
}

export function escapeLatex(value: string): string {
  const backslashToken = "__LATEX_BACKSLASH__";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized
    .replace(/\\/g, backslashToken)
    .replace(/([{}$&#_%])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replaceAll(backslashToken, "\\textbackslash{}");
}

export function sanitizeNameForFile(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tailored-resume";
}

function latexItems(items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  const rows = items
    .map((item) => `    \\resumeItem{${escapeLatex(item)}}`)
    .join("\n");

  return ["  \\resumeItemListStart", rows, "  \\resumeItemListEnd"].join("\n");
}

export function buildExperienceSection(experience: TailoredResumeInput["experience_rewrites"]): string {
  if (experience.length === 0) {
    return [
      "\\section{Experience}",
      "\\resumeSubHeadingListStart",
      "  \\resumeSubheading{Experience details unavailable}{}{}{}",
      "\\resumeSubHeadingListEnd",
    ].join("\n");
  }

  const blocks = experience
    .map((entry) => {
      const company = escapeLatex(entry.company);
      const title = escapeLatex(entry.title);
      return [
        `  \\resumeSubheading{${company}}{}{${title}}{}`,
        latexItems(entry.bullets),
      ].join("\n");
    })
    .join("\n");

  return ["\\section{Experience}", "\\resumeSubHeadingListStart", blocks, "\\resumeSubHeadingListEnd"].join("\n");
}

export function buildProjectsSection(projects: TailoredResumeInput["projects_rewrites"]): string {
  if (projects.length === 0) {
    return "";
  }

  const blocks = projects
    .map((project) => {
      const name = escapeLatex(project.name);
      return [
        "  \\resumeProjectHeading",
        `      {\\textbf{${name}}}{}`,
        latexItems(project.bullets),
      ].join("\n");
    })
    .join("\n");

  return ["\\section{Projects}", "\\resumeSubHeadingListStart", blocks, "\\resumeSubHeadingListEnd"].join("\n");
}

function buildEducationSection(education: TailoredResumeInput["education"]): string {
  const school = escapeLatex(education.school || "Education");
  const degree = escapeLatex(education.degree || "");
  const gradDate = escapeLatex(education.grad_date || "");

  return [
    "\\section{Education}",
    "\\resumeSubHeadingListStart",
    `  \\resumeSubheading{${school}}{${gradDate}}{${degree}}{}`,
    "\\resumeSubHeadingListEnd",
  ].join("\n");
}

function buildSkillsSection(skills: string[]): string {
  const skillText = escapeLatex(skills.join(", "));
  return [
    "\\section{Technical Skills}",
    "\\begin{itemize}[leftmargin=0.15in, label={}]",
    "  \\small{\\item{",
    `    \\textbf{Skills}{: ${skillText}}`,
    "  }}",
    "\\end{itemize}",
  ].join("\n");
}

function buildSummarySection(summary: string): string {
  const safeSummary = escapeLatex(summary);
  return [
    "\\section{Summary}",
    "\\begin{itemize}[leftmargin=0.15in, label={}]",
    "  \\small{\\item{",
    `    ${safeSummary}`,
    "  }}",
    "\\end{itemize}",
  ].join("\n");
}

function extractCandidateName(resumeText: string): string {
  const firstLine = cleanString(resumeText.split("\n")[0] ?? "");
  if (!firstLine) {
    return "Candidate Name";
  }

  if (firstLine.length > 64 || /[@|]/.test(firstLine)) {
    return "Candidate Name";
  }

  return firstLine;
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [token, value]) => {
    return result.replaceAll(`{{${token}}}`, value);
  }, template);
}

export function buildLatexDocument(input: TailoredResumeInput, resumeText: string, template: string): string {
  const candidateName = escapeLatex(extractCandidateName(resumeText));
  const roleLine = escapeLatex(`${input.target_role} - ${input.target_company}`);
  const summarySection = buildSummarySection(input.summary);
  const educationSection = buildEducationSection(input.education);
  const experienceSection = buildExperienceSection(input.experience_rewrites);
  const projectsSection = buildProjectsSection(input.projects_rewrites);
  const skillsSection = buildSkillsSection(input.selected_skills);

  return applyTemplate(template, {
    NAME: candidateName,
    ROLE_LINE: roleLine,
    SUMMARY_SECTION: summarySection,
    EDUCATION_SECTION: educationSection,
    EXPERIENCE_SECTION: experienceSection,
    PROJECTS_SECTION: projectsSection,
    SKILLS_SECTION: skillsSection,
  });
}

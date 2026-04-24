import {
  cleanOptimizationBulletText as cleanBulletText,
  cleanOptimizationSectionTitle,
  deriveSourceExperienceSectionsFromExperienceRewrites,
  deriveSourceExperienceSectionsFromOptimizations,
  extractResumeOptimizationPresentationSections,
  normalizeHeadingText,
} from "../../lib/resumeOptimizations.ts";
import {
  clampScore,
  cleanString,
  deriveExperienceRewritesFromOptimizations,
  normalizeEducation,
  normalizeExperienceRewrites,
  normalizeFixedCount,
  normalizeJobType,
  normalizeList,
  normalizeOptimizations,
  normalizeProjectOptimizations,
  normalizeProjectsRewrites,
  normalizeSkills,
  type ModelOutput,
  type ResumeStudioOutput,
} from "./bulletOutput.ts";
import type { TailoredResumeInput } from "./tailoredResume.ts";

export type ParsedExperienceSection = {
  title: string;
  bullets: string[];
  header_lines?: string[];
};

type SectionMatchCandidate = {
  titleCandidates: string[];
  bulletCandidates: string[];
};

function normalizeBulletText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9%/$+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function createSourceSectionCandidate(section: ParsedExperienceSection): SectionMatchCandidate {
  return {
    titleCandidates: collectUnique([normalizeHeadingText(section.title)]),
    bulletCandidates: collectUnique(section.bullets.map(normalizeBulletText)),
  };
}

function createOptimizationSectionCandidate(
  optimization: ResumeStudioOutput["optimizations"][number] | null | undefined,
): SectionMatchCandidate {
  return {
    titleCandidates: collectUnique([
      normalizeHeadingText(cleanOptimizationSectionTitle(optimization?.experience_title)),
      normalizeHeadingText(cleanOptimizationSectionTitle(optimization?.role_before)),
      normalizeHeadingText(cleanOptimizationSectionTitle(optimization?.role_after)),
    ]),
    bulletCandidates: collectUnique(
      (optimization?.bullets ?? []).map((bullet) => normalizeBulletText(cleanBulletText(bullet.original))),
    ),
  };
}

function createRewriteSectionCandidate(
  rewrite: TailoredResumeInput["experience_rewrites"][number] | null | undefined,
): SectionMatchCandidate {
  return {
    titleCandidates: collectUnique([normalizeHeadingText(cleanString(rewrite?.title))]),
    bulletCandidates: [],
  };
}

function scoreSectionMatch(sourceSection: ParsedExperienceSection, candidate: SectionMatchCandidate): number {
  const sourceCandidate = createSourceSectionCandidate(sourceSection);
  let score = 0;

  if (
    sourceCandidate.titleCandidates.some((sourceTitle) =>
      candidate.titleCandidates.some((candidateTitle) => candidateTitle && candidateTitle === sourceTitle)
    )
  ) {
    score += 100;
  } else if (
    sourceCandidate.titleCandidates.some((sourceTitle) =>
      candidate.titleCandidates.some((candidateTitle) =>
        candidateTitle &&
        sourceTitle &&
        (candidateTitle.includes(sourceTitle) || sourceTitle.includes(candidateTitle))
      )
    )
  ) {
    score += 60;
  }

  const sourceBullets = new Set(sourceCandidate.bulletCandidates);
  for (const bulletCandidate of candidate.bulletCandidates) {
    if (bulletCandidate && sourceBullets.has(bulletCandidate)) {
      score += 15;
    }
  }

  return score;
}

function matchSourceSections(
  sourceSections: ParsedExperienceSection[],
  candidates: SectionMatchCandidate[],
): Array<number | null> {
  const pairs: Array<{ candidateIndex: number; sourceIndex: number; score: number }> = [];

  candidates.forEach((candidate, candidateIndex) => {
    sourceSections.forEach((sourceSection, sourceIndex) => {
      const score = scoreSectionMatch(sourceSection, candidate);
      if (score > 0) {
        pairs.push({ candidateIndex, sourceIndex, score });
      }
    });
  });

  pairs.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.candidateIndex !== right.candidateIndex) {
      return left.candidateIndex - right.candidateIndex;
    }
    return left.sourceIndex - right.sourceIndex;
  });

  const matches = Array.from({ length: candidates.length }, () => null as number | null);
  const usedSourceIndices = new Set<number>();

  for (const pair of pairs) {
    if (matches[pair.candidateIndex] !== null || usedSourceIndices.has(pair.sourceIndex)) {
      continue;
    }

    matches[pair.candidateIndex] = pair.sourceIndex;
    usedSourceIndices.add(pair.sourceIndex);
  }

  return matches;
}

function findBestSourceBulletIndex(
  sourceBullets: string[],
  candidateOriginal: string,
  usedSourceIndices: Set<number>,
): number {
  const normalizedCandidate = normalizeBulletText(candidateOriginal);
  if (!normalizedCandidate) {
    return -1;
  }

  let bestIndex = -1;
  let bestScore = 0;

  sourceBullets.forEach((sourceBullet, sourceIndex) => {
    if (usedSourceIndices.has(sourceIndex)) {
      return;
    }

    const normalizedSource = normalizeBulletText(sourceBullet);
    if (!normalizedSource) {
      return;
    }

    let score = 0;
    if (normalizedSource === normalizedCandidate) {
      score = 100;
    } else if (
      normalizedSource.length >= 12 &&
      normalizedCandidate.length >= 12 &&
      (normalizedSource.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedSource))
    ) {
      score = 70;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = sourceIndex;
    }
  });

  return bestIndex;
}

function rebuildExperienceOptimizations(
  optimizations: ResumeStudioOutput["optimizations"],
  experienceRewrites: TailoredResumeInput["experience_rewrites"],
  sourceSections: Array<{
    title: string;
    bullets: string[];
  }>,
): ResumeStudioOutput["optimizations"] {
  if (sourceSections.length === 0) {
    return optimizations.length > 0 ? optimizations : [];
  }

  const optimizationMatches = matchSourceSections(
    sourceSections,
    optimizations.map((optimization) => createOptimizationSectionCandidate(optimization)),
  );
  const rewriteMatches = matchSourceSections(
    sourceSections,
    experienceRewrites.map((rewrite) => createRewriteSectionCandidate(rewrite)),
  );

  const optimizationBySourceIndex = new Map<number, ResumeStudioOutput["optimizations"][number]>();
  optimizationMatches.forEach((sourceIndex, optimizationIndex) => {
    if (sourceIndex === null) {
      return;
    }
    optimizationBySourceIndex.set(sourceIndex, optimizations[optimizationIndex]);
  });

  const rewriteBySourceIndex = new Map<number, TailoredResumeInput["experience_rewrites"][number]>();
  rewriteMatches.forEach((sourceIndex, rewriteIndex) => {
    if (sourceIndex === null) {
      return;
    }
    rewriteBySourceIndex.set(sourceIndex, experienceRewrites[rewriteIndex]);
  });

  const rebuiltSections = sourceSections
    .map((sourceSection, sectionIndex) => {
      const optimization = optimizationBySourceIndex.get(sectionIndex) ?? null;
      const rewrite = rewriteBySourceIndex.get(sectionIndex) ?? null;
      const rewriteBullets = rewrite?.bullets ?? [];
      const optimizationBullets = optimization?.bullets ?? [];
      const title =
        cleanOptimizationSectionTitle(optimization?.experience_title) ||
        cleanOptimizationSectionTitle(optimization?.role_before) ||
        cleanOptimizationSectionTitle(optimization?.role_after) ||
        cleanString(rewrite?.title) ||
        cleanString(sourceSection.title) ||
        `Experience ${sectionIndex + 1}`;
      const roleAfter =
        cleanOptimizationSectionTitle(optimization?.role_after) ||
        cleanOptimizationSectionTitle(optimization?.role_before) ||
        cleanOptimizationSectionTitle(optimization?.experience_title) ||
        cleanString(rewrite?.title) ||
        cleanString(sourceSection.title) ||
        title;
      const mappedOptimizationBullets = Array.from(
        { length: sourceSection.bullets.length },
        () => null as ResumeStudioOutput["optimizations"][number]["bullets"][number] | null,
      );
      const usedSourceBulletIndices = new Set<number>();
      const additionalOptimizationBullets: ResumeStudioOutput["optimizations"][number]["bullets"] = [];

      optimizationBullets.forEach((optimizationBullet) => {
        if (optimizationBullet.action === "add") {
          additionalOptimizationBullets.push(optimizationBullet);
          return;
        }

        const matchedSourceIndex = findBestSourceBulletIndex(
          sourceSection.bullets,
          cleanBulletText(optimizationBullet.original),
          usedSourceBulletIndices,
        );

        if (matchedSourceIndex === -1) {
          return;
        }

        mappedOptimizationBullets[matchedSourceIndex] = optimizationBullet;
        usedSourceBulletIndices.add(matchedSourceIndex);
      });

      const bullets = sourceSection.bullets
        .map((sourceOriginal, bulletIndex) => {
          const optimizationBullet = mappedOptimizationBullets[bulletIndex];
          const rewriteBullet = cleanString(rewriteBullets[bulletIndex]);
          const rewritten =
            cleanBulletText(optimizationBullet?.rewritten) ||
            rewriteBullet ||
            cleanString(sourceOriginal);

          if (!sourceOriginal && !rewritten) {
            return null;
          }

          return {
            action: optimizationBullet?.action ?? "replace",
            original: cleanString(sourceOriginal),
            rewritten: rewritten || cleanString(sourceOriginal),
            reason: cleanString(optimizationBullet?.reason),
          };
        })
        .filter((bullet): bullet is NonNullable<typeof bullet> => Boolean(bullet));

      const appendedRewriteBullets = rewriteBullets
        .slice(sourceSection.bullets.length)
        .map((bullet) => cleanString(bullet))
        .filter(Boolean)
        .map((bullet) => ({
          action: "add" as const,
          original: "",
          rewritten: bullet,
          reason: "",
        }));

      const appendedOptimizationBullets = additionalOptimizationBullets
        .map((bullet) => ({
          action: bullet.action,
          original: cleanBulletText(bullet.original),
          rewritten: cleanBulletText(bullet.rewritten),
          reason: cleanString(bullet.reason),
        }))
        .filter((bullet) => bullet.rewritten);

      const mergedBullets = [...bullets, ...appendedRewriteBullets, ...appendedOptimizationBullets];

      return mergedBullets.length > 0
        ? {
            experience_title: title,
            role_before: cleanOptimizationSectionTitle(sourceSection.title) || cleanString(sourceSection.title) || title,
            role_after: roleAfter,
            bullets: mergedBullets,
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return rebuiltSections.length > 0 ? rebuiltSections : optimizations;
}

export function normalizeModelOutput(params: {
  raw: unknown;
  model: string;
  requestId: string;
  parsedSourceExperienceSections: ParsedExperienceSection[];
  parserDebug: NonNullable<ResumeStudioOutput["debug"]>["parser"];
}): ResumeStudioOutput {
  const { raw, model, requestId, parsedSourceExperienceSections, parserDebug } = params;

  if (!raw || typeof raw !== "object") {
    throw new Error("Model response was not a JSON object.");
  }

  const data = raw as Partial<ModelOutput>;
  const strengths = normalizeFixedCount(normalizeList(data.strengths), 3);
  const gaps = normalizeFixedCount(normalizeList(data.gaps), 2);
  const normalizedOptimizations = normalizeOptimizations(data.optimizations);
  const projectOptimizations = normalizeProjectOptimizations(data.project_optimizations);
  const score = clampScore(data.match_score);
  const summary = cleanString(data.match_summary, "Resume has partial overlap with the job requirements.");
  const jobCompany = cleanString(data.company, "Unknown Company");
  const jobTitle = cleanString(data.title, "Target Role");
  const industry = cleanString(data.industry, "Not specified");
  const jobType = normalizeJobType(data.job_type);
  const experienceNeeded = cleanString(data.experience_needed, "Not specified");

  const selectedSkills = normalizeSkills(data.selected_skills);
  const modelExperienceRewrites = normalizeExperienceRewrites(data.experience_rewrites);
  const modelProjectsRewrites = normalizeProjectsRewrites(data.projects_rewrites);
  const fallbackSourceExperienceSections =
    deriveSourceExperienceSectionsFromOptimizations(normalizedOptimizations).length > 0
      ? deriveSourceExperienceSectionsFromOptimizations(normalizedOptimizations)
      : deriveSourceExperienceSectionsFromExperienceRewrites(modelExperienceRewrites);
  const sourceExperienceSections =
    parsedSourceExperienceSections.length > 0
      ? parsedSourceExperienceSections
      : fallbackSourceExperienceSections;
  const optimizations = rebuildExperienceOptimizations(
    normalizedOptimizations,
    modelExperienceRewrites,
    sourceExperienceSections,
  );
  const experienceRewrites =
    modelExperienceRewrites.length > 0
      ? modelExperienceRewrites
      : deriveExperienceRewritesFromOptimizations(optimizations, jobCompany);
  const finalizedDerivedSourceExperienceSections = deriveSourceExperienceSectionsFromOptimizations(optimizations);
  const finalizedSourceExperienceSections =
    parsedSourceExperienceSections.length > 0
      ? parsedSourceExperienceSections
      : finalizedDerivedSourceExperienceSections.length > 0
        ? finalizedDerivedSourceExperienceSections
        : deriveSourceExperienceSectionsFromExperienceRewrites(experienceRewrites);
  const optimizationSections = extractResumeOptimizationPresentationSections({
    source_experience_sections: sourceExperienceSections,
    optimizations: normalizedOptimizations,
    project_optimizations: projectOptimizations,
    tailored_resume_input: {
      experience_rewrites: modelExperienceRewrites,
      projects_rewrites: modelProjectsRewrites,
    },
  });

  const rewrittenBullets = optimizations.flatMap((opt) => opt.bullets.map((bullet) => bullet.rewritten));

  return {
    job: {
      company: jobCompany,
      title: jobTitle,
      location: cleanString(data.location, "Unknown Location"),
      industry,
      experience_needed: experienceNeeded,
      job_type: jobType,
    },
    match: {
      score,
      label: `${score}% Match`,
      summary,
    },
    analysis: {
      strengths,
      gaps,
    },
    optimizations,
    project_optimizations: projectOptimizations,
    source_experience_sections: finalizedSourceExperienceSections,
    optimization_sections: optimizationSections,
    meta: {
      model,
      generated_at: new Date().toISOString(),
      request_id: requestId,
      parser_version: "experience_parser_v2",
    },
    debug: {
      parser: parserDebug,
      model: {
        raw_response: raw,
      },
    },
    tailored_resume_input: {
      target_role: jobTitle,
      target_company: jobCompany,
      summary,
      selected_skills: selectedSkills,
      experience_rewrites: experienceRewrites,
      projects_rewrites: modelProjectsRewrites,
      education: normalizeEducation(data.education),
    },
    summary,
    tailored_bullets: rewrittenBullets,
    skills: strengths,
    missing_requirements: gaps,
  };
}

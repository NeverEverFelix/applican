export type OptimizationAction = "replace" | "add";

export type OptimizationBullet = {
  original: string | null;
  rewritten: string;
  action: OptimizationAction;
};

export type BulletSection = {
  title: string;
  bullets: OptimizationBullet[];
};

export type SourceExperienceSection = {
  title: string;
  bullets: string[];
};

export type ResumeOptimizationPresentationBullet = {
  id: string;
  source_index: number;
  original: string | null;
  optimized: string | null;
  action: OptimizationAction;
};

export type ResumeOptimizationPresentationSection = {
  id: string;
  kind: "experience" | "project";
  source_index: number;
  display_title: string;
  bullets: ResumeOptimizationPresentationBullet[];
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeHeadingText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function stripOptimizationArtifactPrefix(value: string): string {
  return value.replace(/^new optimized bullet\s*:\s*/i, "").trim();
}

export function looksLikeSerializedPayload(value: string): boolean {
  const normalized = stripOptimizationArtifactPrefix(value);
  if (!normalized || (!normalized.startsWith("{") && !normalized.startsWith("["))) {
    return false;
  }

  try {
    JSON.parse(normalized);
    return true;
  } catch {
    return /"(job|match|analysis|optimizations|tailored_resume_input|project_optimizations)"\s*:/.test(normalized);
  }
}

export function cleanOptimizationBulletText(value: unknown): string {
  const text = cleanString(value);
  return text && !looksLikeSerializedPayload(text) ? text : "";
}

export function looksLikeBulletBlock(value: string): boolean {
  return value.includes("\n") || /^\s*[-*•]/.test(value);
}

export function cleanOptimizationSectionTitle(value: unknown): string {
  const text = cleanString(value);
  if (!text || looksLikeSerializedPayload(text) || looksLikeBulletBlock(text)) {
    return "";
  }

  return text
    .replace(/\s+at\s+[A-Z].*$/i, "")
    .replace(
      /([a-z])((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b)/g,
      "$1   $2",
    )
    .trim();
}

export function resolveOptimizationSectionTitle(values: unknown[], fallback: string): string {
  return (
    values.map((value) => cleanOptimizationSectionTitle(value)).find(Boolean) ??
    values.map((value) => cleanString(value)).find(Boolean) ??
    fallback
  );
}

export function titlesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeHeadingText(left);
  const normalizedRight = normalizeHeadingText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function sectionKey(title: string): string {
  return normalizeHeadingText(cleanOptimizationSectionTitle(title) || title);
}

function normalizeBulletText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9%/$+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bulletTextMatchesSource(source: unknown, optimizationOriginal: unknown): boolean {
  const normalizedSource = normalizeBulletText(cleanOptimizationBulletText(source));
  const normalizedOriginal = normalizeBulletText(cleanOptimizationBulletText(optimizationOriginal));

  if (!normalizedSource || !normalizedOriginal) {
    return false;
  }

  return (
    normalizedSource === normalizedOriginal ||
    (normalizedSource.length >= 12 &&
      normalizedOriginal.length >= 12 &&
      (normalizedSource.includes(normalizedOriginal) || normalizedOriginal.includes(normalizedSource)))
  );
}

function isOptimizationBullet(value: OptimizationBullet | null): value is OptimizationBullet {
  return Boolean(value);
}

function createOptimizedBullet(
  original: string | null,
  rewritten: string,
  action: OptimizationAction,
): OptimizationBullet {
  return { original, rewritten, action };
}

function createFallbackBullet(text: string): OptimizationBullet {
  return createOptimizedBullet(null, text, "add");
}

function buildOptimizationSection(optimization: unknown, index: number): BulletSection | null {
  if (!optimization || typeof optimization !== "object") {
    return null;
  }

  const title = resolveOptimizationSectionTitle(
    [
      (optimization as { experience_title?: unknown }).experience_title,
      (optimization as { role_before?: unknown }).role_before,
      (optimization as { role_after?: unknown }).role_after,
    ],
    `Experience ${index + 1}`,
  );

  const bullets: OptimizationBullet[] = Array.isArray((optimization as { bullets?: unknown }).bullets)
    ? ((optimization as { bullets?: unknown }).bullets as unknown[])
        .map((bullet) => {
          if (!bullet || typeof bullet !== "object") {
            return null;
          }

          const row = bullet as { original?: unknown; rewritten?: unknown; action?: unknown };
          const original = cleanOptimizationBulletText(row.original);
          const rewritten = cleanOptimizationBulletText(row.rewritten);
          const action = row.action === "add" ? "add" : "replace";

          if (!original && !rewritten) {
            return null;
          }

          return createOptimizedBullet(
            action === "replace" ? original || rewritten : null,
            rewritten || original,
            action,
          );
        })
        .filter(isOptimizationBullet)
    : [];

  return bullets.length > 0 ? { title, bullets } : null;
}

function buildFallbackSection(rewrite: unknown, index: number): BulletSection | null {
  if (!rewrite || typeof rewrite !== "object") {
    return null;
  }

  const title = cleanOptimizationSectionTitle((rewrite as { title?: unknown }).title) || `Experience ${index + 1}`;
  const bullets: OptimizationBullet[] = Array.isArray((rewrite as { bullets?: unknown }).bullets)
    ? ((rewrite as { bullets?: unknown }).bullets as unknown[])
        .map((bullet) => {
          const text = cleanOptimizationBulletText(bullet);
          if (!text) {
            return null;
          }

          return createOptimizedBullet(text, text, "replace");
        })
        .filter(isOptimizationBullet)
    : [];

  return bullets.length > 0 ? { title, bullets } : null;
}

function buildSourceSection(section: unknown, index: number): BulletSection | null {
  if (!section || typeof section !== "object") {
    return null;
  }

  const row = section as { title?: unknown; bullets?: unknown };
  const title = cleanOptimizationSectionTitle(row.title) || cleanString(row.title) || `Experience ${index + 1}`;
  const bullets = Array.isArray(row.bullets)
    ? row.bullets
        .map((bullet) => {
          const text = cleanOptimizationBulletText(bullet);
          if (!text) {
            return null;
          }

          return createOptimizedBullet(text, text, "replace");
        })
        .filter(isOptimizationBullet)
    : [];

  return bullets.length > 0 ? { title, bullets } : null;
}

function findMatchingSection(
  sections: BulletSection[],
  title: string,
  usedTitles = new Set<string>(),
): BulletSection | null {
  const normalizedTitle = sectionKey(title);
  const exactMatch = sections.find((section) => {
    return !usedTitles.has(sectionKey(section.title)) && sectionKey(section.title) === normalizedTitle;
  });

  if (exactMatch) {
    return exactMatch;
  }

  return (
    sections.find((section) => {
      return !usedTitles.has(sectionKey(section.title)) && titlesMatch(section.title, title);
    }) ?? null
  );
}

function mergeSectionBullets(baseSection: BulletSection, optimizationSection: BulletSection): BulletSection {
  const remainingOptimizationBullets = [...optimizationSection.bullets];
  const mergedBullets = baseSection.bullets.map((baseBullet) => {
    const baseCandidates = [
      normalizeBulletText(cleanOptimizationBulletText(baseBullet.original)),
      normalizeBulletText(cleanOptimizationBulletText(baseBullet.rewritten)),
    ].filter(Boolean);

    const matchIndex = remainingOptimizationBullets.findIndex((optimizationBullet) => {
      if (optimizationBullet.action === "add") {
        return false;
      }

      const optimizationCandidates = [
        normalizeBulletText(cleanOptimizationBulletText(optimizationBullet.original)),
        normalizeBulletText(cleanOptimizationBulletText(optimizationBullet.rewritten)),
      ].filter(Boolean);

      return optimizationCandidates.some((candidate) => baseCandidates.includes(candidate));
    });

    if (matchIndex === -1) {
      return baseBullet;
    }

    const [matchedBullet] = remainingOptimizationBullets.splice(matchIndex, 1);
    return {
      action: matchedBullet.action,
      original: matchedBullet.original || baseBullet.original || baseBullet.rewritten,
      rewritten: matchedBullet.rewritten || baseBullet.rewritten,
    };
  });

  const appendedBullets = remainingOptimizationBullets.map((bullet) => ({
    action: bullet.action,
    original: bullet.original,
    rewritten: bullet.rewritten,
  }));

  return {
    title: optimizationSection.title || baseSection.title,
    bullets: [...mergedBullets, ...appendedBullets],
  };
}

function mergeRewriteSectionBullets(baseSection: BulletSection, rewriteSection: BulletSection): BulletSection {
  const mergedBullets = baseSection.bullets.map((baseBullet, index) => {
    const rewriteBullet = rewriteSection.bullets[index];
    if (!rewriteBullet) {
      return baseBullet;
    }

    return {
      action: baseBullet.action,
      original: baseBullet.original || baseBullet.rewritten,
      rewritten: rewriteBullet.rewritten || baseBullet.rewritten,
    };
  });

  const appendedBullets = rewriteSection.bullets.slice(baseSection.bullets.length).map((bullet) => ({
    action: bullet.action,
    original: bullet.original,
    rewritten: bullet.rewritten,
  }));

  return {
    title: baseSection.title,
    bullets: [...mergedBullets, ...appendedBullets],
  };
}

export function extractOriginalBulletSections(value: unknown): BulletSection[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const root = value as {
    source_experience_sections?: Array<{
      title?: unknown;
      bullets?: unknown;
    }>;
    tailored_resume_input?: {
      experience_rewrites?: Array<{
        company?: unknown;
        title?: unknown;
        bullets?: unknown;
      }>;
    };
    optimizations?: Array<{
      experience_title?: unknown;
      role_before?: unknown;
      role_after?: unknown;
      bullets?: Array<{
        original?: unknown;
        rewritten?: unknown;
        action?: unknown;
      }>;
    }>;
  };

  const experienceRewrites = Array.isArray(root.tailored_resume_input?.experience_rewrites)
    ? root.tailored_resume_input.experience_rewrites
    : [];
  const optimizations = Array.isArray(root.optimizations) ? root.optimizations : [];
  const sourceSections = Array.isArray(root.source_experience_sections) ? root.source_experience_sections : [];
  const derivedSourceSections =
    sourceSections.length > 0
      ? sourceSections
      : deriveSourceExperienceSectionsFromOptimizations(optimizations).length > 0
        ? deriveSourceExperienceSectionsFromOptimizations(optimizations)
        : deriveSourceExperienceSectionsFromExperienceRewrites(experienceRewrites);
  const baseSections = derivedSourceSections
    .map((section, index) => buildSourceSection(section, index))
    .filter((entry): entry is BulletSection => Boolean(entry && entry.bullets.length > 0));
  const rewriteSections = experienceRewrites
    .map((rewrite, index) => buildFallbackSection(rewrite, index))
    .filter((entry): entry is BulletSection => Boolean(entry && entry.bullets.length > 0));
  const optimizationSections = optimizations
    .map((optimization, index) => buildOptimizationSection(optimization, index))
    .filter((entry): entry is BulletSection => Boolean(entry && entry.bullets.length > 0));

  const usedRewriteTitles = new Set<string>();
  const usedOptimizationTitles = new Set<string>();

  const mergedBaseSections = baseSections.map((section) => {
    const matchedRewrite = findMatchingSection(rewriteSections, section.title, usedRewriteTitles);
    const rewriteMergedSection = matchedRewrite ? mergeRewriteSectionBullets(section, matchedRewrite) : section;
    if (matchedRewrite) {
      usedRewriteTitles.add(sectionKey(matchedRewrite.title));
    }

    const matchedOptimization = findMatchingSection(
      optimizationSections,
      rewriteMergedSection.title,
      usedOptimizationTitles,
    );
    if (matchedOptimization) {
      usedOptimizationTitles.add(sectionKey(matchedOptimization.title));
    }

    return matchedOptimization
      ? mergeSectionBullets(rewriteMergedSection, matchedOptimization)
      : rewriteMergedSection;
  });

  const additionalRewriteSections = rewriteSections
    .filter((section) => !usedRewriteTitles.has(sectionKey(section.title)))
    .map((section) => {
      const matchedOptimization = findMatchingSection(
        optimizationSections,
        section.title,
        usedOptimizationTitles,
      );
      if (matchedOptimization) {
        usedOptimizationTitles.add(sectionKey(matchedOptimization.title));
      }

      return matchedOptimization
        ? mergeSectionBullets(section, matchedOptimization)
        : section;
    });

  const additionalOptimizationSections = optimizationSections.filter(
    (section) => !usedOptimizationTitles.has(sectionKey(section.title)),
  );

  const mergedSections = [...mergedBaseSections, ...additionalRewriteSections, ...additionalOptimizationSections];
  return mergedSections.length > 0 ? mergedSections : rewriteSections;
}

export function extractProjectBulletSections(value: unknown): BulletSection[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const root = value as {
    project_optimizations?: Array<{
      name?: unknown;
      bullets?: Array<{
        original?: unknown;
        rewritten?: unknown;
        action?: unknown;
      }>;
    }>;
    tailored_resume_input?: {
      projects_rewrites?: Array<{
        name?: unknown;
        bullets?: unknown;
      }>;
    };
  };

  const projects = Array.isArray(root.tailored_resume_input?.projects_rewrites)
    ? root.tailored_resume_input.projects_rewrites
    : [];
  const projectOptimizations = Array.isArray(root.project_optimizations) ? root.project_optimizations : [];

  if (projectOptimizations.length > 0) {
    return projectOptimizations
      .map((project, index) => {
        if (!project || typeof project !== "object") {
          return null;
        }

        const title = cleanOptimizationSectionTitle((project as { name?: unknown }).name) || `Project ${index + 1}`;
        const bullets: OptimizationBullet[] = Array.isArray((project as { bullets?: unknown }).bullets)
          ? ((project as { bullets?: unknown }).bullets as unknown[])
              .map((bullet) => {
                if (!bullet || typeof bullet !== "object") {
                  return null;
                }

                const row = bullet as { original?: unknown; rewritten?: unknown; action?: unknown };
                const original = cleanOptimizationBulletText(row.original);
                const rewritten = cleanOptimizationBulletText(row.rewritten);
                const action = row.action === "add" ? "add" : "replace";

                if (!original && !rewritten) {
                  return null;
                }

                return createOptimizedBullet(
                  action === "replace" ? original || rewritten : null,
                  rewritten || original,
                  action,
                );
              })
              .filter(isOptimizationBullet)
          : [];

        return {
          title,
          bullets,
        };
      })
      .filter((entry): entry is BulletSection => Boolean(entry));
  }

  return projects
    .map((project, index) => {
      if (!project || typeof project !== "object") {
        return null;
      }

      const title = cleanOptimizationSectionTitle((project as { name?: unknown }).name) || `Project ${index + 1}`;
      const bullets: OptimizationBullet[] = Array.isArray((project as { bullets?: unknown }).bullets)
        ? ((project as { bullets?: unknown }).bullets as unknown[])
            .map((bullet) => {
              const text = cleanOptimizationBulletText(bullet);
              if (!text) {
                return null;
              }

              return createFallbackBullet(text);
            })
            .filter(isOptimizationBullet)
        : [];

      return {
        title,
        bullets,
      };
    })
    .filter((entry): entry is BulletSection => Boolean(entry));
}

export function deriveSourceExperienceSectionsFromOptimizations(value: unknown): SourceExperienceSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((optimization, index) => {
      if (!optimization || typeof optimization !== "object") {
        return null;
      }

      const title = resolveOptimizationSectionTitle(
        [
          (optimization as { experience_title?: unknown }).experience_title,
          (optimization as { role_before?: unknown }).role_before,
          (optimization as { role_after?: unknown }).role_after,
        ],
        `Experience ${index + 1}`,
      );

      const bullets = Array.isArray((optimization as { bullets?: unknown }).bullets)
        ? ((optimization as { bullets?: unknown }).bullets as unknown[])
            .map((bullet) => {
              if (!bullet || typeof bullet !== "object") {
                return "";
              }

              const row = bullet as { original?: unknown; rewritten?: unknown; action?: unknown };
              const original = cleanOptimizationBulletText(row.original);
              const rewritten = cleanOptimizationBulletText(row.rewritten);
              return row.action === "replace" ? original || rewritten : original || rewritten;
            })
            .filter(Boolean)
        : [];

      return bullets.length > 0
        ? {
            title,
            bullets,
          }
        : null;
    })
    .filter((entry): entry is SourceExperienceSection => Boolean(entry));
}

export function deriveSourceExperienceSectionsFromExperienceRewrites(value: unknown): SourceExperienceSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((rewrite, index) => {
      if (!rewrite || typeof rewrite !== "object") {
        return null;
      }

      const title = cleanOptimizationSectionTitle((rewrite as { title?: unknown }).title) || `Experience ${index + 1}`;
      const bullets = Array.isArray((rewrite as { bullets?: unknown }).bullets)
        ? ((rewrite as { bullets?: unknown }).bullets as unknown[])
            .map((bullet) => cleanOptimizationBulletText(bullet))
            .filter(Boolean)
        : [];

      return bullets.length > 0
        ? {
            title,
            bullets,
          }
        : null;
    })
    .filter((entry): entry is SourceExperienceSection => Boolean(entry));
}

function resolvePresentationExperienceTitle(
  sourceTitle: unknown,
  rewriteTitle: unknown,
  optimization: {
    experience_title?: unknown;
    role_before?: unknown;
    role_after?: unknown;
  } | null | undefined,
  index: number,
): string {
  return (
    cleanOptimizationSectionTitle(sourceTitle) ||
    cleanString(sourceTitle) ||
    cleanOptimizationSectionTitle(rewriteTitle) ||
    cleanOptimizationSectionTitle(optimization?.experience_title) ||
    cleanOptimizationSectionTitle(optimization?.role_after) ||
    cleanOptimizationSectionTitle(optimization?.role_before) ||
    cleanString(rewriteTitle) ||
    `Experience ${index + 1}`
  );
}

function toPresentationBullet(
  sectionId: string,
  sourceIndex: number,
  original: unknown,
  optimized: unknown,
  action: OptimizationAction,
): ResumeOptimizationPresentationBullet | null {
  const cleanOriginal = cleanOptimizationBulletText(original);
  const cleanOptimized = cleanOptimizationBulletText(optimized);

  if (!cleanOriginal && !cleanOptimized) {
    return null;
  }

  return {
    id: `${sectionId}:${sourceIndex}`,
    source_index: sourceIndex,
    original: cleanOriginal || null,
    optimized: cleanOptimized || null,
    action,
  };
}

function normalizePresentationBullet(
  value: unknown,
  fallbackSectionId: string,
  fallbackIndex: number,
): ResumeOptimizationPresentationBullet | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as {
    id?: unknown;
    source_index?: unknown;
    original?: unknown;
    optimized?: unknown;
    action?: unknown;
  };

  const sourceIndex =
    typeof row.source_index === "number" && Number.isInteger(row.source_index) && row.source_index >= 0
      ? row.source_index
      : fallbackIndex;
  const bullet = toPresentationBullet(
    fallbackSectionId,
    sourceIndex,
    row.original,
    row.optimized,
    row.action === "add" ? "add" : "replace",
  );

  if (!bullet) {
    return null;
  }

  return {
    ...bullet,
    id: cleanString(row.id) || `${fallbackSectionId}:${sourceIndex}`,
  };
}

function normalizePresentationSection(value: unknown, fallbackIndex: number): ResumeOptimizationPresentationSection | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as {
    id?: unknown;
    kind?: unknown;
    source_index?: unknown;
    display_title?: unknown;
    bullets?: unknown;
  };

  const kind = row.kind === "project" ? "project" : row.kind === "experience" ? "experience" : null;
  const sourceIndex =
    typeof row.source_index === "number" && Number.isInteger(row.source_index) && row.source_index >= 0
      ? row.source_index
      : fallbackIndex;
  const displayTitle = cleanOptimizationSectionTitle(row.display_title) || cleanString(row.display_title);
  const id = cleanString(row.id) || `${kind ?? "experience"}:${sourceIndex}`;
  const bullets = Array.isArray(row.bullets)
    ? row.bullets
        .map((bullet, bulletIndex) => normalizePresentationBullet(bullet, id, bulletIndex))
        .filter((entry): entry is ResumeOptimizationPresentationBullet => Boolean(entry))
    : [];

  if (!kind || !displayTitle || bullets.length === 0) {
    return null;
  }

  return {
    id,
    kind,
    source_index: sourceIndex,
    display_title: displayTitle,
    bullets,
  };
}

function extractProvidedPresentationSections(value: unknown): ResumeOptimizationPresentationSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section, sectionIndex) => normalizePresentationSection(section, sectionIndex))
    .filter((entry): entry is ResumeOptimizationPresentationSection => Boolean(entry));
}

function derivePresentationSectionsFromLegacyFields(
  root: {
    source_experience_sections?: Array<{
      title?: unknown;
      bullets?: unknown;
    }>;
    optimizations?: Array<{
      experience_title?: unknown;
      role_before?: unknown;
      role_after?: unknown;
      bullets?: Array<{
        original?: unknown;
        rewritten?: unknown;
        action?: unknown;
      }>;
    }>;
    project_optimizations?: Array<{
      name?: unknown;
      bullets?: Array<{
        original?: unknown;
        rewritten?: unknown;
        action?: unknown;
      }>;
    }>;
    tailored_resume_input?: {
      experience_rewrites?: Array<{
        title?: unknown;
        bullets?: unknown;
      }>;
      projects_rewrites?: Array<{
        name?: unknown;
        bullets?: unknown;
      }>;
    };
  },
): ResumeOptimizationPresentationSection[] {
  const sourceSections = Array.isArray(root.source_experience_sections) ? root.source_experience_sections : [];
  const experienceRewrites = Array.isArray(root.tailored_resume_input?.experience_rewrites)
    ? root.tailored_resume_input.experience_rewrites
    : [];
  const optimizations = Array.isArray(root.optimizations) ? root.optimizations : [];
  const baseExperienceSections =
    sourceSections.length > 0
      ? sourceSections
      : deriveSourceExperienceSectionsFromOptimizations(optimizations).length > 0
        ? deriveSourceExperienceSectionsFromOptimizations(optimizations)
        : deriveSourceExperienceSectionsFromExperienceRewrites(experienceRewrites);

  const experienceSections = baseExperienceSections
    .map((section, sectionIndex) => {
      const optimization = optimizations[sectionIndex];
      const rewrite = experienceRewrites[sectionIndex];
      const sectionId = `exp:${sectionIndex}`;
      const displayTitle = resolvePresentationExperienceTitle(
        section.title,
        rewrite?.title,
        optimization,
        sectionIndex,
      );

      const sourceBullets = Array.isArray(section.bullets) ? section.bullets : [];
      const rewriteBullets = Array.isArray(rewrite?.bullets) ? rewrite.bullets : [];
      const optimizationBullets = Array.isArray(optimization?.bullets) ? optimization.bullets : [];

      const bullets = sourceBullets
        .map((sourceBullet, bulletIndex) => {
          const optimizationBullet = optimizationBullets[bulletIndex];
          const rewriteBullet = rewriteBullets[bulletIndex];
          const canUseOptimizationBullet =
            optimizationBullet?.action !== "add" && bulletTextMatchesSource(sourceBullet, optimizationBullet?.original);
          return toPresentationBullet(
            sectionId,
            bulletIndex,
            cleanString(sourceBullet),
            (canUseOptimizationBullet ? cleanOptimizationBulletText(optimizationBullet?.rewritten) : "") ||
              cleanOptimizationBulletText(rewriteBullet),
            canUseOptimizationBullet ? "replace" : "replace",
          );
        })
        .filter((entry): entry is ResumeOptimizationPresentationBullet => Boolean(entry));

      const appendedBullets = optimizationBullets
        .map((bullet, bulletIndex) => ({ bullet, bulletIndex }))
        .filter(({ bullet }) => bullet?.action === "add")
        .map(({ bullet }, appendedIndex) =>
          toPresentationBullet(
            sectionId,
            sourceBullets.length + appendedIndex,
            cleanOptimizationBulletText(bullet?.original) || null,
            cleanOptimizationBulletText(bullet?.rewritten) || null,
            bullet?.action === "add" ? "add" : "replace",
          ),
        )
        .filter((entry): entry is ResumeOptimizationPresentationBullet => Boolean(entry));

      return {
        id: sectionId,
        kind: "experience" as const,
        source_index: sectionIndex,
        display_title: displayTitle,
        bullets: [...bullets, ...appendedBullets],
      };
    })
    .filter((section) => section.bullets.length > 0);

  const projectOptimizations = Array.isArray(root.project_optimizations) ? root.project_optimizations : [];
  const projectRewrites = Array.isArray(root.tailored_resume_input?.projects_rewrites)
    ? root.tailored_resume_input.projects_rewrites
    : [];
  const projectCount = Math.max(projectOptimizations.length, projectRewrites.length);

  const projectSections = Array.from({ length: projectCount }, (_, sectionIndex) => {
    const optimization = projectOptimizations[sectionIndex];
    const rewrite = projectRewrites[sectionIndex];
    const sectionId = `proj:${sectionIndex}`;
    const displayTitle =
      cleanOptimizationSectionTitle(optimization?.name) ||
      cleanOptimizationSectionTitle(rewrite?.name) ||
      cleanString(rewrite?.name) ||
      cleanString(optimization?.name) ||
      `Project ${sectionIndex + 1}`;

    const optimizationBullets = Array.isArray(optimization?.bullets) ? optimization.bullets : [];
    const rewriteBullets = Array.isArray(rewrite?.bullets) ? rewrite.bullets : [];
    const bulletCount = Math.max(optimizationBullets.length, rewriteBullets.length);
    const bullets = Array.from({ length: bulletCount }, (_, bulletIndex) => {
      const optimizationBullet = optimizationBullets[bulletIndex];
      const rewriteBullet = rewriteBullets[bulletIndex];
      return toPresentationBullet(
        sectionId,
        bulletIndex,
        cleanOptimizationBulletText(optimizationBullet?.original) || null,
        cleanOptimizationBulletText(optimizationBullet?.rewritten) || cleanOptimizationBulletText(rewriteBullet),
        optimizationBullet?.action === "add" ? "add" : "replace",
      );
    }).filter((entry): entry is ResumeOptimizationPresentationBullet => Boolean(entry));

    return {
      id: sectionId,
      kind: "project" as const,
      source_index: sectionIndex,
      display_title: displayTitle,
      bullets,
    };
  }).filter((section) => section.bullets.length > 0);

  return [...experienceSections, ...projectSections];
}

export function extractResumeOptimizationPresentationSections(
  value: unknown,
): ResumeOptimizationPresentationSection[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const root = value as Parameters<typeof derivePresentationSectionsFromLegacyFields>[0] & {
    optimization_sections?: unknown;
  };
  const providedSections = extractProvidedPresentationSections(root.optimization_sections);

  if (providedSections.length > 0) {
    return providedSections;
  }

  return derivePresentationSectionsFromLegacyFields(root);
}

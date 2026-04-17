import { useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
import { layout, prepare } from "@chenglou/pretext";
import gsap from "gsap";
import styles from "../applicationTrack.module.css";
import starIcon from "../../../../assets/Star.png";
import blackStarIcon from "../../../../assets/Black star.png";
import arrowIcon from "../../../../assets/Arrow.png";
import jobDescriptionIcon from "../../../../assets/Job Description Icon.png";
import checkIcon from "../../../../assets/Check.png";
import errorScreenIcon from "../../../../assets/error screen.png";
import { useLocalStorageState } from "../../../../hooks/useLocalStorageState";
import { useCreateResumeRun } from "../../../jobs/hooks/useCreateResumeRun";
import { getLatestResumeRunForEditor } from "../../../jobs/api/getLatestResumeRunForEditor";
import LoadingScreen from "../../../../screens/loading/LoadingScreen.tsx";
import WritingText from "../../../../effects/writing-text";
import TypingText from "../../../../effects/typing-text";
import ScrollSections from "../../../../effects/ScrollSections";
import { supabase } from "../../../../lib/supabaseClient";

type ResumeStudioOutput = {
  job: {
    company: string;
    title: string;
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
};

const RESUME_FILE_DB_NAME = "applican_resume_file_db";
const RESUME_FILE_STORE_NAME = "resume_files";
const RESUME_FILE_KEY = "latest_resume";
const DEFAULT_PAGE_TITLE = "applican";
const OPTIMIZATIONS_TOP = 117;
const OPTIMIZATIONS_LEFT = 51;
const OPTIMIZATIONS_WIDTH = 780;
const ACCORDION_BODY_FONT = '700 18px "Neue Haas Grotesk Display Pro"';
const ACCORDION_BODY_LINE_HEIGHT = 28;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type OriginalBulletSection = {
  title: string;
  bullets: OptimizationBullet[];
};

type ProjectBulletSection = {
  title: string;
  bullets: OptimizationBullet[];
};

type OptimizationBullet = {
  original: string | null;
  rewritten: string;
  action: "replace" | "add";
};

type ParsedExperienceSection = {
  title: string;
  bullets: string[];
};

function isOptimizationBullet(value: OptimizationBullet | null): value is OptimizationBullet {
  return Boolean(value);
}

function createOptimizedBullet(
  original: string | null,
  rewritten: string,
  action: "replace" | "add",
): OptimizationBullet {
  return { original, rewritten, action };
}

function createFallbackBullet(text: string): OptimizationBullet {
  return createOptimizedBullet(null, text, "add");
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseExperienceSections(resumeText: string): ParsedExperienceSection[] {
  const lines = resumeText
    .replace(/\f/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const experienceIndex = lines.findIndex((line) => normalizeMatchText(line) === "experience");
  if (experienceIndex === -1) {
    return [];
  }

  const endIndex = lines.findIndex(
    (line, index) =>
      index > experienceIndex &&
      ["projects", "technical skills", "skills", "education", "certifications"].includes(normalizeMatchText(line)),
  );
  const slice = lines.slice(experienceIndex + 1, endIndex === -1 ? undefined : endIndex);

  const sections: ParsedExperienceSection[] = [];
  let currentTitle = "";
  let currentBullets: string[] = [];
  let sawBullet = false;

  const flush = () => {
    if (!currentTitle || currentBullets.length === 0) {
      currentTitle = "";
      currentBullets = [];
      sawBullet = false;
      return;
    }

    sections.push({
      title: currentTitle,
      bullets: currentBullets,
    });
    currentTitle = "";
    currentBullets = [];
    sawBullet = false;
  };

  for (let index = 0; index < slice.length; index += 1) {
    const line = slice[index];
    const isBullet = line.startsWith("•");
    const nextLine = slice[index + 1] ?? "";

    if (isBullet) {
      if (!currentTitle) {
        currentTitle = `Experience ${sections.length + 1}`;
      }
      sawBullet = true;
      currentBullets.push(line.replace(/^•\s*/, "").trim());
      continue;
    }

    if (sawBullet) {
      const lastBulletIndex = currentBullets.length - 1;
      const nextLineStartsBullet = nextLine.startsWith("•");
      const looksLikeNextTitle =
        /^[A-Z]/.test(line) &&
        !/[,:]/.test(line) &&
        !nextLineStartsBullet &&
        !/[–-]/.test(line) &&
        currentBullets.length > 0;
      if (lastBulletIndex >= 0 && !looksLikeNextTitle) {
        currentBullets[lastBulletIndex] = `${currentBullets[lastBulletIndex]} ${line}`.replace(/\s+/g, " ").trim();
        continue;
      }

      flush();
      currentTitle = line;
      continue;
    }

    if (!currentTitle) {
      currentTitle = line;
    }
  }

  flush();
  return sections;
}

function buildOptimizationSection(optimization: unknown, index: number): OriginalBulletSection | null {
  if (!optimization || typeof optimization !== "object") {
    return null;
  }

  const title =
    [
      cleanString((optimization as { experience_title?: unknown }).experience_title),
      cleanString((optimization as { role_before?: unknown }).role_before),
      cleanString((optimization as { role_after?: unknown }).role_after),
    ].find(Boolean) ?? `Experience ${index + 1}`;

  const bullets: OptimizationBullet[] = Array.isArray((optimization as { bullets?: unknown }).bullets)
    ? ((optimization as { bullets?: unknown }).bullets as unknown[])
        .map((bullet) => {
          if (!bullet || typeof bullet !== "object") {
            return null;
          }

          const row = bullet as { original?: unknown; rewritten?: unknown; action?: unknown };
          const original = cleanString(row.original);
          const rewritten = cleanString(row.rewritten);
          const action = row.action === "add" ? "add" : "replace";

          if (!original && !rewritten) {
            return null;
          }

          return createOptimizedBullet(
            action === "replace" && original ? original : null,
            rewritten || original,
            action,
          );
        })
        .filter(isOptimizationBullet)
    : [];

  return bullets.length > 0 ? { title, bullets } : null;
}

function buildFallbackSection(
  rewrite: unknown,
  index: number,
  sourceSection?: ParsedExperienceSection,
): OriginalBulletSection | null {
  if (!rewrite || typeof rewrite !== "object") {
    return null;
  }

  const title = cleanString((rewrite as { title?: unknown }).title) || `Experience ${index + 1}`;
  const bullets: OptimizationBullet[] = Array.isArray((rewrite as { bullets?: unknown }).bullets)
    ? ((rewrite as { bullets?: unknown }).bullets as unknown[])
        .map((bullet, bulletIndex) => {
          const text = cleanString(bullet);
          if (!text) {
            return null;
          }

          return createOptimizedBullet(cleanString(sourceSection?.bullets[bulletIndex]) || null, text, "add");
        })
        .filter(isOptimizationBullet)
    : [];

  return bullets.length > 0
    ? {
        title,
        bullets,
      }
    : null;
}

function extractOriginalBulletSections(value: unknown, sourceSections: ParsedExperienceSection[] = []): OriginalBulletSection[] {
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

  const resolvedSourceSections = Array.isArray(root.source_experience_sections)
    ? root.source_experience_sections
        .map((section, index) => {
          if (!section || typeof section !== "object") {
            return null;
          }

          const title = cleanString((section as { title?: unknown }).title) || `Experience ${index + 1}`;
          const bullets = Array.isArray((section as { bullets?: unknown }).bullets)
            ? ((section as { bullets?: unknown }).bullets as unknown[]).map(cleanString).filter(Boolean)
            : [];

          return bullets.length > 0 ? { title, bullets } : null;
        })
        .filter((section): section is ParsedExperienceSection => Boolean(section))
    : sourceSections;

  const experienceRewrites = Array.isArray(root.tailored_resume_input?.experience_rewrites)
    ? root.tailored_resume_input?.experience_rewrites
    : [];
  const optimizations = Array.isArray(root.optimizations) ? root.optimizations : [];

  if (resolvedSourceSections.length > 0) {
    const optimizationSections = optimizations
      .map((optimization, index) => buildOptimizationSection(optimization, index))
      .filter((entry): entry is OriginalBulletSection => Boolean(entry && entry.bullets.length > 0));

    return resolvedSourceSections
      .map((sourceSection, sectionIndex) => {
        const rewrite = experienceRewrites[sectionIndex];
        const rewriteBullets =
          rewrite && typeof rewrite === "object" && Array.isArray((rewrite as { bullets?: unknown }).bullets)
            ? ((rewrite as { bullets?: unknown }).bullets as unknown[]).map(cleanString)
            : [];
        const optimizationSection = optimizationSections[sectionIndex];
        const title =
          cleanString(optimizationSection?.title) ||
          cleanString((rewrite as { title?: unknown } | undefined)?.title) ||
          cleanString(sourceSection.title) ||
          `Experience ${sectionIndex + 1}`;

        const bulletCount = Math.max(
          sourceSection.bullets.length,
          rewriteBullets.filter(Boolean).length,
          optimizationSection?.bullets.length ?? 0,
        );

        const bullets = Array.from({ length: bulletCount }, (_, bulletIndex) => {
          const sourceOriginal = cleanString(sourceSection.bullets[bulletIndex]);
          const optimizationBullet = optimizationSection?.bullets[bulletIndex] ?? null;
          const rewritten =
            cleanString(optimizationBullet?.rewritten) ||
            cleanString(rewriteBullets[bulletIndex]) ||
            sourceOriginal;

          if (!sourceOriginal && !rewritten) {
            return null;
          }

          return {
            original: sourceOriginal || null,
            rewritten: rewritten || sourceOriginal,
            action: optimizationBullet?.action ?? "replace",
          };
        }).filter((bullet): bullet is OptimizationBullet => Boolean(bullet));

        return bullets.length > 0 ? { title, bullets } : null;
      })
      .filter((entry): entry is OriginalBulletSection => Boolean(entry));
  }

  if (optimizations.length > 0) {
    const optimizationSections = optimizations
      .map((optimization, index) => buildOptimizationSection(optimization, index))
      .filter((entry): entry is OriginalBulletSection => Boolean(entry && entry.bullets.length > 0));

    const mergedSections = experienceRewrites
      .map((rewrite, rewriteIndex) => {
        const fallbackSection = buildFallbackSection(rewrite, rewriteIndex, resolvedSourceSections[rewriteIndex]);
        if (!fallbackSection) {
          return null;
        }

        const optimizationSection = optimizationSections[rewriteIndex];
        if (!optimizationSection) {
          return fallbackSection;
        }

        return {
          title: optimizationSection.title || fallbackSection.title,
          bullets: fallbackSection.bullets.map((fallbackBullet, bulletIndex) => {
            const optimizationBullet = optimizationSection.bullets[bulletIndex];
            if (!optimizationBullet) {
              return fallbackBullet;
            }

            return {
              original:
                cleanString(resolvedSourceSections[rewriteIndex]?.bullets[bulletIndex]) ||
                cleanString(optimizationBullet.original) ||
                fallbackBullet.original,
              rewritten: cleanString(optimizationBullet.rewritten) || fallbackBullet.rewritten,
              action: optimizationBullet.action,
            };
          }),
        };
      })
      .filter((entry): entry is OriginalBulletSection => Boolean(entry));

    const unmatchedOptimizationSections = optimizationSections.slice(experienceRewrites.length);
    return [...mergedSections, ...unmatchedOptimizationSections];
  }

  return experienceRewrites
    .map((rewrite, index) => buildFallbackSection(rewrite, index, resolvedSourceSections[index]))
    .filter((entry): entry is OriginalBulletSection => Boolean(entry && entry.bullets.length > 0));
}

function extractProjectBulletSections(value: unknown): ProjectBulletSection[] {
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
    ? root.tailored_resume_input?.projects_rewrites
    : [];
  const projectOptimizations = Array.isArray(root.project_optimizations) ? root.project_optimizations : [];

  if (projectOptimizations.length > 0) {
    return projectOptimizations
      .map((project, index) => {
        if (!project || typeof project !== "object") {
          return null;
        }

        const title = cleanString((project as { name?: unknown }).name) || `Project ${index + 1}`;
        const bullets: OptimizationBullet[] = Array.isArray((project as { bullets?: unknown }).bullets)
          ? ((project as { bullets?: unknown }).bullets as unknown[])
              .map((bullet) => {
                if (!bullet || typeof bullet !== "object") {
                  return null;
                }

                const row = bullet as { original?: unknown; rewritten?: unknown; action?: unknown };
                const original = cleanString(row.original);
                const rewritten = cleanString(row.rewritten);
                const action = row.action === "add" ? "add" : "replace";

                if (!original && !rewritten) {
                  return null;
                }

                return createOptimizedBullet(
                  action === "replace" && original ? original : null,
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
      .filter((entry): entry is ProjectBulletSection => Boolean(entry));
  }

  return projects
    .map((project, index) => {
      if (!project || typeof project !== "object") {
        return null;
      }

      const title = cleanString((project as { name?: unknown }).name) || `Project ${index + 1}`;
      const bullets: OptimizationBullet[] = Array.isArray((project as { bullets?: unknown }).bullets)
        ? ((project as { bullets?: unknown }).bullets as unknown[])
            .map((bullet) => {
              const text = cleanString(bullet);
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
    .filter((entry): entry is ProjectBulletSection => Boolean(entry));
}

function OptimizationSectionAccordion({ section }: { section: OriginalBulletSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateHeight = () => {
      const bodyEl = bodyRef.current;
      if (!bodyEl) {
        return;
      }

      if (isOpen) {
        bodyEl.style.maxHeight = `${node.scrollHeight}px`;
      } else {
        bodyEl.style.maxHeight = "0px";
        bodyEl.style.overflow = "hidden";
      }
    };

    updateHeight();
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    const bodyEl = bodyRef.current;
    const innerEl = innerRef.current;
    if (!bodyEl) {
      return;
    }

    if (!isOpen) {
      if (innerEl) {
        bodyEl.style.maxHeight = `${innerEl.scrollHeight}px`;
        void bodyEl.offsetHeight;
      }
      bodyEl.style.maxHeight = "0px";
      bodyEl.style.overflow = "hidden";
      return;
    }

    bodyEl.style.maxHeight = `${innerEl?.scrollHeight ?? 0}px`;
    bodyEl.style.overflow = "hidden";

    const timeoutId = window.setTimeout(() => {
      if (!bodyRef.current || !isOpen) {
        return;
      }

      bodyRef.current.style.maxHeight = "none";
      bodyRef.current.style.overflow = "visible";
    }, 320);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, section.bullets.length]);

  return (
    <section className={styles.optimizationGroup}>
      <button
        type="button"
        className={styles.optimizationAccordionButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className={styles.optimizationJobTitle}>{section.title}</span>
        <span
          className={[
            styles.optimizationAccordionChevron,
            isOpen ? styles.optimizationAccordionChevronOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          +
        </span>
      </button>

      <div ref={bodyRef} className={styles.optimizationAccordionBody}>
        <div ref={innerRef} className={styles.optimizationAccordionBodyInner}>
          <div className={styles.optimizationBulletList}>
            {section.bullets.map((bullet, index) => (
              <OptimizationBulletAccordion
                key={`${section.title}-${index}`}
                original={bullet.original}
                rewritten={bullet.rewritten}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OptimizationBulletAccordion({
  original,
  rewritten,
}: {
  original: string | null;
  rewritten: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const prepared = useMemo(
    () => prepare(rewritten, ACCORDION_BODY_FONT, { whiteSpace: "pre-wrap" }),
    [rewritten],
  );

  useEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWidth = () => {
      setContentWidth(node.getBoundingClientRect().width);
    };

    updateWidth();
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bodyEl = bodyRef.current;
    const innerEl = innerRef.current;
    if (!bodyEl) {
      return;
    }

    if (!isOpen || contentWidth <= 0) {
      if (innerEl) {
        bodyEl.style.maxHeight = `${innerEl.scrollHeight}px`;
        void bodyEl.offsetHeight;
      }
      bodyEl.style.maxHeight = "0px";
      bodyEl.style.overflow = "hidden";
      return;
    }

    const { height } = layout(prepared, contentWidth, ACCORDION_BODY_LINE_HEIGHT);
    const computedStyles = innerEl ? window.getComputedStyle(innerEl) : null;
    const paddingTop = computedStyles ? Number.parseFloat(computedStyles.paddingTop) || 0 : 0;
    const paddingBottom = computedStyles ? Number.parseFloat(computedStyles.paddingBottom) || 0 : 0;
    bodyEl.style.maxHeight = `${height + paddingTop + paddingBottom}px`;
    bodyEl.style.overflow = "hidden";

    const timeoutId = window.setTimeout(() => {
      if (!bodyRef.current || !isOpen) {
        return;
      }

      bodyRef.current.style.maxHeight = "none";
      bodyRef.current.style.overflow = "visible";
    }, 320);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [contentWidth, isOpen, prepared]);

  const label = cleanString(original) || rewritten;

  return (
    <div className={styles.optimizationBulletItem}>
      <button
        type="button"
        className={styles.optimizationBulletButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className={styles.optimizationBulletLabel}>{label}</span>
        <span
          className={[
            styles.optimizationBulletChevron,
            isOpen ? styles.optimizationBulletChevronOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          +
        </span>
      </button>

      <div ref={bodyRef} className={styles.optimizationBulletBody}>
        <div ref={innerRef} className={styles.optimizationBulletBodyInner}>
          <p className={styles.optimizationAccordionBodyText}>
            <strong className={styles.optimizationAccordionBodyTextOptimized}>{rewritten}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function ResumeOptimizationsPanel({
  sections,
  projectSections,
}: {
  sections: OriginalBulletSection[];
  projectSections: ProjectBulletSection[];
}) {
  return (
    <div
      className={styles.resumeOptimizationsCanvas}
      style={{
        top: `${OPTIMIZATIONS_TOP}px`,
        left: `${OPTIMIZATIONS_LEFT}px`,
        width: `${OPTIMIZATIONS_WIDTH}px`,
      }}
    >
      {sections.map((section, index) => (
        <OptimizationSectionAccordion key={`${section.title}-${index}`} section={section} />
      ))}
      {projectSections.length > 0 ? (
        <div className={styles.projectOptimizationsSection}>
          {projectSections.map((section, index) => (
            <OptimizationSectionAccordion key={`project-${section.title}-${index}`} section={section} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function openResumeFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(RESUME_FILE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESUME_FILE_STORE_NAME)) {
        db.createObjectStore(RESUME_FILE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open resume file database."));
  });
}

async function savePersistedResumeFile(file: File) {
  const db = await openResumeFileDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RESUME_FILE_STORE_NAME, "readwrite");
    const store = tx.objectStore(RESUME_FILE_STORE_NAME);
    store.put(file, RESUME_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save resume file."));
    tx.onabort = () => reject(tx.error ?? new Error("Resume file save was aborted."));
  });

  db.close();
}

async function loadPersistedResumeFile(): Promise<File | null> {
  const db = await openResumeFileDb();

  const value = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(RESUME_FILE_STORE_NAME, "readonly");
    const store = tx.objectStore(RESUME_FILE_STORE_NAME);
    const getRequest = store.get(RESUME_FILE_KEY);

    getRequest.onsuccess = () => resolve(getRequest.result);
    getRequest.onerror = () => reject(getRequest.error ?? new Error("Failed to load resume file."));
  });

  db.close();

  return value instanceof File ? value : null;
}

async function clearPersistedResumeFile() {
  const db = await openResumeFileDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RESUME_FILE_STORE_NAME, "readwrite");
    const store = tx.objectStore(RESUME_FILE_STORE_NAME);
    store.delete(RESUME_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to clear resume file."));
    tx.onabort = () => reject(tx.error ?? new Error("Resume file clear was aborted."));
  });

  db.close();
}

function toResumeStudioOutput(value: unknown): ResumeStudioOutput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybe = value as Partial<ResumeStudioOutput>;
  if (
    !maybe.job ||
    typeof maybe.job !== "object" ||
    !maybe.match ||
    typeof maybe.match !== "object" ||
    !maybe.analysis ||
    typeof maybe.analysis !== "object"
  ) {
    return null;
  }

  const job = maybe.job as Partial<ResumeStudioOutput["job"]>;
  const match = maybe.match as Partial<ResumeStudioOutput["match"]>;
  const analysis = maybe.analysis as Partial<ResumeStudioOutput["analysis"]>;

  if (
    typeof job.title !== "string" ||
    typeof job.company !== "string" ||
    typeof match.score !== "number" ||
    typeof match.label !== "string" ||
    !Array.isArray(analysis.strengths) ||
    !Array.isArray(analysis.gaps)
  ) {
    return null;
  }

  return {
    job: {
      company: cleanString(job.company),
      title: cleanString(job.title),
    },
    match: {
      score: match.score,
      label: cleanString(match.label),
      summary: typeof match.summary === "string" ? match.summary : "",
    },
    analysis: {
      strengths: analysis.strengths.filter((item): item is string => typeof item === "string"),
      gaps: analysis.gaps.filter((item): item is string => typeof item === "string"),
    },
  };
}

export function ResumeStudioView() {
  const posthog = usePostHog();
  const MIN_JOB_DESCRIPTION_LENGTH = 200;
  const VALID_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
  const ANALYSIS_TYPING_SPEED = 28;
  const ANALYSIS_REVEAL_GAP_MS = 420;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analysisCompleteScreenRef = useRef<HTMLElement | null>(null);
  const lastTrackedResultKeyRef = useRef<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useLocalStorageState<string>(
    "applican:resume-studio:job-description",
    "",
  );
  const [uploadedFileName, setUploadedFileName] = useLocalStorageState<string>(
    "applican:resume-studio:uploaded-file-name",
    "",
  );
  const [isDragging, setIsDragging] = useState(false);
  const [showComputedResults, setShowComputedResults] = useLocalStorageState<boolean>(
    "applican:resume-studio:show-results",
    false,
  );
  const [persistedRunOutput, setPersistedRunOutput] = useLocalStorageState<unknown>(
    "applican:resume-studio:last-run-output",
    null,
  );
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);
  const [isShowingProgressScreen, setIsShowingProgressScreen] = useState(false);
  const [isShowingAnalysisCompleteScreen, setIsShowingAnalysisCompleteScreen] = useState(false);
  const [shouldRenderAnalysisCompleteScreen, setShouldRenderAnalysisCompleteScreen] = useState(false);
  const [isShowingGenerationErrorScreen, setIsShowingGenerationErrorScreen] = useState(false);
  const [jobDescriptionValidationError, setJobDescriptionValidationError] = useState("");
  const [resumeValidationError, setResumeValidationError] = useState("");
  const [revealedAnalysisCount, setRevealedAnalysisCount] = useState(0);
  const [persistedRunId, setPersistedRunId] = useState("");
  const [experienceSourceSections, setExperienceSourceSections] = useState<ParsedExperienceSection[]>([]);
  const { submitResumeRun, isSubmitting, errorMessage, progressMessage, progressPercent, createdRun } = useCreateResumeRun();

  const currentRunOutput = createdRun?.row.output ?? persistedRunOutput;
  const currentRunId = createdRun?.row.id ?? persistedRunId;
  const parsedOutput = useMemo(() => toResumeStudioOutput(currentRunOutput), [currentRunOutput]);
  const originalBulletSections = useMemo(
    () => extractOriginalBulletSections(currentRunOutput, experienceSourceSections),
    [currentRunOutput, experienceSourceSections],
  );
  const projectBulletSections = useMemo(() => extractProjectBulletSections(currentRunOutput), [currentRunOutput]);
  const hasResult = Boolean(parsedOutput);
  const hasRunOutput = currentRunOutput !== null && currentRunOutput !== undefined;
  const shouldShowResults = showComputedResults && hasResult;
  const outputShapeError =
    showComputedResults && hasRunOutput && !hasResult
      ? "Result was generated, but output shape is not UI-compatible yet."
      : "";
  const generationErrorText =
    errorMessage.trim() ||
    "We failed to generate resume improvements. Press X to retry.";
  const isJobDescriptionValid = jobDescription.trim().length > MIN_JOB_DESCRIPTION_LENGTH;
  const shouldShowValidatedJobDescriptionStyle = isJobDescriptionValid;
  const shouldShowInvalidJobDescriptionStyle = Boolean(jobDescriptionValidationError);
  const isResumeValid = selectedFile !== null;
  const jobDescriptionErrorText = "Job description should be longer than 200 characters";
  const analysisSequence = useMemo(
    () =>
      parsedOutput
        ? [...parsedOutput.analysis.strengths, ...parsedOutput.analysis.gaps]
        : [],
    [parsedOutput],
  );
  const strengthsLength = parsedOutput?.analysis.strengths.length ?? 0;
  const gapsLength = parsedOutput?.analysis.gaps.length ?? 0;
  const revealedVirtuesCount = Math.min(strengthsLength, revealedAnalysisCount);
  const revealedNegativesCount = Math.max(0, revealedAnalysisCount - strengthsLength);
  const virtuesContainerMinHeight = strengthsLength > 0 ? strengthsLength * 60 - 12 : 0;
  const negativesContainerMinHeight = gapsLength > 0 ? gapsLength * 60 - 12 : 0;

  useEffect(() => {
    const screen = analysisCompleteScreenRef.current;
    if (!screen || !shouldRenderAnalysisCompleteScreen) {
      return;
    }

    gsap.killTweensOf(screen);

    if (isShowingAnalysisCompleteScreen) {
      gsap.fromTo(
        screen,
        { autoAlpha: 0, y: 24, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: "power2.inOut" },
      );
      return;
    }

    gsap.to(screen, {
      autoAlpha: 0,
      y: -16,
      scale: 0.985,
      duration: 0.35,
      ease: "power2.inOut",
      onComplete: () => {
        setShouldRenderAnalysisCompleteScreen(false);
      },
    });
  }, [isShowingAnalysisCompleteScreen, shouldRenderAnalysisCompleteScreen]);

  useEffect(() => {
    let isActive = true;

    if (createdRun?.row.output) {
      return () => {
        isActive = false;
      };
    }

    void (async () => {
      try {
        const latestRun = await getLatestResumeRunForEditor();
        if (!isActive || latestRun?.output === null || latestRun?.output === undefined) {
          return;
        }
        setPersistedRunId(latestRun.id);
        setPersistedRunOutput(latestRun.output);
      } catch {
        // Ignore hydration failures and use local persisted output.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [createdRun?.row.output, setPersistedRunOutput]);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      if (!currentRunId) {
        if (isActive) {
          setExperienceSourceSections([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from("resume_documents")
        .select("text")
        .eq("run_id", currentRunId)
        .maybeSingle();

      if (!isActive || error) {
        return;
      }

      const resumeText = typeof data?.text === "string" ? data.text : "";
      setExperienceSourceSections(parseExperienceSections(resumeText));
    })();

    return () => {
      isActive = false;
    };
  }, [currentRunId]);

  const validateJobDescription = (value: string) => {
    if (value.trim().length > MIN_JOB_DESCRIPTION_LENGTH) {
      setJobDescriptionValidationError("");
      return true;
    }

    setJobDescriptionValidationError(jobDescriptionErrorText);
    return false;
  };

  const handleJobDescriptionChange = (value: string) => {
    setJobDescription(value);

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      setJobDescriptionValidationError("");
      return;
    }

    if (normalizedValue.length > MIN_JOB_DESCRIPTION_LENGTH) {
      setJobDescriptionValidationError("");
      return;
    }

    setJobDescriptionValidationError(jobDescriptionErrorText);
  };

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const persistedFile = await loadPersistedResumeFile();
        if (!isActive || !persistedFile) return;

        setSelectedFile(persistedFile);
        setUploadedFileName(persistedFile.name);
      } catch {
        // Ignore persistence read issues and continue with normal flow.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [setUploadedFileName]);

  useEffect(() => {
    if (!shouldShowResults || isAnalysisCollapsed || analysisSequence.length === 0) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | null = null;
    let currentIndex = 0;

    const revealNext = () => {
      if (isCancelled || currentIndex >= analysisSequence.length) {
        return;
      }

      currentIndex += 1;
      setRevealedAnalysisCount(currentIndex);

      const currentText = analysisSequence[currentIndex - 1] ?? "";
      const waitMs = currentText.length * ANALYSIS_TYPING_SPEED + ANALYSIS_REVEAL_GAP_MS;

      timeoutId = window.setTimeout(() => {
        if (isCancelled) {
          return;
        }
        revealNext();
      }, waitMs);
    };

    timeoutId = window.setTimeout(() => {
      revealNext();
    }, 0);

    return () => {
      isCancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [analysisSequence, shouldShowResults, isAnalysisCollapsed]);

  useEffect(() => {
    if (!shouldShowResults || !parsedOutput) {
      return;
    }

    const resultKey = `${parsedOutput.job.company}|${parsedOutput.job.title}|${parsedOutput.match.score}|${analysisSequence.length}`;
    if (lastTrackedResultKeyRef.current === resultKey) {
      return;
    }

    lastTrackedResultKeyRef.current = resultKey;
    posthog.capture("results_viewed", {
      company: parsedOutput.job.company,
      title: parsedOutput.job.title,
      match_score: parsedOutput.match.score,
      strengths_count: parsedOutput.analysis.strengths.length,
      gaps_count: parsedOutput.analysis.gaps.length,
    });
  }, [analysisSequence.length, parsedOutput, posthog, shouldShowResults]);

  useEffect(() => {
    const roleTitle = shouldShowResults ? (parsedOutput?.job.title.trim() ?? "") : "";
    const nextTitle = roleTitle ? `${DEFAULT_PAGE_TITLE} | ${roleTitle}` : DEFAULT_PAGE_TITLE;
    document.title = nextTitle;

    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [parsedOutput?.job.title, shouldShowResults]);

  const selectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextFile = files[0];
    const lowerFileName = nextFile.name.toLowerCase();
    const hasValidExtension = VALID_RESUME_EXTENSIONS.some((extension) => lowerFileName.endsWith(extension));

    if (!hasValidExtension) {
      void clearPersistedResumeFile();
      setSelectedFile(null);
      setUploadedFileName(nextFile.name);
      setResumeValidationError("Please upload a valid resume file (.pdf, .doc, or .docx).");
      return;
    }

    void savePersistedResumeFile(nextFile);
    setSelectedFile(nextFile);
    setUploadedFileName(nextFile.name);
    setResumeValidationError("");
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const onGenerateResult = async () => {
    if (!isResumeValid) {
      setResumeValidationError("Please upload a valid resume file (.pdf, .doc, or .docx).");
    } else {
      setResumeValidationError("");
    }

    const isJobValidForSubmission = validateJobDescription(jobDescription);

    if (!isJobValidForSubmission || !isResumeValid) return;

    setIsShowingGenerationErrorScreen(false);
    setIsShowingProgressScreen(true);

    const result = await submitResumeRun({ file: selectedFile, jobDescription });

    await wait(220);
    setIsShowingProgressScreen(false);

    if (result.ok) {
      setShouldRenderAnalysisCompleteScreen(true);
      setIsShowingAnalysisCompleteScreen(true);
      await wait(2500);
      setIsShowingAnalysisCompleteScreen(false);
      await wait(360);
      setPersistedRunOutput(result.createdRun.row.output);
      setRevealedAnalysisCount(0);
      setShowComputedResults(true);
      return;
    }

    setIsShowingGenerationErrorScreen(true);
  };

  const onStartNewAnalysis = () => {
    lastTrackedResultKeyRef.current = "";
    void clearPersistedResumeFile();
    setShowComputedResults(false);
    setIsAnalysisCollapsed(false);
    setIsShowingAnalysisCompleteScreen(false);
    setShouldRenderAnalysisCompleteScreen(false);
    setIsShowingGenerationErrorScreen(false);
    setJobDescriptionValidationError("");
    setResumeValidationError("");
    setSelectedFile(null);
    setJobDescription("");
    setUploadedFileName("");
    setPersistedRunOutput(null);
    setRevealedAnalysisCount(0);
  };

  const onToggleAnalysisCollapse = () => {
    setIsAnalysisCollapsed((previous) => {
      if (previous) {
        setRevealedAnalysisCount(0);
      }
      return !previous;
    });
  };

  const rootClassName =
    shouldShowResults ||
    isShowingProgressScreen ||
    shouldRenderAnalysisCompleteScreen ||
    isShowingGenerationErrorScreen
      ? [styles.resultsContent, isShowingProgressScreen ? styles.resultsContentLoading : ""].filter(Boolean).join(" ")
      : styles.content;
  const useScrollSectionsFlow = true;

  return (
    <div className={rootClassName}>
      {isShowingProgressScreen ? (
        <section className={styles.progressScreenContainer}>
          <LoadingScreen backendProgress={progressPercent} />
        </section>
      ) : shouldRenderAnalysisCompleteScreen ? (
        <section
          ref={analysisCompleteScreenRef}
          className={styles.analysisCompleteScreen}
          role="status"
          aria-live="polite"
          aria-label="Analyzing complete"
        >
          <p className={styles.analysisCompleteTitle}>Analyzing Complete</p>
          <div className={styles.analysisCompleteSpinner} aria-hidden="true" />
        </section>
      ) : isShowingGenerationErrorScreen ? (
        <section className={styles.generationErrorScreen}>
          <div className={styles.generationErrorButtonContainer}>
            <button
              type="button"
              className={styles.generationErrorButton}
              onClick={() => void onGenerateResult()}
              aria-label="Retry generation"
            >
              <img src={errorScreenIcon} alt="Generation failed. Press to try again." className={styles.generationErrorButtonImage} />
            </button>
          </div>
          <div className={styles.generationErrorSubtextContainer}>
            <p className={styles.generationErrorSubtext}>
              {generationErrorText}
            </p>
          </div>
        </section>
      ) : !shouldShowResults ? (
        <>
          <div className={styles.jobInputWrapper}>
            <img src={jobDescriptionIcon} alt="" aria-hidden="true" className={styles.jobInputIcon} />
            <input
              type="text"
              className={[
                styles.jobDescriptionInput,
                shouldShowValidatedJobDescriptionStyle ? styles.jobDescriptionInputValidated : "",
                shouldShowInvalidJobDescriptionStyle ? styles.jobDescriptionInputInvalid : "",
              ]
                .filter(Boolean)
                .join(" ")}
              placeholder={
                shouldShowInvalidJobDescriptionStyle
                  ? "Job description should be longer than 200 characters"
                  : "Paste a job description..."
              }
              value={jobDescription}
              onChange={(event) => {
                handleJobDescriptionChange(event.target.value);
              }}
            />
          </div>

          <div
            role="button"
            tabIndex={0}
            className={[styles.uploadBox, uploadedFileName ? styles.fileUploaded : "", isDragging ? styles.dragging : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              selectFile(event.dataTransfer.files);
            }}
          >
            <span className={[styles.uploadText, resumeValidationError ? styles.uploadTextInvalid : ""].filter(Boolean).join(" ")}>
              {uploadedFileName ? (
                uploadedFileName
              ) : (
                <>
                  <img src={arrowIcon} alt="" aria-hidden="true" className={styles.arrowIcon} />
                  Upload Resume
                </>
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx"
              onChange={(event) => selectFile(event.target.files)}
            />
          </div>

            <button
              type="button"
              className={styles.generateResultButton}
              onClick={() => void onGenerateResult()}
              disabled={isSubmitting || isShowingProgressScreen || isShowingAnalysisCompleteScreen || !isResumeValid || !isJobDescriptionValid}
            >
            <img src={starIcon} alt="" aria-hidden="true" className={styles.generateResultButtonIcon} />
            <span>{isSubmitting ? "Generating..." : "Generate Result"}</span>
          </button>
          {progressMessage ? <p className={styles.statusSuccess}>{progressMessage}</p> : null}
          {resumeValidationError ? <p className={styles.statusError}>{resumeValidationError}</p> : null}
          {errorMessage && !isShowingGenerationErrorScreen ? <p className={styles.statusError}>{errorMessage}</p> : null}
          {outputShapeError ? <p className={styles.statusError}>{outputShapeError}</p> : null}
        </>
      ) : useScrollSectionsFlow ? (
        <section className={styles.resumeAnalysisContainer}>
          <div className={styles.resumeAnalysisActions}>
            <button type="button" className={styles.newAnalysisButton} onClick={onStartNewAnalysis}>
              New analysis
            </button>
          </div>
          <ScrollSections
            sections={[
              {
                id: "analysis",
                content: (
                  <div className={styles.resumeAnalysisScrollContainer}>
                    <div className={styles.resumeRoleContainer}>
                      <h2 className={styles.resumeRoleText}>
                        <WritingText
                          key={`company-${parsedOutput?.job.company ?? ""}`}
                          text={parsedOutput?.job.company ?? ""}
                          transition={{ type: "spring", bounce: 0, duration: 4.25, delay: 0.175 }}
                          spacing="0.3ch"
                        />
                        {" - "}
                        <WritingText
                          key={`title-${parsedOutput?.job.title ?? ""}`}
                          text={parsedOutput?.job.title ?? ""}
                          transition={{ type: "spring", bounce: 0, duration: 4.25, delay: 0.175 }}
                          spacing="0.3ch"
                        />
                      </h2>
                    </div>

                    <div className={styles.resumeScorePill}>
                      <img src={blackStarIcon} alt="" aria-hidden="true" className={styles.resumeScoreIcon} />
                      <p className={styles.resumeScoreValue}>{parsedOutput?.match.label}</p>
                    </div>

                    <div className={styles.resumeVirtuesContainer} style={{ minHeight: virtuesContainerMinHeight }}>
                      {parsedOutput?.analysis.strengths.slice(0, revealedVirtuesCount).map((virtue, index) => (
                        <span key={virtue} className={styles.resumeVirtuePill}>
                          <img src={checkIcon} alt="" aria-hidden="true" className={styles.resumeVirtueIcon} />
                          <TypingText
                            key={`virtue-${index}-${virtue}`}
                            as="span"
                            className={styles.resumeVirtueText}
                            text={virtue}
                            showCursor
                            showCursorWhileTypingOnly
                            cursorCharacter="│"
                            cursorClassName={styles.resumeTypingCursor}
                            loop={false}
                            typingSpeed={ANALYSIS_TYPING_SPEED}
                            initialDelay={0}
                            pauseDuration={0}
                          />
                        </span>
                      ))}
                    </div>

                    <div className={styles.resumeNegativesContainer} style={{ minHeight: negativesContainerMinHeight }}>
                      {parsedOutput?.analysis.gaps.slice(0, revealedNegativesCount).map((negative, index) => (
                        <span key={negative} className={styles.resumeNegativePill}>
                          <span className={styles.resumeNegativeIcon} aria-hidden="true">
                            ×
                          </span>
                          <TypingText
                            key={`negative-${index}-${negative}`}
                            as="span"
                            className={styles.resumeNegativeText}
                            text={negative}
                            showCursor
                            showCursorWhileTypingOnly
                            cursorCharacter="│"
                            cursorClassName={styles.resumeTypingCursor}
                            loop={false}
                            typingSpeed={ANALYSIS_TYPING_SPEED}
                            initialDelay={0}
                            pauseDuration={0}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                id: "optimizations",
                content: (
                  <div className={styles.resumeOptimizationsContainer}>
                    <h3 className={styles.resumeOptimizationsTitle}>Resume Optimizations</h3>
                    <ResumeOptimizationsPanel
                      sections={originalBulletSections}
                      projectSections={projectBulletSections}
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <section className={styles.resumeAnalysisContainer}>
          <div className={styles.resumeAnalysisActions}>
            <button type="button" className={styles.newAnalysisButton} onClick={onStartNewAnalysis}>
              New analysis
            </button>
          </div>

          <button
            type="button"
            className={styles.analysisCollapseButton}
            onClick={onToggleAnalysisCollapse}
            aria-label={isAnalysisCollapsed ? "Expand resume analysis" : "Collapse resume analysis"}
            aria-expanded={!isAnalysisCollapsed}
          >
            <img
              src={arrowIcon}
              alt=""
              aria-hidden="true"
              className={[
                styles.analysisCollapseIcon,
                isAnalysisCollapsed ? styles.analysisCollapseIconFlipped : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          </button>

          {!isAnalysisCollapsed ? (
            <>
              <div className={styles.resumeRoleContainer}>
                <h2 className={styles.resumeRoleText}>
                  <WritingText
                    key={`company-${parsedOutput?.job.company ?? ""}`}
                    text={parsedOutput?.job.company ?? ""}
                    transition={{ type: "spring", bounce: 0, duration: 4.25, delay: 0.175 }}
                    spacing="0.3ch"
                  />
                  {" - "}
                  <WritingText
                    key={`title-${parsedOutput?.job.title ?? ""}`}
                    text={parsedOutput?.job.title ?? ""}
                    transition={{ type: "spring", bounce: 0, duration: 4.25, delay: 0.175 }}
                    spacing="0.3ch"
                  />
                </h2>
              </div>

              <div className={styles.resumeScorePill}>
                <img src={blackStarIcon} alt="" aria-hidden="true" className={styles.resumeScoreIcon} />
                <p className={styles.resumeScoreValue}>{parsedOutput?.match.label}</p>
              </div>

              <div className={styles.resumeVirtuesContainer} style={{ minHeight: virtuesContainerMinHeight }}>
                {parsedOutput?.analysis.strengths.slice(0, revealedVirtuesCount).map((virtue, index) => (
                  <span key={virtue} className={styles.resumeVirtuePill}>
                    <img src={checkIcon} alt="" aria-hidden="true" className={styles.resumeVirtueIcon} />
                    <TypingText
                      key={`virtue-${index}-${virtue}`}
                      as="span"
                      className={styles.resumeVirtueText}
                      text={virtue}
                      showCursor
                      showCursorWhileTypingOnly
                      cursorCharacter="│"
                      cursorClassName={styles.resumeTypingCursor}
                      loop={false}
                      typingSpeed={ANALYSIS_TYPING_SPEED}
                      initialDelay={0}
                      pauseDuration={0}
                    />
                  </span>
                ))}
              </div>

              <div className={styles.resumeNegativesContainer} style={{ minHeight: negativesContainerMinHeight }}>
                {parsedOutput?.analysis.gaps.slice(0, revealedNegativesCount).map((negative, index) => (
                  <span key={negative} className={styles.resumeNegativePill}>
                    <span className={styles.resumeNegativeIcon} aria-hidden="true">
                      ×
                    </span>
                    <TypingText
                      key={`negative-${index}-${negative}`}
                      as="span"
                      className={styles.resumeNegativeText}
                      text={negative}
                      showCursor
                      showCursorWhileTypingOnly
                      cursorCharacter="│"
                      cursorClassName={styles.resumeTypingCursor}
                      loop={false}
                      typingSpeed={ANALYSIS_TYPING_SPEED}
                      initialDelay={0}
                      pauseDuration={0}
                    />
                  </span>
                ))}
              </div>
            </>
          ) : null}

        </section>
      )}
    </div>
  );
}

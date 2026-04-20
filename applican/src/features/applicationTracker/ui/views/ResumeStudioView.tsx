import { useEffect, useMemo, useRef, useState } from "react";
import { usePostHog } from "@posthog/react";
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
import {
  extractResumeOptimizationPresentationSections,
  type ResumeOptimizationPresentationSection,
} from "../../../../lib/resumeOptimizations";

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

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function OptimizationSectionAccordion({ section }: { section: ResumeOptimizationPresentationSection }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={styles.optimizationGroup}>
      <button
        type="button"
        className={styles.optimizationAccordionButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className={styles.optimizationJobTitle}>{section.display_title}</span>
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

      <div className={styles.optimizationAccordionBody} style={{ maxHeight: isOpen ? "2000px" : "0px" }}>
        <div className={styles.optimizationAccordionBodyInner}>
          <div className={styles.optimizationBulletList}>
            {section.bullets.map((bullet) => (
              <article key={bullet.id} className={styles.optimizationBulletItem}>
                <p className={styles.optimizationAccordionBodyText}>{bullet.original ?? bullet.optimized ?? ""}</p>
                {isOpen && bullet.optimized && bullet.optimized !== bullet.original ? (
                  <div className={styles.optimizationBulletBodyInner}>
                    <p
                      className={[
                        styles.optimizationAccordionBodyText,
                        styles.optimizationAccordionBodyTextOptimized,
                      ].join(" ")}
                    >
                      {bullet.optimized}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function ResumeOptimizationsPanel({ sections }: { sections: ResumeOptimizationPresentationSection[] }) {
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
        <OptimizationSectionAccordion key={`${section.id}-${index}`} section={section} />
      ))}
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
  const { submitResumeRun, isSubmitting, errorMessage, progressMessage, progressPercent, createdRun } = useCreateResumeRun();

  const currentRunOutput = createdRun?.row.output ?? persistedRunOutput;
  const parsedOutput = useMemo(() => toResumeStudioOutput(currentRunOutput), [currentRunOutput]);
  const optimizationSections = useMemo(
    () => extractResumeOptimizationPresentationSections(currentRunOutput),
    [currentRunOutput],
  );
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
        setPersistedRunOutput(latestRun.output);
      } catch {
        // Ignore hydration failures and use local persisted output.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [createdRun?.row.output, setPersistedRunOutput]);

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
                    <ResumeOptimizationsPanel sections={optimizationSections} />
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

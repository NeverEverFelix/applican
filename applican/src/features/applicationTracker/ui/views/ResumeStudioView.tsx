import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../applicationTrack.module.css";
import starIcon from "../../../../assets/Star.png";
import blackStarIcon from "../../../../assets/Black star.png";
import arrowIcon from "../../../../assets/Arrow.png";
import logoIcon from "../../../../assets/logo.png";
import jobDescriptionIcon from "../../../../assets/Job Description Icon.png";
import checkIcon from "../../../../assets/Check.png";
import { useLocalStorageState } from "../../../../hooks/useLocalStorageState";
import { useCreateResumeRun } from "../../../jobs/hooks/useCreateResumeRun";

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
};

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
    typeof maybe.analysis !== "object" ||
    !Array.isArray(maybe.optimizations)
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

  return maybe as ResumeStudioOutput;
}

export function ResumeStudioView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTickerRef = useRef<number | null>(null);
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
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);
  const [isShowingProgressScreen, setIsShowingProgressScreen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const { submitResumeRun, isSubmitting, errorMessage, progressMessage, createdRun } = useCreateResumeRun();

  const parsedOutput = useMemo(() => toResumeStudioOutput(createdRun?.row.output), [createdRun?.row.output]);
  const hasResult = Boolean(parsedOutput);
  const hasRunOutput = createdRun?.row.output !== null && createdRun?.row.output !== undefined;
  const shouldShowResults = showComputedResults && hasResult;
  const outputShapeError =
    showComputedResults && hasRunOutput && !hasResult
      ? "Result was generated, but output shape is not UI-compatible yet."
      : "";
  const roleTitle = parsedOutput ? `${parsedOutput.job.company} - ${parsedOutput.job.title}` : "";
  const progressStatusText = "Generating tailored bullet improvements... This usually takes ~10-25 seconds.";

  useEffect(() => {
    return () => {
      if (progressTickerRef.current !== null) {
        window.clearInterval(progressTickerRef.current);
      }
    };
  }, []);

  const stopProgressTicker = () => {
    if (progressTickerRef.current !== null) {
      window.clearInterval(progressTickerRef.current);
      progressTickerRef.current = null;
    }
  };

  const startProgressTicker = () => {
    stopProgressTicker();
    progressTickerRef.current = window.setInterval(() => {
      setProgressPercent((previous) => {
        if (previous >= 92) {
          return previous;
        }
        const remaining = 92 - previous;
        const step = Math.max(0.25, remaining * 0.04);
        return Math.min(previous + step, 92);
      });
    }, 80);
  };

  const selectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
    setUploadedFileName(files[0].name);
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const onGenerateResult = async () => {
    setProgressPercent(8);
    setIsShowingProgressScreen(true);
    startProgressTicker();

    const result = await submitResumeRun({ file: selectedFile, jobDescription });

    stopProgressTicker();
    setProgressPercent(100);
    await wait(350);
    setIsShowingProgressScreen(false);

    if (result.ok) {
      setShowComputedResults(true);
    }
  };

  const onStartNewAnalysis = () => {
    setShowComputedResults(false);
    setIsAnalysisCollapsed(false);
    setSelectedFile(null);
    setJobDescription("");
    setUploadedFileName("");
  };

  const rootClassName = shouldShowResults || isShowingProgressScreen ? styles.resultsContent : styles.content;

  return (
    <div className={rootClassName}>
      {isShowingProgressScreen ? (
        <section className={styles.progressScreenContainer}>
          <div className={styles.progressLogoContainer}>
            <img src={logoIcon} alt="Applican logo" className={styles.progressLogoImage} />
          </div>
          <div className={styles.progressBarContainer} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.progressStatusContainer}>
            <p className={styles.progressStatusText}>{progressStatusText}</p>
          </div>
        </section>
      ) : !shouldShowResults ? (
        <>
          <div className={styles.jobInputWrapper}>
            <img src={jobDescriptionIcon} alt="" aria-hidden="true" className={styles.jobInputIcon} />
            <input
              type="text"
              className={styles.jobDescriptionInput}
              placeholder="Paste a job description..."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
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
            <span className={styles.uploadText}>
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
            disabled={isSubmitting || isShowingProgressScreen || !selectedFile || !jobDescription.trim()}
          >
            <img src={starIcon} alt="" aria-hidden="true" className={styles.generateResultButtonIcon} />
            <span>{isSubmitting ? "Generating..." : "Generate Result"}</span>
          </button>
          {progressMessage ? <p className={styles.statusSuccess}>{progressMessage}</p> : null}
          {errorMessage ? <p className={styles.statusError}>{errorMessage}</p> : null}
          {outputShapeError ? <p className={styles.statusError}>{outputShapeError}</p> : null}
        </>
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
            onClick={() => setIsAnalysisCollapsed((previous) => !previous)}
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
                <h2 className={styles.resumeRoleText}>{roleTitle}</h2>
              </div>

              <div className={styles.resumeScorePill}>
                <img src={blackStarIcon} alt="" aria-hidden="true" className={styles.resumeScoreIcon} />
                <p className={styles.resumeScoreValue}>{parsedOutput?.match.label}</p>
              </div>

              <div className={styles.resumeVirtuesContainer}>
                {parsedOutput?.analysis.strengths.map((virtue) => (
                  <span key={virtue} className={styles.resumeVirtuePill}>
                    <img src={checkIcon} alt="" aria-hidden="true" className={styles.resumeVirtueIcon} />
                    <span className={styles.resumeVirtueText}>{virtue}</span>
                  </span>
                ))}
              </div>

              <div className={styles.resumeNegativesContainer}>
                {parsedOutput?.analysis.gaps.map((negative) => (
                  <span key={negative} className={styles.resumeNegativePill}>
                    <span className={styles.resumeNegativeIcon} aria-hidden="true">
                      ×
                    </span>
                    <span className={styles.resumeNegativeText}>{negative}</span>
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <div className={styles.resumeAnalysisSeparatorWrap}>
            <div className={styles.resumeAnalysisBottomSeparator} aria-hidden="true" />
          </div>

          <div
            className={[
              styles.resumeOptimizationsContainer,
              isAnalysisCollapsed ? styles.resumeOptimizationsContainerExpanded : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <h3 className={styles.resumeOptimizationsTitle}>Resume Optimizations</h3>
            {parsedOutput?.optimizations.map((optimization, optimizationIndex) => (
              <section key={`${optimization.experience_title}-${optimizationIndex}`} className={styles.optimizationGroup}>
                <h4 className={styles.optimizationExperienceTitle}>{optimization.experience_title}</h4>
                <p className={styles.optimizationRoleLine}>
                  {optimization.role_before} {"->"} <strong>{optimization.role_after}</strong>
                </p>
                {optimization.bullets.map((bullet, index) => (
                  <article key={`${optimization.experience_title}-${index}`} className={styles.optimizationBulletCard}>
                    {bullet.original ? (
                      <p className={styles.optimizationOriginalLine}>
                        <span className={styles.optimizationActionTag}>{bullet.action.toUpperCase()}</span>
                        {bullet.original}
                      </p>
                    ) : null}
                    <p className={styles.optimizationRewrittenLine}>{bullet.rewritten}</p>
                    {bullet.reason ? <p className={styles.optimizationReasonLine}>{bullet.reason}</p> : null}
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

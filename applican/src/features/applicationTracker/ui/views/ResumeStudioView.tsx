import { useRef, useState } from "react";
import styles from "../applicationTrack.module.css";
import starIcon from "../../../../assets/Star.png";
import blackStarIcon from "../../../../assets/Black star.png";
import arrowIcon from "../../../../assets/Arrow.png";
import jobDescriptionIcon from "../../../../assets/Job Description Icon.png";
import checkIcon from "../../../../assets/Check.png";
import { useLocalStorageState } from "../../../../hooks/useLocalStorageState";

export function ResumeStudioView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const mockTitle = "Senior Product Designer";
  const mockScore = 92;
  const mockVirtues = [
    "You clearly quantify impact across content and growth work, which makes your accomplishments easy to evaluate quickly.",
    "Your bullets consistently use strong action verbs and ownership language that signals execution depth and leadership.",
    "You include relevant role-specific keywords and platform terms that should improve ATS matching for this job family.",
  ];
  const mockNegatives = [
    "Several bullets mention responsibilities but do not include specific outcome metrics, making results less convincing than they could be.",
    "Your experience section does not yet highlight direct large-scale cross-functional collaboration in a major tech environment.",
  ];

  const selectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadedFileName(files[0].name);
  };

  const onGenerateResult = () => {
    setShowComputedResults(true);
  };

  return (
    <div className={showComputedResults ? styles.resultsContent : styles.content}>
      {!showComputedResults ? (
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

          <button type="button" className={styles.generateResultButton} onClick={onGenerateResult}>
            <img src={starIcon} alt="" aria-hidden="true" className={styles.generateResultButtonIcon} />
            <span>Generate Result</span>
          </button>
        </>
      ) : (
        <section className={styles.resumeAnalysisContainer}>
          <div className={styles.resumeRoleContainer}>
            <h2 className={styles.resumeRoleText}>{mockTitle}</h2>
          </div>

          <div className={styles.resumeScorePill}>
            <img src={blackStarIcon} alt="" aria-hidden="true" className={styles.resumeScoreIcon} />
            <p className={styles.resumeScoreValue}>{mockScore} Resume Score</p>
          </div>

          <div className={styles.resumeVirtuesContainer}>
            {mockVirtues.map((virtue) => (
              <span key={virtue} className={styles.resumeVirtuePill}>
                <img src={checkIcon} alt="" aria-hidden="true" className={styles.resumeVirtueIcon} />
                <span className={styles.resumeVirtueText}>{virtue}</span>
              </span>
            ))}
          </div>

          <div className={styles.resumeNegativesContainer}>
            {mockNegatives.map((negative) => (
              <span key={negative} className={styles.resumeNegativePill}>
                <span className={styles.resumeNegativeIcon} aria-hidden="true">
                  ×
                </span>
                <span className={styles.resumeNegativeText}>{negative}</span>
              </span>
            ))}
          </div>

          <div className={styles.resumeAnalysisBottomSeparator} aria-hidden="true" />

          <div className={styles.resumeOptimizationsContainer}>
            <h3 className={styles.resumeOptimizationsTitle}>Resume Optimization</h3>
          </div>
        </section>
      )}
    </div>
  );
}

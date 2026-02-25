import { useRef, useState } from "react";
import styles from "../applicationTrack.module.css";
import starIcon from "../../../../assets/Star.png";
import arrowIcon from "../../../../assets/Arrow.png";
import jobDescriptionIcon from "../../../../assets/Job Description Icon.png";
import { useCreateResumeRun } from "../../../jobs/hooks/useCreateResumeRun";

export function ResumeStudioView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const { isSubmitting, errorMessage, createdRun, submitResumeRun } = useCreateResumeRun();

  const selectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
    setUploadedFileName(files[0].name);
  };

  return (
    <div className={styles.content}>
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
        disabled={isSubmitting}
        onClick={() => submitResumeRun({ file: selectedFile, jobDescription })}
      >
        <img src={starIcon} alt="" aria-hidden="true" className={styles.generateResultButtonIcon} />
        <span>{isSubmitting ? "Generating..." : "Generate Result"}</span>
      </button>

      {errorMessage ? <p className={styles.statusError}>{errorMessage}</p> : null}
      {createdRun ? <p className={styles.statusSuccess}>Generation complete.</p> : null}
      {createdRun?.row.output ? (
        <pre className={styles.outputPanel}>{JSON.stringify(createdRun.row.output, null, 2)}</pre>
      ) : null}
    </div>
  );
}

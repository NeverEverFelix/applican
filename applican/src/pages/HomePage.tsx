import { useRef, useState } from "react";
import styles from "./HomePage.module.css";
import starIcon from "../assets/Star.png";
import jobDescriptionIcon from "../assets/Job Description Icon.png";
import hamburgerIcon from "../assets/Hamburger.png";
import careerPathIcon from "../assets/Vector (1).png";
import resourcesIcon from "../assets/oblong.png";
import arrowIcon from "../assets/Arrow.png";
import UserInfoCard from "../components/UserInfoCard";
import { useCurrentUserName } from "../features/auth/useCurrentUser";
import userStyles from "../components/UserInfo.module.css";

type PickerView = "Resume Studio" | "Application Tracker" | "Career Path" | "Resources";

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedView, setSelectedView] = useState<PickerView>("Resume Studio");
  const currentUserName = useCurrentUserName();
  const pickerItems: Array<{ label: PickerView; iconSrc: string }> = [
    { label: "Resume Studio", iconSrc: starIcon },
    { label: "Application Tracker", iconSrc: hamburgerIcon },
    { label: "Career Path", iconSrc: careerPathIcon },
    { label: "Resources", iconSrc: resourcesIcon },
  ];

  const selectFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadedFileName(files[0].name);
  };

  return (
    <div className={styles.container}>
      <div className={styles.userInfoContainer}>
        <UserInfoCard user={{ name: currentUserName }} />
        <div className={userStyles.stateControlStack}>
          {pickerItems.map((item) => (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              className={[
                userStyles.stateControlItem,
                selectedView === item.label ? userStyles.stateControlItemActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelectedView(item.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedView(item.label);
                }
              }}
              aria-pressed={selectedView === item.label}
            >
              <img src={item.iconSrc} alt="" aria-hidden="true" className={userStyles.stateControlIcon} />
              <p className={userStyles.stateControlLabel}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.studioContainer}>
        <div className={styles.content}>
          <div className={styles.jobInputWrapper}>
            <img src={jobDescriptionIcon} alt="" aria-hidden="true" className={styles.jobInputIcon} />
            <input
              type="text"
              className={styles.jobDescriptionInput}
              placeholder="Paste a job description..."
            />
          </div>
          <div
            role="button"
            tabIndex={0}
            className={[
              styles.uploadBox,
              uploadedFileName ? styles.fileUploaded : "",
              isDragging ? styles.dragging : "",
            ]
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
          <button type="button" className={styles.generateResultButton}>
            <img src={starIcon} alt="" aria-hidden="true" className={styles.generateResultButtonIcon} />
            <span>Generate Result</span>
          </button>
        </div>
      </div>
    </div>
  );
}

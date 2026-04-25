import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import styles from "../applicationTrack.module.css";
import { animateEditorFlip, captureEditorFlipState } from "../../../../effects/flip";
import { invokeGenerateTailoredResume } from "../../../jobs/api/invokeGenerateTailoredResume";
import StatusNotice from "../../../../components/feedback/StatusNotice";
import { listGeneratedResumes } from "../../../jobs/api/listGeneratedResumes";
import { getLatestResumeRunForEditor } from "../../../jobs/api/getLatestResumeRunForEditor";
import type { GeneratedResumeRow } from "../../../jobs/model/types";
import resumeIcon3 from "../../../../assets/resume-icons/resume-icon3.svg";
import texFileIcon from "../../../../assets/.tex.svg";
import downloadIcon from "../../../../assets/downloadIcon.svg";
import editorModeIcon from "../../../../assets/editor.svg";
import historyModeIcon from "../../../../assets/history.svg";
import refreshHistoryIcon from "../../../../assets/refresh-history.svg";

const DEFAULT_LATEX = [
  "% Tailored resume output will appear here after compile.",
  "\\documentclass{article}",
  "\\begin{document}",
  "Open Editor after analysis and LaTeX will auto-load.",
  "\\end{document}",
].join("\n");

const configureLatexLanguage: BeforeMount = (monaco) => {
  const hasLatex = monaco.languages.getLanguages().some((language: { id: string }) => language.id === "latex");
  if (!hasLatex) {
    monaco.languages.register({ id: "latex" });
    monaco.languages.setLanguageConfiguration("latex", {
      comments: { lineComment: "%" },
      brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
      ],
    });

    monaco.languages.setMonarchTokensProvider("latex", {
      tokenizer: {
        root: [
          [/\\\\[a-zA-Z@]+/, "keyword"],
          [/%.*$/, "comment"],
          [/[[\]{}()]/, "delimiter"],
          [/\$[^$]*\$/, "string"],
        ],
      },
    });
  }
};

type TailoredResumeOutput = {
  id?: string;
  filename?: string;
  latex?: string;
};

function extractTailoredResumeFromOutput(output: unknown): TailoredResumeOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const root = output as { tailored_resume?: unknown };
  if (!root.tailored_resume || typeof root.tailored_resume !== "object") {
    return null;
  }

  const tailored = root.tailored_resume as {
    id?: unknown;
    filename?: unknown;
    latex?: unknown;
  };

  return {
    id: typeof tailored.id === "string" ? tailored.id : undefined,
    filename: typeof tailored.filename === "string" ? tailored.filename : undefined,
    latex: typeof tailored.latex === "string" ? tailored.latex : undefined,
  };
}

export function EditorView() {
  const historySkeletonRows = 5;
  const [latex, setLatex] = useState(DEFAULT_LATEX);
  const [filename, setFilename] = useState("tailored-resume.tex");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryRefreshAnimating, setIsHistoryRefreshAnimating] = useState(false);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResumeRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditorMode, setIsEditorMode] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const pendingFlipRef = useRef<ReturnType<typeof captureEditorFlipState> | null>(null);

  const onSelectHistoryItem = useCallback(async (row: GeneratedResumeRow) => {
    setSelectedResumeId(row.id);
    setFilename(row.filename);
    setLatex(row.latex);
    setErrorMessage("");
  }, []);

  const loadHistory = useCallback(async (autoSelectFirst = false, showRefreshAnimation = false) => {
    setIsHistoryLoading(true);
    if (showRefreshAnimation) {
      setIsHistoryRefreshAnimating(true);
    }
    try {
      const rows = await listGeneratedResumes(30);
      setGeneratedResumes(rows);
      if (autoSelectFirst && rows.length > 0) {
        await onSelectHistoryItem(rows[0]);
      }
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load generated resumes.";
      setErrorMessage(message);
      return [];
    } finally {
      setIsHistoryLoading(false);
      setIsHistoryRefreshAnimating(false);
    }
  }, [onSelectHistoryItem]);

  const compileForRun = useCallback(async (targetRunId: string, targetRequestId?: string) => {
    setErrorMessage("");

    try {
      const response = await invokeGenerateTailoredResume({
        runId: targetRunId,
        requestId: targetRequestId || undefined,
      });

      setLatex(response.tailored_resume.latex);
      setFilename(response.tailored_resume.filename || "tailored-resume.tex");
      setSelectedResumeId(response.tailored_resume.id ?? "");
      await loadHistory(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to compile LaTeX.";
      setErrorMessage(message);
    }
  }, [loadHistory]);

  useEffect(() => {
    void (async () => {
      const history = await loadHistory(true);
      if (history.length > 0) {
        return;
      }

      try {
        const latestRun = await getLatestResumeRunForEditor();
        if (!latestRun) {
          return;
        }

        const existingTailored = extractTailoredResumeFromOutput(latestRun.output);
        if (existingTailored?.latex) {
          setLatex(existingTailored.latex);
          setFilename(existingTailored.filename || "tailored-resume.tex");
          setSelectedResumeId(existingTailored.id ?? "");
          return;
        }

        await compileForRun(latestRun.id, latestRun.request_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize editor.";
        setErrorMessage(message);
      }
    })();
  }, [compileForRun, loadHistory]);

  useLayoutEffect(() => {
    if (!pendingFlipRef.current) {
      return;
    }

    animateEditorFlip(pendingFlipRef.current);
    pendingFlipRef.current = null;
  }, [isEditorMode]);

  const onDownloadTex = () => {
    const blob = new Blob([latex], { type: "application/x-tex" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const onToggleEditorMode = () => {
    pendingFlipRef.current = captureEditorFlipState(workspaceRef.current);
    setIsEditorMode((current) => !current);
  };

  const onEditorKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      onDownloadTex();
    }
  };

  const shouldShowHistorySkeleton = isHistoryLoading && (generatedResumes.length === 0 || isHistoryRefreshAnimating);

  return (
    <section className={styles.editorView}>
      <div className={styles.editorToolbar}>
        <div className={styles.editorDownloadActions} aria-label="Download resume files">
          <div className={styles.editorDownloadAction}>
            <img src={texFileIcon} alt=".tex" className={styles.editorDownloadFileTypeIcon} />
            <button
              type="button"
              className={styles.editorDownloadIconButton}
              onClick={onDownloadTex}
              aria-label="Download .tex file"
            >
              <img src={downloadIcon} alt="" aria-hidden="true" className={styles.editorDownloadIcon} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className={styles.editorModeToggleButton}
          onClick={onToggleEditorMode}
          aria-label={isEditorMode ? "Switch to history view" : "Switch to editor view"}
        >
          <img
            src={isEditorMode ? historyModeIcon : editorModeIcon}
            alt={isEditorMode ? "History" : "Editor"}
            className={styles.editorModeToggleIcon}
          />
        </button>
        <button
          type="button"
          className={styles.editorModeToggleButton}
          onClick={() => void loadHistory(false, true)}
          disabled={isHistoryLoading}
          aria-label={isHistoryLoading ? "Refreshing history" : "Refresh history"}
        >
          <img src={refreshHistoryIcon} alt="Refresh History" className={styles.editorModeToggleIcon} />
        </button>
      </div>

      {errorMessage ? (
        <StatusNotice
          tone="error"
          message={errorMessage}
          className={styles.statusNotice}
        />
      ) : null}

      <div
        ref={workspaceRef}
        className={styles.editorWorkspace}
      >
        <aside
          data-editor-flip="history"
          className={[
            styles.editorHistoryPanel,
            isEditorMode ? styles.editorHistoryPanelCollapsed : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.editorHistoryHeader}>
            <p className={styles.editorHistoryTitle}>Generated History</p>
          </div>

          <div className={styles.editorHistoryList}>
            {shouldShowHistorySkeleton ? (
              Array.from({ length: historySkeletonRows }).map((_, index) => (
                <div
                  key={`history-skeleton-${index}`}
                  className={[styles.editorHistoryItem, styles.editorHistoryItemSkeleton].join(" ")}
                  aria-hidden="true"
                >
                  <span className={[styles.editorHistorySkeletonLine, styles.editorHistorySkeletonName].join(" ")} />
                  <span className={[styles.editorHistorySkeletonLine, styles.editorHistorySkeletonMeta].join(" ")} />
                </div>
              ))
            ) : generatedResumes.length === 0 ? (
              <StatusNotice tone="info" message="No generated resumes yet." className={styles.editorHistoryEmptyNotice} />
            ) : (
              generatedResumes.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={[
                    styles.editorHistoryItem,
                    selectedResumeId === row.id ? styles.editorHistoryItemActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => void onSelectHistoryItem(row)}
                >
                  <span className={styles.editorHistoryItemName}>{row.filename}</span>
                  <span className={styles.editorHistoryItemMeta}>{new Date(row.created_at).toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div
          data-editor-flip="editor"
          className={[
            styles.editorFrame,
            styles.editorFramePreview,
            isEditorMode ? styles.editorFrameSplit : "",
            !isEditorMode ? styles.editorFrameCollapsed : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onKeyDownCapture={onEditorKeyDownCapture}
        >
          <Editor
            height="100%"
            defaultLanguage="latex"
            language="latex"
            value={latex}
            onChange={(value) => setLatex(value ?? "")}
            beforeMount={configureLatexLanguage}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
            theme="vs-dark"
          />
        </div>

        <aside
          data-editor-flip="preview"
          className={[
            styles.editorPreviewPanel,
            styles.editorPreviewPanelOpen,
            isEditorMode ? styles.editorPreviewPanelSplit : styles.editorPreviewPanelHistoryMode,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.editorPreviewFrame}>
            <div className={styles.editorPreviewLoading}>
              <div className={styles.editorPreviewLoadingIconWrap}>
                <img
                  src={resumeIcon3}
                  alt=""
                  aria-hidden="true"
                  className={styles.editorPreviewLoadingIcon}
                />
              </div>
              <div className={styles.editorPreviewLoadingShadow} aria-hidden="true" />
              <StatusNotice
                tone="info"
                message="PDF preview is unavailable. Download the .tex file from the toolbar."
                className={styles.editorHistoryEmptyNotice}
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

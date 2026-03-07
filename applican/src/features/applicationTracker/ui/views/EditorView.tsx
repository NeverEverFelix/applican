import { useEffect, useState } from "react";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import { jsPDF } from "jspdf";
import styles from "../applicationTrack.module.css";
import { invokeGenerateTailoredResume } from "../../../jobs/api/invokeGenerateTailoredResume";
import { listGeneratedResumes } from "../../../jobs/api/listGeneratedResumes";
import { getLatestResumeRunForEditor } from "../../../jobs/api/getLatestResumeRunForEditor";
import type { GeneratedResumeRow } from "../../../jobs/model/types";

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
          [/[{}\[\]()]/, "delimiter"],
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
  const [runId, setRunId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [latex, setLatex] = useState(DEFAULT_LATEX);
  const [filename, setFilename] = useState("tailored-resume.tex");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [generatedResumes, setGeneratedResumes] = useState<GeneratedResumeRow[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onSelectHistoryItem = (row: GeneratedResumeRow) => {
    setSelectedResumeId(row.id);
    setRunId(row.run_id);
    setRequestId(row.request_id ?? "");
    setFilename(row.filename);
    setLatex(row.latex);
    setStatusMessage(`Loaded ${row.filename}.`);
    setErrorMessage("");
  };

  const loadHistory = async (autoSelectFirst = false) => {
    setIsHistoryLoading(true);
    try {
      const rows = await listGeneratedResumes(30);
      setGeneratedResumes(rows);
      if (autoSelectFirst && rows.length > 0) {
        onSelectHistoryItem(rows[0]);
      }
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load generated resumes.";
      setErrorMessage(message);
      return [];
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const compileForRun = async (targetRunId: string, targetRequestId?: string) => {
    setIsCompiling(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await invokeGenerateTailoredResume({
        runId: targetRunId,
        requestId: targetRequestId || undefined,
      });

      setRunId(targetRunId);
      setRequestId(targetRequestId ?? "");
      setLatex(response.tailored_resume.latex);
      setFilename(response.tailored_resume.filename || "tailored-resume.tex");
      setSelectedResumeId(response.tailored_resume.id ?? "");
      setStatusMessage("LaTeX compiled from your latest analysis.");
      await loadHistory(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to compile LaTeX.";
      setErrorMessage(message);
    } finally {
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const history = await loadHistory(true);
      if (history.length > 0) {
        return;
      }

      try {
        const latestRun = await getLatestResumeRunForEditor();
        if (!latestRun) {
          setStatusMessage("No completed resume analyses yet.");
          return;
        }

        setRunId(latestRun.id);
        setRequestId(latestRun.request_id);

        const existingTailored = extractTailoredResumeFromOutput(latestRun.output);
        if (existingTailored?.latex) {
          setLatex(existingTailored.latex);
          setFilename(existingTailored.filename || "tailored-resume.tex");
          setSelectedResumeId(existingTailored.id ?? "");
          setStatusMessage("Loaded latest generated resume.");
          return;
        }

        await compileForRun(latestRun.id, latestRun.request_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize editor.";
        setErrorMessage(message);
      }
    })();
  }, []);

  const onCompileLatest = async () => {
    if (runId) {
      await compileForRun(runId, requestId || undefined);
      return;
    }

    try {
      const latestRun = await getLatestResumeRunForEditor();
      if (!latestRun) {
        setErrorMessage("No completed resume analyses found to compile.");
        return;
      }

      await compileForRun(latestRun.id, latestRun.request_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to find latest run.";
      setErrorMessage(message);
    }
  };

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

  const onDownloadPdf = () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    pdf.setFont("courier", "normal");
    pdf.setFontSize(9);

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const lineHeight = 11;
    const maxTextWidth = pageWidth - margin * 2;
    const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
    const wrappedLines = pdf.splitTextToSize(latex || "", maxTextWidth) as string[];

    if (wrappedLines.length === 0) {
      wrappedLines.push("");
    }

    for (let offset = 0; offset < wrappedLines.length; offset += maxLinesPerPage) {
      if (offset > 0) {
        pdf.addPage();
      }
      const pageLines = wrappedLines.slice(offset, offset + maxLinesPerPage);
      pdf.text(pageLines, margin, margin, {
        baseline: "top",
      });
    }

    const pdfFilename = filename.replace(/\.tex$/i, "") || "tailored-resume";
    pdf.save(`${pdfFilename}.pdf`);
  };

  return (
    <section className={styles.editorView}>
      <div className={styles.editorToolbar}>
        <button
          type="button"
          className={styles.editorButton}
          onClick={() => void onCompileLatest()}
          disabled={isCompiling}
        >
          {isCompiling ? "Compiling..." : "Compile Latest Resume"}
        </button>
        <button type="button" className={styles.editorButtonSecondary} onClick={onDownloadTex}>
          Download .tex
        </button>
        <button
          type="button"
          className={styles.editorButtonSecondary}
          onClick={onDownloadPdf}
        >
          Download .pdf
        </button>
        <button
          type="button"
          className={styles.editorButtonSecondary}
          onClick={() => void loadHistory(false)}
          disabled={isHistoryLoading}
        >
          {isHistoryLoading ? "Refreshing..." : "Refresh History"}
        </button>
        {runId ? <p className={styles.editorMeta}>Run: {runId.slice(0, 8)}...</p> : null}
      </div>

      {statusMessage ? <p className={styles.statusSuccess}>{statusMessage}</p> : null}
      {errorMessage ? <p className={styles.statusError}>{errorMessage}</p> : null}

      <div className={styles.editorWorkspace}>
        <aside className={styles.editorHistoryPanel}>
          <div className={styles.editorHistoryHeader}>
            <p className={styles.editorHistoryTitle}>Generated History</p>
          </div>

          <div className={styles.editorHistoryList}>
            {generatedResumes.length === 0 ? (
              <p className={styles.editorHistoryEmpty}>No generated resumes yet.</p>
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
                  onClick={() => onSelectHistoryItem(row)}
                >
                  <span className={styles.editorHistoryItemName}>{row.filename}</span>
                  <span className={styles.editorHistoryItemMeta}>{new Date(row.created_at).toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className={styles.editorFrame}>
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
      </div>
    </section>
  );
}

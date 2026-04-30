import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorView } from "./EditorView";

const {
  listGeneratedResumesMock,
  getLatestResumeRunForEditorMock,
  invokeGenerateTailoredResumeMock,
  captureEventMock,
} = vi.hoisted(() => ({
  listGeneratedResumesMock: vi.fn(),
  getLatestResumeRunForEditorMock: vi.fn(),
  invokeGenerateTailoredResumeMock: vi.fn(),
  captureEventMock: vi.fn(),
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="latex editor" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

vi.mock("../../../../effects/flip", () => ({
  animateEditorFlip: vi.fn(),
  captureEditorFlipState: vi.fn(() => null),
}));

vi.mock("../../../jobs/api/listGeneratedResumes", () => ({
  listGeneratedResumes: listGeneratedResumesMock,
}));

vi.mock("../../../jobs/api/getLatestResumeRunForEditor", () => ({
  getLatestResumeRunForEditor: getLatestResumeRunForEditorMock,
}));

vi.mock("../../../jobs/api/invokeGenerateTailoredResume", () => ({
  invokeGenerateTailoredResume: invokeGenerateTailoredResumeMock,
}));

vi.mock("../../../../posthog", () => ({
  captureEvent: captureEventMock,
}));

describe("EditorView", () => {
  beforeEach(() => {
    listGeneratedResumesMock.mockResolvedValue([
      {
        id: "resume-1",
        run_id: "run-1",
        request_id: "request-1",
        template: "jakes",
        filename: "tailored-resume.tex",
        latex: "\\\\documentclass{article}",
        created_at: "2026-04-16T00:00:00.000Z",
        updated_at: "2026-04-16T00:00:00.000Z",
      },
    ]);
    getLatestResumeRunForEditorMock.mockResolvedValue(null);
    invokeGenerateTailoredResumeMock.mockReset();
    captureEventMock.mockReset();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:test"),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("tracks opening, editing, and downloading a resume in the editor", async () => {
    render(<EditorView />);

    await waitFor(() => {
      expect(captureEventMock).toHaveBeenCalledWith("latex_editor_opened", {
        resume_id: "resume-1",
        run_id: "run-1",
        request_id: "request-1",
        filename: "tailored-resume.tex",
        source: "editor",
        file_type: "tex",
        resume_origin: "history",
        template: "jakes",
      });
    });

    fireEvent.change(screen.getByLabelText("latex editor"), {
      target: { value: "\\\\documentclass{report}" },
    });

    expect(captureEventMock).toHaveBeenCalledWith(
      "resume_edited",
      expect.objectContaining({
        resume_id: "resume-1",
        run_id: "run-1",
        request_id: "request-1",
        filename: "tailored-resume.tex",
        action: "edit",
        source: "editor",
        edit_mode: "latex_monaco",
        is_editor_mode: false,
        resume_origin: "history",
        template: "jakes",
        file_type: "tex",
        initial_character_count: 24,
        current_character_count: 23,
        seconds_since_editor_opened: expect.any(Number),
        character_delta_bucket: "1_20",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /download .tex file/i }));

    expect(captureEventMock).toHaveBeenCalledWith("resume_downloaded", {
      resume_id: "resume-1",
      run_id: "run-1",
      request_id: "request-1",
      filename: "tailored-resume.tex",
      file_type: "tex",
      resume_origin: "history",
      template: "jakes",
      source: "editor",
    });
  });
});

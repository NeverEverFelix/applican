import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APPLICATION_STATUS, type ApplicationRow } from "../data/model";
import { ApplicationTrackerContent } from "./applicationTrackerContent";

const mockUseApplications = vi.fn();

afterEach(() => {
  cleanup();
  mockUseApplications.mockReset();
});

vi.mock("../data/useApplications", () => ({
  useApplications: () => mockUseApplications(),
}));

vi.mock("../api/getResumeDownloadUrl", () => ({
  getResumeDownloadUrl: vi.fn(),
}));

vi.mock("./views/ResumeStudioView", () => ({
  ResumeStudioView: () => <div>Resume Studio</div>,
}));

vi.mock("./views/EditorView", () => ({
  EditorView: () => <div>Editor</div>,
}));

vi.mock("../../../components/profile/Profile", () => ({
  default: () => <div>Profile</div>,
}));

vi.mock("../../../components/history/HistoryCard", () => ({
  default: () => <div>History Card</div>,
}));

vi.mock("../../../components/history/HistorySummaryPanel", () => ({
  default: () => <div>History Summary</div>,
}));

vi.mock("../../../features/history/api/listHistoryCards", () => ({
  listHistoryCards: vi.fn(async () => ({ cards: [] })),
}));

vi.mock("../../../effects/FadeSwipePanels", () => ({
  default: () => <div>Fade Panels</div>,
}));

const buildApplication = (overrides: Partial<ApplicationRow>): ApplicationRow => ({
  id: "application-1",
  user_id: "user-1",
  company: "Acme",
  date_applied: "2026-04-20T00:00:00.000Z",
  status: APPLICATION_STATUS.APPLIED,
  position: "Frontend Engineer",
  location: "Remote",
  resume_filename: "resume.pdf",
  resume_path: "resumes/resume.pdf",
  created_at: "2026-04-20T00:00:00.000Z",
  updated_at: "2026-04-20T00:00:00.000Z",
  ...overrides,
});

describe("ApplicationTrackerContent", () => {
  it("supports selecting rows individually and via the header checkbox", async () => {
    const deleteApplicationsMock = vi.fn(async () => true);
    const updateApplicationStatusMock = vi.fn(async () => {});
    mockUseApplications.mockReturnValue({
      applications: [
        buildApplication({ id: "application-1", company: "Acme" }),
        buildApplication({ id: "application-2", company: "Beta" }),
      ],
      counts: { all: 2, applied: 2, interview: 0, rejected: 0 },
      isLoading: false,
      isFetchingMore: false,
      hasMore: false,
      errorMessage: null,
      retryLoad: vi.fn(),
      loadMore: vi.fn(),
      updateApplicationStatus: updateApplicationStatusMock,
      deleteApplications: deleteApplicationsMock,
      isUpdating: vi.fn(() => false),
      isDeleting: false,
    });

    render(
      <ApplicationTrackerContent
        selectedView="Application Tracker"
        selectedStatus="all"
        onSelectStatus={vi.fn()}
        onSelectView={vi.fn()}
      />,
    );

    const headerCheckbox = screen.getByRole("checkbox", { name: "Select all applications" }) as HTMLInputElement;
    const acmeCheckbox = screen.getByRole("checkbox", { name: "Select Acme" }) as HTMLInputElement;
    const betaCheckbox = screen.getByRole("checkbox", { name: "Select Beta" }) as HTMLInputElement;
    expect(headerCheckbox.checked).toBe(false);
    expect(headerCheckbox.indeterminate).toBe(false);
    expect(acmeCheckbox.checked).toBe(false);
    expect(betaCheckbox.checked).toBe(false);
    expect(screen.queryByTestId("tracker-progress-pill")).toBeNull();
    expect(screen.queryByTestId("tracker-delete-pill")).toBeNull();

    fireEvent.click(acmeCheckbox);

    const progressPill = screen.getByTestId("tracker-progress-pill");
    const deletePill = screen.getByTestId("tracker-delete-pill");
    const offerPill = screen.getByTestId("tracker-offer-pill");

    expect(acmeCheckbox.checked).toBe(true);
    expect(betaCheckbox.checked).toBe(false);
    expect(headerCheckbox.checked).toBe(false);
    expect(headerCheckbox.indeterminate).toBe(true);
    expect(progressPill.textContent).toContain("Progress");
    expect(deletePill.textContent).toContain("Delete");
    expect(offerPill.textContent).toContain("Offer");

    fireEvent.click(offerPill);

    await waitFor(() => {
      expect(updateApplicationStatusMock).toHaveBeenCalledWith("application-1", APPLICATION_STATUS.OFFER);
    });

    fireEvent.click(progressPill);

    await waitFor(() => {
      expect(updateApplicationStatusMock).toHaveBeenCalledWith("application-1", APPLICATION_STATUS.INTERVIEW_1);
    });

    fireEvent.click(deletePill);

    expect(deleteApplicationsMock).toHaveBeenCalledWith(["application-1"]);

    await waitFor(() => {
      expect(screen.queryByTestId("tracker-delete-pill")).toBeNull();
    });

    fireEvent.click(headerCheckbox);

    const progressPillAfterSelectAll = screen.getByTestId("tracker-progress-pill");
    const deletePillAfterSelectAll = screen.getByTestId("tracker-delete-pill");

    expect(acmeCheckbox.checked).toBe(true);
    expect(betaCheckbox.checked).toBe(true);
    expect(headerCheckbox.checked).toBe(true);
    expect(headerCheckbox.indeterminate).toBe(false);
    expect(deletePillAfterSelectAll.textContent).toContain("Delete All");

    fireEvent.click(progressPillAfterSelectAll);

    await waitFor(() => {
      expect(updateApplicationStatusMock).toHaveBeenCalledWith("application-2", APPLICATION_STATUS.INTERVIEW_1);
    });

    fireEvent.click(headerCheckbox);

    expect(acmeCheckbox.checked).toBe(false);
    expect(betaCheckbox.checked).toBe(false);
    expect(headerCheckbox.checked).toBe(false);
    expect(headerCheckbox.indeterminate).toBe(false);
    expect(screen.queryByTestId("tracker-progress-pill")).toBeNull();
    expect(screen.queryByTestId("tracker-delete-pill")).toBeNull();

    fireEvent.click(headerCheckbox);

    expect(acmeCheckbox.checked).toBe(true);
    expect(betaCheckbox.checked).toBe(true);
    expect(headerCheckbox.checked).toBe(true);

    const deletePillAfterReselectAll = screen.getByTestId("tracker-delete-pill");

    fireEvent.click(deletePillAfterReselectAll);

    await waitFor(() => {
      expect(deleteApplicationsMock).toHaveBeenLastCalledWith(["application-1", "application-2"]);
    });
  });

  it("keeps newly loaded rows selected while select-all remains active", () => {
    const useApplicationsState = {
      applications: [buildApplication({ id: "application-1", company: "Acme" })],
      counts: { all: 1, applied: 1, interview: 0, rejected: 0 },
      isLoading: false,
      isFetchingMore: false,
      hasMore: true,
      errorMessage: null,
      retryLoad: vi.fn(),
      loadMore: vi.fn(),
      updateApplicationStatus: vi.fn(),
      deleteApplications: vi.fn(async () => true),
      isUpdating: vi.fn(() => false),
      isDeleting: false,
    };

    mockUseApplications.mockImplementation(() => useApplicationsState);

    const { rerender } = render(
      <ApplicationTrackerContent
        selectedView="Application Tracker"
        selectedStatus="all"
        onSelectStatus={vi.fn()}
        onSelectView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all applications" }));

    const acmeCheckbox = screen.getByRole("checkbox", { name: "Select Acme" }) as HTMLInputElement;
    expect(acmeCheckbox.checked).toBe(true);

    useApplicationsState.applications = [
      buildApplication({ id: "application-1", company: "Acme" }),
      buildApplication({ id: "application-2", company: "Beta" }),
    ];
    useApplicationsState.counts = { all: 2, applied: 2, interview: 0, rejected: 0 };

    rerender(
      <ApplicationTrackerContent
        selectedView="Application Tracker"
        selectedStatus="all"
        onSelectStatus={vi.fn()}
        onSelectView={vi.fn()}
      />,
    );

    const refreshedAcmeCheckbox = screen.getByRole("checkbox", { name: "Select Acme" }) as HTMLInputElement;
    const betaCheckbox = screen.getByRole("checkbox", { name: "Select Beta" }) as HTMLInputElement;
    const headerCheckbox = screen.getByRole("checkbox", { name: "Select all applications" }) as HTMLInputElement;

    expect(refreshedAcmeCheckbox.checked).toBe(true);
    expect(betaCheckbox.checked).toBe(true);
    expect(headerCheckbox.checked).toBe(true);
    expect(headerCheckbox.indeterminate).toBe(false);
  });
});

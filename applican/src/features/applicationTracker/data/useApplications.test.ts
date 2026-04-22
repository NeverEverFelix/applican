import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserMock,
  removeChannelMock,
  channelOnMock,
  channelSubscribeMock,
  channelMock,
  rangeMock,
  orderMock,
  eqQueryMock,
  orQueryMock,
  countResultsQueue,
  selectQueryMock,
  updateEqMock,
  updateMock,
  deleteInMock,
  deleteMock,
  fromMock,
} = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    getUserMock: vi.fn(),
    removeChannelMock: vi.fn(),
    channelOnMock: channel.on,
    channelSubscribeMock: channel.subscribe,
    channelMock: channel,
    rangeMock: vi.fn(),
    orderMock: vi.fn(),
    eqQueryMock: vi.fn(),
    orQueryMock: vi.fn(),
    countResultsQueue: [] as Array<{ count: number; error: null }>,
    selectQueryMock: vi.fn(),
    updateEqMock: vi.fn(),
    updateMock: vi.fn(),
    deleteInMock: vi.fn(),
    deleteMock: vi.fn(),
    fromMock: vi.fn(),
  };
});

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
    channel: vi.fn(() => channelMock),
    removeChannel: removeChannelMock,
  },
}));

import { APPLICATION_STATUS, type ApplicationRow } from "./model";
import { useApplications } from "./useApplications";

function createApplication(
  overrides: Partial<ApplicationRow> = {},
): ApplicationRow {
  return {
    id: "app-1",
    user_id: "user-1",
    company: "Acme",
    date_applied: null,
    status: APPLICATION_STATUS.READY_TO_APPLY,
    position: "Engineer",
    location: "Remote",
    resume_filename: "resume.pdf",
    resume_path: "resume.pdf",
    created_at: "2026-04-17T00:00:00.000Z",
    updated_at: "2026-04-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("useApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countResultsQueue.length = 0;

    channelOnMock.mockReturnValue(channelMock);
    channelSubscribeMock.mockReturnValue(channelMock);

    orderMock.mockReturnValue({ range: rangeMock });
    const filteredQuery = { order: orderMock, or: orQueryMock };
    eqQueryMock.mockReturnValue(filteredQuery);
    orQueryMock.mockReturnValue({ order: orderMock });
    selectQueryMock.mockImplementation((_columns?: string, options?: { count?: string; head?: boolean }) => {
      if (options?.head) {
        const chain = {
          eq: vi.fn(() => chain),
          or: vi.fn(() => chain),
          then: (resolve: (value: { count: number; error: null }) => void) =>
            resolve(countResultsQueue.shift() ?? { count: 0, error: null }),
        };
        return { eq: vi.fn(() => chain) };
      }
      return { eq: eqQueryMock, or: orQueryMock };
    });

    updateEqMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    updateMock.mockReturnValue({ eq: updateEqMock });
    deleteInMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    deleteMock.mockReturnValue({ in: deleteInMock });

    fromMock.mockImplementation((table: string) => {
      if (table === "applications") {
        return {
          select: selectQueryMock,
          update: updateMock,
          delete: deleteMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("loads applications, computes counts, and unsubscribes on cleanup", async () => {
    countResultsQueue.push(
      { count: 3, error: null },
      { count: 1, error: null },
      { count: 1, error: null },
      { count: 0, error: null },
    );

    rangeMock.mockResolvedValue({
      data: [
        createApplication({
          id: "app-1",
          status: APPLICATION_STATUS.APPLIED,
        }),
        createApplication({
          id: "app-2",
          status: APPLICATION_STATUS.INTERVIEW_1,
        }),
        createApplication({
          id: "app-3",
          status: APPLICATION_STATUS.READY_TO_APPLY,
        }),
      ],
      error: null,
    });

    const { result, unmount } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(3);
    expect(result.current.counts).toEqual({
      all: 3,
      applied: 1,
      interview: 1,
      rejected: 0,
    });
    expect(result.current.hasMore).toBe(false);
    expect(channelOnMock).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "applications" },
      expect.any(Function),
    );

    unmount();

    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });

  it("queries the full interview range when loading interview counts and filters", async () => {
    countResultsQueue.push(
      { count: 1, error: null },
      { count: 0, error: null },
      { count: 1, error: null },
      { count: 0, error: null },
    );

    rangeMock.mockResolvedValue({
      data: [createApplication({ id: "app-2", status: APPLICATION_STATUS.INTERVIEW_7 })],
      error: null,
    });

    renderHook(() => useApplications("interview"));

    await waitFor(() => {
      expect(rangeMock).toHaveBeenCalled();
    });

    expect(selectQueryMock).toHaveBeenCalled();
    expect(eqQueryMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(orderMock).toHaveBeenCalled();
    expect(orQueryMock).toHaveBeenCalledWith(
      "status.eq.Interview #1,status.eq.Interview #2,status.eq.Interview #3,status.eq.Interview #4,status.eq.Interview #5,status.eq.Interview #6,status.eq.Interview #7,status.eq.Interview #8",
    );
  });

  it("optimistically updates status, sets applied date, and rolls back on failure", async () => {
    countResultsQueue.push(
      { count: 1, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
    );

    let resolveUpdate!: (value: { error: { message: string } }) => void;
    const updateResultPromise = new Promise<{ error: { message: string } }>((resolve) => {
      resolveUpdate = resolve;
    });
    const updateUserEqMock = vi.fn().mockReturnValue(updateResultPromise);
    updateEqMock.mockReturnValue({ eq: updateUserEqMock });

    rangeMock.mockResolvedValue({
      data: [createApplication()],
      error: null,
    });

    const { result } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let updatePromise!: Promise<void>;
    await act(async () => {
      updatePromise = result.current.updateApplicationStatus(
        "app-1",
        APPLICATION_STATUS.APPLIED,
      );
    });

    expect(result.current.isUpdating("app-1")).toBe(true);
    expect(result.current.applications[0]?.status).toBe(APPLICATION_STATUS.APPLIED);
    expect(result.current.applications[0]?.date_applied).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );

    await act(async () => {
      resolveUpdate({ error: { message: "write failed" } });
      await updatePromise;
    });

    expect(updateMock).toHaveBeenCalledWith({
      status: APPLICATION_STATUS.APPLIED,
      date_applied: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
    });
    expect(result.current.applications[0]?.status).toBe(APPLICATION_STATUS.READY_TO_APPLY);
    expect(result.current.applications[0]?.date_applied).toBeNull();
    expect(result.current.errorMessage).toBe("Failed to update status: write failed");
    expect(result.current.isUpdating("app-1")).toBe(false);
  });

  it("optimistically deletes applications and keeps them removed on success", async () => {
    countResultsQueue.push(
      { count: 2, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { count: 0, error: null },
    );

    let resolveDelete!: (value: { error: null }) => void;
    const deleteResultPromise = new Promise<{ error: null }>((resolve) => {
      resolveDelete = resolve;
    });
    const deleteUserEqMock = vi.fn().mockReturnValue(deleteResultPromise);
    deleteInMock.mockReturnValue({ eq: deleteUserEqMock });

    rangeMock.mockResolvedValue({
      data: [createApplication(), createApplication({ id: "app-2", company: "Beta" })],
      error: null,
    });

    const { result } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let deletePromise!: Promise<boolean>;
    await act(async () => {
      deletePromise = result.current.deleteApplications(["app-1", "app-2"]);
    });

    expect(result.current.isDeleting).toBe(true);
    expect(result.current.applications).toHaveLength(0);

    await act(async () => {
      resolveDelete({ error: null });
      await deletePromise;
    });

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteInMock).toHaveBeenCalledWith("id", ["app-1", "app-2"]);
    expect(deleteUserEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.applications).toHaveLength(0);
  });
});

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
  selectQueryMock,
  updateEqMock,
  updateMock,
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
    selectQueryMock: vi.fn(),
    updateEqMock: vi.fn(),
    updateMock: vi.fn(),
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

    channelOnMock.mockReturnValue(channelMock);
    channelSubscribeMock.mockReturnValue(channelMock);

    orderMock.mockReturnValue({ range: rangeMock });
    eqQueryMock.mockReturnValue({ order: orderMock });
    selectQueryMock.mockReturnValue({ eq: eqQueryMock });

    updateEqMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    updateMock.mockReturnValue({ eq: updateEqMock });

    fromMock.mockImplementation((table: string) => {
      if (table === "applications") {
        return {
          select: selectQueryMock,
          update: updateMock,
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
      ],
      error: null,
    });

    const { result, unmount } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.applications).toHaveLength(2);
    expect(result.current.counts).toEqual({
      all: 2,
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

  it("optimistically updates status, sets applied date, and rolls back on failure", async () => {
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
});

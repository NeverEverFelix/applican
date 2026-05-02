import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { captureEvent } from "../posthog";
import { createCheckoutSession } from "../features/billing/api/createCheckoutSession";
import { createPortalSession } from "../features/billing/api/createPortalSession";
import { supabase } from "../lib/supabaseClient";

const refreshSessionResponse = {
  data: {
    session: null,
    user: null,
  },
  error: null,
} as const;

const { mockUseViewport } = vi.hoisted(() => ({
  mockUseViewport: vi.fn(),
}));

const { mockOpenUpgradeModal, mockSetIsUserMenuOpen, mockCloseUpgradeModalAndOpenMenu, mockCurrentUserPlan } = vi.hoisted(() => ({
  mockOpenUpgradeModal: vi.fn(),
  mockSetIsUserMenuOpen: vi.fn(),
  mockCloseUpgradeModalAndOpenMenu: vi.fn(),
  mockCurrentUserPlan: vi.fn(),
}));

const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => (localStorageStore.has(key) ? localStorageStore.get(key)! : null)),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
};

mockUseViewport.mockReturnValue({
  width: 1440,
  bucket: "desktop",
  isMobile: false,
  isTablet: false,
  isTabletOrBelow: false,
  isDesktop: true,
});
mockCurrentUserPlan.mockReturnValue("pro");

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue(refreshSessionResponse);
});

vi.mock("../hooks/useViewport", () => ({
  useViewport: () => mockUseViewport(),
}));

vi.mock("../features/auth/useCurrentUser", () => ({
  useCurrentUserName: () => "Test User",
  useCurrentUserPlan: () => mockCurrentUserPlan(),
}));

vi.mock("../features/auth/useMinimumLoading", () => ({
  useMinimumLoading: () => false,
}));

vi.mock("../components/UserMenu/UserMenu", () => ({
  default: ({
    onUpgrade,
    onBilling,
    onResumeStudioSelect,
    onApplicationTrackerSelect,
    onProfileSelect,
    onHistorySelect,
  }: {
    onUpgrade: (source: string) => Promise<void>;
    onBilling: (source: string) => Promise<void>;
    onResumeStudioSelect?: () => void;
    onApplicationTrackerSelect?: () => void;
    onProfileSelect?: () => void;
    onHistorySelect?: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => void onUpgrade("test_upgrade_source")}>
        Trigger upgrade
      </button>
      <button type="button" onClick={() => void onBilling("test_billing_source")}>
        Trigger billing
      </button>
      <button type="button" onClick={() => onResumeStudioSelect?.()}>
        Go Resume Studio
      </button>
      <button type="button" onClick={() => onApplicationTrackerSelect?.()}>
        Go Application Tracker
      </button>
      <button type="button" onClick={() => onProfileSelect?.()}>
        Go Profile
      </button>
      <button type="button" onClick={() => onHistorySelect?.()}>
        Go History
      </button>
    </div>
  ),
}));

vi.mock("../components/UserInfoCard", () => ({
  default: () => <div>User Info Card</div>,
}));

vi.mock("../components/Modal/Modal", () => ({
  default: () => null,
}));

vi.mock("../features/applicationTracker/ui/applicationTracker", () => ({
  default: ({ selectedView }: { selectedView: string }) => <div>Selected view: {selectedView}</div>,
}));

vi.mock("../hooks/useUpgradeGate", () => ({
  useUpgradeGate: () => ({
    isUpgradeModalOpen: false,
    isUserMenuOpen: false,
    setIsUserMenuOpen: mockSetIsUserMenuOpen,
    openUpgradeModal: mockOpenUpgradeModal,
    closeUpgradeModalAndOpenMenu: mockCloseUpgradeModalAndOpenMenu,
  }),
}));

vi.mock("../features/billing/api/createCheckoutSession", () => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock("../features/billing/api/createPortalSession", () => ({
  createPortalSession: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../posthog", () => ({
  captureEvent: vi.fn(),
}));

afterEach(() => {
  cleanup();
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  mockUseViewport.mockReset();
  mockUseViewport.mockReturnValue({
    width: 1440,
    bucket: "desktop",
    isMobile: false,
    isTablet: false,
    isTabletOrBelow: false,
    isDesktop: true,
  });
  mockOpenUpgradeModal.mockReset();
  mockSetIsUserMenuOpen.mockReset();
  mockCloseUpgradeModalAndOpenMenu.mockReset();
  mockCurrentUserPlan.mockReset();
  mockCurrentUserPlan.mockReturnValue("pro");
  vi.mocked(captureEvent).mockReset();
  vi.mocked(createCheckoutSession).mockReset();
  vi.mocked(createPortalSession).mockReset();
  vi.mocked(supabase.auth.refreshSession).mockReset();
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue(refreshSessionResponse);
});

function renderHomePage() {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("normalizes a persisted unsupported view back to Resume Studio on tablet", async () => {
    window.localStorage.setItem("applican:selected-view", JSON.stringify("Editor"));
    mockUseViewport.mockReturnValue({
      width: 1024,
      bucket: "tablet",
      isMobile: false,
      isTablet: true,
      isTabletOrBelow: true,
      isDesktop: false,
    });

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("Selected view: Resume Studio")).toBeTruthy();
    });
  });

  it("switches views via user menu callbacks", async () => {
    renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "Go Application Tracker" }));
    await waitFor(() => {
      expect(screen.getByText("Selected view: Application Tracker")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Go Profile" }));
    await waitFor(() => {
      expect(screen.getByText("Selected view: Profile")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Go History" }));
    await waitFor(() => {
      expect(screen.getByText("Selected view: History")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Go Resume Studio" }));
    await waitFor(() => {
      expect(screen.getByText("Selected view: Resume Studio")).toBeTruthy();
    });
  });

  it("does not open upgrade modal when selecting menu-supported views", async () => {
    renderHomePage();
    fireEvent.click(screen.getByRole("button", { name: "Go Application Tracker" }));
    fireEvent.click(screen.getByRole("button", { name: "Go Resume Studio" }));
    expect(mockOpenUpgradeModal).not.toHaveBeenCalled();
  });

  it("captures checkout session lifecycle events", async () => {
    vi.mocked(createCheckoutSession).mockResolvedValue("https://billing.example/checkout");
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock },
      configurable: true,
    });

    renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "Trigger upgrade" }));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    });

    expect(captureEvent).toHaveBeenNthCalledWith(1, "checkout_session_requested", {
      source: "test_upgrade_source",
    });
    expect(captureEvent).toHaveBeenNthCalledWith(2, "checkout_session_created", {
      source: "test_upgrade_source",
    });
    expect(assignMock).toHaveBeenCalledWith("https://billing.example/checkout");
  });

  it("captures billing portal lifecycle events", async () => {
    vi.mocked(createPortalSession).mockResolvedValue("https://billing.example/portal");
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock },
      configurable: true,
    });

    renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "Trigger billing" }));

    await waitFor(() => {
      expect(createPortalSession).toHaveBeenCalledTimes(1);
    });

    expect(captureEvent).toHaveBeenNthCalledWith(1, "billing_portal_session_requested", {
      source: "test_billing_source",
    });
    expect(captureEvent).toHaveBeenNthCalledWith(2, "billing_portal_session_created", {
      source: "test_billing_source",
    });
    expect(assignMock).toHaveBeenCalledWith("https://billing.example/portal");
  });

  it("captures checkout completion on successful Stripe return", async () => {
    render(
      <MemoryRouter initialEntries={["/app?checkout=success&session_id=cs_test_123"]}>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    expect(captureEvent).toHaveBeenCalledWith("checkout_completed", {
      source: "stripe_checkout_return",
      has_session_id: true,
    });
  });

  it("captures checkout cancellation on canceled Stripe return", async () => {
    render(
      <MemoryRouter initialEntries={["/app?checkout=cancel"]}>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(captureEvent).toHaveBeenCalledWith("checkout_canceled", {
        source: "stripe_checkout_return",
        has_session_id: false,
      });
    });
  });
});

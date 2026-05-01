import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";

const { mockUseViewport } = vi.hoisted(() => ({
  mockUseViewport: vi.fn(),
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

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
});

vi.mock("../hooks/useViewport", () => ({
  useViewport: () => mockUseViewport(),
}));

vi.mock("../features/auth/useCurrentUser", () => ({
  useCurrentUserName: () => "Test User",
  useCurrentUserPlan: () => "pro",
}));

vi.mock("../features/auth/useMinimumLoading", () => ({
  useMinimumLoading: () => false,
}));

vi.mock("../components/UserMenu/UserMenu", () => ({
  default: () => <div>User Menu</div>,
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
    setIsUserMenuOpen: vi.fn(),
    openUpgradeModal: vi.fn(),
    closeUpgradeModalAndOpenMenu: vi.fn(),
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

    const editorButton = screen.getByRole("button", { name: /Editor/i }) as HTMLButtonElement;
    expect(editorButton.disabled).toBe(true);
    expect(screen.getAllByText("Desktop only").length).toBeGreaterThan(0);
  });

  it("keeps desktop-only nav items disabled on tablet when clicked", async () => {
    mockUseViewport.mockReturnValue({
      width: 1024,
      bucket: "tablet",
      isMobile: false,
      isTablet: true,
      isTabletOrBelow: true,
      isDesktop: false,
    });

    renderHomePage();

    const editorButton = screen.getByRole("button", { name: /Editor/i }) as HTMLButtonElement;
    expect(editorButton.disabled).toBe(true);

    fireEvent.click(editorButton);

    await waitFor(() => {
      expect(screen.getByText("Selected view: Resume Studio")).toBeTruthy();
    });
  });

  it("allows desktop users to activate Editor from the nav", async () => {
    renderHomePage();

    const editorButton = screen.getByRole("button", { name: /Editor/i }) as HTMLButtonElement;
    expect(editorButton.disabled).toBe(false);

    fireEvent.click(editorButton);

    await waitFor(() => {
      expect(screen.getByText("Selected view: Editor")).toBeTruthy();
    });
  });

  it("keeps coming-soon views disabled even on desktop", async () => {
    renderHomePage();

    const careerPathButton = screen.getByRole("button", { name: /Career Path/i }) as HTMLButtonElement;
    const resourcesButton = screen.getByRole("button", { name: /Resources/i }) as HTMLButtonElement;

    expect(careerPathButton.disabled).toBe(true);
    expect(resourcesButton.disabled).toBe(true);
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);

    fireEvent.click(careerPathButton);
    fireEvent.click(resourcesButton);

    await waitFor(() => {
      expect(screen.getByText("Selected view: Resume Studio")).toBeTruthy();
    });
  });
});

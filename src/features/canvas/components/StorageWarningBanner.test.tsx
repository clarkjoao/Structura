import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mutable shared state for the mock. vi.hoisted ensures the object exists
// before vi.mock factories run, and assignments in beforeEach are visible
// because the hook reads the property at call time, not at module init.
const mockState = vi.hoisted(() => ({
  folderStatus: "disconnected" as
    "disconnected" | "connecting" | "connected" | "needs_permission" | "error",
  lastWrite: "unknown" as "unknown" | "ok" | "failed",
}));

// We mock the barrel that the banner actually imports from. Vitest resolves
// this path eagerly and replaces its exports; named bindings then read the
// mocked values, which is what the banner expects.
vi.mock("@/infrastructure/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/persistence")>();
  return {
    ...actual,
    useFolderSyncStatus: () => ({
      status: mockState.folderStatus,
      folderName: "workspace",
      lastWrite: mockState.lastWrite,
    }),
    isFileSystemSupported: true,
  };
});

vi.mock("@/infrastructure/persistence/requestConnectFolder", () => ({
  requestConnectFolder: () => {},
}));

import { StorageWarningBanner } from "./StorageWarningBanner";
import { shouldSuggestFolderSync, useSaveStatusStore } from "@/features/diagram";

function setHealth(
  level: "ok" | "warning" | "danger" | "critical",
  storageQuotaBytes: number | null = null,
): void {
  useSaveStatusStore.setState({
    storageHealthLevel: level,
    storageQuotaBytes,
    storageUsedBytes: 3_500_000,
    lastStorageCheckAt: Date.now(),
  });
}

describe("shouldSuggestFolderSync helper", () => {
  it("returns true only when warning/danger + disconnected", () => {
    expect(shouldSuggestFolderSync("warning", "disconnected")).toBe(true);
    expect(shouldSuggestFolderSync("danger", "disconnected")).toBe(true);
    expect(shouldSuggestFolderSync("critical", "disconnected")).toBe(false);
    expect(shouldSuggestFolderSync("warning", "connected")).toBe(false);
    expect(shouldSuggestFolderSync("warning", "connecting")).toBe(false);
    expect(shouldSuggestFolderSync("ok", "disconnected")).toBe(false);
  });
});

describe("StorageWarningBanner", () => {
  beforeEach(() => {
    mockState.folderStatus = "disconnected";
    mockState.lastWrite = "unknown";
    setHealth("ok");
  });

  it("renders nothing when storage is healthy", () => {
    setHealth("ok");
    const { container } = render(<StorageWarningBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("promotes folder sync as primary CTA when warning + disconnected", () => {
    setHealth("warning");
    mockState.folderStatus = "disconnected";

    render(<StorageWarningBanner />);

    // Suggestion copy wins over generic warning copy.
    expect(screen.getByText("Sync to a folder")).toBeInTheDocument();

    // Clear-storage is suppressed when promoting folder sync.
    expect(screen.queryByRole("button", { name: /free up space/i })).not.toBeInTheDocument();

    // Connect-folder CTA is present.
    expect(screen.getByRole("button", { name: /connect folder/i })).toBeInTheDocument();
  });

  it("hides dismiss in danger + disconnected (mirrors critical)", () => {
    setHealth("danger");
    mockState.folderStatus = "disconnected";

    render(<StorageWarningBanner />);

    expect(screen.getByText("Sync to a folder now")).toBeInTheDocument();

    // The dismiss X is suppressed: only the connect-folder CTA should render.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(/connect folder/i);
  });

  it("never asks to connect a folder that is already connected", () => {
    mockState.folderStatus = "connected";
    for (const level of ["warning", "danger"] as const) {
      setHealth(level);
      const { container, unmount } = render(<StorageWarningBanner />);
      // The folder holds the work: a near-full browser backup is not worth a banner.
      expect(container.firstChild).toBeNull();
      unmount();
    }

    setHealth("critical");
    render(<StorageWarningBanner />);
    expect(screen.getByText("The browser is out of space")).toBeInTheDocument();
    expect(screen.getByText(/still being saved to the workspace folder/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect folder/i })).toBeNull();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("keeps a full browser serious when the folder's last write failed too", () => {
    mockState.folderStatus = "connected";
    mockState.lastWrite = "failed";
    setHealth("critical");
    render(<StorageWarningBanner />);
    expect(screen.getByText(/last write to the workspace folder failed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /connect folder/i })).toBeNull();
  });

  it("offers to restore access, not to connect, when the folder lost its permission", () => {
    mockState.folderStatus = "needs_permission";
    setHealth("critical");
    render(<StorageWarningBanner />);
    expect(screen.getByRole("button", { name: /restore access/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect folder/i })).toBeNull();
  });

  it("states the localStorage ceiling, or the origin quota when the workspace is in IndexedDB", () => {
    mockState.folderStatus = "connecting";
    setHealth("warning");
    const { unmount } = render(<StorageWarningBanner />);
    expect(screen.getByText(/Using 3\.3 MB of ~5 MB available/)).toBeInTheDocument();
    unmount();

    setHealth("warning", 4 * 1024 * 1024);
    render(<StorageWarningBanner />);
    expect(screen.getByText(/Using 3\.3 MB of 4\.0 MB available/)).toBeInTheDocument();
  });
});

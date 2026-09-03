import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mutable shared state for the mock. vi.hoisted ensures the object exists
// before vi.mock factories run, and assignments in beforeEach are visible
// because the hook reads the property at call time, not at module init.
const mockState = vi.hoisted(() => ({
  folderStatus: "disconnected" as
    "disconnected" | "connecting" | "connected" | "needs_permission" | "error",
}));

// We mock the barrel that the banner actually imports from. Vitest resolves
// this path eagerly and replaces its exports; named bindings then read the
// mocked values, which is what the banner expects.
vi.mock("@/infrastructure/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/persistence")>();
  return {
    ...actual,
    useFileSystemStorage: () => ({ status: mockState.folderStatus }) as never,
    isFileSystemSupported: true,
  };
});

vi.mock("@/infrastructure/persistence/requestConnectFolder", () => ({
  requestConnectFolder: () => {},
}));

import { StorageWarningBanner } from "./StorageWarningBanner";
import { shouldSuggestFolderSync, useSaveStatusStore } from "@/features/diagram";

function setHealth(level: "ok" | "warning" | "danger" | "critical"): void {
  useSaveStatusStore.setState({
    storageHealthLevel: level,
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

  it("keeps both buttons when folder is connected (no suggestion)", () => {
    setHealth("warning");
    mockState.folderStatus = "connected";

    render(<StorageWarningBanner />);

    // Falls back to the pre-existing generic copy.
    expect(screen.getByText("Local storage almost full")).toBeInTheDocument();

    // No suggestion copy is shown.
    expect(screen.queryByText("Sync to a folder")).not.toBeInTheDocument();

    // Both remediation buttons remain accessible.
    expect(screen.getByRole("button", { name: /free up space/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect folder/i })).toBeInTheDocument();
  });
});

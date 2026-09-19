import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectedFolderCard } from "./ConnectedFolderCard";

vi.mock("@/infrastructure/persistence/FileSystemAdapter", () => ({
  fileSystemAdapter: {
    get isConnected() {
      return mockConnected;
    },
    get folderName() {
      return mockFolderName;
    },
  },
}));

vi.mock("@/infrastructure/persistence", () => ({
  isFileSystemSupported: true,
}));

vi.mock("@/hooks/useLastFolderSync", () => ({
  useLastFolderSync: () => mockLastSync,
}));

let mockConnected = false;
let mockFolderName: string | null = null;
let mockLastSync: number | null = null;

describe("ConnectedFolderCard", () => {
  beforeEach(() => {
    mockConnected = false;
    mockFolderName = null;
    mockLastSync = null;
  });

  it("renders nothing when no folder is connected", () => {
    const { container } = render(<ConnectedFolderCard />);
    expect(container.querySelector('[data-testid="connected-folder-card"]')).toBeNull();
  });

  it("shows folder name and sync caption when connected", () => {
    mockConnected = true;
    mockFolderName = "my-workspace";
    mockLastSync = Date.now() - 60_000;
    render(<ConnectedFolderCard />);
    expect(screen.getByTestId("connected-folder-card")).toBeTruthy();
    expect(screen.getByText("my-workspace")).toBeTruthy();
  });
});

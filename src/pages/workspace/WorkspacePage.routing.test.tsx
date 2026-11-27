import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import WorkspacePage from "./index";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// The canvas shell is not under test; a stand-in that shows which diagram is active.
vi.mock("./WorkspaceContent", () => ({
  WorkspaceContent: () => (
    <div data-testid="content">
      {useDiagramStore.getState().diagrams[useDiagramStore.getState().activeDiagramId ?? ""]?.name}
    </div>
  ),
}));

function diagram(id: string, name: string): Diagram {
  return {
    id,
    name,
    level: "container",
    folderId: null,
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
  } as unknown as Diagram;
}

function Jump({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go {to}
    </button>
  );
}

function mount(path: string, active: string | null) {
  useDiagramStore.setState({
    diagrams: { d1: diagram("d1", "First"), d2: diagram("d2", "Second") },
    activeDiagramId: active,
  } as never);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Jump to="/model/d2" />
      <Jump to="/model/ghost" />
      <Routes>
        <Route path="/model/:id" element={<WorkspacePage />} />
        <Route path="/workspace" element={<div data-testid="dashboard">dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspacePage routing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ac72766c: an unknown /model/:id kept showing whichever diagram was active before.
  it("leaves an unknown diagram id instead of showing the previous diagram", () => {
    mount("/model/ghost", "d1");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).toBeNull();
  });

  it("shows the empty state for an unknown id when nothing is active", () => {
    mount("/model/ghost", null);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText("No diagram selected.")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).toBeNull();
  });

  // ac72766c: following a link to another id must open that diagram, not stay on the old one.
  it("opens the diagram of the URL when the id changes", () => {
    mount("/model/d1", "d1");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId("content")).toHaveTextContent("First");

    fireEvent.click(screen.getByRole("button", { name: "go /model/d2" }));
    expect(useDiagramStore.getState().activeDiagramId).toBe("d2");
    expect(screen.getByTestId("content")).toHaveTextContent("Second");
    expect(screen.getByTestId("content")).not.toHaveTextContent("First");
  });

  it("redirects when navigating from a real diagram to an unknown id", () => {
    mount("/model/d1", "d1");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.click(screen.getByRole("button", { name: "go /model/ghost" }));
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).toBeNull();
  });
});

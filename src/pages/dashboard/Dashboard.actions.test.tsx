import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardPage from "./index";

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

function diagram(id: string, name: string): Diagram {
  return {
    id,
    name,
    level: "container",
    folderId: null,
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { c1: { id: "c1", type: "container", name: "api", parentId: null } },
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
  } as unknown as Diagram;
}

function diagramsInStore(): Diagram[] {
  return Object.values(useDiagramStore.getState().diagrams);
}

function mount() {
  useDiagramStore.setState({
    diagrams: { d1: diagram("d1", "Checkout") },
    folders: {
      f1: { id: "f1", name: "Payments", parentId: null, createdAt: 0 },
    },
    activeDiagramId: null,
  } as never);
  return render(
    <MemoryRouter initialEntries={["/workspace"]}>
      <TooltipProvider>
        <DashboardPage />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

// f6943cfa: rename / duplicate / move / delete on a dashboard card were lost once.
describe("Dashboard diagram card actions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("duplicates the diagram under a copy name", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    const names = diagramsInStore().map((d) => d.name);
    expect(names).toHaveLength(2);
    expect(names).toContain("Checkout (copy)");
  });

  it("renames the diagram from the rename modal", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getAllByRole("textbox")[0]!;
    fireEvent.change(input, { target: { value: "Payment flow" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));
    expect(useDiagramStore.getState().diagrams.d1?.name).toBe("Payment flow");
  });

  it("moves the diagram into the chosen folder", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Payments" }));
    expect(useDiagramStore.getState().diagrams.d1?.folderId).toBe("f1");
  });

  it("deletes only after the confirmation dialog is accepted", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog");
    expect(useDiagramStore.getState().diagrams.d1).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(useDiagramStore.getState().diagrams.d1).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const again = screen.getByRole("alertdialog");
    fireEvent.click(within(again).getByRole("button", { name: "Delete" }));
    expect(useDiagramStore.getState().diagrams.d1).toBeUndefined();
  });
});

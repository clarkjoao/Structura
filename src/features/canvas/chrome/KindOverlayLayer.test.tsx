import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { KindOverlayLayer, KindOverlayView } from "./KindOverlayLayer";
import { applyKindTextBuild, buildKindText } from "./kindTextCapture";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ViewportPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
  // Screen and flow coordinates are the same in these tests.
  useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
}));

registerBuiltInDiagramKinds();

describe("KindOverlayLayer", () => {
  it("draws the phases, selects a phase's start, and hides in freehand mode", () => {
    const { diagram } = createKindDiagram({
      name: `O ${Math.random()}`,
      level: "context",
      kindId: "guided",
    });
    useDiagramStore.getState().openDiagram(diagram.id);
    const built = buildKindText("## Discover\nUsuário: A\n## Buy\nB");
    if (!built || !("edit" in built)) throw new Error("no build");
    applyKindTextBuild(built);
    const onSelect = vi.fn();
    const view = render(<KindOverlayLayer onSelectElement={onSelect} />);
    const segments = screen.getAllByTestId("kind-overlay-segment");
    expect(segments.map((s) => s.textContent)).toEqual(["Discover", "Buy"]);
    fireEvent.click(segments[1]!);
    const b = Object.values(
      useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components,
    ).find((c) => c.name === "B")!;
    expect(onSelect).toHaveBeenCalledWith(b.id);
    useDiagramStore.getState().setKindMode(diagram.id, "freehand");
    view.rerender(<KindOverlayLayer onSelectElement={onSelect} />);
    expect(screen.queryByTestId("kind-overlay")).toBeNull();
  });

  it("draws the line of visibility with its two labels", () => {
    const view = render(
      <KindOverlayView
        overlay={{
          axis: "x",
          at: 0,
          depth: 0,
          segments: [],
          separators: [],
          lines: [
            {
              id: "visibility",
              across: 200,
              from: 0,
              to: 800,
              labels: {
                before: { text: "Visible to the customer" },
                after: { text: "Backstage" },
              },
            },
          ],
        }}
      />,
    );
    const line = view.getByTestId("kind-overlay-line");
    expect(line).toHaveStyle({ top: "200px", width: "800px" });
    expect(line).toHaveTextContent("Visible to the customer");
    expect(line).toHaveTextContent("Backstage");
    expect(view.queryAllByRole("button")).toHaveLength(0);
  });

  it("renames a phase in place and drags a separator to move a start, when editable", () => {
    const { diagram } = createKindDiagram({
      name: `E ${Math.random()}`,
      level: "context",
      kindId: "guided",
    });
    useDiagramStore.getState().openDiagram(diagram.id);
    const built = buildKindText("## Discover\nUsuário: A\nB\n## Buy\nC");
    if (!built || !("edit" in built)) throw new Error("no build");
    applyKindTextBuild(built);
    const names = () =>
      Object.values(useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components)
        .map((c) => (c.kindProps?.phase as string | undefined) ?? null)
        .filter(Boolean);
    const view = render(<KindOverlayLayer onSelectElement={vi.fn()} editable />);
    fireEvent.doubleClick(screen.getAllByTestId("kind-overlay-segment")[1]!);
    const input = screen.getByTestId("kind-overlay-segment-input");
    fireEvent.change(input, { target: { value: "Pay" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(names()).toEqual(expect.arrayContaining(["Discover", "Pay"]));
    view.rerender(<KindOverlayLayer onSelectElement={vi.fn()} editable />);
    // Drag the separator before Pay back to B's column.
    const handles = screen.getAllByTestId("kind-overlay-separator-handle");
    const handle = handles[handles.length - 1]!;
    const b = Object.values(
      useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components,
    ).find((c) => c.name === "B")!;
    const layouts = useDiagramStore.getState().diagrams[diagram.id]!.nodeLayouts;
    const lane = layouts[b.parentId!]!;
    const x = lane.x + layouts[b.id]!.x;
    fireEvent.pointerDown(handle, { clientX: x, clientY: 0, pointerId: 1 });
    expect(screen.getByTestId("kind-overlay-separator-preview")).toBeInTheDocument();
    fireEvent.pointerUp(handle, { clientX: x, clientY: 0, pointerId: 1 });
    const bNow = useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components[b.id]!;
    expect(bNow.kindProps?.phase).toBe("Pay");
  });

  it("offers no editing when not editable", () => {
    const { diagram } = createKindDiagram({
      name: `R ${Math.random()}`,
      level: "context",
      kindId: "guided",
    });
    useDiagramStore.getState().openDiagram(diagram.id);
    const built = buildKindText("## Discover\nUsuário: A\n## Buy\nB");
    if (!built || !("edit" in built)) throw new Error("no build");
    applyKindTextBuild(built);
    render(<KindOverlayLayer onSelectElement={vi.fn()} />);
    fireEvent.doubleClick(screen.getAllByTestId("kind-overlay-segment")[0]!);
    expect(screen.queryByTestId("kind-overlay-segment-input")).toBeNull();
    expect(screen.queryByTestId("kind-overlay-separator-handle")).toBeNull();
  });
});

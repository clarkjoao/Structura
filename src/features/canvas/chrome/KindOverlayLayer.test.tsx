import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { KindOverlayLayer } from "./KindOverlayLayer";
import { applyKindTextBuild, buildKindText } from "./kindTextCapture";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ViewportPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

registerBuiltInDiagramKinds();

describe("KindOverlayLayer", () => {
  it("draws the phases and the curve, selects a phase's start, and hides in freehand mode", () => {
    const { diagram } = createKindDiagram({
      name: `O ${Math.random()}`,
      level: "context",
      kindId: "guided",
    });
    useDiagramStore.getState().openDiagram(diagram.id);
    const built = buildKindText("## Discover\nUsuário: A [5]\n## Buy\nB [1]");
    if (!built || !("edit" in built)) throw new Error("no build");
    applyKindTextBuild(built);
    const onSelect = vi.fn();
    const view = render(<KindOverlayLayer onSelectElement={onSelect} />);
    const segments = screen.getAllByTestId("kind-overlay-segment");
    expect(segments.map((s) => s.textContent)).toEqual(["Discover", "Buy"]);
    expect(screen.getByTestId("kind-overlay-curve").querySelectorAll("circle")).toHaveLength(2);
    fireEvent.click(segments[1]!);
    const b = Object.values(
      useDiagramStore.getState().diagrams[diagram.id]!.snapshot.components,
    ).find((c) => c.name === "B")!;
    expect(onSelect).toHaveBeenCalledWith(b.id);
    useDiagramStore.getState().setKindMode(diagram.id, "freehand");
    view.rerender(<KindOverlayLayer onSelectElement={onSelect} />);
    expect(screen.queryByTestId("kind-overlay")).toBeNull();
  });
});

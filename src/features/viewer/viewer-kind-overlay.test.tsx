import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { applyKindTextBuild, buildKindText } from "@/features/canvas/chrome/kindTextCapture";
import { ViewerCanvas } from "./components/ViewerCanvas";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ViewportPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

registerBuiltInDiagramKinds();

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
});

/** A guided journey with two phases, as the viewer receives it. */
function phasedJourney() {
  const { diagram } = createKindDiagram({
    name: `V ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const built = buildKindText("## Discover\nUsuário: A [5]\n## Buy\nB [1]");
  if (!built || !("edit" in built)) throw new Error("no build");
  applyKindTextBuild(built);
  return useDiagramStore.getState().diagrams[diagram.id]!;
}

const open = (diagram: ReturnType<typeof phasedJourney>) =>
  render(
    <MemoryRouter>
      <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} />
    </MemoryRouter>,
  );

describe("the viewer's kind overlay", () => {
  it("draws a guided journey's phases, read-only", () => {
    open(phasedJourney());
    const segments = screen.getAllByTestId("kind-overlay-segment");
    expect(segments.map((s) => s.textContent)).toEqual(["Discover", "Buy"]);
    expect(screen.queryAllByRole("button", { name: "Discover" })).toHaveLength(0);
    fireEvent.click(segments[0]!);
    expect(screen.getByTestId("kind-overlay")).toBeInTheDocument();
  });

  it("draws nothing for the same journey in freehand mode", () => {
    const diagram = phasedJourney();
    useDiagramStore.getState().setKindMode(diagram.id, "freehand");
    open(useDiagramStore.getState().diagrams[diagram.id]!);
    expect(screen.queryByTestId("kind-overlay")).toBeNull();
  });
});

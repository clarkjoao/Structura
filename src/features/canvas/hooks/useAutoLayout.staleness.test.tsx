import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram";

/**
 * ELK runs in a worker, so the page stays live while a whole-diagram plan is
 * made. A plan is only applied to the diagram, scene and structure it was made
 * from: switch diagrams or change the structure meanwhile and it is dropped,
 * with a word, instead of laying one diagram out with another's plan.
 *
 * The planner is spied on, so each test decides when the plan arrives.
 */

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import * as autoLayoutModule from "../layout/autoLayoutDiagram";
import { useAutoLayout } from "./useAutoLayout";

function wrapper({ children }: { children: ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

function seed() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("arrange-staleness", "container");
  store.openDiagram(diagram.id);
  const a = useDiagramStore.getState().addComponent("system", "A", null);
  const b = useDiagramStore.getState().addComponent("system", "B", null);
  useDiagramStore.getState().addConnection(a.id, b.id, "uses");
  return { diagramId: diagram.id, aId: a.id };
}

const measured: Node[] = [
  { id: "m", position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 50 } },
];

/** Starts an arrangement whose plan arrives only when `deliver` is called. */
async function startArrange() {
  const real = autoLayoutModule.planDiagramAutoLayout;
  let deliver: () => Promise<void> = async () => {};
  vi.spyOn(autoLayoutModule, "planDiagramAutoLayout").mockImplementation(
    (input) =>
      new Promise((resolve) => {
        deliver = async () => resolve(await real(input));
      }),
  );
  const apply = vi.spyOn(autoLayoutModule, "applyDiagramAutoLayout");
  const { result } = renderHook(() => useAutoLayout(), { wrapper });
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  let running: Promise<void> = Promise.resolve();
  act(() => {
    running = result.current.runAutoLayout(
      diagram.snapshot.components,
      Object.values(diagram.snapshot.connections),
      diagram.nodeLayouts,
      measured,
    );
  });
  const finish = async () => {
    await act(async () => {
      await deliver();
      await running;
    });
  };
  return { apply, finish };
}

describe("an arrangement whose diagram changed while it was planned", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(toast.info).mockClear();
  });

  it("is applied when nothing changed", async () => {
    seed();
    const { apply, finish } = await startArrange();
    await finish();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("is dropped when another diagram was opened meanwhile", async () => {
    seed();
    const { apply, finish } = await startArrange();
    const other = useDiagramStore.getState().addDiagram("other", "container");
    useDiagramStore.getState().openDiagram(other.id);
    await finish();
    expect(apply).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("changed"));
  });

  it("is dropped when the structure changed meanwhile", async () => {
    const { aId } = seed();
    const { apply, finish } = await startArrange();
    useDiagramStore.getState().removeComponent(aId);
    await finish();
    expect(apply).not.toHaveBeenCalled();
  });

  it("is applied when only a position changed meanwhile", async () => {
    const { aId } = seed();
    const { apply, finish } = await startArrange();
    useDiagramStore.getState().updateNodeLayout(aId, { x: 999, y: 999 });
    await finish();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});

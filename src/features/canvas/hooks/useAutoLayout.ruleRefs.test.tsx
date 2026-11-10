import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram";
import { useAutoLayout } from "./useAutoLayout";

/**
 * Arranging under the reading rules says what they did: the references made,
 * and how the connections that point back were handled.
 */

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

const measured: Node[] = [
  { id: "m", position: { x: 0, y: 0 }, data: {}, measured: { width: 100, height: 50 } },
];

async function arrange() {
  const { result } = renderHook(() => useAutoLayout(), { wrapper });
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  await act(async () => {
    await result.current.runAutoLayout(
      diagram.snapshot.components,
      Object.values(diagram.snapshot.connections),
      diagram.nodeLayouts,
      measured,
    );
  });
}

describe("the arrangement's message under the reading rules", () => {
  afterEach(() => {
    vi.mocked(toast.success).mockClear();
  });

  it("names the references and summarises the connections that point back", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Loop toast", "container");
    store.openDiagram(diagram.id);
    const ids = ["A", "B", "C", "D", "E"].map(
      (name) => useDiagramStore.getState().addComponent("system", name, null).id,
    );
    for (let i = 0; i < ids.length - 1; i += 1) {
      useDiagramStore.getState().addConnection(ids[i]!, ids[i + 1]!, "calls");
    }
    useDiagramStore.getState().addConnection(ids[4]!, ids[0]!, "retries");

    await arrange();

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("1 reference replaces a long line"),
      {
        description: expect.stringMatching(
          /^1 connection points back: 0 stays .*, 1 moved onto a reference, 0 stays/,
        ),
      },
    );
  });

  it("says how many long forward lines moved onto references", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("Forward toast", "container");
    store.openDiagram(diagram.id);
    const ids = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map(
      (name) => useDiagramStore.getState().addComponent("system", name, null).id,
    );
    for (let i = 0; i < ids.length - 1; i += 1) {
      useDiagramStore.getState().addConnection(ids[i]!, ids[i + 1]!, "");
    }
    // Eight columns ahead, past the forward limit.
    useDiagramStore.getState().addConnection(ids[0]!, ids[8]!, "");

    await arrange();

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("1 reference replaces a long line"),
      { description: "1 long forward line moved onto a reference." },
    );
  });

  it("says nothing more when no connection points back", async () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram("No loop toast", "container");
    store.openDiagram(diagram.id);
    const a = useDiagramStore.getState().addComponent("system", "A", null);
    const b = useDiagramStore.getState().addComponent("system", "B", null);
    useDiagramStore.getState().addConnection(a.id, b.id, "calls");

    await arrange();

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("applied"), undefined);
  });
});

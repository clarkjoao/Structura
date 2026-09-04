/**
 * A local edit must survive a remote patch that lands in the same frame.
 *
 * The sync loop keeps a baseline of what peers already know and broadcasts the
 * difference once per frame. Applying a remote patch used to reset that
 * baseline to the *whole* current store, which quietly absorbed any local edit
 * still waiting for its frame: the mover kept the new position, everyone else
 * kept the old one, and nothing ever reconciled the two.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import { useCollabStoreSync } from "../hooks/useCollabStoreSync";
import type { CollabPatch } from "../hooks/useCollab";

const DIAGRAM_ID = "d1";

function seedDiagram() {
  useDiagramStore.setState({
    diagrams: {
      [DIAGRAM_ID]: {
        id: DIAGRAM_ID,
        name: "D",
        domain: "",
        level: "context",
        description: "",
        snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
        nodeLayouts: {
          a: { elementId: "a", x: 0, y: 0, width: 10, height: 10 },
          b: { elementId: "b", x: 0, y: 0, width: 10, height: 10 },
        },
        edgeLayouts: {},
        scenes: {},
        activeSceneId: null,
        compareSceneId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    activeDiagramId: DIAGRAM_ID,
  } as never);
}

/** Hand control of the frame callback to the test. */
function stubAnimationFrames() {
  const pending: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pending.push(cb);
    return pending.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    pending[handle - 1] = () => {};
  });
  return () => {
    const queued = pending.splice(0, pending.length);
    for (const cb of queued) cb(performance.now());
  };
}

function moveNodeLocally(id: string, x: number, y: number) {
  useDiagramStore.setState((state) => {
    const diagram = state.diagrams[DIAGRAM_ID]!;
    return {
      diagrams: {
        ...state.diagrams,
        [DIAGRAM_ID]: {
          ...diagram,
          nodeLayouts: {
            ...diagram.nodeLayouts,
            [id]: { ...diagram.nodeLayouts[id]!, x, y },
          },
        },
      },
    } as never;
  });
}

describe("useCollabStoreSync — local edits vs. incoming patches", () => {
  let runFrames: () => void;

  beforeEach(() => {
    seedDiagram();
    runFrames = stubAnimationFrames();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still broadcasts a local move when a remote patch arrives before the frame", () => {
    const sent: CollabPatch[] = [];
    const sendPatchRef = { current: (patch: CollabPatch) => sent.push(patch) };

    const { result } = renderHook(() =>
      useCollabStoreSync({ diagramId: DIAGRAM_ID, sendPatchRef }),
    );

    // The user drags node "a"; the frame that would broadcast it has not run.
    moveNodeLocally("a", 100, 100);

    // A peer moves node "b" and that patch is applied first.
    result.current.onPatch({
      nodeLayouts: { b: { elementId: "b", x: 55, y: 55, width: 10, height: 10 } },
    });

    runFrames();

    const movedA = sent.flatMap((patch) =>
      patch.nodeLayouts ? Object.keys(patch.nodeLayouts as Record<string, unknown>) : [],
    );
    expect(movedA).toContain("a");
    expect(useDiagramStore.getState().diagrams[DIAGRAM_ID]!.nodeLayouts.a).toMatchObject({
      x: 100,
      y: 100,
    });
  });

  it("does not echo an applied remote patch back to the room", () => {
    const sent: CollabPatch[] = [];
    const sendPatchRef = { current: (patch: CollabPatch) => sent.push(patch) };

    const { result } = renderHook(() =>
      useCollabStoreSync({ diagramId: DIAGRAM_ID, sendPatchRef }),
    );

    result.current.onPatch({
      nodeLayouts: { b: { elementId: "b", x: 55, y: 55, width: 10, height: 10 } },
    });

    runFrames();

    expect(sent).toEqual([]);
  });
});

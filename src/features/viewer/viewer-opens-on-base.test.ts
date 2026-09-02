import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Component, Diagram, Flow, SceneDiff } from "@/features/diagram";
import { generateShareUrl, decodeShareParam } from "@/lib/diagram-url";
import { useDiagramToFlow } from "./hooks/useDiagramToFlow";

/**
 * A link opens on the base.
 *
 * `activeSceneId` is which scene the author had open when they copied the
 * link. Carried through, it dropped the reader inside that scene — without the
 * nodes it hides, without saying so, and with no way out. Two guards: the link
 * stops carrying it, and the viewer stops reading it, because links shared
 * before the first guard are still out there.
 */

const component = (id: string, name: string) =>
  ({ id, name, type: "system", parentId: null }) as unknown as Component;

const flow = (id: string, name: string): Flow => ({
  id,
  name,
  mermaid: "",
  diagramId: "d1",
  entryStepId: "s1",
  steps: {
    s1: { id: "s1", type: "action", title: "The ask", note: "Only the happy path." },
  },
});

const scene = (id: string, name: string, removedComponentIds: string[]) =>
  ({
    id,
    name,
    color: "#000",
    createdAt: 0,
    addedComponents: {},
    addedConnections: {},
    removedComponentIds,
    removedConnectionIds: [],
    nodeLayouts: {},
  }) as unknown as SceneDiff;

function diagramInScene(): Diagram {
  return {
    id: "d1",
    name: "Checkout",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: { c1: component("c1", "Gateway"), c2: component("c2", "Ledger") },
      connections: {},
      flows: { f1: flow("f1", "Checkout"), f2: flow("f2", "Refund") },
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: { sc1: scene("sc1", "Sem ledger", ["c2"]) },
    activeSceneId: "sc1",
  } as unknown as Diagram;
}

function nodeNames(diagram: Diagram): string[] {
  const { result } = renderHook(() => useDiagramToFlow(diagram));
  return result.current.nodes.map((node) => String(node.data.name)).sort();
}

describe("the scripts reach the viewer in the payload", () => {
  it("carries every flow through a share link", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    expect(
      Object.values(shared!.snapshot.flows)
        .map((f) => f.name)
        .sort(),
    ).toEqual(["Checkout", "Refund"]);
  });

  it("carries the title and the note a reader is meant to read", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    const step = shared!.snapshot.flows.f1!.steps.s1!;
    expect([step.title, step.note]).toEqual(["The ask", "Only the happy path."]);
  });

  it("carries the scenes themselves, which are part of the diagram", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    expect(Object.values(shared!.scenes ?? {}).map((s) => s.name)).toEqual(["Sem ledger"]);
  });
});

describe("a link opens on the base, not in the author's scene", () => {
  it("stops carrying which scene the author had open", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    expect(shared!.activeSceneId).toBeUndefined();
  });

  it("shows the node the scene was hiding", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    expect(nodeNames(shared!)).toEqual(["Gateway", "Ledger"]);
  });

  it("ignores the field even on a link shared before the rule", () => {
    // What an older link decodes to: the field survived the round trip.
    const legacy = diagramInScene();
    expect(legacy.activeSceneId).toBe("sc1");

    expect(nodeNames(legacy)).toEqual(["Gateway", "Ledger"]);
  });

  it("shows the same nodes whichever scene was open", () => {
    const other = diagramInScene();
    other.scenes!.sc2 = scene("sc2", "Sem gateway", ["c1"]);
    other.activeSceneId = "sc2";

    expect(nodeNames(other)).toEqual(nodeNames(diagramInScene()));
  });

  it("still shows a diagram that has no scenes at all", () => {
    const plain = diagramInScene();
    delete plain.scenes;
    plain.activeSceneId = null;

    expect(nodeNames(plain)).toEqual(["Gateway", "Ledger"]);
  });

  it("keeps everything else the link carried", () => {
    const shared = decodeShareParam(generateShareUrl(diagramInScene()).url.split("#share=")[1]!);

    expect(shared!.name).toBe("Checkout");
    expect(Object.keys(shared!.snapshot.components).sort()).toEqual(["c1", "c2"]);
  });
});

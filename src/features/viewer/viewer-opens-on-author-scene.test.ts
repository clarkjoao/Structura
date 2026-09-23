import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Component, Diagram, Flow, VersionDiff } from "@/features/diagram";
import { generateShareUrl, decodeShareParam } from "@/lib/share-url";
import { useReadDiagramFlow } from "@/features/canvas/core";

/**
 * The payload as a reader receives it: through `URLSearchParams`, which undoes
 * the percent-encoding `generateShareUrl` applies over the compressed payload.
 * A raw string split would leave it encoded — see `lib/share-url/share-url.test.ts`.
 */
const shareParamOf = (url: string) => new URLSearchParams(url.split("#")[1]).get("share")!;

/**
 * A link opens on the scene its author had open.
 *
 * The editor draws the scene the author is in; a link used to draw the base
 * underneath, whatever the author was looking at — one of the ways "the same
 * diagram" read differently depending on where it was opened. The decision
 * (2026-09-22) is that a link draws what the author saw: it carries
 * `activeVersionId`, and the viewer resolves it as the editor does.
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
  }) as unknown as VersionDiff;

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
    nodeLayouts: {
      c1: { elementId: "c1", x: 0, y: 0 },
      c2: { elementId: "c2", x: 300, y: 0 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    versions: { sc1: scene("sc1", "Sem ledger", ["c2"]) },
    activeVersionId: "sc1",
  } as unknown as Diagram;
}

function nodeNames(diagram: Diagram): string[] {
  const { result } = renderHook(() => useReadDiagramFlow(diagram));
  return result.current.nodes.map((node) => String(node.data.name)).sort();
}

describe("the scripts reach the viewer in the payload", () => {
  it("carries every flow through a share link", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    expect(
      Object.values(shared!.snapshot.flows)
        .map((f) => f.name)
        .sort(),
    ).toEqual(["Checkout", "Refund"]);
  });

  it("carries the title and the note a reader is meant to read", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    const step = shared!.snapshot.flows.f1!.steps.s1!;
    expect([step.title, step.note]).toEqual(["The ask", "Only the happy path."]);
  });

  it("carries the scenes themselves, which are part of the diagram", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    expect(Object.values(shared!.versions ?? {}).map((s) => s.name)).toEqual(["Sem ledger"]);
  });
});

describe("a link opens in the author's scene, as the editor shows it", () => {
  it("carries which scene the author had open", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    expect(shared!.activeVersionId).toBe("sc1");
  });

  it("hides what the scene hides", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    expect(nodeNames(shared!)).toEqual(["Gateway"]);
  });

  it("follows whichever scene was open", () => {
    const other = diagramInScene();
    other.versions!.sc2 = scene("sc2", "Sem gateway", ["c1"]);
    other.activeVersionId = "sc2";

    expect(nodeNames(other)).toEqual(["Ledger"]);
  });

  it("draws the base when the author was on the base", () => {
    const onBase = diagramInScene();
    onBase.activeVersionId = null;

    expect(nodeNames(onBase)).toEqual(["Gateway", "Ledger"]);
  });

  it("draws the base when the scene named no longer exists", () => {
    const stale = diagramInScene();
    stale.activeVersionId = "deleted-scene";

    expect(nodeNames(stale)).toEqual(["Gateway", "Ledger"]);
  });

  it("still shows a diagram that has no scenes at all", () => {
    const plain = diagramInScene();
    delete plain.versions;
    plain.activeVersionId = null;

    expect(nodeNames(plain)).toEqual(["Gateway", "Ledger"]);
  });

  it("keeps everything else the link carried", () => {
    const shared = decodeShareParam(shareParamOf(generateShareUrl(diagramInScene()).url));

    expect(shared!.name).toBe("Checkout");
    expect(Object.keys(shared!.snapshot.components).sort()).toEqual(["c1", "c2"]);
  });
});

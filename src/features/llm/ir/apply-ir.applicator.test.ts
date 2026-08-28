import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { REFERENCE_DIAGRAMS } from "@/features/canvas/layout/reference-diagrams";
import { applyIRToDiagram } from "./apply-ir";
import type { DiagramIR } from "./ir.types";

/**
 * The generation path writes handle order and waypoints through the same
 * applicator as the other four layout consumers.
 *
 * What makes this path different — and what these tests exist to pin — is that
 * its layout graph is keyed by IR ids while the store minted ids of its own.
 * Every id that reaches the store has to be the store's, and an id with no store
 * counterpart has to be dropped rather than written through. Writing an IR id
 * into `handleOrder` or `setEdgeControlPoints` is silent: nothing throws, the
 * canvas just ignores an ordering that names connections it never heard of, and
 * the diagram falls back to round-robin handles.
 *
 * The fixture is a reference diagram rather than a three-node line, and that is
 * deliberate: a line has no bend points, so every waypoint assertion over one
 * passes with zero waypoints written. The first version of this file did exactly
 * that. `writes waypoints at all` below is the guard against it happening again.
 */

const IR: DiagramIR = REFERENCE_DIAGRAMS[0].ir;

const COMPONENT_ID: Record<string, string> = Object.fromEntries(
  IR.nodes.map((node, index) => [node.id, `cmp-${index}`]),
);
const CONNECTION_IDS: string[] = IR.edges.map((_edge, index) => `conn-${index}`);

function makeFakeStore(viewport: { x: number; y: number; zoom: number }) {
  const handleOrders: Array<{ componentId: string; side: string; ids: string[] }> = [];
  const waypoints: Array<{ connectionId: string; points: Array<{ x: number; y: number }> }> = [];

  return {
    activeDiagramId: "diag-1",
    diagrams: { "diag-1": { nodeLayouts: {}, edgeLayouts: {}, viewport } },
    insertGeneratedGraph: vi.fn(() => ({
      componentIds: Object.values(COMPONENT_ID),
      connectionIds: CONNECTION_IDS,
      componentIdByExternalId: COMPONENT_ID,
    })),
    updateHandleOrder: vi.fn((componentId: string, side: string, ids: string[]) => {
      handleOrders.push({ componentId, side, ids });
    }),
    setEdgeControlPoints: vi.fn(
      (
        _diagramId: string,
        connectionId: string,
        points: Array<{ x: number; y: number }>,
        _opts?: unknown,
      ) => {
        waypoints.push({ connectionId, points });
      },
    ),
    resetEdgeControlPoints: vi.fn(),
    _handleOrders: handleOrders,
    _waypoints: waypoints,
  };
}

describe("applyIRToDiagram — ids that reach the store", () => {
  let fakeStore: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    fakeStore = makeFakeStore({ x: 0, y: 0, zoom: 1 });
    vi.spyOn(useDiagramStore, "getState").mockReturnValue(fakeStore as never);
    vi.spyOn(useCanvasSelectionStore, "getState").mockReturnValue({
      setSelectedNodeId: vi.fn(),
      setSelectedNodeIds: vi.fn(),
      setSelectedEdgeId: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes waypoints at all — without this the assertions below are vacuous", async () => {
    await applyIRToDiagram(IR);

    expect(fakeStore._waypoints.length).toBeGreaterThan(0);
    expect(fakeStore._handleOrders.length).toBeGreaterThan(0);
  });

  it("writes handle order under component ids, never IR node ids", async () => {
    await applyIRToDiagram(IR);

    const componentIds = new Set(Object.values(COMPONENT_ID));
    const irNodeIds = new Set(IR.nodes.map((node) => node.id));
    for (const entry of fakeStore._handleOrders) {
      expect(irNodeIds, `handleOrder written for IR node ${entry.componentId}`).not.toContain(
        entry.componentId,
      );
      expect(componentIds).toContain(entry.componentId);
    }
  });

  it("writes handle order whose values are connection ids, never IR edge ids", async () => {
    await applyIRToDiagram(IR);

    const irEdgeIds = new Set(IR.edges.map((edge) => edge.id));
    for (const entry of fakeStore._handleOrders) {
      for (const id of entry.ids) {
        expect(irEdgeIds, `handleOrder value ${id} is an IR edge id`).not.toContain(id);
        expect(CONNECTION_IDS).toContain(id);
      }
    }
  });

  it("writes waypoints under connection ids, never IR edge ids", async () => {
    await applyIRToDiagram(IR);

    const irEdgeIds = new Set(IR.edges.map((edge) => edge.id));
    for (const entry of fakeStore._waypoints) {
      expect(irEdgeIds, `waypoints written for IR edge ${entry.connectionId}`).not.toContain(
        entry.connectionId,
      );
      expect(CONNECTION_IDS).toContain(entry.connectionId);
    }
  });

  it("skips an edge the store did not create instead of writing its IR id", async () => {
    // One connection short: `insertGeneratedGraph` returned ids for all but the
    // last IR edge, so that edge has no store counterpart.
    const short = CONNECTION_IDS.slice(0, -1);
    fakeStore.insertGeneratedGraph.mockReturnValue({
      componentIds: Object.values(COMPONENT_ID),
      connectionIds: short,
      componentIdByExternalId: COMPONENT_ID,
    });

    await applyIRToDiagram(IR);

    const written = [
      ...fakeStore._waypoints.map((entry) => entry.connectionId),
      ...fakeStore._handleOrders.flatMap((entry) => entry.ids),
    ];
    expect(written.length).toBeGreaterThan(0);
    for (const id of written) {
      expect(short).toContain(id);
    }
  });

  it("offsets waypoints by the viewport origin", async () => {
    // Viewport scrolled: the generated graph lands where the user is looking,
    // and the waypoints have to follow the nodes.
    // origin = -viewport.x / zoom + 80, so (480, 280) here.
    fakeStore = makeFakeStore({ x: -400, y: -200, zoom: 1 });
    vi.spyOn(useDiagramStore, "getState").mockReturnValue(fakeStore as never);

    await applyIRToDiagram(IR);

    expect(fakeStore._waypoints.length).toBeGreaterThan(0);
    for (const entry of fakeStore._waypoints) {
      for (const point of entry.points) {
        // ELK anchors its routes at (0,0); nothing could clear the origin if the
        // offset had been dropped on the way through the applicator.
        expect(point.x).toBeGreaterThanOrEqual(480);
        expect(point.y).toBeGreaterThanOrEqual(280);
      }
    }
  });
});

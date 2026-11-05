import { describe, expect, it } from "vitest";
import { PERSIST_SCHEMA_VERSION } from "@/features/diagram/store/persist.config";
import {
  buildLargeDiagramSeed,
  LARGE_SEED_PERSIST_VERSION,
} from "../../../../cypress/support/seed-large-diagram";

/**
 * The large-diagram performance fixture (`npm run perf:large`). Before/after
 * numbers only compare if both runs measure the same diagram, and the diagram
 * only loads without a migration if it is written at the current schema.
 */
describe("large-diagram performance fixture", () => {
  const seed = buildLargeDiagramSeed();
  const payload = JSON.parse(seed.localStoragePayload) as {
    version: number;
    state: {
      diagrams: Record<
        string,
        {
          viewport: { zoom: number };
          snapshot: {
            components: Record<
              string,
              { id: string; parentId: string | null; type: string; refOf?: string }
            >;
            connections: Record<string, { sourceId: string; targetId: string }>;
          };
          nodeLayouts: Record<string, unknown>;
          edgeLayouts: Record<string, { points: unknown[] }>;
        }
      >;
    };
  };
  const diagram = payload.state.diagrams[seed.diagramId]!;
  const { components, connections } = diagram.snapshot;

  it("is deterministic for the default seed", () => {
    expect(buildLargeDiagramSeed().localStoragePayload).toBe(seed.localStoragePayload);
  });

  it("is written at the current persist schema version", () => {
    expect(LARGE_SEED_PERSIST_VERSION).toBe(PERSIST_SCHEMA_VERSION);
    expect(payload.version).toBe(PERSIST_SCHEMA_VERSION);
  });

  it("has the size and shape the baseline was measured on", () => {
    expect(seed.stats.nodes).toBeGreaterThanOrEqual(650);
    expect(seed.stats.edges).toBeGreaterThanOrEqual(700);
    expect(seed.stats.routePoints).toBeGreaterThanOrEqual(2900);
    expect(diagram.viewport.zoom).toBe(0.3);
    const childCounts = new Map<string, number>();
    for (const c of Object.values(components)) {
      if (c.parentId) childCounts.set(c.parentId, (childCounts.get(c.parentId) ?? 0) + 1);
    }
    expect(Math.max(...childCounts.values())).toBeGreaterThanOrEqual(95);
  });

  it("only references elements that exist", () => {
    for (const c of Object.values(components)) {
      if (c.parentId) expect(components[c.parentId]?.type).toBe("panel");
      if (c.type === "shared-ref") expect(components[c.refOf!]).toBeDefined();
      expect(diagram.nodeLayouts[c.id]).toBeDefined();
    }
    for (const [id, conn] of Object.entries(connections)) {
      expect(components[conn.sourceId]).toBeDefined();
      expect(components[conn.targetId]).toBeDefined();
      expect(diagram.edgeLayouts[id]?.points.length).toBeGreaterThan(0);
    }
  });
});

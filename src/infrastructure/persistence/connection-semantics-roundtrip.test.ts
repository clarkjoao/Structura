import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { validateDiagramFile } from "./validateWorkspaceFile";
import { migrateDiagram } from "./migrations";

/**
 * Connected folder: a diagram is written to a file, closed, and read back. What the editor added
 * (interaction, kind, a swapped connection) has to come back intact, and a file written before the
 * change has to come back migrated.
 */

function diagramWith(connections: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "d",
    name: "Round trip",
    level: "container",
    createdAt: 1,
    updatedAt: 2,
    snapshot: { components: {}, connections, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function reopen(raw: Record<string, unknown>): Diagram {
  const onDisk = JSON.parse(JSON.stringify(raw)) as unknown;
  const result = validateDiagramFile(onDisk);
  if (!result.valid) throw new Error(result.reason);
  return migrateDiagram(result.diagram, 1);
}

describe("save → close → reopen", () => {
  it("keeps interaction, kind and direction", () => {
    const reopened = reopen(
      diagramWith({
        c: {
          id: "c",
          sourceId: "b",
          targetId: "a",
          label: "events",
          technology: "Kafka",
          interaction: "async",
          kind: "event",
          direction: "bidirectional",
        },
      }),
    );
    expect(reopened.snapshot.connections.c).toMatchObject({
      sourceId: "b",
      targetId: "a",
      technology: "Kafka",
      interaction: "async",
      kind: "event",
      direction: "bidirectional",
    });
  });

  it("migrates a file written before the change, without touching the caller's object", () => {
    const raw = diagramWith({
      c: {
        id: "c",
        sourceId: "a",
        targetId: "b",
        label: "",
        intent: "async-message",
        transportPreset: "tcp",
      },
    });
    const parsed = JSON.parse(JSON.stringify(raw)) as Diagram;
    const migrated = migrateDiagram(parsed, 1);
    expect(migrated.snapshot.connections.c).toMatchObject({
      interaction: "async",
      kind: "command",
      technology: "TCP",
    });
    expect(migrated.snapshot.connections.c.intent).toBeUndefined();
    expect(parsed.snapshot.connections.c.intent).toBe("async-message");
  });

  it("is stable: reopening a migrated file changes nothing", () => {
    const once = reopen(
      diagramWith({ c: { id: "c", sourceId: "a", targetId: "b", label: "", intent: "event" } }),
    );
    const twice = migrateDiagram(JSON.parse(JSON.stringify(once)) as Diagram, 1);
    expect(twice.snapshot.connections).toEqual(once.snapshot.connections);
  });
});

describe("save → close → reopen: boundaries", () => {
  it("keeps a boundary's type, the group it sits in, and a picked colour", () => {
    const raw = diagramWith({});
    (raw.snapshot as { components: Record<string, unknown> }).components = {
      vendas: { id: "vendas", name: "Vendas", type: "panel", description: "", parentId: null },
      q: {
        id: "q",
        name: "Q-Checkout",
        type: "panel",
        description: "",
        parentId: "vendas",
        boundaryType: "quantum",
        panelColor: "#123456",
      },
    };
    const reopened = reopen(raw);
    expect(reopened.snapshot.components.q).toMatchObject({
      boundaryType: "quantum",
      parentId: "vendas",
      panelColor: "#123456",
    });
  });
});

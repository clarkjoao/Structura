import { describe, expect, it } from "vitest";
import { mergePersistedState, PERSIST_SCHEMA_VERSION } from "./persist.config";
import type { DiagramStore } from "./store.types";
import type { Component, Connection } from "../model/diagram.types";
import { getEffectiveConnectionStyle } from "../model/connection-defaults";
import { migrateConnectionSemantics } from "../utils/connection-semantics-migration";

/**
 * v15 -> v16: intent becomes interaction × kind (the D2 table), `reverse` becomes a swapped
 * connection, the transport preset folds into interaction and technology, and the write-only
 * communication type goes. Saved diagrams must not change how they look.
 */

const conn = (id: string, extra: Partial<Connection> = {}): Connection =>
  ({ id, sourceId: "a", targetId: "b", label: "", ...extra }) as Connection;

function migrate(
  connections: Record<string, Connection>,
  components: Record<string, Component> = {},
) {
  const state = {
    diagrams: {
      d1: {
        snapshot: { components, connections },
        edgeLayouts: {},
        versions: {},
      } as never,
    },
  } as Partial<DiagramStore>;
  const next = mergePersistedState(state, {} as DiagramStore);
  const d = (
    next.diagrams as unknown as Record<
      string,
      {
        snapshot: {
          connections: Record<string, Connection>;
          components: Record<string, Component>;
        };
        edgeLayouts: Record<string, { points?: unknown[]; labelOffset?: number }>;
      }
    >
  ).d1;
  return d;
}

describe("schema version", () => {
  it("is 16", () => {
    expect(PERSIST_SCHEMA_VERSION).toBe(16);
  });
});

describe("intent → interaction × kind (the D2 table)", () => {
  const table: Array<[NonNullable<Connection["intent"]>, string, string]> = [
    ["dependency", "sync", "dependency"],
    ["call", "sync", "call"],
    ["event", "async", "event"],
    ["data-flow", "sync", "call"],
    ["async-message", "async", "command"],
  ];

  it.each(table)("%s → %s, %s", (intent, interaction, kind) => {
    const { snapshot } = migrate({ c: conn("c", { intent }) });
    expect(snapshot.connections.c).toMatchObject({ interaction, kind });
    expect(snapshot.connections.c.intent).toBeUndefined();
  });

  it("leaves a plain edge (no intent) alone", () => {
    const { snapshot } = migrate({ c: conn("c") });
    expect(snapshot.connections.c.interaction).toBeUndefined();
    expect(snapshot.connections.c.kind).toBeUndefined();
  });

  it("keeps what the user already set", () => {
    const { snapshot } = migrate({
      c: conn("c", { intent: "call", interaction: "async", kind: "event" }),
    });
    expect(snapshot.connections.c).toMatchObject({ interaction: "async", kind: "event" });
  });
});

describe("saved diagrams keep their drawing", () => {
  const before = (intent: NonNullable<Connection["intent"]>) =>
    getEffectiveConnectionStyle(conn("c", { intent }));

  it.each(["dependency", "call", "event", "data-flow", "async-message"] as const)(
    "%s draws the same stroke, width and animation after the migration",
    (intent) => {
      const { snapshot } = migrate({ c: conn("c", { intent }) });
      expect(getEffectiveConnectionStyle(snapshot.connections.c)).toEqual(before(intent));
    },
  );

  it("pins only what the new derivation would draw differently", () => {
    const { snapshot } = migrate({
      dep: conn("dep", { intent: "dependency" }),
      call: conn("call", { intent: "call" }),
      flow: conn("flow", { intent: "data-flow" }),
    });
    // Dependency was dashed but is synchronous (solid): the dash is pinned.
    expect(snapshot.connections.dep.style).toEqual({ strokeStyle: "dashed" });
    // A call draws what a synchronous call derives: nothing to pin.
    expect(snapshot.connections.call.style).toBeUndefined();
    expect(snapshot.connections.flow.style).toEqual({ strokeWidth: 3, animated: true });
  });

  it("does not overwrite a style the user already set", () => {
    const { snapshot } = migrate({
      c: conn("c", { intent: "event", style: { strokeStyle: "dotted" as never } }),
    });
    expect(snapshot.connections.c.style?.strokeStyle).toBe("dotted");
  });
});

describe("new edges: the interaction drives the stroke", () => {
  it("draws sync solid and async dashed, with no style of its own", () => {
    expect(getEffectiveConnectionStyle(conn("s", { interaction: "sync" })).strokeStyle).toBe(
      "solid",
    );
    expect(getEffectiveConnectionStyle(conn("a", { interaction: "async" })).strokeStyle).toBe(
      "dashed",
    );
  });

  it("an explicit stroke still wins", () => {
    const style = { strokeStyle: "solid" as never };
    expect(
      getEffectiveConnectionStyle(conn("a", { interaction: "async", style })).strokeStyle,
    ).toBe("solid");
  });
});

describe("transport preset", () => {
  it("sync and async become the interaction", () => {
    const { snapshot } = migrate({
      s: conn("s", { transportPreset: "sync" }),
      a: conn("a", { transportPreset: "async" }),
    });
    expect(snapshot.connections.s.interaction).toBe("sync");
    expect(snapshot.connections.a.interaction).toBe("async");
    expect(snapshot.connections.a.transportPreset).toBeUndefined();
  });

  it("event becomes an asynchronous event", () => {
    const { snapshot } = migrate({ e: conn("e", { transportPreset: "event" }) });
    expect(snapshot.connections.e).toMatchObject({ interaction: "async", kind: "event" });
  });

  it("tcp and udp fold into the technology, keeping what is there", () => {
    const { snapshot } = migrate({
      empty: conn("empty", { transportPreset: "tcp" }),
      has: conn("has", { transportPreset: "udp", technology: "gRPC" }),
      already: conn("already", { transportPreset: "tcp", technology: "Raw TCP" }),
    });
    expect(snapshot.connections.empty.technology).toBe("TCP");
    expect(snapshot.connections.has.technology).toBe("gRPC · UDP");
    expect(snapshot.connections.already.technology).toBe("Raw TCP");
  });

  it("a preset does not override an interaction the intent already gave", () => {
    const { snapshot } = migrate({ c: conn("c", { intent: "event", transportPreset: "sync" }) });
    expect(snapshot.connections.c.interaction).toBe("async");
  });
});

describe("communicationType", () => {
  it("is dropped", () => {
    const { snapshot } = migrate({ c: conn("c", { communicationType: "custom" }) });
    expect(snapshot.connections.c.communicationType).toBeUndefined();
  });
});

describe("reverse → a swapped connection", () => {
  const components = {
    a: { id: "a", handleOrder: { incoming: [], outgoing: ["c", "x"] } } as unknown as Component,
    b: { id: "b", handleOrder: { incoming: ["c"], outgoing: [] } } as unknown as Component,
  };

  it("swaps the ends and becomes unidirectional", () => {
    const { snapshot } = migrate({ c: conn("c", { direction: "reverse" }) }, components);
    expect(snapshot.connections.c).toMatchObject({
      sourceId: "b",
      targetId: "a",
      direction: "unidirectional",
    });
  });

  it("drops the cross-axis sides, which belonged to the old ends", () => {
    const { snapshot } = migrate(
      { c: conn("c", { direction: "reverse", sourceSide: "bottom", targetSide: "top" }) },
      components,
    );
    expect(snapshot.connections.c.sourceSide).toBeUndefined();
    expect(snapshot.connections.c.targetSide).toBeUndefined();
  });

  it("forgets the connection in the old ends' handle orders", () => {
    const { snapshot } = migrate({ c: conn("c", { direction: "reverse" }) }, components);
    expect(snapshot.components.a.handleOrder?.outgoing).toEqual(["x"]);
    expect(snapshot.components.b.handleOrder?.incoming).toEqual([]);
  });

  it("resets the waypoints and mirrors the label along the line", () => {
    const state = {
      diagrams: {
        d1: {
          snapshot: { components, connections: { c: conn("c", { direction: "reverse" }) } },
          edgeLayouts: { c: { points: [{ id: "p", x: 1, y: 2 }], labelOffset: 0.25 } },
          versions: {},
        } as never,
      },
    } as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    const layout = (
      next.diagrams as unknown as Record<
        string,
        { edgeLayouts: Record<string, { points?: unknown[]; labelOffset?: number }> }
      >
    ).d1.edgeLayouts.c;
    expect(layout.points).toBeUndefined();
    expect(layout.labelOffset).toBe(0.75);
  });

  it("keeps bidirectional edges as they are", () => {
    const { snapshot } = migrate({ c: conn("c", { direction: "bidirectional" }) });
    expect(snapshot.connections.c).toMatchObject({
      sourceId: "a",
      targetId: "b",
      direction: "bidirectional",
    });
  });
});

describe("versions", () => {
  it("migrates the connections a version adds", () => {
    const state = {
      diagrams: {
        d1: {
          snapshot: { components: {}, connections: {} },
          edgeLayouts: {},
          versions: {
            v1: {
              addedComponents: {},
              addedConnections: { c: conn("c", { intent: "async-message" }) },
            },
          },
        } as never,
      },
    } as Partial<DiagramStore>;
    const next = mergePersistedState(state, {} as DiagramStore);
    const added = (
      next.diagrams as unknown as Record<
        string,
        { versions: Record<string, { addedConnections: Record<string, Connection> }> }
      >
    ).d1.versions.v1.addedConnections.c;
    expect(added).toMatchObject({ interaction: "async", kind: "command" });
    expect(added.intent).toBeUndefined();
  });
});

describe("idempotence", () => {
  it("migrating twice changes nothing the second time", () => {
    const target = {
      components: {},
      connections: {
        c: conn("c", { intent: "data-flow", transportPreset: "tcp", direction: "reverse" }),
      },
      edgeLayouts: {},
    };
    expect(migrateConnectionSemantics(target.connections.c, target)).toBe(true);
    const once = JSON.stringify(target);
    expect(migrateConnectionSemantics(target.connections.c, target)).toBe(false);
    expect(JSON.stringify(target)).toBe(once);
  });
});

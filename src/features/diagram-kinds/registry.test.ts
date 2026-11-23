import { afterEach, describe, expect, it } from "vitest";
import {
  diagramKindsVersion,
  getDiagramKind,
  listDiagramKinds,
  registerDiagramKind,
  unregisterDiagramKind,
} from "./registry";
import { FREEHAND_INTERACTION, interactionOf, resolveKindPolicy } from "./policy";
import type { DiagramKindDescriptor } from "./kind.types";

function stubKind(id: string, extra: Partial<DiagramKindDescriptor> = {}): DiagramKindDescriptor {
  return {
    id,
    label: { text: id },
    returnLabel: { text: `Back to ${id}` },
    creatable: true,
    elements: [],
    interaction: {
      nodesDraggable: false,
      resizable: false,
      arrangeModeChoice: false,
      recordFlows: false,
    },
    conforms: () => [],
    ...extra,
  };
}

const registered: string[] = [];
function register(descriptor: DiagramKindDescriptor, contributed = false): void {
  registerDiagramKind(descriptor, { contributed });
  registered.push(descriptor.id);
}

afterEach(() => {
  for (const id of registered.splice(0)) unregisterDiagramKind(id);
});

describe("diagram-kind registry", () => {
  it("registers a kind and bumps the version", () => {
    const before = diagramKindsVersion();
    register(stubKind("stub-a"));
    expect(getDiagramKind("stub-a")?.id).toBe("stub-a");
    expect(listDiagramKinds().map((k) => k.id)).toContain("stub-a");
    expect(diagramKindsVersion()).toBeGreaterThan(before);
  });

  it("refuses a duplicate id and keeps the first kind", () => {
    const first = stubKind("stub-dup");
    register(first);
    expect(() => registerDiagramKind(stubKind("stub-dup"))).toThrow(/stub-dup/);
    expect(getDiagramKind("stub-dup")).toBe(first);
  });

  it("refuses malformed ids", () => {
    for (const id of ["Stub", "freehand", "a b", "", "acme:stub"]) {
      expect(() => registerDiagramKind(stubKind(id))).toThrow();
    }
    expect(() => registerDiagramKind(stubKind("stub"), { contributed: true })).toThrow(/pluginId/);
    expect(getDiagramKind("Stub")).toBeUndefined();
  });

  it("accepts a namespaced contributed id", () => {
    register(stubKind("acme:value-stream"), true);
    expect(getDiagramKind("acme:value-stream")).toBeDefined();
  });

  it("requires a conformance check", () => {
    const broken = { ...stubKind("stub-broken"), conforms: undefined } as unknown;
    expect(() => registerDiagramKind(broken as DiagramKindDescriptor)).toThrow(/conforms/);
  });

  it("refuses a command declared twice", () => {
    const command = {
      id: "next",
      label: { text: "Next" },
      enabled: () => true,
      run: () => ({ edit: {} }),
    };
    expect(() =>
      registerDiagramKind(stubKind("stub-cmd", { commands: [command, command] })),
    ).toThrow(/twice/);
  });
});

describe("resolveKindPolicy", () => {
  it("is freehand without a kind, with today's interaction", () => {
    const policy = resolveKindPolicy({});
    expect(policy.type).toBe("freehand");
    expect(interactionOf(policy)).toEqual(FREEHAND_INTERACTION);
  });

  it("resolves a registered kind in its mode and in freehand mode", () => {
    const kind = stubKind("stub-policy");
    register(kind);
    const active = resolveKindPolicy({ kind: "stub-policy" });
    expect(active).toEqual({ type: "kind", descriptor: kind });
    expect(interactionOf(active).nodesDraggable).toBe(false);
    const freehand = resolveKindPolicy({ kind: "stub-policy", kindMode: "freehand" });
    expect(freehand).toEqual({ type: "kind-freehand", descriptor: kind });
    expect(interactionOf(freehand)).toEqual(FREEHAND_INTERACTION);
  });

  it("marks an unregistered kind unavailable, and follows a later registration", () => {
    expect(resolveKindPolicy({ kind: "stub-late" })).toEqual({
      type: "kind-unavailable",
      kindId: "stub-late",
    });
    register(stubKind("stub-late"));
    expect(resolveKindPolicy({ kind: "stub-late" }).type).toBe("kind");
  });

  it("reads a malformed kind as freehand", () => {
    expect(resolveKindPolicy({ kind: "Not A Kind" }).type).toBe("freehand");
  });
});

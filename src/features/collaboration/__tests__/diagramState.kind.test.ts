import { describe, expect, it } from "vitest";
import { DOC_FIELDS } from "@collab-protocol";
import type { Diagram } from "@/features/diagram";
import { LEGACY_DOC_FIELD_SET, applyStateToDiagram, diagramToState } from "../sync/diagramState";

const ALL_FIELDS = new Set<string>(DOC_FIELDS);

function diagram(extra: Partial<Diagram> = {}): Diagram {
  return {
    id: "d",
    name: "d",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...extra,
  };
}

describe("collaboration — diagram kind", () => {
  it("sends the kind fields only to a relay that declared them", () => {
    const d = diagram({ kind: "guided", kindData: { flowId: "f" } });
    expect("kind" in diagramToState(d, LEGACY_DOC_FIELD_SET).doc).toBe(false);
    const doc = diagramToState(d, ALL_FIELDS).doc;
    expect(doc.kind).toBe("guided");
    expect(doc.kindMode).toBeNull();
    expect(doc.kindData).toEqual({ flowId: "f" });
  });

  it("adopts a peer's mode switch", () => {
    const local = diagram({ kind: "guided", kindData: { flowId: "f" } });
    const remote = diagramToState({ ...local, kindMode: "freehand" }, ALL_FIELDS);
    const next = applyStateToDiagram(local, remote);
    expect(next.kind).toBe("guided");
    expect(next.kindMode).toBe("freehand");
    expect(next.kindData).toEqual({ flowId: "f" });
  });

  it("leaves the local kind alone when an older relay carries no kind fields", () => {
    const local = diagram({ kind: "guided", kindMode: "freehand" });
    const next = applyStateToDiagram(local, diagramToState(local, LEGACY_DOC_FIELD_SET));
    expect(next.kind).toBe("guided");
    expect(next.kindMode).toBe("freehand");
  });

  it("drops a malformed remote kind", () => {
    const local = diagram({ kind: "guided" });
    const state = diagramToState(local, ALL_FIELDS);
    const next = applyStateToDiagram(local, { ...state, doc: { ...state.doc, kind: 42 } });
    expect("kind" in next).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildFlowObject, withKey, withRead } from "./flowObject";

/**
 * The object a script carries, seen from one of its steps.
 *
 * The panel this replaces held two lists inside every step — what was already
 * set, and what the step added — and left the reader to join them. One object,
 * and the selected step is the lens: at that step, it has this value.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Criar", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const CHAIN = flow({
  s1: { next: "s2", context: { sets: { slug: "artigo26", plano: "pro" } } },
  s2: { next: "s3", context: { sets: { plano: "enterprise" }, reads: ["slug", "ttl_horas"] } },
  s3: {},
});

const rowsAt = (stepId: string | null) =>
  buildFlowObject(CHAIN, stepId).rows.map((row) => ({
    key: row.key,
    value: row.value,
    written: row.written,
    read: row.read,
    from: row.fromNumber,
  }));

describe("the object at a step", () => {
  it("holds what the step writes as well as what it inherits", () => {
    expect(rowsAt("s2")).toEqual([
      { key: "slug", value: "artigo26", written: false, read: true, from: "1" },
      // Written here, and showing the value it ends up with — not the one it
      // replaced, which the panel used to hide behind a second list.
      { key: "plano", value: "enterprise", written: true, read: false, from: "2" },
      { key: "ttl_horas", value: null, written: false, read: true, from: "" },
    ]);
  });

  it("is all inherited from a step that writes nothing", () => {
    expect(rowsAt("s3").every((row) => !row.written)).toBe(true);
    expect(rowsAt("s3").map((row) => row.value)).toEqual(["artigo26", "enterprise"]);
  });

  it("reads the end of the script when no step is chosen", () => {
    const object = buildFlowObject(CHAIN, null);

    expect(object.atStepId).toBeNull();
    expect(object.rows.every((row) => !row.written && !row.read)).toBe(true);
    expect(object.rows.map((row) => row.key)).toEqual(["slug", "plano"]);
  });

  it("names the step it is being seen from", () => {
    expect(buildFlowObject(CHAIN, "s2").atNumber).toBe("2");
  });

  it("keeps a key the step consumes that nothing writes, with no value", () => {
    const unset = rowsAt("s2").find((row) => row.key === "ttl_horas");

    expect(unset).toMatchObject({ value: null, read: true });
  });

  it("has nothing to show for a flow with no steps", () => {
    expect(buildFlowObject(flow({}), null).rows).toEqual([]);
  });

  it("has nothing to show for a step no path reaches", () => {
    const orphaned = flow({ s1: { context: { sets: { a: "1" } } }, lost: {} });

    expect(buildFlowObject(orphaned, "lost").rows).toEqual([]);
  });
});

describe("a value that does not outlive the call that wrote it", () => {
  const NESTED = flow({
    s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
    s2: { next: "s3", context: { sets: { linha: "1" } } },
    s3: { next: "s4" },
    s4: { connectionId: "c1", payloadDirection: "response" },
  });

  it("says where it stops existing", () => {
    const row = buildFlowObject(NESTED, "s3").rows.find((candidate) => candidate.key === "linha");

    expect(row?.endsAtNumber).toBe("4");
  });

  it("says nothing for a value no call is holding", () => {
    expect(buildFlowObject(CHAIN, "s2").rows.every((row) => row.endsAtNumber === null)).toBe(true);
  });

  it("says nothing on a way that never reaches the answer", () => {
    const branched = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: { next: "c", context: { sets: { linha: "1" } } },
      c: {
        type: "condition",
        branches: [
          { label: "sim", nextId: "a1" },
          { label: "nao", nextId: "b1" },
        ],
      },
      a1: { connectionId: "c1", payloadDirection: "response" },
      b1: {},
    });
    const row = buildFlowObject(branched, "b1").rows.find((c) => c.key === "linha");

    expect(row?.endsAtNumber).toBeNull();
  });
});

describe("writing one key of the object", () => {
  const step = (context: FlowStep["context"]): FlowStep =>
    ({ id: "s", type: "action", context }) as FlowStep;

  it("adds a key the step did not write", () => {
    expect(withKey(step({ sets: { a: "1" } }), "b", "2")).toEqual({ a: "1", b: "2" });
  });

  it("writes over one it did", () => {
    expect(withKey(step({ sets: { a: "1" } }), "a", "9")).toEqual({ a: "9" });
  });

  it("drops the whole field when its last key is cleared", () => {
    expect(withKey(step({ sets: { a: "1" } }), "a", null)).toBeUndefined();
  });

  it("turns a key the step consumes on and off", () => {
    expect(withRead(step({ reads: ["a"] }), "b")).toEqual(["a", "b"]);
    expect(withRead(step({ reads: ["a", "b"] }), "a")).toEqual(["b"]);
    expect(withRead(step({ reads: ["a"] }), "a")).toBeUndefined();
  });
});

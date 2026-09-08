import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildCallStack, buildFlowOutline } from "@/features/diagram";
import {
  buildRunningContext,
  checkContract,
  describeExpected,
  describePayload,
  parsePayload,
} from "./readingVariables";

/**
 * The contract of a call, and what the reading knows by the time it gets there.
 *
 * The property worth guarding hardest is that the running object is *derived*:
 * a shorter path is the earlier state, with nothing kept on the side. Every
 * going-back case here is really a test of that.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const stackOf = (f: Flow) => buildCallStack(f, buildFlowOutline(f));

/** s2 calls Antifraude from inside the call s1 made; s3 answers s2, s4 answers s1. */
const NESTED = flow({
  s1: {
    connectionId: "c1",
    payloadDirection: "request",
    payload: '{"cliente_id":"c_8f3a"}',
    context: { sets: { cliente_id: "c_8f3a" } },
    next: "s2",
  },
  s2: {
    connectionId: "c2",
    payloadDirection: "request",
    payload: '{"cpf":"***.***.891-04"}',
    context: { reads: ["cliente_id"], sets: { device_id: "d_71bc" } },
    next: "s3",
  },
  s3: {
    connectionId: "c2",
    payloadDirection: "response",
    payload: '{"score":0.12,"desafio_3ds":false}',
    context: { sets: { score: "0.12" } },
    next: "s4",
  },
  s4: { connectionId: "c1", payloadDirection: "response", payload: '{"status":"pago"}' },
});

describe("a payload is an object when it is one, and prose when it is not", () => {
  it("parses an object", () => {
    expect(parsePayload('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses an array", () => {
    expect(parsePayload("[1,2]")).toEqual([1, 2]);
  });

  it("gives prose back as nothing to draw, without throwing", () => {
    expect(parsePayload("o gateway envia o cartão tokenizado")).toBeNull();
    expect(parsePayload("{not json")).toBeNull();
  });

  it("keeps the text of a payload that is not JSON, so it is still shown", () => {
    const prose = flow({ s1: { payload: "cartão tokenizado" } });

    expect(describePayload(prose, "s1")).toEqual({
      json: null,
      text: "cartão tokenizado",
      direction: null,
    });
  });

  it("says which way the body is travelling", () => {
    expect(describePayload(NESTED, "s2")?.direction).toBe("request");
    expect(describePayload(NESTED, "s3")?.direction).toBe("response");
  });

  it("has nothing to show for a step with no payload", () => {
    expect(describePayload(flow({ s1: { componentId: "a" } }), "s1")).toBeNull();
  });
});

describe("the other half of the contract is derived from the pairing", () => {
  it("takes the expected body from the step that closes the call", () => {
    const expected = describeExpected(NESTED, stackOf(NESTED), "s2");

    expect(expected?.fromStepId).toBe("s3");
    expect(expected?.explicit).toBe(false);
    expect(expected?.payload?.json).toEqual({ score: 0.12, desafio_3ds: false });
  });

  it("prefers what the author declared over the derived preview", () => {
    const declared = flow({
      s1: {
        connectionId: "c1",
        payloadDirection: "request",
        context: { expects: '{"score":"number","limite":"number"}' },
        next: "s2",
      },
      s2: { connectionId: "c1", payloadDirection: "response", payload: '{"score":0.12}' },
    });

    const expected = describeExpected(declared, stackOf(declared), "s1");

    expect(expected?.explicit).toBe(true);
    expect(expected?.payload?.json).toEqual({ score: "number", limite: "number" });
  });

  it("says out loud that nothing comes back from a fire-and-forget call", () => {
    const async = flow({
      s1: { connectionId: "c1", payloadDirection: "request", isAsync: true, next: "s2" },
      s2: { componentId: "b" },
    });

    expect(describeExpected(async, stackOf(async), "s1")).toEqual({
      payload: null,
      fromStepId: null,
      explicit: false,
      nothingComesBack: true,
    });
  });

  it("has nothing to expect on a step that makes no call", () => {
    expect(describeExpected(NESTED, stackOf(NESTED), "s3")).toBeNull();
  });
});

describe("a declared expectation is checked against what arrived", () => {
  const declared = (expects: string, payload: string) =>
    flow({
      s1: {
        connectionId: "c1",
        payloadDirection: "request",
        context: { expects },
        next: "s2",
      },
      s2: { connectionId: "c1", payloadDirection: "response", payload },
    });

  it("confirms a response that carries what was asked for", () => {
    const f = declared('{"score":0}', '{"score":0.12}');

    expect(checkContract(f, stackOf(f), "s2")).toEqual({
      missing: [],
      unexpected: [],
      matches: true,
    });
  });

  it("reports a key that was expected and did not arrive", () => {
    const f = declared('{"score":0,"limite":0}', '{"score":0.12}');

    expect(checkContract(f, stackOf(f), "s2")).toMatchObject({
      missing: ["limite"],
      matches: false,
    });
  });

  it("reports a key that arrived unannounced", () => {
    const f = declared('{"score":0}', '{"score":0.12,"motivos":[]}');

    expect(checkContract(f, stackOf(f), "s2")).toMatchObject({
      unexpected: ["motivos"],
      matches: false,
    });
  });

  it("changes neither body", () => {
    const f = declared('{"score":0,"limite":0}', '{"score":0.12}');
    const before = JSON.stringify(f.steps);

    checkContract(f, stackOf(f), "s2");

    expect(JSON.stringify(f.steps)).toBe(before);
  });

  it("has nothing to compare when the author declared nothing", () => {
    expect(checkContract(NESTED, stackOf(NESTED), "s3")).toBeNull();
  });
});

describe("the running object is folded from the walk, not kept on the side", () => {
  const read = (path: string[]) => buildRunningContext(NESTED, stackOf(NESTED), path);

  it("shows a value from the step that introduced it", () => {
    const context = read(["s1"]);

    expect(context.byKey.get("cliente_id")).toMatchObject({
      value: "c_8f3a",
      fromStepId: "s1",
    });
  });

  it("has nothing before the step that introduces it", () => {
    expect(read([]).size).toBe(0);
  });

  it("lets a later value take the key from an earlier one", () => {
    const twice = flow({
      s1: { context: { sets: { estado: "pendente" } }, next: "s2" },
      s2: { context: { sets: { estado: "pago" } } },
    });

    const context = buildRunningContext(twice, stackOf(twice), ["s1", "s2"]);

    expect(context.byKey.get("estado")?.value).toBe("pago");
    expect(context.byKey.get("estado")?.fromStepId).toBe("s2");
  });

  it("restores the earlier state when the reading goes back", () => {
    expect(read(["s1", "s2", "s3"]).byKey.has("score")).toBe(true);
    expect(read(["s1", "s2"]).byKey.has("score")).toBe(false);
  });
});

describe("a call takes its locals with it when it ends", () => {
  const read = (path: string[]) => buildRunningContext(NESTED, stackOf(NESTED), path);

  it("groups values by the call they were introduced in, innermost first", () => {
    const context = read(["s1", "s2"]);

    expect(context.groups.map((group) => group.frameId)).toEqual(["s1", null]);
    expect(context.groups[0]!.entries.map((entry) => entry.key)).toEqual(["device_id"]);
  });

  it("keeps what the calling step produced: that belongs to the caller", () => {
    // `device_id` is set by the step that *makes* the call, so it lives where
    // that step lives — the way `const id = ...; inner(id)` leaves `id` behind
    // in the outer function rather than inside `inner`.
    expect(read(["s1", "s2"]).byKey.get("device_id")?.frameId).toBe("s1");
    expect(read(["s1", "s2", "s3"]).byKey.has("device_id")).toBe(true);
  });

  it("drops what a step inside the call introduced, once the call returns", () => {
    const deep = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: { componentId: "b", context: { sets: { tentativas: "1" } }, next: "s3" },
      s3: { connectionId: "c1", payloadDirection: "response" },
    });

    const inside = buildRunningContext(deep, stackOf(deep), ["s1", "s2"]);
    const after = buildRunningContext(deep, stackOf(deep), ["s1", "s2", "s3"]);

    expect(inside.byKey.get("tentativas")?.frameId).toBe("s1");
    expect(after.byKey.has("tentativas")).toBe(false);
  });

  it("keeps what the closing step itself carries, in the caller's frame", () => {
    const context = read(["s1", "s2", "s3"]);

    expect(context.byKey.get("score")).toMatchObject({ fromStepId: "s3", frameId: "s1" });
  });

  it("drops the locals of a call that ended with no step to say so", () => {
    const unwound = flow({
      s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
      s2: {
        connectionId: "c2",
        payloadDirection: "request",
        context: { sets: { tentativa: "1" } },
        next: "s3",
      },
      s3: { componentId: "x", context: { sets: { interno: "sim" } }, next: "s4" },
      s4: { connectionId: "c1", payloadDirection: "response" },
    });

    const inside = buildRunningContext(unwound, stackOf(unwound), ["s1", "s2", "s3"]);
    const after = buildRunningContext(unwound, stackOf(unwound), ["s1", "s2", "s3", "s4"]);

    expect(inside.byKey.has("interno")).toBe(true);
    expect(after.byKey.has("interno")).toBe(false);
  });
});

describe("the step being read says what it consumes", () => {
  it("names the keys it declares", () => {
    const context = buildRunningContext(NESTED, stackOf(NESTED), ["s1", "s2"]);

    expect(context.reads).toEqual(["cliente_id"]);
    expect(context.unsetReads).toEqual([]);
  });

  it("reports a key nothing before it introduced", () => {
    const orphan = flow({
      s1: { componentId: "a", next: "s2" },
      s2: { componentId: "b", context: { reads: ["cupom_id"] } },
    });

    const context = buildRunningContext(orphan, stackOf(orphan), ["s1", "s2"]);

    expect(context.unsetReads).toEqual(["cupom_id"]);
  });
});

describe("a script with no context at all folds to nothing", () => {
  it("has no groups, no reads and no size", () => {
    const flat = flow({ s1: { componentId: "a", next: "s2" }, s2: { componentId: "b" } });

    const context = buildRunningContext(flat, stackOf(flat), ["s1", "s2"]);

    expect(context).toMatchObject({ groups: [], reads: [], unsetReads: [], size: 0 });
  });
});

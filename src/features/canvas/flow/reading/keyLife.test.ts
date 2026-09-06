import { describe, expect, it } from "vitest";
import type { Flow, FlowCallStack, FlowStep } from "@/features/diagram";
import { buildCallStack, buildFlowOutline } from "@/features/diagram";
import {
  buildRunningContext,
  describeContextChange,
  keyLife,
  type KeyEvent,
} from "./readingVariables";

/**
 * The life of a key, pinned against the slow way of getting it.
 *
 * `keyLife` walks the path once and repeats the fold's rules to do it. That
 * duplication is the risk, so the oracle below derives the same events the
 * expensive way — folding every prefix and comparing consecutive pairs — and
 * the two are compared on every shape. A change to the fold breaks this.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "X", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

function slowKeyLife(
  f: Flow,
  stack: FlowCallStack,
  path: readonly string[],
  key: string,
): KeyEvent[] {
  const events: KeyEvent[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const prefix = path.slice(0, i + 1);
    const stepId = path[i]!;
    const change = describeContextChange(f, stack, prefix);

    for (const frame of change.gone) {
      if (frame.entries.some((entry) => entry.key === key)) {
        events.push({ kind: "gone", stepId, frameId: frame.frameId });
      }
    }
    for (const entry of change.introduced) {
      if (entry.key === key) events.push({ kind: "set", stepId, value: entry.value });
    }
    for (const swap of change.replaced) {
      if (swap.entry.key === key) {
        events.push({ kind: "replaced", stepId, value: swap.entry.value });
      }
    }
    const running = buildRunningContext(f, stack, prefix);
    if (running.reads.includes(key) && running.byKey.has(key)) {
      events.push({ kind: "read", stepId });
    }
  }
  return events;
}

const NESTED = flow({
  s1: { connectionId: "c1", payloadDirection: "request", next: "s2" },
  s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
  s3: {
    connectionId: "c2",
    payloadDirection: "response",
    next: "s4",
    context: { sets: { url_id: "u_9f2" } },
  },
  s4: {
    connectionId: "c3",
    payloadDirection: "request",
    next: "s5",
    context: { reads: ["url_id"] },
  },
  s5: {
    connectionId: "c3",
    payloadDirection: "response",
    next: "s6",
    context: { reads: ["url_id"] },
  },
  s6: { connectionId: "c1", payloadDirection: "response" },
});

const STACK = buildCallStack(NESTED, buildFlowOutline(NESTED));
const PATH = ["s1", "s2", "s3", "s4", "s5", "s6"];

describe("the life of a key on the walked path", () => {
  it("names where it was introduced, read, and where it went", () => {
    const life = keyLife(NESTED, STACK, PATH, "url_id");

    expect(life).toEqual([
      { kind: "set", stepId: "s3", value: "u_9f2" },
      { kind: "read", stepId: "s4" },
      { kind: "read", stepId: "s5" },
      { kind: "gone", stepId: "s6", frameId: "s1" },
    ]);
  });

  it("agrees with folding every prefix and comparing them", () => {
    for (let i = 1; i <= PATH.length; i += 1) {
      const path = PATH.slice(0, i);
      expect(keyLife(NESTED, STACK, path, "url_id"), `prefix of ${i}`).toEqual(
        slowKeyLife(NESTED, STACK, path, "url_id"),
      );
    }
  });

  it("says nothing about a key the path never introduces", () => {
    expect(keyLife(NESTED, STACK, PATH, "ttl_horas")).toEqual([]);
  });

  it("says nothing before the reading has started", () => {
    expect(keyLife(NESTED, STACK, [], "url_id")).toEqual([]);
  });
});

describe("a value written over", () => {
  const OVER = flow({
    s1: { next: "s2", context: { sets: { plano: "pro" } } },
    s2: { next: "s3", context: { sets: { plano: "enterprise" } } },
    s3: { context: { reads: ["plano"] } },
  });
  const stack = buildCallStack(OVER, buildFlowOutline(OVER));

  it("is a replacement, not a second introduction", () => {
    expect(keyLife(OVER, stack, ["s1", "s2", "s3"], "plano")).toEqual([
      { kind: "set", stepId: "s1", value: "pro" },
      { kind: "replaced", stepId: "s2", value: "enterprise" },
      { kind: "read", stepId: "s3" },
    ]);
  });

  it("agrees with the slow derivation", () => {
    expect(keyLife(OVER, stack, ["s1", "s2", "s3"], "plano")).toEqual(
      slowKeyLife(OVER, stack, ["s1", "s2", "s3"], "plano"),
    );
  });
});

describe("a key introduced only on a branch not taken", () => {
  const BRANCHED = flow({
    s1: {
      type: "condition",
      branches: [
        { label: "sim", nextId: "a1" },
        { label: "nao", nextId: "b1" },
      ],
    },
    a1: { context: { sets: { cupom: "X10" } } },
    b1: { context: { sets: { plano: "pro" } } },
  });
  const stack = buildCallStack(BRANCHED, buildFlowOutline(BRANCHED));

  it("has no life on the path that never reaches it", () => {
    expect(keyLife(BRANCHED, stack, ["s1", "b1"], "cupom")).toEqual([]);
    expect(keyLife(BRANCHED, stack, ["s1", "a1"], "cupom")).toEqual([
      { kind: "set", stepId: "a1", value: "X10" },
    ]);
  });
});

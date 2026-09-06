import { describe, expect, it } from "vitest";
import type { Flow, FlowConditionKind } from "@/features/diagram";
import {
  buildCallStack,
  buildFlowOutline,
  checkFlowInvariants,
  conditionKindOf,
  findFrameExit,
  getPathToStep,
  isConditionStep,
  stepsToMermaid,
} from "@/features/diagram";
import {
  buildRunningContext,
  checkContract,
} from "@/features/canvas/flow/reading/readingVariables";
import { SEED_US_DIAGRAMS } from "./urlshort-example";

/**
 * What a fresh install can be read for.
 *
 * The seed is the only script most people will ever open, so a feature missing
 * from it is a feature nobody finds. Worse, it is a feature nothing exercises
 * end to end: the reading derives everything, and a derivation with no data to
 * chew on is green in every unit test and broken in the product — which is how
 * `payloadDirection`, `context` and the thread mark each shipped inert.
 *
 * So these assert the seeded scripts, together, still produce every shape the
 * reading knows how to draw. Removing one from the seed fails here rather than
 * quietly emptying a panel.
 */

interface Seeded {
  flow: Flow;
  outline: ReturnType<typeof buildFlowOutline>;
  stack: ReturnType<typeof buildCallStack>;
}

const SEEDED: Seeded[] = Object.values(SEED_US_DIAGRAMS).flatMap((diagram) =>
  Object.values(diagram.snapshot.flows ?? {}).map((flow) => {
    const outline = buildFlowOutline(flow);
    return { flow, outline, stack: buildCallStack(flow, outline) };
  }),
);

const everyStep = () =>
  SEEDED.flatMap(({ flow }) => Object.values(flow.steps).map((step) => ({ flow, step })));

const some = (predicate: (entry: Seeded) => boolean) => SEEDED.some(predicate);

describe("the seeded scripts hold together", () => {
  it("seeds more than one script, so the rail has somewhere to switch to", () => {
    expect(SEEDED.length).toBeGreaterThan(3);
  });

  it("keeps every seeded script structurally sound", () => {
    for (const { flow, outline } of SEEDED) {
      expect({
        flow: flow.name,
        violations: checkFlowInvariants(flow).map((v) => v.code),
        unreachable: outline.unreachable,
      }).toEqual({ flow: flow.name, violations: [], unreachable: [] });
    }
  });

  it("leaves no seeded response answering a call nobody made", () => {
    for (const { flow, stack } of SEEDED) {
      expect({ flow: flow.name, orphans: stack.orphanResponses }).toEqual({
        flow: flow.name,
        orphans: [],
      });
    }
  });
});

describe("the seeded scripts exercise the call stack", () => {
  it("nests a call inside a call, so the guides and the trail have something to draw", () => {
    expect(
      some(({ stack }) => [...stack.byStep.values()].some((info) => info.callDepth >= 2)),
    ).toBe(true);
  });

  it("leaves one call without a written answer, so a derived return is drawn", () => {
    expect(some(({ stack }) => stack.derivedReturnsBefore.size > 0)).toBe(true);
  });

  it("fires one call and forgets it, so a detached frame exists", () => {
    expect(everyStep().some(({ step }) => step.isAsync)).toBe(true);
  });

  it("offers a step over that lands somewhere", () => {
    const found = some(({ flow, stack }) =>
      [...stack.byStep.entries()].some(([stepId, info]) =>
        info.opensFrameId ? findFrameExit(flow, stack, stepId, info.opensFrameId) !== null : false,
      ),
    );
    expect(found).toBe(true);
  });

  it("offers a step out from inside a call", () => {
    const found = some(({ flow, stack }) =>
      [...stack.byStep.entries()].some(([stepId, info]) => {
        if (info.callDepth === 0) return false;
        const frameId = info.openFrameIds[info.callDepth - 1];
        return frameId ? findFrameExit(flow, stack, stepId, frameId) !== null : false;
      }),
    );
    expect(found).toBe(true);
  });
});

describe("the seeded scripts exercise every kind of branch point", () => {
  const kindsSeeded = new Set<FlowConditionKind>(
    everyStep()
      .filter(({ step }) => isConditionStep(step))
      .map(({ step }) => conditionKindOf(step)),
  );

  it("covers all six, so each reads as itself somewhere", () => {
    expect([...kindsSeeded].sort()).toEqual(["alt", "break", "critical", "loop", "opt", "par"]);
  });

  it("puts a branch point inside a thread of a parallel one", () => {
    const nested = some(({ flow, outline }) =>
      outline.rows.some((row) => {
        if (!row.branch) return false;
        const parent = flow.steps[row.branch.conditionStepId];
        const step = flow.steps[row.stepId];
        return Boolean(
          parent && step && conditionKindOf(parent) === "par" && isConditionStep(step),
        );
      }),
    );
    expect(nested).toBe(true);
  });
});

describe("the seeded scripts exercise the variables panel", () => {
  it("introduces values, consumes them, and declares a contract", () => {
    const steps = everyStep().map(({ step }) => step);
    expect({
      sets: steps.some((step) => step.context?.sets),
      reads: steps.some((step) => step.context?.reads?.length),
      expects: steps.some((step) => step.context?.expects?.trim()),
    }).toEqual({ sets: true, reads: true, expects: true });
  });

  it("declares a contract the response does not keep, in both directions", () => {
    const diffs = SEEDED.flatMap(({ flow, stack }) =>
      Object.keys(flow.steps)
        .map((stepId) => checkContract(flow, stack, stepId))
        .filter((check): check is NonNullable<typeof check> => check !== null),
    );

    expect(diffs.some((check) => check.missing.length > 0)).toBe(true);
    expect(diffs.some((check) => check.unexpected.length > 0)).toBe(true);
  });

  it("reads a key nothing sets, so the report has something to report", () => {
    const reported = SEEDED.some(({ flow, stack }) =>
      Object.keys(flow.steps).some((stepId) => {
        const path = getPathToStep(flow, stepId);
        if (path.length === 0) return false;
        return buildRunningContext(flow, stack, path).unsetReads.length > 0;
      }),
    );
    expect(reported).toBe(true);
  });

  it("carries a value out of a call that ends, into the caller that made it", () => {
    const survived = SEEDED.some(({ flow, stack }) =>
      Object.keys(flow.steps).some((stepId) => {
        const info = stack.byStep.get(stepId);
        if (!info?.closesFrameId || !flow.steps[stepId]?.context?.sets) return false;
        // A value introduced by the closing step is the one thing a frame does
        // not take with it: read one step later, it is still there.
        const after = flow.steps[stepId]?.next;
        if (!after) return false;
        const context = buildRunningContext(flow, stack, getPathToStep(flow, after));
        return Object.keys(flow.steps[stepId]!.context!.sets!).every((key) =>
          context.byKey.has(key),
        );
      }),
    );
    expect(survived).toBe(true);
  });
});

describe("the seeded scripts survive being exported", () => {
  /** The diagram each flow belongs to, since the exporter names participants. */
  const withDiagram = Object.values(SEED_US_DIAGRAMS).flatMap((diagram) =>
    Object.values(diagram.snapshot.flows ?? {}).map((flow) => ({ diagram, flow })),
  );

  it("writes every block keyword the seed uses", () => {
    const emitted = withDiagram
      .map(({ diagram, flow }) =>
        stepsToMermaid(flow, diagram.snapshot.components, diagram.snapshot.connections),
      )
      .join("\n");

    for (const keyword of ["alt", "loop", "opt", "par", "critical", "break"]) {
      expect({ keyword, present: new RegExp(`^\\s*${keyword}\\b`, "m").test(emitted) }).toEqual({
        keyword,
        present: true,
      });
    }
  });

  it("writes a separator for each kind that has one", () => {
    const emitted = withDiagram
      .map(({ diagram, flow }) =>
        stepsToMermaid(flow, diagram.snapshot.components, diagram.snapshot.connections),
      )
      .join("\n");

    for (const separator of ["else", "and", "option"]) {
      expect({ separator, present: new RegExp(`^\\s*${separator}\\b`, "m").test(emitted) }).toEqual(
        { separator, present: true },
      );
    }
  });
});

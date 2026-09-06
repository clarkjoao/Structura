import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildCallStack, buildFlowOutline } from "@/features/diagram";
import { buildRunningContext, describeContextChange, framesDroppedAt } from "./readingVariables";

/**
 * What a step did to the running object, rather than what the object holds.
 *
 * The panel showed the fold's result and nothing else, so a value set twelve
 * steps ago and one set on the line being read looked identical, and a call
 * ending took its locals away in silence. These are the two folds compared.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Criar", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

/**
 * Three nested calls, each answered, each answer leaving something behind — the
 * shape of the seeded `Criar link` script, small enough to reason about by hand.
 */
const NESTED = flow({
  s1: {
    connectionId: "c1",
    payloadDirection: "request",
    next: "s2",
    context: { sets: { slug: "artigo26", plano: "pro" } },
  },
  s2: { connectionId: "c2", payloadDirection: "request", next: "s3" },
  s3: { connectionId: "c3", payloadDirection: "request", next: "s4" },
  s4: {
    connectionId: "c3",
    payloadDirection: "response",
    next: "s5",
    context: { sets: { url_id: "u_9f2" } },
  },
  s5: {
    connectionId: "c2",
    payloadDirection: "response",
    next: "s6",
    context: { sets: { short_url: "https://url.sh/artigo26" } },
  },
  s6: {
    connectionId: "c1",
    payloadDirection: "response",
    context: { sets: { plano: "enterprise" } },
  },
});

const STACK = buildCallStack(NESTED, buildFlowOutline(NESTED));
const PATH = ["s1", "s2", "s3", "s4", "s5", "s6"];

const changeAt = (upTo: string) =>
  describeContextChange(NESTED, STACK, PATH.slice(0, PATH.indexOf(upTo) + 1));

describe("the change a step makes to the running object", () => {
  it("names the values a step introduces", () => {
    const change = changeAt("s1");

    expect(change.introduced.map((entry) => entry.key).sort()).toEqual(["plano", "slug"]);
    expect(change.replaced).toEqual([]);
    expect(change.gone).toEqual([]);
    expect(change.empty).toBe(false);
  });

  it("carries the value a step wrote over", () => {
    const change = changeAt("s6");

    expect(change.replaced).toHaveLength(1);
    expect(change.replaced[0]!.entry).toMatchObject({ key: "plano", value: "enterprise" });
    expect(change.replaced[0]!.previous).toMatchObject({ value: "pro", fromStepId: "s1" });
    expect(change.introduced).toEqual([]);
  });

  it("names the call a value left with", () => {
    const change = changeAt("s5");

    expect(change.gone).toHaveLength(1);
    // `s2` opened the call, and a frame is named by the step that opened it.
    expect(change.gone[0]!.frameId).toBe("s2");
    expect(change.gone[0]!.entries.map((entry) => entry.key)).toEqual(["url_id"]);
    // The same step introduces one of its own, on the caller's level.
    expect(change.introduced.map((entry) => entry.key)).toEqual(["short_url"]);
  });

  it("has nothing to say about a step that neither writes nor ends anything", () => {
    const change = changeAt("s2");

    expect(change.empty).toBe(true);
    expect(change).toMatchObject({ introduced: [], replaced: [], gone: [] });
  });

  it("says nothing about a reading that has not started", () => {
    expect(describeContextChange(NESTED, STACK, []).empty).toBe(true);
  });

  it("reports the step arrived at when the reading goes back", () => {
    // Walking forward past `s1` and returning to it must read as `s1` again:
    // the report is a property of the path, and going back shortens the path.
    expect(changeAt("s1")).toEqual(describeContextChange(NESTED, STACK, ["s1"]));
  });
});

describe("a value is visible on the step that ends it and absent after", () => {
  it("shows what leaves while the reading stands on the closing step", () => {
    const gone = changeAt("s5").gone.flatMap((frame) => frame.entries.map((e) => e.key));

    expect(gone).toContain("url_id");
    expect(buildRunningContext(NESTED, STACK, PATH.slice(0, 5)).byKey.has("url_id")).toBe(false);
  });

  it("has already forgotten it on the next step", () => {
    const change = changeAt("s6");

    expect(change.gone.flatMap((frame) => frame.entries.map((e) => e.key))).not.toContain("url_id");
  });
});

describe("the calls that end at a step", () => {
  it("is the one the step answers", () => {
    expect(framesDroppedAt(STACK, "s5")).toEqual(["s2"]);
  });

  it("is empty for a step that answers nothing", () => {
    expect(framesDroppedAt(STACK, "s3")).toEqual([]);
  });
});

describe("the fold a panel is authored against", () => {
  it("leaves out only the step's own values", () => {
    const withOwn = buildRunningContext(NESTED, STACK, PATH);
    const without = buildRunningContext(NESTED, STACK, PATH, "s6");

    expect(withOwn.byKey.get("plano")?.value).toBe("enterprise");
    expect(without.byKey.get("plano")?.value).toBe("pro");
    expect(without.byKey.get("slug")?.value).toBe("artigo26");
  });

  it("still drops what the step's own return takes away", () => {
    // The whole point: `short_url` lives in the frame `s6` closes. Folding the
    // path one step shorter would never run that drop and would offer it.
    const shorter = buildRunningContext(NESTED, STACK, PATH.slice(0, -1));
    const authored = buildRunningContext(NESTED, STACK, PATH, "s6");

    expect(shorter.byKey.has("short_url")).toBe(true);
    expect(authored.byKey.has("short_url")).toBe(false);
  });

  it("holds the same keys the reading holds, apart from the step's own", () => {
    for (const stepId of PATH) {
      const path = PATH.slice(0, PATH.indexOf(stepId) + 1);
      const reading = buildRunningContext(NESTED, STACK, path);
      const authored = buildRunningContext(NESTED, STACK, path, stepId);
      const own = Object.keys(NESTED.steps[stepId]?.context?.sets ?? {});

      for (const key of authored.byKey.keys()) {
        expect(reading.byKey.has(key), `${stepId}: ${key} offered but not in the reading`).toBe(
          true,
        );
      }
      for (const key of reading.byKey.keys()) {
        if (own.includes(key)) continue;
        expect(authored.byKey.has(key), `${stepId}: ${key} read but not offered`).toBe(true);
      }
    }
  });

  it("changes nothing when the step names no step to exclude", () => {
    expect(buildRunningContext(NESTED, STACK, PATH, null)).toEqual(
      buildRunningContext(NESTED, STACK, PATH),
    );
  });
});

import { describe, expect, it } from "vitest";
import { getDescriptor } from "@/features/canvas/nodes/node-types/registry";
import { hasElement, registeredElementIds } from "@/features/elements/element.registry";
import type { ComponentType } from "@/features/diagram";

/**
 * F9 performance baseline: C4 used to be last in the linear `NODE_TYPE_REGISTRY`
 * scan (`matches: () => true`). After F9 every built-in type is an O(1) map
 * lookup on the element registry.
 *
 * Numbers are reported for the slice report; the assertion only guards against
 * a catastrophic regression. The budget is a ceiling about 20x the unloaded cost, so
 * CPU contention from a parallel full run cannot trip it, while a return to a linear
 * scan (orders of magnitude slower) still does.
 */
const BUDGET_MS = 1_000;

describe("F9 resolve/hasElement lookup baseline", () => {
  const ids = registeredElementIds() as ComponentType[];
  const rounds = 2_000;

  it("hasElement over every registered id stays under budget for 2000 rounds", () => {
    const start = performance.now();
    for (let i = 0; i < rounds; i++) {
      for (const id of ids) {
        if (!hasElement(id)) throw new Error(`missing ${id}`);
      }
    }
    const elapsed = performance.now() - start;
    console.log(
      `[F9 baseline] hasElement × ${ids.length} ids × ${rounds} rounds = ${elapsed.toFixed(2)}ms`,
    );
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("getDescriptor for C4 person (was catch-all last) stays under budget for 50k calls", () => {
    const calls = 50_000;
    const start = performance.now();
    for (let i = 0; i < calls; i++) {
      getDescriptor("person");
    }
    const elapsed = performance.now() - start;
    console.log(`[F9 baseline] getDescriptor("person") × ${calls} = ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(BUDGET_MS);
    expect(getDescriptor("person").rfType).toBe("person");
  });
});

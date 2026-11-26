import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { createTestDiagramStore } from "../test-utils";

/**
 * Property-style invariants for parenting, drag-reparenting, copy/paste and
 * delete. A tiny seeded PRNG drives random panel/node trees and random
 * operation sequences; every step re-checks the structural invariants. A failure
 * names its seed so it can be replayed with `runSeed(seed)`.
 *
 * Regressions this locks in:
 * - 5cd0df8e: setParent rebases child coordinates (absolute position is kept).
 * - 5cd0df8e: a pasted child never keeps a stale parentId when its parent is also pasted.
 * - 60d51ec2 (#267): a drag may not make a panel its own parent or close a cycle.
 * - c5c03f6d: dropping an element into another panel reparents it.
 */

const SEEDS = 250;
const MAX_NODES = 40;
const MAX_DEPTH = 6;
const STEPS = 8;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, n: number) => Math.floor(rng() * n);
const pick = <T>(rng: Rng, items: T[]): T => items[int(rng, items.length)];

function setup() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Invariants", "container");
  store.getState().openDiagram(diagram.id);
  const d = () => store.getState().diagrams[diagram.id];
  return { store, d };
}
type Ctx = ReturnType<typeof setup>;

/** Absolute position from the parent chain; throws on a cycle or a dangling parent. */
function absolute(ctx: Ctx, id: string): { x: number; y: number } {
  const comps = ctx.d().snapshot.components;
  const layouts = ctx.d().nodeLayouts;
  let x = 0;
  let y = 0;
  const seen = new Set<string>();
  let cur: string | null | undefined = id;
  while (cur) {
    if (seen.has(cur)) throw new Error(`cycle through ${cur}`);
    seen.add(cur);
    if (!comps[cur]) throw new Error(`dangling parent ${cur}`);
    x += layouts[cur]?.x ?? 0;
    y += layouts[cur]?.y ?? 0;
    cur = comps[cur].parentId;
  }
  return { x, y };
}

function absMap(ctx: Ctx): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const id of Object.keys(ctx.d().snapshot.components)) out[id] = absolute(ctx, id);
  return out;
}

function descendantsOf(ctx: Ctx, id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of Object.values(ctx.d().snapshot.components)) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        grew = true;
      }
    }
  }
  return result;
}

function depthOf(ctx: Ctx, id: string): number {
  let depth = 0;
  let cur = ctx.d().snapshot.components[id]?.parentId;
  while (cur) {
    depth++;
    cur = ctx.d().snapshot.components[cur]?.parentId;
  }
  return depth;
}

function assertStructure(ctx: Ctx) {
  const comps = ctx.d().snapshot.components;
  for (const c of Object.values(comps)) {
    expect(c.parentId, `${c.id} is its own parent`).not.toBe(c.id);
    if (c.parentId) {
      expect(comps[c.parentId], `${c.id} points at missing ${c.parentId}`).toBeDefined();
      expect(comps[c.parentId].type, `${c.id} parent must be a container`).toBe("panel");
    }
    absolute(ctx, c.id); // throws on a cycle
  }
}

function buildTree(ctx: Ctx, rng: Rng) {
  const count = 2 + int(rng, MAX_NODES - 1);
  for (let i = 0; i < count; i++) {
    const type = rng() < 0.4 ? "panel" : "system";
    const c = ctx.store
      .getState()
      .addComponent(type, `N${i}`, null, { x: int(rng, 2000), y: int(rng, 2000) });
    const panels = Object.values(ctx.d().snapshot.components).filter(
      (p) => p.type === "panel" && p.id !== c.id && depthOf(ctx, p.id) < MAX_DEPTH - 1,
    );
    if (panels.length > 0 && rng() < 0.7) {
      // Parents are picked among existing nodes, never below the new one: no cycle.
      ctx.store.getState().setParent(c.id, pick(rng, panels).id);
    }
  }
}

function step(ctx: Ctx, rng: Rng, label: string[]) {
  const comps = ctx.d().snapshot.components;
  const ids = Object.keys(comps);
  if (ids.length === 0) return;
  const panels = ids.filter((id) => comps[id].type === "panel");
  const roll = rng();
  const before = absMap(ctx);
  const where = () => label.join(" > ");

  if (roll < 0.25) {
    // setParent into a target that does not close a cycle (the UI never offers one).
    const id = pick(rng, ids);
    const below = descendantsOf(ctx, id);
    const targets = panels.filter((p) => !below.has(p));
    const parentId = targets.length > 0 && rng() < 0.8 ? pick(rng, targets) : null;
    label.push(`setParent(${id}, ${parentId})`);
    ctx.store.getState().setParent(id, parentId);
    // 5cd0df8e: reparenting never moves anything on the canvas.
    expect(absMap(ctx), where()).toEqual(before);
  } else if (roll < 0.55) {
    // Drag-reparent into any panel, cycles included: the store must refuse those.
    const id = pick(rng, ids);
    const target = panels.length > 0 && rng() < 0.85 ? pick(rng, panels) : null;
    const want = { x: int(rng, 2000), y: int(rng, 2000) };
    const parentAbs = target ? before[target] : { x: 0, y: 0 };
    const subtree = descendantsOf(ctx, id);
    const closesCycle = target !== null && subtree.has(target);
    const prevParent = comps[id].parentId;
    label.push(`drag(${id} -> ${target}${closesCycle ? " [cycle]" : ""})`);
    ctx.store.getState().batchCommitNodeDrag([
      {
        nodeId: id,
        newParentId: target,
        newPosition: { x: want.x - parentAbs.x, y: want.y - parentAbs.y },
      },
    ]);
    const after = absMap(ctx);
    if (closesCycle) {
      // 60d51ec2 (#267): nothing is nested into itself or below itself.
      expect(ctx.d().snapshot.components[id].parentId, where()).toBe(prevParent);
      expect(after, where()).toEqual(before);
    } else {
      // c5c03f6d: the dropped node lands under the panel, at the dropped spot.
      expect(after[id], where()).toEqual(want);
      expect(ctx.d().snapshot.components[id].parentId ?? null, where()).toBe(target);
      for (const other of ids) {
        if (subtree.has(other)) continue;
        expect(after[other], `${where()} moved ${other}`).toEqual(before[other]);
      }
    }
  } else if (roll < 0.8) {
    const size = 1 + int(rng, Math.min(8, ids.length));
    const subset = [...ids].sort(() => rng() - 0.5).slice(0, size);
    const base = { x: int(rng, 3000), y: int(rng, 3000) };
    const preserve = rng() < 0.5;
    label.push(`paste([${subset.join(",")}], preserve=${preserve})`);
    ctx.store.getState().copyToClipboard(subset);
    const clip = ctx.store.getState().clipboard!;
    const pasted = ctx.store.getState().pasteFromClipboard(base, {
      preserveParentWhenMissing: preserve,
    });
    expect(pasted, where()).toHaveLength(clip.components.length);
    const after = ctx.d().snapshot.components;
    const newIdOf = new Map(clip.components.map((c, i) => [c.id, pasted[i]]));
    clip.components.forEach((source, i) => {
      const copy = after[pasted[i]];
      expect(copy, where()).toBeDefined();
      const parentCopy = source.parentId ? newIdOf.get(source.parentId) : undefined;
      if (parentCopy) {
        // 5cd0df8e: a pasted parent is the new parent, never the stale original.
        expect(copy.parentId, `${where()} stale parent on ${pasted[i]}`).toBe(parentCopy);
      } else if (copy.parentId) {
        expect(before[copy.parentId], where()).toBeDefined();
        expect(copy.parentId, where()).toBe(preserve ? source.parentId : undefined);
      }
      // Chains that end at the canvas root are checked at any depth; a chain ending
      // at an existing parent (preserveParentWhenMissing) is positioned inside it.
      const pastedSet = new Set(pasted);
      let top = copy;
      while (top.parentId && pastedSet.has(top.parentId)) {
        top = after[top.parentId];
      }
      if (!top.parentId) {
        const offset = clip.relativeOffsets![i];
        expect(absolute(ctx, pasted[i]), `${where()} offset of ${pasted[i]}`).toEqual({
          x: base.x + offset.dx,
          y: base.y + offset.dy,
        });
      }
    });
  } else {
    const id = pick(rng, ids);
    label.push(`remove(${id})`);
    const gone = descendantsOf(ctx, id);
    ctx.store.getState().removeComponent(id);
    for (const g of gone) expect(ctx.d().snapshot.components[g], where()).toBeUndefined();
  }
  assertStructure(ctx);
}

function runSeed(seed: number) {
  const ctx = setup();
  const rng = mulberry32(seed);
  const label: string[] = [`seed=${seed}`];
  try {
    buildTree(ctx, rng);
    assertStructure(ctx);
    for (let i = 0; i < STEPS; i++) step(ctx, rng, label);
  } catch (error) {
    if (error instanceof Error) {
      error.message = `FAILED seed=${seed}: ${error.message}\nops: ${label.join(" > ")}`;
    }
    throw error;
  }
}

describe("parenting and clipboard invariants", () => {
  // Regression (RT-030): pasting a chain panel > panel > node used to subtract the
  // parent's layout after the parent was already rebased, so the grandchild landed far off.
  it("pastes a three-level chain at its relative offsets", () => {
    const ctx = setup();
    const s = ctx.store.getState();
    const a = s.addComponent("panel", "A", null, { x: 100, y: 100 });
    const b = s.addComponent("panel", "B", null, { x: 150, y: 150 });
    const c = s.addComponent("system", "C", null, { x: 170, y: 170 });
    s.setParent(b.id, a.id);
    s.setParent(c.id, b.id);
    s.copyToClipboard([a.id, b.id, c.id]);
    const ids = ctx.store.getState().pasteFromClipboard({ x: 1000, y: 1000 });
    expect(absolute(ctx, ids[2])).toEqual({ x: 1070, y: 1070 });
  });

  it(`holds across ${SEEDS} seeded random operation sequences`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) runSeed(seed);
  });
});

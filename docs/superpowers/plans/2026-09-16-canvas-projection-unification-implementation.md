# Implementation Plan: Unify Editor and Viewer Node Projection

**Based on:** `docs/superpowers/specs/2026-09-16-canvas-projection-unification-design.md`
**Date:** 2026-09-16
**Phase:** 2 of Canvas Architecture Unification

---

## Overview

Extract shared projection logic into two new pure modules (`sortComponents`, `projectNode`) and wire them into both the editor (`useCanvasNodes`) and viewer (`projectReadDiagram`) paths. The editor's cache and write-side context remain in `useCanvasNodes`; the viewer's locked/read-only mode is controlled by a single `locked: true` flag.

**Constraints (non-negotiable):**
- `projectNode` is pure — no side effects, no store access, no write-side state
- No ELK/layout changes
- No data fetching or loading changes
- No read-mode behavior in the editor
- No drag or local-node state changes
- `computeNodeVisibility` / `zIndex` unification explicitly deferred
- Editor and viewer behavior must be byte-identical after refactor

---

## Task 1: Create sortComponents.ts

**File:** `src/features/canvas/nodes/sortComponents.ts`

### What to extract

From `useCanvasNodes.ts:391–401`:

```typescript
// Current inline sort in useCanvasNodes:
const sorted = [...visibleComponents].sort((a, b) => {
  const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
  const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
  if (aIsGroup && !bIsGroup) return -1;
  if (!aIsGroup && bIsGroup) return 1;

  const aDepth = getDepth(a, resolvedComponents);
  const bDepth = getDepth(b, resolvedComponents);
  if (aDepth !== bDepth) return aDepth - bDepth;
  return a.id.localeCompare(b.id);
});
```

### New function signature

```typescript
interface SortComponentsOptions {
  resolvedComponents: Record<string, Component>;
  collapsedPanelIds: ReadonlySet<string>;
}

export function sortComponents(
  components: Component[],
  opts: SortComponentsOptions,
): Component[]
```

### Implementation

```typescript
function getDepth(
  comp: Component,
  resolvedComponents: Record<string, Component>,
): number {
  let depth = 0;
  let current = comp;
  while (current.parentId && resolvedComponents[current.parentId]) {
    depth++;
    current = resolvedComponents[current.parentId];
  }
  return depth;
}

export function sortComponents(
  components: Component[],
  { resolvedComponents }: SortComponentsOptions,
): Component[] {
  return [...components].sort((a, b) => {
    const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
    const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;

    const aDepth = getDepth(a, resolvedComponents);
    const bDepth = getDepth(b, resolvedComponents);
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.id.localeCompare(b.id);
  });
}
```

**Note:** `collapsedPanelIds` is accepted in the interface for future use but is not used in this task — deferred per the visibility unification deferral.

### Imports needed

```typescript
import type { Component } from "@/core/domain/Diagram";
import { isPanelComponent, isApiGroupComponent } from "@/features/canvas/nodes/node-types";
```

Verify the import paths exist before committing.

---

## Task 2: Create sortComponents.test.ts

**File:** `src/features/canvas/nodes/sortComponents.test.ts`

Tests:

```typescript
import { sortComponents } from "./sortComponents";

describe("sortComponents", () => {
  it("groups panels/groups first, then sorts by depth", () => {
    // Use fixture from reference-diagrams or create minimal inline fixtures
  });

  it("produces the same order as the editor's inline sort", () => {
    // Replicate the inline sort logic in the test as the reference
    // Assert sortComponents output matches
  });

  it("sorts stable for same-depth free-floating nodes by id", () => {
    // Two free-floating nodes at depth 0: assert id order
  });

  it("handles empty input", () => {
    expect(sortComponents([], { resolvedComponents: {}, collapsedPanelIds: new Set() })).toEqual([]);
  });
});
```

Use inline fixtures (small arrays of Component objects with id, parentId, type) rather than loading external fixture files, to keep the test fast and self-contained.

---

## Task 3: Create projectNode.ts

**File:** `src/features/canvas/nodes/projectNode.ts`

### What to extract

From `useCanvasNodes.ts:391–498` (the per-component loop) and `projectReadDiagram.ts:80–150` (the `buildReadNode` function).

### ProjectNodeOptions interface

```typescript
export interface ProjectNodeOptions {
  /** Lock all interaction (viewer mode — sets draggable/selectable/connectable=false). */
  locked: boolean;
  /** Node to mark as selected (viewer click-to-focus). */
  focusedNodeId: string | null;
  /** IDs hidden by tag filter. */
  tagHiddenIds: ReadonlySet<string>;
  /** Whether compare mode is active. */
  compareMode: boolean;
  /** Opacity multiplier from compare mode, per component id. */
  compareOpacityById?: Record<string, number>;
  /** Whether playback is active (locks all interaction). */
  isPlaying: boolean;
  /** IDs of nodes that are locked (self or ancestor locked). */
  lockedNodeIds: ReadonlySet<string>;
}
```

### projectComponentToNode signature

```typescript
export function projectComponentToNode(
  component: Component,
  descriptor: NodeTypeDescriptor,
  ctx: NodeBuildContext,
  opts: ProjectNodeOptions,
): Node
```

### Implementation steps

1. **Data derivation** — call `descriptor.buildData(component, ctx)`:
   - If `opts.locked: true`, apply `lockForReading()` overlay to the returned data

2. **Style derivation** — call `descriptor.buildStyle(component, ctx)`:
   - Clone the style object (to avoid mutation)
   - Apply `selectionDimOpacity` if `opts.isPlaying`
   - Apply compare opacity: if `opts.compareMode && opts.compareOpacityById?.[component.id]`, multiply base opacity
   - Apply tag filter dimming: if `opts.tagHiddenIds.has(component.id)`, set `opacity: OPACITY_TAG_FILTER_DIM` and `pointerEvents: "none"`

3. **Node class names** — build string:
   - `"cursor-default"` if `opts.compareMode`
   - `"cursor-not-allowed"` if `opts.lockedNodeIds.has(component.id)`
   - `"node-pending"` if `ctx.pendingNodeIds` (from NodeBuildContext) has `component.id`
   - `"diffOutline"` if `opts.compareMode && ctx.compareVisualByComponentId?.[component.id]?.hasDiff`

4. **Interaction flags**:
   ```typescript
   const isCmp = descriptor.rfType === "component";
   const isReading = opts.isPlaying;

   const connectable = descriptor.connectable && !isCmp && !isReading && !opts.locked;
   const draggable = descriptor.draggable && !isCmp && !isReading && !opts.locked;
   const selectable = descriptor.selectable && !isCmp && !isReading && !opts.locked;
   ```

5. **zIndex** — use `descriptor.zIndex ?? 0` from the descriptor (NOT `computeNodeVisibility`)

6. **Position** — from `ctx.resolvedNodeLayouts[component.id]?.x ?? 0`, same for y

7. **Selection state** — if `opts.focusedNodeId === component.id`, set `data.selected = true`

8. **Return** — assemble `Node` object

### Context note

`projectComponentToNode` receives `ctx: NodeBuildContext`. For the editor path, `ctx` carries `pendingNodeIds` (from `useLLMStore`) and `compareVisualByComponentId`. For the viewer path, these are empty. Read them from `ctx` directly.

### Imports needed

```typescript
import type { Component } from "@/core/domain/Diagram";
import type { Node } from "reactflow";
import type { NodeTypeDescriptor, NodeBuildContext } from "./types";
import { lockForReading } from "./node-types/lockForReading";
```

Verify the import paths exist. Read `useCanvasNodes.ts` around line 391 to find the exact values for `OPACITY_TAG_FILTER_DIM` and `selectionDimOpacity`.

---

## Task 4: Create projectNode.test.ts

**File:** `src/features/canvas/nodes/projectNode.test.ts`

```typescript
import { projectComponentToNode } from "./projectNode";

describe("projectComponentToNode", () => {
  // Build a minimal NodeBuildContext in each test using inline fixtures

  describe("locked: true", () => {
    it("sets draggable/selectable/connectable to false", () => { ... });
    it("applies lockForReading to node data", () => { ... });
  });

  describe("locked: false", () => {
    it("passes through descriptor interaction flags when not cmp/reading", () => { ... });
    it("locks all interaction when isPlaying", () => { ... });
  });

  describe("tagHiddenIds", () => {
    it("applies OPACITY_TAG_FILTER_DIM when hidden", () => { ... });
    it("leaves opacity unchanged when not hidden", () => { ... });
  });

  describe("focusedNodeId", () => {
    it("sets selected: true on focused node", () => { ... });
    it("does not set selected on non-focused nodes", () => { ... });
  });

  describe("compareMode", () => {
    it("applies compare opacity multiplier", () => { ... });
    it("adds cursor-default class in compare mode", () => { ... });
  });
});
```

Use inline fixtures. Do not depend on external fixture files. Each test case should be self-contained.

---

## Task 5: Update projectReadDiagram.ts (viewer)

**File:** `src/features/canvas/core/projectReadDiagram.ts`

### Changes

1. **Import** `sortComponents` and `projectComponentToNode`:
   ```typescript
   import { sortComponents } from "@/features/canvas/nodes/sortComponents";
   import { projectComponentToNode } from "@/features/canvas/nodes/projectNode";
   ```

2. **Replace topological sort** (currently `sortComponentsTopologically`):
   ```typescript
   const sortedComponents = sortComponents(visibleComponents, {
     resolvedComponents,
     collapsedPanelIds: new Set(),
   });
   ```

3. **Replace `buildReadNode` inline function** with:
   ```typescript
   const lockedNodeIds = buildLockedNodeIds(resolvedComponents);

   for (const component of sortedComponents) {
     const descriptor = resolveNodeDescriptor(component);
     const node = projectComponentToNode(component, descriptor, ctx, {
       locked: true,
       focusedNodeId,
       tagHiddenIds: new Set(),
       compareMode: false,
       compareOpacityById: {},
       isPlaying: false,
       lockedNodeIds,
     });
     nodes.push(node);
   }
   ```

4. **Add `buildLockedNodeIds`** helper if not already present:
   ```typescript
   function buildLockedNodeIds(components: Record<string, Component>): ReadonlySet<string> {
     const locked = new Set<string>();
     for (const comp of Object.values(components)) {
       if (comp.locked) locked.add(comp.id);
     }
     return locked;
   }
   ```
   Check if this helper already exists in the codebase before creating it.

### No behavior change

This refactor must produce byte-identical output. After making the changes, run the existing `projectReadDiagram.test.ts` to confirm no regression.

---

## Task 6: Update useCanvasNodes.ts (editor)

**File:** `src/features/canvas/nodes/useCanvasNodes.ts`

### Changes

1. **Import** at top:
   ```typescript
   import { sortComponents } from "./sortComponents";
   import { projectComponentToNode } from "./projectNode";
   ```

2. **Replace inline sort** (around lines 391–401):
   ```typescript
   const sortedComponents = sortComponents(visibleComponents, {
     resolvedComponents,
     collapsedPanelIds,
   });
   ```

3. **Replace per-component projection loop** with `projectComponentToNode`:
   - Keep the stability cache (`prevNodeDataRef`, `prevRfNodesByIdRef`) in `useCanvasNodes`
   - Replace the `resolveNodeDescriptor` + `buildData` + `buildStyle` + dimming + className + interaction flags + Node assembly section with:
   ```typescript
   for (const comp of sortedComponents) {
     const descriptor = resolveNodeDescriptor(comp);

     const node = projectComponentToNode(comp, descriptor, ctx, {
       locked: false,
       focusedNodeId: null,
       tagHiddenIds: isNodeHiddenByTagFilter ? stableTagHiddenIds : new Set(),
       compareMode: isCompareMode,
       compareOpacityById,
       isPlaying,
       lockedNodeIds,
     });

     // [existing cache logic — DO NOT move this to projectComponentToNode]
     const prevData = prevNodeDataRef.current.get(comp.id);
     if (
       prevData &&
       shallowEqualIgnoringFunctions(node.data, prevData.data) &&
       shallowEqualStyle(node.style, prevData.style) &&
       node.position.x === prevData.position.x &&
       node.position.y === prevData.position.y
     ) {
       const prevNode = prevRfNodesByIdRef.current.get(comp.id);
       if (prevNode) {
         prevRfNodesByIdRef.current.set(comp.id, prevNode);
         nextNodesMap.set(comp.id, prevNode);
         continue;
       }
     }

     prevNodeDataRef.current.set(comp.id, {
       data: node.data,
       style: node.style,
       position: node.position,
     });
     prevRfNodesByIdRef.current.set(comp.id, node);
     nextNodesMap.set(comp.id, node);
   }
   ```

4. **Verify `lockedNodeIds`** — it should already be computed around lines 341–346. Confirm it produces the same result as `buildLockedNodeIds` before proceeding.

### Performance safety check

- Confirm `shallowEqualIgnoringFunctions` and `shallowEqualStyle` skip function equality checks
- `projectComponentToNode` must not create new object references that would fail these shallow-equal checks (especially for `data` and `style`)
- Verify the cache hit rate is unchanged after refactoring

---

## Task 7: Create editor-viewer-parity.test.ts

**File:** `src/features/canvas/nodes/editor-viewer-parity.test.ts`

Assert that when editor and viewer receive equivalent input, they produce identical node output.

Structure:
```typescript
import { projectReadDiagram } from "@/features/canvas/core/projectReadDiagram";
import { projectComponentToNode } from "@/features/canvas/nodes/projectNode";
import { resolveNodeDescriptor } from "@/features/canvas/nodes/node-types/resolveNodeDescriptor";
import { sortComponents } from "@/features/canvas/nodes/sortComponents";
import { buildReadNodeContext } from "@/features/canvas/core/buildReadNodeContext";
import type { Diagram } from "@/core/domain/Diagram";
import type { Node } from "reactflow";

describe("editor-viewer-parity", () => {
  // Load each reference-diagram fixture
  const fixtures = loadReferenceDiagrams();

  fixtures.forEach((fixture) => {
    describe(fixture.name, () => {
      // Build viewer nodes via projectReadDiagram
      const viewerResult = projectReadDiagram(fixture.diagram, null, null, null);
      const viewerNodesById = new Map(viewerResult.nodes.map((n) => [n.id, n]));

      // Build editor nodes via projectComponentToNode with minimal context
      const editorCtx = buildReadNodeContext(fixture.diagram, null, null, null);
      const sortedComponents = sortComponents(editorCtx.resolvedComponents, {
        resolvedComponents: editorCtx.resolvedComponents,
        collapsedPanelIds: new Set(),
      });
      const lockedNodeIds = new Set(
        Object.values(editorCtx.resolvedComponents).filter((c) => c.locked).map((c) => c.id),
      );

      const editorNodesById = new Map<string, Node>();
      for (const comp of sortedComponents) {
        const descriptor = resolveNodeDescriptor(comp);
        const node = projectComponentToNode(comp, descriptor, editorCtx, {
          locked: false,
          focusedNodeId: null,
          tagHiddenIds: new Set(),
          compareMode: false,
          compareOpacityById: {},
          isPlaying: false,
          lockedNodeIds,
        });
        editorNodesById.set(node.id, node);
      }

      // Assert parity for all shared node ids
      const allIds = new Set([...viewerNodesById.keys(), ...editorNodesById.keys()]);
      allIds.forEach((id) => {
        const viewerNode = viewerNodesById.get(id);
        const editorNode = editorNodesById.get(id);
        // Assert both defined
        // Assert: type, position (±1px), zIndex, style, className, draggable, selectable, connectable
      });
    });
  });

  describe("focusedNodeId parity", () => {
    it("both paths set selected:true on focused node", () => {
      // projectReadDiagram(fixture, null, null, "some-id") vs projectComponentToNode with focusedNodeId="some-id"
    });
  });
});
```

Fixture loading: Use the same pattern as `layoutForVisualization.test.ts` or load from `src/test-fixtures/reference-diagrams/`. Check what's available.

---

## Task 8: Update nodes/index.ts exports

**File:** `src/features/canvas/nodes/index.ts`

Add:
```typescript
export { sortComponents } from "./sortComponents";
export { projectComponentToNode, type ProjectNodeOptions } from "./projectNode";
```

---

## Regression Checklist

```bash
pnpm test -- sortComponents
pnpm test -- projectNode
pnpm test -- projectReadDiagram
pnpm test -- useCanvasNodes
pnpm test -- editor-viewer-parity
pnpm test
```

Additionally:
- [ ] `npm run dev` — visual smoke test
- [ ] Chrome DevTools — check for React Flow node identity warnings during drag

---

## Migration Order

| Task | File | Action | Dependency |
|------|------|--------|------------|
| 1 | `sortComponents.ts` | Create | None |
| 2 | `sortComponents.test.ts` | Create | Task 1 |
| 3 | `projectNode.ts` | Create | None |
| 4 | `projectNode.test.ts` | Create | Task 3 |
| 5 | `projectReadDiagram.ts` | Update | Tasks 1, 3 |
| 6 | Run `projectReadDiagram.test.ts` | Verify | Task 5 |
| 7 | `useCanvasNodes.ts` | Update | Tasks 1, 3, 6 |
| 8 | Run `useCanvasNodes.test.ts` | Verify | Task 7 |
| 9 | `editor-viewer-parity.test.ts` | Create | Tasks 1, 3, 5, 7 |
| 10 | `nodes/index.ts` | Update | Tasks 1, 3 |
| 11 | Full test suite | Run | All above |

---

## Acceptance Criteria

1. **`sortComponents` is a pure function** — same input always produces same output order; no side effects
2. **`projectComponentToNode` is a pure function** — same inputs always produce same `Node` output; no side effects
3. **`sortComponents.test.ts` passes** — covers groups-first, depth sort, stable id sort, empty input
4. **`projectNode.test.ts` passes** — covers locked/unlocked, tag filter, focusedNodeId, compare mode, interaction flags
5. **`projectReadDiagram.test.ts` passes** — no regression in existing viewer tests
6. **`useCanvasNodes.test.ts` passes** — no regression in existing editor tests
7. **`editor-viewer-parity.test.ts` passes** — all reference fixtures pass parity assertions
8. **Visual smoke test** — editor and viewer render identically for the same component set
9. **Drag performance** — no new React Flow re-renders during drag (stability cache intact)
10. **No new object allocations in hot path** — `projectComponentToNode` must not bypass the `useCanvasNodes` stability cache

---

## Explicitly Deferred

- **zIndex unification** — `computeNodeVisibility` (editor) vs `descriptorZIndex` (viewer) remain separate. Defer until a use case requires it.

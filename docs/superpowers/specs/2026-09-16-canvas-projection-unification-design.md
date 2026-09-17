# Design: Unify Editor and Viewer Node Projection

**Date:** 2026-09-16
**Status:** Draft
**Phase:** 2 of the Canvas Architecture Unification

---

## Context

The editor canvas (`Canvas.tsx`) and the viewer canvas (`ViewerCanvas.tsx`) both project `Diagram` → React Flow `Node[]` / `Edge[]`. They share descriptor logic (`resolveNodeDescriptor`, `buildData`, `buildStyle`) but diverge in how they orchestrate that logic: sort order, context construction, visibility computation, and caching strategy.

This creates a maintenance hazard: a change to a descriptor that affects node appearance can look correct in the viewer but not in the editor, and there is no automated guard against that divergence.

**Goal:** Both paths produce visually identical nodes from the same component input.

---

## What Does Not Change

- `ELK_OPTIONS_VISUALIZATION` and the `layoutForVisualization` fork — kept as-is; already measured and tested
- How the viewer receives its `Diagram` (still via `ViewerPage` routing, no Zustand dependency introduced)
- How the editor receives its diagram (still via Zustand diagram store)
- `layoutForVisualization`'s call in `ViewerPage` for the `?source=file` and `?diagramId=` branches
- Read-mode playback state machine (already separate and correct)

---

## What Changes

### 1. Extract `projectComponentToNode` — shared pure node builder

**File:** `src/features/canvas/nodes/projectNode.ts`

Both paths have a per-component loop that calls:
1. `resolveNodeDescriptor(component)` → descriptor
2. `descriptor.buildData(component, ctx)` → node data
3. `descriptor.buildStyle(component, ctx)` → node style
4. Apply dimming layers (playback, compare mode, tag filter)
5. Assemble `Node` object with `draggable`/`selectable`/`connectable`

Extract this into a pure function:

```typescript
interface ProjectNodeOptions {
  /** Lock all interaction (viewer mode). */
  locked: boolean;
  /** Node to mark as selected (viewer click-to-focus). */
  focusedNodeId: string | null;
  /** IDs hidden by tag filter. */
  tagHiddenIds: ReadonlySet<string>;
  /** Whether compare mode is active. */
  compareMode: boolean;
  /** Opacity multiplier from compare mode, per component id. */
  compareOpacityById?: Record<string, number>;
  /** Whether playback is active. */
  isPlaying: boolean;
  /** IDs of locked nodes (self or ancestor locked). */
  lockedNodeIds: ReadonlySet<string>;
}

export function projectComponentToNode(
  component: Component,
  descriptor: NodeTypeDescriptor,
  ctx: NodeBuildContext,
  opts: ProjectNodeOptions,
): Node
```

The function encapsulates:

- `descriptor.buildData(component, ctx)` → apply `lockForReading()` overlay when `locked: true`
- `descriptor.buildStyle(component, ctx)` → apply `selectionDimOpacity`, compare opacity, tag filter dimming
- `nodeClassNames` string (compare cursor, lock cursor, pending, diff outline)
- `draggable`/`selectable`/`connectable` — hardcoded `false` when `locked: true`, otherwise from descriptor + `isCmp`/`isReading` gates
- `zIndex` via `descriptorZIndex`

**Why a single function with an `opts.locked` flag** rather than two functions: the projection logic is identical in both modes; only the lock overlay and the interaction flags differ. A boolean flag keeps the shared surface minimal.

### 2. Extract `sortComponents` — shared sort logic

**File:** `src/features/canvas/nodes/sortComponents.ts`

Both paths sort `Component[]` → ordered `Component[]` for React Flow render order.

Current state:
- **Editor** (`useCanvasNodes.ts:391–401`): groups/panels first, then depth ascending, then free-floating
- **Viewer** (`projectReadDiagram.ts:57–74`): topological (parent before children in traversal)

Unify by extracting the editor's sort as the canonical implementation:

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

The viewer starts using `sortComponents` (passing an empty `collapsedPanelIds` set). Both paths now sort identically.

### 3. Update `projectReadDiagram` (viewer)

Refactor to use `sortComponents` and `projectComponentToNode`:

```typescript
export function projectReadDiagram(
  diagram: Diagram,
  reading: ReadDiagramReading | null,
  routePlay: ReadDiagramRoutePlay | null,
  focusedNodeId: string | null,
): { nodes: Node[]; edges: Edge[] }
```

Changes:
- Replace `sortComponentsTopologically` with `sortComponents`
- Replace `buildReadNode` inline loop with `projectComponentToNode`
- `locked: true`, `tagHiddenIds: empty set`, `compareMode: false`, `compareOpacityById: {}`
- `lockedNodeIds` derived from `resolvedComponents`

### 4. Update `useCanvasNodes` (editor)

Refactor the per-component loop to use `sortComponents` and `projectComponentToNode`:

- Replace inline sort with `sortComponents`
- Replace per-component build with `projectComponentToNode`
- Pass `locked: false`, pass actual `tagHiddenIds`, `compareMode`, `compareOpacityById`, `isPlaying`, `lockedNodeIds`

The cache (`prevNodeDataRef`, `prevRfNodesByIdRef`) stays in `useCanvasNodes` — it is specific to the editor's write-side dependencies and must not be shared with the viewer.

### 5. Add parity test

**File:** `src/features/canvas/nodes/editor-viewer-parity.test.ts`

A test that:
1. Loads a fixture diagram (the `reference-diagrams` fixtures already in the repo)
2. Calls `projectReadDiagram` to get viewer nodes
3. Calls the editor's projection logic (same component loop, same context fields but without write-side state) to get editor nodes
4. Asserts for every node id: `type`, `position` (±1px tolerance), `zIndex`, `style`, `className`, `draggable`, `selectable`, `connectable` are equal

The test uses a **shared context setup** that populates `NodeBuildContext` with identical values for both paths — no selection, no compare mode, no tag filter, no playback. This is the ground-truth case: when context is equal, output must be equal.

Secondary test: with `focusedNodeId` set on both paths, asserts the focused node gets `selected: true` in both outputs.

---

## Files Touched

| File | Action |
|---|---|
| `src/features/canvas/nodes/sortComponents.ts` | **Create** — extracted sort logic |
| `src/features/canvas/nodes/projectNode.ts` | **Create** — shared pure projection |
| `src/features/canvas/core/projectReadDiagram.ts` | **Update** — use `sortComponents` + `projectComponentToNode` |
| `src/features/canvas/nodes/useCanvasNodes.ts` | **Update** — use `sortComponents` + `projectComponentToNode` |
| `src/features/canvas/nodes/editor-viewer-parity.test.ts` | **Create** — parity assertion |
| `src/features/canvas/nodes/index.ts` | **Update** — export new modules |

---

## Context Derivation — Left Separate

The context derivation stays in each path and is not unified:

| Field | Editor (`useCanvasNodes`) | Viewer (`buildReadNodeContext`) |
|---|---|---|
| `selectedNodeId` | From `useCanvasSelectionStore` | `focusedNodeId` or `null` |
| `selectedNodeIds` | From `useCanvasSelectionStore` | `focusedNodeId` ? `{focusedNodeId}` : `{}` |
| `compareVisualByComponentId` | From `compareState` | `{}` |
| `isCompareMode` | From `compareState` | `false` |
| `dragTargetPanelId` | From `useNodeDragParenting` | `null` |
| `isNodeHiddenByTagFilter` | From `useCanvasVisualState` | Always `false` |
| `pendingNodeIds` | From `useLLMStore` | `Set()` |
| `handleDrillDown` | Real callback | `noop` |
| `updateComponent` | Real callback | `undefined` |
| `onPlayFlow` | From `canvasProps` | From `routePlay` |

These are **intentionally different**. The editor needs write-side state; the viewer needs read-only state. Forcing them to share a builder would require threading `null`/`undefined` through every call site, which is worse than the current divergence.

The parity test bypasses this by constructing a minimal context that is equal for both paths — the ground truth that the shared projection code produces identical output.

---

## Acceptance Criteria

1. `sortComponents` produces the same order as the editor's inline sort for all test fixtures
2. `projectComponentToNode` produces identical `Node` output when called with equivalent context in both paths
3. `editor-viewer-parity.test.ts` passes on all reference fixtures
4. Existing tests in `useCanvasNodes.test.ts`, `projectReadDiagram.test.ts`, and `layoutForVisualization.test.ts` all pass
5. No regressions in actual viewer/editor rendering (verified via `npm run dev` smoke test)

---

## Open Questions

- **zIndex divergence:** The editor uses `computeNodeVisibility` which derives `zIndex` from `selectedNodeIds` / `collapsedPanelIds`. The viewer uses `descriptorZIndex` which is a flat descriptor value. Since the viewer has no selection and no collapsed panels in its context, these produce the same result — but they are computed differently. Whether to unify `computeNodeVisibility` into `projectComponentToNode` is deferred: if a future use case requires the viewer to handle collapsed panels or selection, the unification happens then, not preemptively.

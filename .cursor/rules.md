# Cursor Rules — Architecture & Code Standards

## Project Context

Open source software architecture diagramming tool built with:
- React + TypeScript
- Zustand (with Immer) for global state
- React Flow (@xyflow/react) for canvas
- react-i18next for internationalization
- Tailwind CSS for styling

---

## Naming Conventions

### Variables
- No single-letter variables except `i`, `j` in loops and `x`, `y`, `z` in geometric contexts
- Hook results must use descriptive names that reflect what they represent:
```ts
  // ✅
  const flowMode = useFlowMode();
  const diagram = useActiveDiagram();
  const { isPlaying, isRecording } = useFlowMode();

  // ❌
  const m = useFlowMode();
  const d = useActiveDiagram();
```
- Discriminated state extractions must be named after what they represent:
```ts
  // ✅
  const recordingState = flowMode.mode.kind === "recording" ? flowMode.mode : null;
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;

  // ❌
  const rec = flowMode.mode.kind === "recording" ? flowMode.mode : null;
  const playing = flowMode.mode.kind === "playing" ? flowMode.mode : null;
```
- Forbidden single-letter variable names: `m`, `r`, `d`, `p`, `s`, `c`, `n`, `v`, `e` (outside catch blocks)

### Functions
- Boolean returning functions must start with `is`, `has`, `can`, `should`:
```ts
  // ✅
  function isRecording() {}
  function hasChildren() {}
  function canMoveNode() {}

  // ❌
  function recording() {}
  function children() {}
```
- Event handlers must start with `handle` (definitions) or `on` (props):
```ts
  // ✅ definition
  const handleNodeClick = () => {};
  // ✅ prop
  <Node onClick={handleNodeClick} onNodeClick={handleNodeClick} />

  // ❌
  const nodeClick = () => {};
  const clickNode = () => {};
```
- Avoid abbreviations in any context:
```ts
  // ✅
  const connection = ...;
  const component = ...;
  const diagram = ...;

  // ❌
  const conn = ...;
  const comp = ...;
  const diag = ...;
```

### Components
- Component files use PascalCase: `FlowRecorderPanel.tsx`
- Hook files use camelCase prefixed with `use`: `useCanvasNodes.ts`
- Utility files use camelCase: `scene.utils.ts`, `flow-traversal.ts`
- Type/interface files use camelCase: `diagram.types.ts`
- Constants files use camelCase: `canvas.constants.ts`

---

## React Rules

### Components
- One component per file (sub-components can live in a `components/` subfolder)
- Components over 150 lines must be decomposed into subcomponents
- No business logic inside components — extract to hooks or utils
- No direct store access inside components — always go through hooks
- Props interfaces must be explicitly typed, never inlined:
```ts
  // ✅
  interface FlowPanelProps {
    onClose: () => void;
    isCompareMode?: boolean;
  }
  const FlowPanel = ({ onClose, isCompareMode }: FlowPanelProps) => {};

  // ❌
  const FlowPanel = ({ onClose, isCompareMode }: { onClose: () => void; isCompareMode?: boolean }) => {};
```
- Optional props must have explicit defaults or be guarded before use

### Hooks
- Hooks over 100 lines should be decomposed
- Each hook has a single responsibility
- Never call hooks conditionally
- `useCallback` and `useMemo` must always have explicit dependency arrays
- `useMemo` with more than 8 dependencies must be split into smaller memos
- Derived state must be computed via `useMemo`, never stored in `useState`
```ts
  // ✅
  const isVisible = useMemo(() => selectedIds.has(node.id), [selectedIds, node.id]);

  // ❌
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => setIsVisible(selectedIds.has(node.id)), [selectedIds]);
```

### Context
- Split context into state and actions when consumers only need one or the other
- Context values that contain functions must memoize those functions with `useCallback`
- Discriminated union for mutually exclusive states:
```ts
  // ✅
  type FlowMode =
    | { kind: "idle" }
    | { kind: "playing"; flow: Flow; currentStepId: string }
    | { kind: "recording"; steps: FlowStep[] };

  // ❌ — allows invalid states
  interface FlowState {
    isPlaying: boolean;
    isRecording: boolean; // can be true simultaneously with isPlaying
  }
```

### Effects
- `useEffect` must have a single purpose
- No `useEffect` for derived state — use `useMemo`
- No `useEffect` for event handling — use event handlers
- Always return cleanup functions when subscribing to events

---

## TypeScript Rules

- No `any` — use `unknown` with type guards if type is truly unknown
- No type assertions (`as Type`) except when interfacing with untyped external libs
- Prefer type guards over assertions:
```ts
  // ✅
  if (isPanelComponent(component)) { ... }

  // ❌
  const panel = component as PanelComponent;
```
- Exported functions must have explicit return types
- Internal/private functions may infer return types
- Enums for domain values that are persisted (EdgeStyle, PanelKind, etc.)
- Union types for UI-only discriminated states

---

## Architecture Rules (Project-Specific)

### Feature Structure
```
src/features/<feature>/
├── index.ts              # public API only — never import internals directly
├── <Feature>.tsx         # top-level component
├── hooks/                # feature-private hooks
├── components/           # subcomponents
├── utils/                # pure functions
└── <feature>.types.ts    # types private to the feature
```

- Never import from another feature's internals — only from its `index.ts`
- `src/features/diagram/` is the domain layer — no React, no UI, no React Flow imports
- `src/features/canvas/` is the UI layer — bridges diagram domain to React Flow

### Store (Zustand) Rules
- Slices are pure state transformations — no side effects, no I/O, no fetch calls
- `pushHistory` must be called at the start of every undoable mutation
- Never call `pushHistory` for layout/viewport updates (not undoable by design)
- Selectors use `useShallow` when returning objects or arrays
- Never derive state inside a slice — derive in selectors or hooks
- Actions are named as verbs: `addComponent`, `removeConnection`, `updateDiagram`

### Node Type System
- New node types are added via `NodeTypeDescriptor` in `nodes/node-types/`
- Never add node type conditionals directly in `useCanvasNodes` or `Canvas.tsx`
- `c4Descriptor` must always be last in `NODE_TYPE_REGISTRY` (catch-all)

### Flow Mode (FlowModeContext)
- `playing` and `recording` are mutually exclusive — enforced by discriminated union
- Any action requiring idle state must guard with `flowMode.isIdle`
- Never check `isPlaying && isRecording` — use `!flowMode.isIdle`
- Guards for UI actions use `withFlowModeGuard` pattern (toast feedback)

### Scene / Branch Rules
- Scene mutations are blocked during playing and recording (`scenesLocked = !flowMode.isIdle`)
- FlowRecorder cannot be opened in compare mode (`isCompareMode`)
- Compare mode and active scene are mutually exclusive at the store level

### Internationalization
- No hardcoded user-facing strings — always use `t("key")`
- Translation keys use dot notation by feature: `"flowRecorder.finalize"`, `"scenes.lockedWhilePlaying"`
- New keys must be added to all locale files simultaneously
- Never use `disabled={true}` hardcoded — always derive from state

### Performance
- `resolveCanvasSnapshot` must go through `getCachedCanvasSnapshot` in selectors
- `useMemo` in `useCanvasNodes` splits static context from playback context
- `WeakMap` cache is the pattern for expensive derivations keyed by object reference

---

## Anti-patterns (Never Do)
```ts
// ❌ Single-letter variables
const m = useFlowMode();
const d = useActiveDiagram();

// ❌ Hardcoded strings
<button>Trazer para frente</button>

// ❌ disabled hardcoded
<button disabled={true}>

// ❌ Business logic in component body
const FlowPanel = () => {
  const steps = Object.values(flow.steps).filter(...).sort(...); // extract to hook/util
};

// ❌ Side effects in Zustand slices
deleteDiagram: (id) => {
  fileSystemAdapter.deleteDiagram(id); // no I/O in slices
}

// ❌ Invalid state representable
interface State {
  isPlaying: boolean;
  isRecording: boolean; // both true = invalid, use discriminated union
}

// ❌ Direct feature internals import
import { buildEdge } from "@/features/canvas/edges/edgeBuilding"; // use index.ts

// ❌ resolveCanvasSnapshot in selectors directly
const r = resolveCanvasSnapshot(diagram); // use getCachedCanvasSnapshot
```
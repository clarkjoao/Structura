# node-types — descriptor system

This folder defines the descriptor layer that turns diagram components into
React Flow node definitions.

The descriptor system has two jobs:

1. Decide which React Flow node type should render a given diagram component.
2. Build the `data`, `style`, and interaction metadata that node component
   needs at render time.

## Mental model

The pipeline looks like this:

```text
diagram component
  -> resolveNodeDescriptor(comp)
  -> descriptor.buildData(comp, ctx)
  -> descriptor.buildStyle?.(comp, ctx)
  -> React Flow node { type, data, style, ... }
```

`useCanvasNodes` is the main consumer of this system. It creates a shared
`NodeBuildContext`, resolves one descriptor per component, and uses that
descriptor to build the final React Flow node object.

## Main files

| File              | Responsibility                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`        | Defines `NodeTypeDescriptor` and the `NodeBuildContext` contract passed into every descriptor.                                                      |
| `registry.ts`     | Registers descriptors, resolves the right descriptor for each component, supports runtime registration, and exports the React Flow `nodeTypes` map. |
| `index.ts`        | Re-exports the descriptor API for canvas consumers.                                                                                                 |
| `*.descriptor.ts` | Per-node-type descriptor implementations.                                                                                                           |

## Descriptor contract

A `NodeTypeDescriptor` describes both rendering and behavior for one node type.

| Field                                                | Goal                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `rfType`                                             | The React Flow node type key used in the `nodeTypes` map.                                  |
| `component`                                          | The React component that renders this node type.                                           |
| `matches(type)`                                      | Decides whether this descriptor handles a diagram component type.                          |
| `zIndex`                                             | Default stacking order for the rendered node. Can be static or derived from the component. |
| `connectable`                                        | Whether this node can participate in edge connections.                                     |
| `canHaveParent`                                      | Whether this node can live inside a parent panel.                                          |
| `canBeParent`                                        | Whether this node can contain child nodes.                                                 |
| `buildData(comp, ctx)`                               | Builds the `data` payload consumed by the node React component.                            |
| `buildStyle(comp, ctx)`                              | Optional style builder for width, height, opacity, and other per-node visual state.        |
| `defaultSize`                                        | Optional default size used by higher-level creation logic.                                 |
| `defaultData`                                        | Optional default data for future descriptor-aware creation flows.                          |
| `draggable`, `selectable`, `focusable`, `dragHandle` | Optional React Flow behavior overrides.                                                    |

`NodeBuildContext` is intentionally broad because descriptors are allowed to
depend on current canvas state, not just component fields. For example:

- flow playback and recording overlays
- compare-mode visuals
- selection state
- service registry lookups
- handle counts and ordering
- drill-down callbacks
- panel collapse callbacks
- scene badges

## Registry behavior

`registry.ts` is the matching and export layer.

Important rules:

- Descriptors are evaluated in order.
- `c4Descriptor` must always stay last because its `matches` function returns
  `true` for everything and acts as the catch-all fallback.
- `resolveNodeDescriptor(comp)` has one special case: swimlane panels bypass the
  normal `matches` flow and are resolved directly to `swimlaneDescriptor`.
- `registerDescriptor()` inserts new descriptors just before the catch-all, so
  runtime extensions still preserve the fallback behavior.
- The exported `nodeTypes` map deduplicates by `rfType`, which means multiple
  descriptors cannot safely share the same React Flow type key.

## Built-in descriptors

| Descriptor             | Goal                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `panelDescriptor`      | Renders regular panel containers, including drag-target and collapse metadata.                                                             |
| `swimlaneDescriptor`   | Handles swimlane panels as a special panel variant with lane-specific data and layout.                                                     |
| `noteDescriptor`       | Builds sticky-note style nodes, including collapse state and inline editing hooks.                                                         |
| `apiGroupDescriptor`   | Builds API group containers and computes size from child endpoint count.                                                                   |
| `endpointDescriptor`   | Builds API endpoint nodes and wires handler-to-flow playback actions.                                                                      |
| `dbTableDescriptor`    | Builds database table nodes with editable column data and collapsed sizing rules.                                                          |
| `jsonViewerDescriptor` | Builds JSON viewer nodes with inline editing and size persistence.                                                                         |
| `svgDescriptor`        | Builds SVG-backed nodes that render imported custom artwork.                                                                               |
| `unknownDescriptor`    | Renders unknown component payloads safely when the model type is intentionally opaque.                                                     |
| `c4Descriptor`         | Catch-all descriptor for C4-style nodes and AWS nodes, including flow overlays, service metadata, journey badges, and drill-down behavior. |

## Adding a new node type

1. Create a new `*.descriptor.ts` file in this folder.
2. Implement `NodeTypeDescriptor`.
3. Add the descriptor to `NODE_TYPE_REGISTRY` before `c4Descriptor`.
4. If the new node needs a custom renderer, add the React component under
   `src/features/canvas/nodes/`.
5. Make sure the corresponding diagram component type can be distinguished by
   `matches(type)` or by a special-case resolver rule.

### Minimal descriptor example

```ts
import MyNode from "../MyNode";
import type { NodeTypeDescriptor } from "./types";

export const myDescriptor: NodeTypeDescriptor = {
  rfType: "my-type",
  component: MyNode,
  matches: (type) => type === "my-type",
  zIndex: 1,
  connectable: true,
  canHaveParent: true,
  canBeParent: false,

  buildData: (comp, _ctx) => ({
    elementId: comp.id,
    name: comp.name,
  }),
};
```

## Practical guidance

- Put shape-independent policy in the descriptor, not inside `useCanvasNodes`.
- Keep `buildData` focused on props the node renderer actually needs.
- Use `buildStyle` for derived size or visual state, especially when size
  depends on collapse state, recording state, or resolved layout.
- Reuse shared helpers when possible. For example, `buildC4Style` is exported so
  descriptors that extend C4 visuals can share the same playback and recording
  dimming logic.
- If a node behaves like a structural container, set `canBeParent` correctly so
  drag-parenting logic can respect it.

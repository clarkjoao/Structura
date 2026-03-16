# node-types — descriptor system

Each node type rendered on the canvas is described by a `NodeTypeDescriptor`.
Descriptors are registered in `registry.ts` and evaluated in order.

## Adding a new node type

1. Create `src/features/canvas/node-types/<name>.descriptor.ts` implementing `NodeTypeDescriptor`.
2. Import it in `registry.ts` and insert it **before** `c4Descriptor` in `NODE_TYPE_REGISTRY`.
3. (Optional) use `registerDescriptor` for runtime registration — it inserts before the catch-all automatically.

### Minimal descriptor example

```ts
import MyNode from "../nodes/MyNode";
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

## Important rules

- **`c4Descriptor` must always be last** — its `matches` returns `true` for every type,
  making it the catch-all fallback for person, system, container, component, and all AWS nodes.
- `buildC4Style` (exported from `c4.descriptor.ts`) can be reused by descriptors that extend
  or wrap the C4 visual style.
- `defaultSize` and `defaultData` are optional fields on `NodeTypeDescriptor` that future
  infrastructure can use without changing each descriptor individually.

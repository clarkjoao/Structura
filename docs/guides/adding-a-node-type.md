# Guide: Adding a Node Type

The honest, complete checklist for adding a component/node type today.
(Yes, it touches core files — reducing this list to "one descriptor pair" is
the goal of the component-type-extensibility work; see
[extension-points](../architecture/extension-points.md).)

## 1. Domain half (`src/features/diagram/`)

1. **Type:** add `MyComponent extends BaseComponent` with a literal `type` in
   `model/component.types.ts`; add it to the `Component` union, to
   `ComponentType`, and to `ComponentPatch`/`TypedComponentPatch`.
2. **Guard:** add `isMyComponent(c)` in `model/component.guards.ts`. All
   narrowing goes through guards — never compare `type` strings elsewhere.
3. **Defaults/constants:** default size in `model/layout.constants.ts` or the
   descriptor's `defaultSize`; creation defaults where the toolbar creates it.
4. **Persistence:** if the shape will persist (it will), decide whether old
   workspaces need a migration in `store/persist.config.ts`
   (new optional fields: usually no; changed meanings: yes + version bump).

## 2. Canvas half (`src/features/canvas/`)

5. **Renderer:** a React component under `nodes/MyNode/`. Type it as
   `NodeProps<Node<MyNodeData>>` where `MyNodeData` is a **`type` alias**
   (interfaces don't satisfy React Flow's data constraint). Render only from
   `data`; no store subscriptions inside the node.
6. **Descriptor:** `nodes/node-types/my.descriptor.ts` implementing
   `NodeTypeDescriptor` (see the
   [co-located README](../../src/features/canvas/nodes/node-types/README.md)
   for the contract and a minimal example). Put *all* per-type policy here:
   `matches`, `zIndex`, parenting flags, `buildData`, `buildStyle`.
7. **Register:** add to `NODE_TYPE_REGISTRY` **before** `c4Descriptor` (the
   catch-all must stay last). Unique `rfType`.

## 3. Surfaces

8. **Element picker/toolbar:** add a palette entry so users can create it.
9. **Inspector:** an `ElementPanel` section if it has editable fields.
10. **Export:** teach `lib/export-service/cell-builders.ts` how to render it
    in draw.io (and Mermaid/Structurizr if it maps); otherwise it exports as
    a generic box — decide deliberately.
11. **i18n:** every user-visible string via `t("key")` with entries in **both**
    `en.json` and `pt-BR.json`.

## 4. Proof

12. **Tests:** unit-test any nontrivial `buildData`/model logic; if the node
    affects layout/parenting, extend the relevant hook tests.
13. Run `npm run typecheck && npm run lint && npm run test` and exercise the
    node on the canvas: create, rename, connect, parent into a panel, undo,
    reload (persistence), export.

## Design questions to answer *before* coding

- Is it **semantic** (denotes architecture → may need service-registry /
  future model identity) or an **annotation** (decorates a diagram)? See
  [core-concepts](../concepts/core-concepts.md).
- Should it exist at all, or is it a variant of an existing type (a
  `panelKind`, a catalog entry, a template) — the union should grow slowly.
- Does it belong in core, or is it the first customer of a future diagram
  profile (VSM, Step Functions)? If the latter, write/extend a spec first.

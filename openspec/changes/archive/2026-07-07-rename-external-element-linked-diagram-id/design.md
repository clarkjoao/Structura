# Design — rename ExternalElementComponent.linkedDiagramId

## Scope boundary

The change is a **field rename** on a single interface. No
behavior changes, no public API surface changes for the C4
drill-down case, no migration of users. The migration is a
mechanical field-rename in persisted state.

## Type change

`ExternalElementComponent` (in
`features/diagram/model/component.types.ts`):

```diff
  export interface ExternalElementComponent extends BaseComponent {
    type: "external-element";
-   linkedDiagramId: string;
+   referenceDiagramId: string;
    linkedElementId?: string;
    linkedElementName?: string;
    linkedDiagramName?: string;
  }
```

`BaseComponent.linkedDiagramId` is **not** touched. It still
serves the C4 drill-down case (Level 1 → 2 → 3). After this
change the two fields have clearly distinct names and
semantics.

## Migration

`persist.config.ts` adds:

```ts
function migrateExternalElementLinkedDiagramId(state: Partial<DiagramStore>): void {
  const migrate = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      if (comp.type !== "external-element") continue;
      const ext = comp as ExternalElementComponent & Record<string, unknown>;
      if (typeof ext.linkedDiagramId === "string" && ext.referenceDiagramId === undefined) {
        ext.referenceDiagramId = ext.linkedDiagramId;
      }
      delete ext.linkedDiagramId;
    }
  };
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrate(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrate(scene.addedComponents);
    }
  }
}
```

The migration is idempotent: when a v10 workspace is re-read at
v10, `referenceDiagramId` is already present and `linkedDiagramId`
is absent, so the body of the `if` is short-circuited and the
`delete` is a no-op.

`PERSIST_SCHEMA_VERSION` bumps 9 → 10. The walkthroughs store
does not need a bump because it doesn't carry external-element
components.

## Consumer updates

- `services.slice.ts`: `linkComponentToDiagram` writes
  `referenceDiagramId` (after narrowing to
  `ExternalElementComponent`).
- `import-mermaid-flowchart.ts` and `import-mermaid-sequence.ts`:
  any code that constructs an `ExternalElementComponent`
  writes `referenceDiagramId`.
- `normalize-imported-diagram.ts`: any code that reconstructs
  components after import honors the new field name.
- `useCanvasGraphState.ts`,
  `useCanvasDiagramNavigation.ts`, `Canvas.tsx`,
  `useCanvasNodes.ts`: any read of `linkedDiagramId` is now
  type-narrowed first; for `ExternalElementComponent`
  instances the field is `referenceDiagramId`.
- `import-drawio.ts` and `export-drawio.ts`: the draw.io
  mapper for external elements uses the new field.

## Type guards

`isExternalElementComponent` (in
`features/diagram/model/component.guards.ts`) is unchanged
because the narrowing key is `type`, not the field name. Code
that needs to read the new field simply narrows first.

## Verification

A workspace saved at v9 and reopened at v10 should:

1. Migrate every `ExternalElementComponent` to have
   `referenceDiagramId` instead of `linkedDiagramId`.
2. Keep the same child Diagram reference (the string value is
   preserved).
3. Round-trip cleanly: save at v10, reload, find no
   `linkedDiagramId` field on any external-element component.
4. The C4 drill-down case (`BaseComponent.linkedDiagramId`)
   is unaffected — those fields are not touched by the
   migration.

The unit test asserts all four properties on a v9 fixture, an
empty v10 fixture, and an already-v10 fixture (idempotency).

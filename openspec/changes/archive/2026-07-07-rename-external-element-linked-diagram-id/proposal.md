## Why

`BaseComponent.linkedDiagramId` and `ExternalElementComponent.linkedDiagramId`
share the same field name but mean two different things:

- `BaseComponent.linkedDiagramId` (drill-down) — "this Component has
  a child Diagram that details it". Used by C4 Level 1 → 2 → 3
  navigation.
- `ExternalElementComponent.linkedDiagramId` (cross-diagram
  reference) — "this Component represents an element of another
  Diagram, used as a placeholder in a higher-level view". Used by
  C4 drill-up.

The same field name, two unrelated semantics. The `AGENTS.md` hard
rule says: "type guards, not raw string checks". Today any consumer
that reads `linkedDiagramId` cannot tell which semantics apply
without first narrowing the type to `ExternalElementComponent` — a
cost that is small for code that already does the narrowing, and
fatal for any code that walks the model without discrimination
(e.g. analytics, future AI features, third-party plugins). Renaming
the second occurrence to `referenceDiagramId` removes the ambiguity
at the type level. The first stays `linkedDiagramId` because that is
the field's documented C4 contract.

This change is the smaller of the two Tier-3 renames tracked in the
glossary's Appendix A. The data model is unchanged otherwise: the
migration is a field rename, byte-for-byte equivalent in shape.

## What Changes

- `ExternalElementComponent.linkedDiagramId` is renamed to
  `ExternalElementComponent.referenceDiagramId`. The shape is
  identical (a string id pointing to a Diagram).
- `BaseComponent.linkedDiagramId` is **not** renamed — it keeps its
  current name and its C4 drill-down semantics.
- A forward-only migration in `persist.config.ts` copies the
  `linkedDiagramId` value from each `ExternalElementComponent`
  into a new `referenceDiagramId` field, then drops the old
  field. The migration is idempotent: an already-migrated
  workspace is a no-op.
- Bumps `PERSIST_SCHEMA_VERSION` 9 → 10. (The diagram store itself
  does not change shape, but the field rename affects persisted
  components, so the migration lives here.)
- Type guards (`isExternalElementComponent`,
  `isExternalElementType`) are unchanged because the
  discriminated-union narrowing is on `type`, not on the field
  name.
- All consumers of the field are updated:
  - `features/diagram/store/slices/services.slice.ts`:
    `linkComponentToDiagram` writes the new field.
  - `features/diagram/utils/import-mermaid-flowchart.ts` and
    `import-mermaid-sequence.ts`: any code that constructs an
    `ExternalElementComponent` writes the new field.
  - `features/diagram/utils/normalize-imported-diagram.ts`: any
    reconstruction logic uses the new field.
  - `features/canvas/hooks/useCanvasGraphState.ts` and
    `useCanvasDiagramNavigation.ts`: canvas navigation reads the
    new field for external elements.
  - `lib/export-service/import-drawio.ts` and `export-drawio.ts`:
    draw.io import/export maps to the new field.
  - Any test fixture that builds an `ExternalElementComponent`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

_None._

## Impact

- **Domain (`features/diagram`)**:
  - `model/component.types.ts`: `ExternalElementComponent` interface
    gains `referenceDiagramId: string`; the old `linkedDiagramId`
    field is removed from this interface (it stays on
    `BaseComponent`).
  - `model/component.guards.ts`: no change.
  - `model/component-type-constants.ts`: no change.
  - `store/persist.config.ts`: add `migrateExternalElementLinkedDiagramId`
    function and call it after the existing migrations.
  - `store/slices/services.slice.ts`: `linkComponentToDiagram`
    writes `referenceDiagramId`.
  - `index.ts` of the feature: no new exports; the public API
    is shape-compatible.
- **Canvas (`features/canvas`)**:
  - `hooks/useCanvasGraphState.ts`,
    `hooks/useCanvasDiagramNavigation.ts`,
    `panels/JourneysInDiagramPanel.tsx`,
    `panels/ElementPanel/ComponentPanel.tsx`,
    `nodes/useCanvasNodes.ts`, `Canvas.tsx`: any read of
    `linkedDiagramId` is now type-narrowed first; for
    `ExternalElementComponent` instances the field is
    `referenceDiagramId`.
- **Interchange (`lib/export-service`)**:
  - `import-drawio.ts` and `export-drawio.ts`: the draw.io mapper
    for external elements reads/writes the new field.
- **Tests**:
  - Any fixture that constructs an
    `ExternalElementComponent` is updated. The migration is
    covered by a unit test: load a v9 fixture, assert the field
    is renamed and values are intact; load an already-v10
    fixture, assert idempotency.

## Non-Goals

- Not renaming `BaseComponent.linkedDiagramId`. That field is the
  documented C4 drill-down contract; renaming it would be a
  breaking change to the C4 model itself.
- Not changing the public `StructuraPlugin.*` API. Plugin authors
  who read `component.linkedDiagramId` directly (without
  narrowing) are unaffected: their code already only fires on
  the drill-down case in practice. Plugin authors who narrow
  to `ExternalElementComponent` and read `linkedDiagramId` will
  need to update to `referenceDiagramId` — this is the
  intended breaking change, and it is the entire point of the
  spec.
- Not removing the field outright. The two-field collision
  exists because the two concepts are different and both
  necessary. Removing one would lose a feature (C4 drill-down
  vs drill-up).

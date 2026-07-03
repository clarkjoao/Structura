# plugin-system Delta — Diagram read/write API (v1.1)

## ADDED Requirements

### Requirement: Diagram read access returns read-only snapshots

The API SHALL expose `getActiveDiagramId()` returning the active diagram's id (or null) and
`getDiagram(diagramId?)` returning a read-only `DiagramSnapshot` of the requested diagram
(defaulting to the active one), or null when the diagram does not exist. Snapshots SHALL be
projections (including each component's `parentId`) and SHALL NOT expose store objects; use of
these methods is declared by the `diagram:read` capability.

#### Scenario: Reading the diagram after a change notification

- **GIVEN** an active plugin subscribed via `onDiagramChange`
- **WHEN** its callback receives a diagram id and calls `api.getDiagram(diagramId)`
- **THEN** it receives a read-only snapshot reflecting the committed state, with components,
  connections and `parentId` fields, and mutating the snapshot has no effect on the diagram

#### Scenario: Unknown diagram id

- **GIVEN** an active plugin
- **WHEN** it calls `api.getDiagram("no-such-id")`
- **THEN** the call returns null and nothing throws

### Requirement: Top-level diagram mutation is whitelisted and undoable

The API SHALL expose `updateComponent(componentId, patch)` applying only whitelisted component
fields to the active diagram through the sanctioned store action (history pushed before the
mutation), and `moveComponents(moves)` applying a batch of `{ id, x, y }` position changes as a
single history step. Both are declared by the `diagram:write` capability. Non-whitelisted patch
fields SHALL be dropped; moves referencing unknown component ids SHALL be ignored without
corrupting state.

#### Scenario: Plugin field patch is undoable

- **GIVEN** an active plugin calling `api.updateComponent(id, { name: "Renamed" })`
- **WHEN** the patch is applied
- **THEN** the component is renamed on the active diagram and a single undo restores the
  previous name

#### Scenario: Batch move is one history step

- **GIVEN** an active plugin calling `api.moveComponents([{ id: a, x: 0, y: 0 }, { id: b, x: 260, y: 0 }])`
- **WHEN** the moves are applied
- **THEN** both components occupy their new positions and a single undo restores both previous
  positions

#### Scenario: Non-whitelisted fields are dropped

- **GIVEN** an active plugin calling `api.updateComponent(id, { name: "Ok", parentId: "hijack" })`
- **WHEN** the patch is applied
- **THEN** the name changes and `parentId` is unchanged

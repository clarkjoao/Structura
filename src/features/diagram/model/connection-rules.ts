import { isDbTableType, isJsonViewerType, isNoteType } from "./component-type-constants";

/**
 * Whether a connection may leave a component of this type.
 *
 * `note`, `json-viewer` and `db-table` are things a diagram points *at*: the
 * arrow runs from whatever is being described to them, and never back out.
 * They render an incoming handle and no outgoing one, and that is the design
 * rather than an omission.
 *
 * The rule lives in the domain layer, not with the canvas handle specs, because
 * the handles are not what enforces it. The UI cannot draw such a connection —
 * with no source handle there is nothing to start a drag from — so every path
 * that can create one bypasses the handles: quick insert from a selected node,
 * a generated graph, an LLM patch, a scene. They all go through the store,
 * which is why the store is where this is checked.
 *
 * What used to happen without the check: the connection was created, React Flow
 * refused to draw an edge naming a handle that does not exist (error #008), and
 * it disappeared with only a console warning — while staying in the store, in
 * every export, and in any flow that referenced it.
 *
 * `SINGLE_INCOMING_HANDLES` in `features/canvas/nodes/node-types/handle-spec.ts`
 * declares the same thing for the canvas; `handle-spec.test.ts` holds the two
 * together so they cannot drift.
 */
export function canBeConnectionSource(type: string): boolean {
  return !isNoteType(type) && !isJsonViewerType(type) && !isDbTableType(type);
}

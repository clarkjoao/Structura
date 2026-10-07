/**
 * opscr-mapping — projects an opscr workspace into a Structura technical view.
 *
 * Framework-agnostic and shared: the app, `structura-plugin-opscr` and the VSCode
 * preview consume it (plugins through `sync-shared`, as with `export-core`). It has
 * no dependency on `@/features/*`, the plugin API or the `opscr` package: callers pass
 * an `opscr/core` workspace, which satisfies `OpscrWorkspaceInput` structurally.
 */

export { buildTechnicalView, nodeId } from "./technical-view";
export { BOUNDARY_KINDS, LEAF_KINDS, PROVIDER_SERVICES, elementFor, isDrawnKind } from "./elements";
export { placeView, toLayoutGraph } from "./layout";
export { stabilizeLayout } from "./stable-layout";
export { toImporterGraph } from "./importer-graph";
export { LAYOUT_FILE, overlayLayouts, parseLayoutFile, serializeLayoutFile } from "./layout-file";
export type {
  ImporterGraph,
  ImporterGraphComponent,
  ImporterGraphConnection,
} from "./importer-graph";
export type {
  PlacedEdge,
  PlacedNode,
  PlacedView,
  ViewBox,
  ViewLayoutGraph,
  ViewLayoutResult,
} from "./layout";
export type {
  DroppedEdge,
  DroppedReason,
  OmittedManifest,
  OpscrManifestInput,
  OpscrWorkspaceInput,
  TechnicalView,
  ViewEdge,
  ViewElement,
  ViewNode,
} from "./types";

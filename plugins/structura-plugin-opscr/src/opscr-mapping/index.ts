/**
 * opscr-mapping — projects an opscr workspace into a Structura technical view.
 *
 * The opscr plugin's own library; the VSCode preview copies it (`sync-shared`). It has no
 * dependency on `@/features/*`, the plugin API or the `opscr` package: callers pass an
 * `opscr/core` workspace, which satisfies `OpscrWorkspaceInput` structurally.
 */

export { buildTechnicalView, nodeId } from "./technical-view";
export { withoutBroken } from "./broken";
export type { DiagnosticInput, WithoutBroken } from "./broken";
export {
  BOUNDARY_KINDS,
  DRAWN_KINDS,
  LEAF_KINDS,
  PROVIDER_SERVICES,
  elementFor,
  isDrawnKind,
  kindFor,
  providersFor,
} from "./elements";
export type { KindGuess } from "./elements";
export { placeView, placeViewWith } from "./layout";
export { connectionKeys, toImporterGraph } from "./importer-graph";
export { SourceIndex } from "./source-index";
export type { GraphElementRef, LocatedManifestInput, SourceLocation } from "./source-index";
export { CONFIG_FILE, isManifestName } from "./files";
export {
  LAYOUT_FILE,
  layoutFor,
  overlayLayouts,
  parseLayoutFile,
  parseLayoutFiles,
  serializeLayoutFile,
  serializeLayoutFiles,
  updateLayoutFile,
} from "./layout-file";
export type { LayoutFiles } from "./layout-file";
export { buildViewDiagram } from "./view-diagram";
export type { ResolvedViewInput } from "./view-diagram";
export {
  VISUAL_FILE,
  VISUAL_SERVICES,
  boundaryPanelKind,
  parseVisualFile,
  serviceFor,
  withVisualLayer,
} from "./visual-layer";
export type {
  DrawnThrough,
  VisualBox,
  VisualEdge,
  VisualElement,
  VisualFile,
  VisualLayerResult,
} from "./visual-layer";
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
  ViewLayoutResult,
  ViewPlacer,
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

/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

/**
 * Neutral export IR (intermediate representation).
 *
 * This is the single input contract for the draw.io/mxGraph core. It has NO
 * dependency on `@/features/*` or the plugin snapshot types: each source builds
 * an `ExportModel` in its own adapter, and the core turns it into XML. Kind is a
 * discriminated union so the core never needs domain type guards.
 */

/** Edge routing style (source enums map onto these string literals). */
export type ExportEdgeStyle =
  "smoothstep" | "step" | "bezier" | "straight" | "editable" | "editable-step";

/** Line style. */
export type ExportStrokeStyle = "solid" | "dashed" | "dotted";

/** Arrow marker at an edge end. */
export type ExportMarker = "none" | "arrow" | "arrow-closed";

/** Node kinds that map 1:1 to a cell-builder. Panels and api-groups are containers. */
export type ExportNodeKind =
  "c4" | "aws" | "panel" | "apiGroup" | "endpoint" | "dbTable" | "note" | "jsonViewer";

interface BaseNode {
  id: string;
  /** Container node id, or null at the diagram root. */
  parentId: string | null;
  x: number;
  y: number;
  /** 0 means "use the kind's default size" (kept for CSS-auto C4 nodes). */
  width: number;
  height: number;
}

export interface C4Node extends BaseNode {
  kind: "c4";
  /** Raw domain type: person, system, container, component, or a gcp/azure service type. */
  subtype: string;
  name: string;
  description: string;
  technology?: string;
  serviceId?: string;
  serviceName?: string;
}

export interface AwsNode extends BaseNode {
  kind: "aws";
  name: string;
  /** Pre-resolved mxgraph aws4 icon id (resolution lives in the adapter). */
  awsIcon: string;
}

export interface PanelNode extends BaseNode {
  kind: "panel";
  name: string;
  panelColor?: string;
}

export interface ApiGroupNode extends BaseNode {
  kind: "apiGroup";
  serviceName: string;
  basePath: string;
  protocol: string;
}

export interface EndpointNode extends BaseNode {
  kind: "endpoint";
  method: string;
  path: string;
  endpointDescription?: string;
}

export interface DbTableNode extends BaseNode {
  kind: "dbTable";
  tableName: string;
  columns: { name: string; dataType: string }[];
}

export interface NoteNode extends BaseNode {
  kind: "note";
  name: string;
  description: string;
}

export interface JsonViewerNode extends BaseNode {
  kind: "jsonViewer";
  name: string;
  jsonContent: string;
  schemaRef?: string;
}

export type ExportNode =
  | C4Node
  | AwsNode
  | PanelNode
  | ApiGroupNode
  | EndpointNode
  | DbTableNode
  | NoteNode
  | JsonViewerNode;

export interface ExportEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  technology?: string;
  /** call | event | data-flow | async-message | dependency | undefined. */
  intent?: string;
  edgeStyle: ExportEdgeStyle;
  strokeStyle: ExportStrokeStyle;
  strokeWidth: number;
  markerStart: ExportMarker;
  markerEnd: ExportMarker;
  waypoints?: { x: number; y: number }[];
}

export interface ExportModel {
  name: string;
  nodes: ExportNode[];
  edges: ExportEdge[];
}

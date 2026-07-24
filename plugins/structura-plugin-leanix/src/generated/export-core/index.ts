/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host export core (src/lib/export-core), synced via
 * `npm run sync-shared`. It is the single source of truth for draw.io
 * generation shared by the app and this plugin; edit the host files and re-sync.
 */

/**
 * export-core — framework-agnostic draw.io / mxGraph generator.
 *
 * Single source of truth for both the app export (`src/lib/export-service`) and
 * the LeanIX plugin export. It has NO dependency on `@/features/*` or the plugin
 * snapshot types: callers build an `ExportModel` in their own adapter and pass it
 * to `buildMxGraphXml`.
 */

export { buildMxGraphXml, type MxGraphWrapper } from "./build";
export type {
  ExportModel,
  ExportNode,
  ExportNodeKind,
  ExportEdge,
  ExportEdgeStyle,
  ExportStrokeStyle,
  ExportMarker,
} from "./model";

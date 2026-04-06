/**
 * Public export-service API.
 *
 * Primary entrypoints:
 * - `exportDrawio`: convert a diagram to draw.io XML.
 * - `exportJson`: serialize a diagram to Structura JSON export.
 * - `exportMermaid`: export diagram flows as Mermaid markdown.
 * - `importDrawio`: parse draw.io XML into Structura components/connections/layouts.
 */
export { exportDrawio } from "./export-drawio";
export { exportJSON as exportJson } from "./export-json";
export { exportMermaid } from "./export-mermaid";
export { parseDrawioXml as importDrawio } from "./import-drawio";

// Public utility exports used by current app consumers.
export { downloadFile, downloadZip } from "./download-file";
export type { ZipEntryFile } from "./download-file";
export { extractMxGraphModelXml } from "./export-drawio";
export { normalizeImportedDiagram } from "./normalize-imported-diagram";

/**
 * DefectDojo integration: API client, service search, and diagram import.
 */
export { DefectDojoClient } from "./defectdojo.client";
export {
  searchProducts,
  getProductTypes,
  getCurrentUser,
  buildDefectDojoProductLink,
  mapToServiceDefinition,
  DD_PRODUCT_SEARCH_FIELDS,
  type DDProductSearchField,
} from "./defectdojo.service";
export type {
  DefectDojoConfig,
  DDProduct,
  DDProductType,
  DDUser,
  DDSearchResult,
  ImportStatus,
} from "./types";
export { DefectDojoImportStatus } from "./enums";
export { DefectDojoPanel } from "./components/DefectDojoPanel";

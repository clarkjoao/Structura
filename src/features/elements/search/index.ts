export {
  catalogGroupCounts,
  createCatalogIndex,
  registryCatalogEntries,
  searchCatalog,
  type CatalogEntry,
  type CatalogGroup,
  type CatalogHit,
  type CatalogIndex,
  type CatalogInsert,
  type CatalogMatchField,
  type CatalogSearchResult,
} from "./catalog-index";
export { CATALOG_CONCEPTS, conceptTerms, type CatalogConceptId } from "./concepts";
export { findMatchRanges, fold, type MatchRange } from "./normalize";

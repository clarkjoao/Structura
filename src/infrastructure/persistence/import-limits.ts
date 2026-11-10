/**
 * Largest workspace/diagram JSON file the importer will parse, in characters of text.
 *
 * Generous on purpose (the largest real diagrams are a few MB); the cap exists so a hostile or
 * corrupt file cannot freeze the tab inside `JSON.parse` and the validators.
 */
export const MAX_WORKSPACE_IMPORT_CHARS = 25 * 1024 * 1024;

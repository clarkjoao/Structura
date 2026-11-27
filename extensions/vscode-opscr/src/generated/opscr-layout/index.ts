/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-layout, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

/**
 * opscr-layout — ELK for the opscr technical view, for the VSCode extension.
 *
 * Depends only on `elkjs` and `../opscr-mapping`, so the extension copies this folder next to
 * the mapping (`sync-shared`) and lays out in the Node extension host, for its manual arrange
 * mode. The app lays out through `features/canvas/layout`, and plugins reach that engine
 * through `api.layout` (API 1.19); this module exists only for the host that cannot.
 */
export { layoutView } from "./elk-layout";

/**
 * opscr-layout — ELK for the opscr technical view, shared like `opscr-mapping`.
 *
 * Depends only on `elkjs` and `../opscr-mapping`, so the opscr plugin and the VSCode
 * extension copy this folder next to the mapping (`sync-shared`). The app itself lays out
 * through `features/canvas/layout`; this module exists for hosts that cannot import it.
 */
export { layoutView } from "./elk-layout";

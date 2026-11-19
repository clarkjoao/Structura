/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

/**
 * The file names an opscr workspace is made of, so the importer, the document pane and the
 * VSCode preview agree on which files of a folder belong to it.
 */

/** A manifest: `*.opscr.yaml` or `*.opscr.yml`, any case. */
const MANIFEST = /\.opscr\.ya?ml$/i;

/** The workspace config beside the manifests. */
export const CONFIG_FILE = "opscr.config.yaml";

/** Whether a file name (or path) is an opscr manifest. */
export const isManifestName = (name: string): boolean => MANIFEST.test(name);

/**
 * Typed companion files that live beside the diagrams in a connected workspace.
 *
 * A sidecar is a `<id>.<type>.json` file written into the same directory as the
 * diagrams of the folder it belongs to, by a feature that has something to say
 * about those diagrams. A walkthrough is the first; the shape is deliberately
 * open so the next one costs a line here.
 *
 * The workspace scan consults this list *before opening a file*, which is what
 * keeps boot cheap — and what makes a workspace scan cleanly whether or not the
 * feature that writes these files is enabled, loaded, or still in the codebase.
 *
 * **Leave `.walkthrough.json` here even if walkthroughs are removed.** A folder
 * someone used walkthroughs in still holds those files, and taking the suffix
 * off this list would make every one of them surface as a corrupt diagram in
 * the workspace merge dialog. This list is a promise to files already written,
 * not a feature flag.
 *
 * Kept as an explicit list rather than a pattern like `/\.[a-z]+\.json$/`: a
 * diagram someone exported by hand as `my.diagram.json` would match that
 * pattern and quietly disappear from the scan. An explicit list cannot misfire.
 */
export const SIDECAR_SUFFIXES: readonly string[] = [".walkthrough.json"];

/** Whether the workspace scan should skip this file rather than read it as a diagram. */
export function isSidecarFileName(name: string): boolean {
  return SIDECAR_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** The file name a sidecar of this type takes for the given item id. */
export function sidecarFileName(id: string, suffix: string): string {
  return `${id}${suffix}`;
}

/** The item id a sidecar file name carries, or null if the name is not one. */
export function sidecarIdFromFileName(name: string, suffix: string): string | null {
  if (!name.endsWith(suffix)) return null;
  const id = name.slice(0, -suffix.length);
  return id.length > 0 ? id : null;
}

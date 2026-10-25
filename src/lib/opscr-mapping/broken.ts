import type { LocatedManifestInput } from "./source-index";

/** What the projection reads of an opscr diagnostic. */
export interface DiagnosticInput {
  severity: string;
  file?: string;
  line?: number;
}

export interface WithoutBroken<M> {
  manifests: M[];
  /** `Kind/name` of each manifest left out for an error in it. */
  broken: string[];
}

/**
 * The manifests minus the elements opscr reports an error in, so one broken element does not stop
 * the whole drawing: the element manifest an error line falls in is left out, and edges to it are
 * not drawn, as for any missing end. A Relationship is kept whatever its errors — one bad edge
 * must not take the others with it, and an edge the drawing cannot follow is already dropped
 * (`TechnicalView.dropped`). Errors that name no file and line leave the manifests as they are.
 */
export function withoutBroken<M extends LocatedManifestInput>(
  manifests: readonly M[],
  diagnostics: readonly DiagnosticInput[],
): WithoutBroken<M> {
  const broken = new Set<M>();
  for (const d of diagnostics) {
    if (d.severity !== "error" || d.file === undefined || d.line === undefined) continue;
    // The manifest a line falls in: the last one of its file that starts at or before it.
    let owner: M | undefined;
    for (const m of manifests) {
      if (m.sourceFile === d.file && m.line <= d.line && (!owner || m.line > owner.line)) owner = m;
    }
    if (owner && owner.kind !== "Relationship" && owner.edgeLines.size === 0) broken.add(owner);
  }
  return {
    manifests: manifests.filter((m) => !broken.has(m)),
    broken: [...broken].map((m) => `${m.kind}/${m.metadata.name}`),
  };
}

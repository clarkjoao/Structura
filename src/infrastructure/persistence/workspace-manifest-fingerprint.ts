/**
 * Stable fingerprint for manifest *content* (excludes timestamps) so we can
 * skip rewriting structura-manifest.json when nothing semantic changed.
 */
export function manifestSemanticFingerprint(args: {
  diagramIds: string[];
  services: unknown;
  folders: unknown;
  activeDiagramId: string | null;
  elementPresets: unknown;
  iconLibrary: unknown;
}): string {
  return JSON.stringify({
    diagramIds: [...args.diagramIds].sort(),
    services: args.services,
    folders: args.folders,
    activeDiagramId: args.activeDiagramId,
    elementPresets: args.elementPresets,
    iconLibrary: args.iconLibrary,
  });
}

/**
 * Stable fingerprint for manifest *content* (excludes timestamps) so we can
 * skip rewriting structura-manifest.json when nothing semantic changed.
 */
export function manifestSemanticFingerprint(args: {
  diagramIds: string[];
  serviceRegistry: unknown;
  folders: unknown;
  activeDiagramId: string | null;
  customComponentTemplates: unknown;
  iconLibrary: unknown;
}): string {
  return JSON.stringify({
    diagramIds: [...args.diagramIds].sort(),
    serviceRegistry: args.serviceRegistry,
    folders: args.folders,
    activeDiagramId: args.activeDiagramId,
    customComponentTemplates: args.customComponentTemplates,
    iconLibrary: args.iconLibrary,
  });
}

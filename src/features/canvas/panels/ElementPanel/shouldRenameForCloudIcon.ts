/**
 * Decide whether changing the cloud icon catalog entry should also rename the node.
 *
 * Nodes linked to a business catalog service (`serviceId`) keep name/description —
 * only `cloudServiceId` (the icon) updates.
 *
 * @example
 * shouldRenameForCloudIcon({
 *   hasCloudCatalogEntry: true,
 *   businessServiceId: "svc-pay",
 *   currentName: "Payments",
 *   defaultNamePrefix: "New",
 * }) // → false
 */
export function shouldRenameForCloudIcon(params: {
  hasCloudCatalogEntry: boolean;
  businessServiceId: string | undefined | null;
  currentName: string;
  defaultNamePrefix: string;
}): boolean {
  if (!params.hasCloudCatalogEntry) return false;
  if (params.businessServiceId) return false;
  const name = params.currentName.trim();
  if (name.length === 0) return true;
  return name.startsWith(params.defaultNamePrefix);
}

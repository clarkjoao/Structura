import type { IconResolver } from "@/features/cloud/model/cloud.types";
import type { CloudFamilyId } from "./cloud-family.types";

/**
 * Icon resolvers remembered when a cloud family is materialised.
 *
 * `palette.icon: { kind: "family", iconName }` needs a family → resolver
 * lookup; this map is that lookup. Populated by `buildCloudFamilyDescriptors`
 * so `CloudFamilyDefinition.icons` has a reader in the same commit that
 * introduces the field.
 */
const familyIconResolvers = new Map<CloudFamilyId, IconResolver>();

/** Stores the resolver the family's descriptors will resolve icons through. */
export function rememberFamilyIconResolver(familyId: CloudFamilyId, resolver: IconResolver): void {
  familyIconResolvers.set(familyId, resolver);
}

/** The resolver a `palette.icon` of `{ kind: "family" }` resolves through. */
export function iconResolverForFamily(familyId: string): IconResolver | undefined {
  return familyIconResolvers.get(familyId as CloudFamilyId);
}

/** Test-only: drop remembered resolvers between cases. */
export function clearFamilyIconResolvers(): void {
  familyIconResolvers.clear();
}

import { describe, expect, it } from "vitest";
import { AWS_CATEGORIES, AWS_CATEGORY_IDS } from "@/features/cloud/providers/aws/aws.catalog";
import {
  AZURE_CATEGORIES,
  AZURE_CATEGORY_IDS,
} from "@/features/cloud/providers/azure/azure.catalog";
import { GCP_CATEGORIES, GCP_CATEGORY_IDS } from "@/features/cloud/providers/gcp/gcp.catalog";
import { K8S_CATEGORIES, K8S_CATEGORY_IDS } from "@/features/elements/families/k8s/k8s.catalog";
import { OSS_CATEGORIES, OSS_CATEGORY_IDS } from "@/features/elements/families/oss/oss.catalog";
import { builtinPacks } from "./builtin-packs";
import snapshot from "./__fixtures__/legacy-catalog.snapshot.json";

/**
 * The five families moved from TypeScript catalogs to packs with their persisted ids intact.
 *
 * `legacy-catalog.snapshot.json` is the catalog as it was in TypeScript before the move
 * (categories, services, icon names, concepts, in order). The packs must keep all of it: a
 * dropped, renamed or reordered entry is a saved diagram that no longer finds its icon, or a
 * palette that changed under the user. Adding services is free — the snapshot is a floor, not a
 * copy, so a new service is a pack edit only.
 */
const FAMILIES = {
  aws: { ids: AWS_CATEGORY_IDS, catalog: AWS_CATEGORIES },
  gcp: { ids: GCP_CATEGORY_IDS, catalog: GCP_CATEGORIES },
  azure: { ids: AZURE_CATEGORY_IDS, catalog: AZURE_CATEGORIES },
  k8s: { ids: K8S_CATEGORY_IDS, catalog: K8S_CATEGORIES },
  oss: { ids: OSS_CATEGORY_IDS, catalog: OSS_CATEGORIES },
} as const;

describe("legacy families as packs", () => {
  const packs = new Map(builtinPacks().map(({ pack }) => [pack.id, pack]));

  for (const [familyId, { ids, catalog }] of Object.entries(FAMILIES)) {
    describe(familyId, () => {
      const pack = packs.get(familyId)!;

      it("keeps its type ids verbatim and in its TS id list, both ways", () => {
        expect(pack.typeIds).toBe("verbatim");
        expect(pack.categories.map((category) => category.id).sort()).toEqual([...ids].sort());
      });

      it("keeps every entry of the pre-migration catalog, in order", () => {
        const before = snapshot[familyId as keyof typeof snapshot].categories;
        const after = pack.categories.map((category) => ({
          id: category.id,
          name: category.vendorName ?? category.label.en,
          services: pack.services
            .filter((service) => service.category === category.id)
            .map((service) => ({
              id: service.id,
              name: service.name,
              iconName: service.icon,
              concepts: service.concepts ?? [],
            })),
        }));
        // Every category of before, in order, each holding before's services in order.
        const kept = after.filter((category) => before.some((b) => b.id === category.id));
        expect(kept.map((category) => category.id)).toEqual(before.map((b) => b.id));
        before.forEach((category, index) => {
          const { services, ...rest } = kept[index];
          expect(rest, category.id).toEqual({ id: category.id, name: category.name });
          const beforeIds = new Set(category.services.map((service) => service.id));
          expect(
            services.filter((service) => beforeIds.has(service.id)),
            category.id,
          ).toEqual(category.services);
        });
      });

      it("keeps its TS catalog view equal to the pack", () => {
        expect(
          catalog.map((category) => ({
            id: category.id,
            services: category.services.map((service) => service.id),
          })),
        ).toEqual(
          pack.categories.map((category) => ({
            id: category.id,
            services: pack.services
              .filter((service) => service.category === category.id)
              .map((service) => service.id),
          })),
        );
      });
    });
  }
});

import { awsPack, awsPackAdapter } from "../families/aws/aws.family";
import { azurePack, azurePackAdapter } from "../families/azure/azure.family";
import { gcpPack, gcpPackAdapter } from "../families/gcp/gcp.family";
import { k8sPack, k8sPackAdapter, k8sPackIcons } from "../families/k8s/k8s.family";
import { ossPack, ossPackAdapter, ossPackIcons } from "../families/oss/oss.family";
import { isRegisteredCloudFamily } from "../families/cloud-family.registry";
import { allElements } from "../element.registry";
import type { PackAdapter } from "./pack.adapter";
import { builtinPackIcons, type PackIconSource } from "./pack.icons";
import { registerElementPack } from "./pack.loader";
import { parsePack, type ElementPack } from "./pack.schema";

/**
 * The packs that ship with Structura, found on disk: every `packs/<id>/pack.json`, with the
 * SVGs in `packs/<id>/icons/`. Adding a pack, a category, a service or a shape is a JSON edit
 * and an SVG — nothing here changes.
 *
 * The five families whose type ids predate packs (`aws-compute`, …) carry an adapter for what
 * is not data and register first, in their historical order, which is also the catalog's
 * group order.
 */

export interface BuiltinPack {
  pack: ElementPack;
  adapter?: PackAdapter;
  icons?: ReadonlyMap<string, PackIconSource>;
}

const LEGACY_PACKS: readonly BuiltinPack[] = [
  { pack: awsPack, adapter: awsPackAdapter },
  { pack: gcpPack, adapter: gcpPackAdapter },
  { pack: azurePack, adapter: azurePackAdapter },
  { pack: k8sPack, adapter: k8sPackAdapter, icons: k8sPackIcons },
  { pack: ossPack, adapter: ossPackAdapter, icons: ossPackIcons },
];

const discovered = import.meta.glob<unknown>("./*/pack.json", { eager: true, import: "default" });

/** Every built-in pack, legacy families first, then the rest by id. */
export function builtinPacks(): BuiltinPack[] {
  const legacyIds = new Set(LEGACY_PACKS.map(({ pack }) => pack.id));
  const others = Object.entries(discovered)
    .map(([file, raw]) => ({ file, pack: parsePack(raw, `built-in pack ${file}`) }))
    .filter(({ pack }) => !legacyIds.has(pack.id))
    .sort((a, b) => a.pack.id.localeCompare(b.pack.id))
    .map(({ file, pack }) => {
      const folder = file.split("/")[1];
      if (folder !== pack.id) {
        throw new Error(
          `[element-packs] ${file} declares id "${pack.id}"; it must match its folder.`,
        );
      }
      return { pack, icons: builtinPackIcons(pack.id) };
    });
  return [...LEGACY_PACKS, ...others];
}

/** Registers every built-in pack once (idempotent: tests evaluate bootstrap more than once). */
export function registerBuiltinPacks(): void {
  for (const { pack, adapter, icons } of builtinPacks()) {
    const registered =
      isRegisteredCloudFamily(pack.id) ||
      (pack.categories.length === 0 && allElements().some((el) => el.family === pack.id));
    if (!registered) registerElementPack(pack, { adapter, icons });
  }
}

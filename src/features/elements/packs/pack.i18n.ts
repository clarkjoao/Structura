import i18n from "@/infrastructure/i18n/i18n";
import {
  PACK_LOCALES,
  type ElementPack,
  type LocalizedPackText,
  type PackLocale,
} from "./pack.schema";

/**
 * Pack strings as i18n keys, so every reader keeps calling `t()`.
 *
 * Keys sit where the hand-written families kept theirs — `elements.<packId>.categories.<id>.*`
 * — so the migrated families' keys did not move. Two i18next details shape this module:
 *
 * - A lazily loaded locale replaces the namespace's top level (shallow merge), which would drop
 *   `elements.*` pack keys added before it arrived; so bundles are re-applied on `loaded`.
 * - Adding to a locale that is not loaded yet makes `hasResourceBundle` true, and the app then
 *   skips fetching that locale; so bundles go only into locales already loaded.
 */

export const packKeys = {
  label: (packId: string) => `elements.${packId}.label`,
  /** The LLM catalog's family heading (`component-catalog.ts`), for packs with shapes. */
  familyLabel: (packId: string) => `elements.families.${packId}.label`,
  group: (packId: string) => `elementCatalog.groups.${packId}`,
  categoryLabel: (packId: string, id: string) => `elements.${packId}.categories.${id}.label`,
  categoryDescription: (packId: string, id: string) =>
    `elements.${packId}.categories.${id}.description`,
  serviceDescription: (packId: string, id: string) =>
    `elements.${packId}.services.${id}.description`,
  shapeLabel: (packId: string, id: string) => `elements.${packId}.shapes.${id}.label`,
  shapeDescription: (packId: string, id: string) => `elements.${packId}.shapes.${id}.description`,
};

type Bundle = Record<string, unknown>;

function setPath(target: Bundle, key: string, value: string): void {
  const segments = key.split(".");
  let node = target;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (typeof next === "object" && next !== null) {
      node = next as Bundle;
    } else {
      const created: Bundle = {};
      node[segment] = created;
      node = created;
    }
  }
  node[segments[segments.length - 1]] = value;
}

function bundleFor(pack: ElementPack, locale: PackLocale): Bundle {
  const bundle: Bundle = {};
  const put = (key: string, value: LocalizedPackText | undefined) => {
    if (value) setPath(bundle, key, value[locale]);
  };
  put(packKeys.label(pack.id), pack.label);
  put(packKeys.familyLabel(pack.id), pack.label);
  put(packKeys.group(pack.id), pack.groupLabel ?? pack.label);
  for (const category of pack.categories) {
    put(packKeys.categoryLabel(pack.id, category.id), category.label);
    put(packKeys.categoryDescription(pack.id, category.id), category.description);
  }
  for (const service of pack.services) {
    put(packKeys.serviceDescription(pack.id, service.id), service.description);
  }
  for (const shape of pack.shapes) {
    put(packKeys.shapeLabel(pack.id, shape.id), shape.label);
    put(packKeys.shapeDescription(pack.id, shape.id), shape.description ?? shape.label);
  }
  return bundle;
}

const bundles = new Map<string, Record<PackLocale, Bundle>>();

function applyTo(locale: string): void {
  if (!(PACK_LOCALES as readonly string[]).includes(locale)) return;
  if (!i18n.hasResourceBundle(locale, "translation")) return;
  for (const perLocale of bundles.values()) {
    // deep + overwrite: merges into `elements.*` without touching the locale's other keys.
    i18n.addResourceBundle(locale, "translation", perLocale[locale as PackLocale], true, true);
  }
}

let listening = false;
function listen(): void {
  if (listening) return;
  listening = true;
  i18n.on("loaded", (loaded: Record<string, unknown>) => {
    for (const locale of Object.keys(loaded)) applyTo(locale);
  });
}

/** Makes a pack's strings resolvable now and in every locale loaded later. */
export function addPackStrings(pack: ElementPack): void {
  bundles.set(pack.id, { en: bundleFor(pack, "en"), "pt-BR": bundleFor(pack, "pt-BR") });
  listen();
  for (const locale of PACK_LOCALES) applyTo(locale);
}

/** Drops a pack's strings (plugin packs only; built-in packs are never removed). */
export function removePackStrings(pack: ElementPack): void {
  if (!bundles.delete(pack.id)) return;
  for (const locale of PACK_LOCALES) {
    if (!i18n.hasResourceBundle(locale, "translation")) continue;
    const elements = i18n.getResource(locale, "translation", "elements") as Bundle | undefined;
    if (elements) delete elements[pack.id];
    const families = elements?.families;
    if (typeof families === "object" && families !== null) delete (families as Bundle)[pack.id];
    const groups = i18n.getResource(locale, "translation", "elementCatalog.groups") as
      Bundle | undefined;
    if (groups) delete groups[pack.id];
  }
}

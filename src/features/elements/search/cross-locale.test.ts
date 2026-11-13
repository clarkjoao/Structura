import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import { registryCatalog } from "@/features/canvas/catalog/toolbarTools";
import { createCatalogIndex, registryCatalogEntries, searchCatalog } from "./catalog-index";
import { conceptTerms, loadedLocalesKey } from "./concepts";

/**
 * Catalog search is cross-locale by design (see `concepts.ts`): a pt-BR user typing
 * "queue" finds SQS. Locales load on demand, so before the second bundle arrives the
 * index has no terms of that language; the index consumers key on `loadedLocalesKey()`
 * to rebuild once it lands.
 */
describe("cross-locale search with lazily loaded bundles", () => {
  const enBundle = i18n.getResourceBundle("en", "translation");

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR");
    if (!i18n.hasResourceBundle("en", "translation")) {
      i18n.addResourceBundle("en", "translation", enBundle);
    }
  });

  function build() {
    const { groups, entries } = registryCatalogEntries();
    return createCatalogIndex(groups, entries);
  }

  it("changes the loaded-locales key when a bundle arrives", () => {
    const withBoth = loadedLocalesKey();
    i18n.removeResourceBundle("en", "translation");
    const withoutEn = loadedLocalesKey();
    expect(withoutEn).not.toBe(withBoth);
    i18n.addResourceBundle("en", "translation", enBundle);
    expect(loadedLocalesKey()).toBe(withBoth);
  });

  it("finds the other language only after its bundle is loaded and the index rebuilt", async () => {
    await i18n.changeLanguage("pt-BR");
    i18n.removeResourceBundle("en", "translation");
    expect(conceptTerms("queue")).not.toContain("queue");
    const before = build();
    const tagHits = (index: ReturnType<typeof build>) =>
      searchCatalog(index, "queue").hits.filter((hit) => hit.matchedOn === "tag");
    expect(tagHits(before)).toHaveLength(0);

    i18n.addResourceBundle("en", "translation", enBundle);
    expect(conceptTerms("queue")).toContain("queue");
    const after = build();
    expect(tagHits(after).length).toBeGreaterThan(0);
  });

  it("refreshes the toolbar's cached catalog when a bundle arrives", async () => {
    await i18n.changeLanguage("pt-BR");
    i18n.removeResourceBundle("en", "translation");
    const first = registryCatalog();
    expect(registryCatalog()).toBe(first);
    i18n.addResourceBundle("en", "translation", enBundle);
    expect(registryCatalog()).not.toBe(first);
  });
});

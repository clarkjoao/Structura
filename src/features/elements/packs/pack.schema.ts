import { z } from "zod";
import { CATALOG_CONCEPTS } from "../search/concepts";

/**
 * The element-pack format: a family's categories, services and shapes as data.
 *
 * A pack is what a developer writes to add catalog content (`packs/<id>/pack.json`) and what a
 * plugin hands to `registerElementPack`. Everything a registered element needs that is *data*
 * lives here; what is behaviour (an npm icon set, a native draw.io export) is a `PackAdapter`.
 * See `docs/architecture/element-registry.md#element-packs`.
 */

/** Families whose type ids were persisted before packs existed, so they keep them verbatim. */
const LEGACY_VERBATIM_PACK_IDS: readonly string[] = ["aws", "gcp", "azure", "k8s", "oss"];

const LOCALES = ["en", "pt-BR"] as const;
export type PackLocale = (typeof LOCALES)[number];

const ID = /^[a-z0-9][a-z0-9-]*$/;
/** HSL triplet as the CSS tokens store it (`30 100% 50%`), or a hex colour. */
const HSL_TRIPLET = /^\d{1,3}(\.\d+)? \d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Only path commands and numbers: an outline can carry no markup, script or URL. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const VIEW_BOX = /^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/;

const id = z.string().regex(ID, "must be lowercase letters, digits and dashes");
const text = z.string().trim().min(1);
const localized = z.object({ en: text, "pt-BR": text }, { error: "needs both en and pt-BR" });
const color = z
  .string()
  .refine((value) => HSL_TRIPLET.test(value) || HEX.test(value), "must be `H S% L%` or a hex");
const concept = z.enum(CATALOG_CONCEPTS);

const accentSchema = z.object({ light: color, dark: color.optional() });

const categorySchema = z.object({
  id,
  label: localized,
  /**
   * The provider's own name for the category ("Networking & Content Delivery"), where the
   * vendor taxonomy is what a reader expects (the AWS icon picker, the LLM's IR prompt).
   * Not translated; the English label when absent.
   */
  vendorName: text.optional(),
  description: localized,
  accent: accentSchema,
});

const serviceSchema = z.object({
  /** Catalog service ids are persisted as written, so they keep their own shape (`s3-glacier`). */
  id: z.string().trim().min(1),
  name: text,
  category: id,
  icon: z.string().trim().min(1),
  description: localized.optional(),
  concepts: z.array(concept).optional(),
  searchKeys: z.array(text).optional(),
});

const shapeSchema = z.object({
  id,
  label: localized,
  description: localized.optional(),
  viewBox: z.string().regex(VIEW_BOX, "must be four numbers: `minX minY width height`"),
  paths: z.array(z.string().regex(PATH_DATA, "may only hold SVG path commands and numbers")).min(1),
  size: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
  searchKeys: z.array(text).optional(),
});

const packSchema = z
  .object({
    id,
    /** `namespaced` (default): types are `<packId>/<id>`. `verbatim`: legacy families only. */
    typeIds: z.enum(["namespaced", "verbatim"]).default("namespaced"),
    label: localized,
    /** Catalog group heading; the label when absent. */
    groupLabel: localized.optional(),
    categories: z.array(categorySchema).default([]),
    services: z.array(serviceSchema).default([]),
    shapes: z.array(shapeSchema).default([]),
    primaryCategories: z.array(id).optional(),
    spotlightServices: z.array(z.string()).optional(),
    preferredServiceByConcept: z.partialRecord(concept, z.string()).optional(),
  })
  .superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (pack.categories.length === 0 && pack.shapes.length === 0) {
      issue([], "needs at least one category or shape");
    }
    if (pack.typeIds === "verbatim" && !LEGACY_VERBATIM_PACK_IDS.includes(pack.id)) {
      issue(["typeIds"], `"verbatim" is reserved for ${LEGACY_VERBATIM_PACK_IDS.join(", ")}`);
    }

    const categoryIds = new Set<string>();
    pack.categories.forEach((category, index) => {
      if (categoryIds.has(category.id)) issue(["categories", index, "id"], "is a duplicate");
      categoryIds.add(category.id);
    });
    const shapeIds = new Set<string>();
    pack.shapes.forEach((shape, index) => {
      if (shapeIds.has(shape.id) || categoryIds.has(shape.id)) {
        issue(["shapes", index, "id"], "is a duplicate of another category or shape");
      }
      shapeIds.add(shape.id);
    });
    // A family may list one service under two categories (AWS has ECS in compute and in
    // containers), so the pair is what must be unique.
    const servicePairs = new Set<string>();
    pack.services.forEach((service, index) => {
      if (!categoryIds.has(service.category)) {
        issue(
          ["services", index, "category"],
          `service "${service.id}" references unknown category "${service.category}"`,
        );
      }
      const pair = `${service.category}|${service.id}`;
      if (servicePairs.has(pair)) issue(["services", index, "id"], "is a duplicate");
      servicePairs.add(pair);
    });
    const serviceIds = new Set(pack.services.map((service) => service.id));
    pack.primaryCategories?.forEach((categoryId, index) => {
      if (!categoryIds.has(categoryId)) issue(["primaryCategories", index], "unknown category");
    });
    pack.spotlightServices?.forEach((serviceId, index) => {
      if (!serviceIds.has(serviceId)) issue(["spotlightServices", index], "unknown service");
    });
    for (const [conceptId, serviceId] of Object.entries(pack.preferredServiceByConcept ?? {})) {
      if (serviceId && !serviceIds.has(serviceId)) {
        issue(["preferredServiceByConcept", conceptId], `unknown service "${serviceId}"`);
      }
    }
  });

export type ElementPack = z.output<typeof packSchema>;
export type PackCategory = ElementPack["categories"][number];
export type PackService = ElementPack["services"][number];
export type PackShape = ElementPack["shapes"][number];
export type LocalizedPackText = PackCategory["label"];

/**
 * Validates a pack and returns it typed, or throws one error listing every problem with its
 * path — a broken pack is a programming error, caught by the built-in pack test or at plugin
 * registration, never a half-registered family.
 */
export function parsePack(raw: unknown, source = "pack"): ElementPack {
  const result = packSchema.safeParse(raw);
  if (result.success) return result.data;
  const packId =
    typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
      ? raw.id
      : "?";
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(pack)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`[element-packs] Invalid ${source} "${packId}":\n${problems}`);
}

/** The element type id a pack entry registers as. */
export function packTypeId(pack: Pick<ElementPack, "id" | "typeIds">, localId: string): string {
  return pack.typeIds === "verbatim" ? localId : `${pack.id}/${localId}`;
}

/** `H S% L%` for a colour written as a triplet or a hex. */
export function toHslTriplet(value: string): string {
  if (HSL_TRIPLET.test(value)) return value;
  let hex = value.slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const PACK_LOCALES = LOCALES;

import { allElements } from "@/features/elements/element.registry";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";
import i18n from "@/infrastructure/i18n";
import { PATTERNS, PATTERN_CATEGORIES } from "@/lib/catalogs/patterns";

/** The catalog is part of the system prompt, which is written in English. */
const CATALOG_LOCALE = "en";

export interface ComponentTypeDefinition {
  nodeType: string;
  displayName: string;
  description: string;
  awsService?: string;
  requiredFields?: string[];
  example?: string;
}

export const STRUCTURAL_TYPES: ComponentTypeDefinition[] = [];

/**
 * @deprecated F9 — C4 lives on the element registry (`c4RegisteredTypes`).
 * Kept as an empty array so older imports that spread it stay safe.
 */
export const C4_TYPES: ComponentTypeDefinition[] = [];

/**
 * Registered elements, as catalog entries.
 *
 * Derived rather than curated (decision 7): an element that exists is an
 * element the model can ask for, and its description is the one the palette
 * shows. Resolved in English because the catalog is part of the system prompt,
 * whatever locale the UI is in.
 */
export function registeredElementTypes(): ComponentTypeDefinition[] {
  // Cloud families publish a compact catalog of their own; listing every
  // category here would duplicate them under "Structural & Canvas" without
  // service ids. C4 has its own section below (`c4RegisteredTypes`).
  return allElements()
    .filter((element) => element.family === "structural")
    .map((element) => ({
      nodeType: element.id,
      displayName: i18n.t(element.labelKey, { lng: CATALOG_LOCALE }),
      description: i18n.t(element.descriptionKey, { lng: CATALOG_LOCALE }),
      requiredFields: element.model.requiredFields ? [...element.model.requiredFields] : undefined,
      example: JSON.stringify({ nodeType: element.id, name: "New", parentId: null }),
    }));
}

/** C4 Model types from the registry (F9) — replaces the hand-curated `C4_TYPES` list. */
export function c4RegisteredTypes(): ComponentTypeDefinition[] {
  return allElements()
    .filter((element) => element.family === "c4")
    .map((element) => ({
      nodeType: element.id,
      displayName: i18n.t(element.labelKey, { lng: CATALOG_LOCALE }),
      description: i18n.t(element.descriptionKey, { lng: CATALOG_LOCALE }),
      example: JSON.stringify({ nodeType: element.id, name: "New", parentId: null }),
    }));
}

/** Cloud family categories registered on the element registry, as catalog entries. */
function cloudFamilyRegisteredTypes(familyId: string): ComponentTypeDefinition[] {
  return allElements()
    .filter((element) => element.family === familyId)
    .flatMap((element) => {
      const variants = element.palette.variants;
      if (!variants || variants.length === 0) {
        return [
          {
            nodeType: element.id,
            displayName: i18n.t(element.labelKey, { lng: CATALOG_LOCALE }),
            description: i18n.t(element.descriptionKey, { lng: CATALOG_LOCALE }),
            example: JSON.stringify({
              nodeType: element.id,
              name: i18n.t(element.labelKey, { lng: CATALOG_LOCALE }),
              parentId: null,
            }),
          },
        ];
      }
      return variants.map((variant) => ({
        nodeType: element.id,
        // Tool parameter slot shared across cloud families; addComponent maps
        // it onto awsService / gcpService / azureService as appropriate.
        awsService: variant.createOptions.serviceId,
        displayName: i18n.t(variant.labelKey, { lng: CATALOG_LOCALE }),
        description: i18n.t(element.descriptionKey, { lng: CATALOG_LOCALE }),
        example: JSON.stringify({
          nodeType: element.id,
          awsService: variant.createOptions.serviceId,
          name: i18n.t(variant.labelKey, { lng: CATALOG_LOCALE }),
          parentId: null,
        }),
      }));
    });
}

/** @deprecated Prefer iterating `allCloudFamilies()` — kept for call-site stability. */
export function awsRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("aws");
}

/** @deprecated Prefer iterating `allCloudFamilies()` — kept for call-site stability. */
export function gcpRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("gcp");
}

/** @deprecated Prefer iterating `allCloudFamilies()` — kept for call-site stability. */
export function azureRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("azure");
}

export function allComponentTypes(): ComponentTypeDefinition[] {
  return [
    ...STRUCTURAL_TYPES,
    ...registeredElementTypes(),
    ...c4RegisteredTypes(),
    ...allCloudFamilies().flatMap((family) => cloudFamilyRegisteredTypes(family.id)),
  ];
}

function formatTypeDef(def: ComponentTypeDefinition): string {
  const lines = [
    `nodeType: "${def.nodeType}" - ${def.displayName}`,
    `  Use when: ${def.description}`,
  ];
  if (def.awsService) {
    lines.push(`  awsService: "${def.awsService}"`);
  }
  if (def.requiredFields && def.requiredFields.length > 0) {
    lines.push(`  Required fields: ${def.requiredFields.join(", ")}`);
  }
  if (def.example) {
    lines.push(`  Example: ${def.example}`);
  }
  return lines.join("\n");
}

export function buildComponentTypeCatalog(): string {
  const sections: string[] = [
    "## Available Component Types",
    "",
    "You MUST use the exact nodeType string when calling add_node.",
    "Never invent nodeType values.",
    "",
    "### Structural & Canvas Types",
  ];

  for (const definition of [...STRUCTURAL_TYPES, ...registeredElementTypes()]) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push("### C4 Architecture Types");
  for (const definition of c4RegisteredTypes()) {
    sections.push(formatTypeDef(definition));
  }

  for (const family of allCloudFamilies()) {
    sections.push("");
    sections.push(buildCloudFamilyCatalogCompact(family.id));
  }

  return sections.join("\n");
}

/**
 * Compact catalog block for one registered cloud family.
 *
 * Service ids ride the shared `awsService` tool parameter (addComponent maps
 * onto `cloudServiceId`). Label comes from the family's i18n key.
 */
export function buildCloudFamilyCatalogCompact(familyId: string): string {
  const family = allCloudFamilies().find((entry) => entry.id === familyId);
  const label = family ? i18n.t(family.labelKey, { lng: CATALOG_LOCALE }) : familyId.toUpperCase();
  const serviceParamHint =
    familyId === "aws"
      ? "awsService"
      : `awsService (same add_node parameter; maps onto cloudServiceId for ${familyId})`;

  const prefix = `${familyId}-`;
  const lines: string[] = [
    `### ${label} Service Types`,
    "",
    familyId === "aws"
      ? `Use ${serviceParamHint} in add_node parameters. nodeType must match the category prefix.`
      : `For ${familyId}-* nodeTypes, pass the service id in ${serviceParamHint}.\nnodeType must be the category id (e.g. ${familyId}-compute).`,
    "",
  ];

  for (const element of allElements().filter((entry) => entry.family === familyId)) {
    const serviceIds = (element.palette.variants ?? [])
      .map((variant) => variant.createOptions.serviceId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .join(", ");
    const categoryLabel = element.id.replace(prefix, "").toUpperCase();
    lines.push(`${categoryLabel}: ${serviceIds || "(no services)"}`);
  }

  return lines.join("\n");
}

/** @deprecated Use `buildCloudFamilyCatalogCompact("aws")`. */
export function buildAwsCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact("aws");
}

/** @deprecated Use `buildCloudFamilyCatalogCompact("gcp")`. */
export function buildGcpCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact("gcp");
}

/** @deprecated Use `buildCloudFamilyCatalogCompact("azure")`. */
export function buildAzureCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact("azure");
}

export function buildPatternCatalogCompact(): string {
  const lines: string[] = [
    "",
    "### Architectural Patterns",
    "",
    "Use insert_pattern tool with the pattern ID.",
    "",
  ];

  for (const category of PATTERN_CATEGORIES) {
    const patternIds = PATTERNS.filter((p) => p.category === category)
      .map((p) => p.id)
      .join(", ");
    lines.push(`${category.toUpperCase()}: ${patternIds}`);
  }

  return lines.join("\n");
}

export function isValidNodeType(nodeType: string): boolean {
  return allComponentTypes().some((definition) => definition.nodeType === nodeType);
}

export function buildPatternCatalog(): string {
  const lines: string[] = [
    "",
    "### Architectural Patterns",
    "",
    "These are reusable architectural templates you can insert into the diagram. Use the insert_pattern tool.",
    "",
  ];

  for (const category of PATTERN_CATEGORIES) {
    const patterns = PATTERNS.filter((p) => p.category === category);
    lines.push(`${category.toUpperCase()}:`);
    for (const p of patterns) {
      const shortDesc =
        p.description.length > 120 ? p.description.slice(0, 117) + "..." : p.description;
      lines.push(`  - ${p.id}: ${shortDesc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function isValidPatternId(patternId: string): boolean {
  return PATTERNS.some((p) => p.id === patternId);
}

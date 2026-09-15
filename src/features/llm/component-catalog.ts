import { allElements } from "@/features/elements/element.registry";
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

export const C4_TYPES: ComponentTypeDefinition[] = [
  {
    nodeType: "person",
    displayName: "Person / Actor",
    description:
      "A human user or external actor that interacts with the system. Use in C4 context diagrams.",
    example: '{ "nodeType": "person", "name": "Customer", "parentId": null }',
  },
  {
    nodeType: "system",
    displayName: "Software System",
    description:
      "A top-level software system. Use for external systems or the system being described at context level.",
    example: '{ "nodeType": "system", "name": "Payment System", "parentId": null }',
  },
  {
    nodeType: "container",
    displayName: "Container",
    description:
      "A deployable unit: web app, microservice, database, mobile app, etc. Use at C4 container level.",
    example: '{ "nodeType": "container", "name": "BFF Service", "parentId": null }',
  },
  {
    nodeType: "component",
    displayName: "Component",
    description: "A module or component inside a container. Use at C4 component level.",
    example: '{ "nodeType": "component", "name": "AuthController", "parentId": "container-id" }',
  },
];

/**
 * Registered elements, as catalog entries.
 *
 * Derived rather than curated (decision 7): an element that exists is an
 * element the model can ask for, and its description is the one the palette
 * shows. Resolved in English because the catalog is part of the system prompt,
 * whatever locale the UI is in.
 */
export function registeredElementTypes(): ComponentTypeDefinition[] {
  // Cloud families publish a compact catalog of their own (see
  // `buildAwsCatalogCompact`); listing every category here would duplicate
  // them under "Structural & Canvas" without service ids.
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

/** Cloud family categories registered on the element registry, as catalog entries. */
function cloudFamilyRegisteredTypes(familyId: "aws" | "gcp" | "azure"): ComponentTypeDefinition[] {
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

export function awsRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("aws");
}

export function gcpRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("gcp");
}

export function azureRegisteredTypes(): ComponentTypeDefinition[] {
  return cloudFamilyRegisteredTypes("azure");
}

export function allComponentTypes(): ComponentTypeDefinition[] {
  return [
    ...STRUCTURAL_TYPES,
    ...registeredElementTypes(),
    ...C4_TYPES,
    ...awsRegisteredTypes(),
    ...gcpRegisteredTypes(),
    ...azureRegisteredTypes(),
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
  for (const definition of C4_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push(buildAwsCatalogCompact());
  sections.push("");
  sections.push(buildGcpCatalogCompact());
  sections.push("");
  sections.push(buildAzureCatalogCompact());

  return sections.join("\n");
}

/**
 * Compact AWS catalog derived from registered family descriptors.
 *
 * F5b drops the hand-curated per-service descriptions so all three cloud
 * families share the same verbosity (category label + service id list). A
 * later slice can re-level detail across families if needed — not ad-hoc here.
 */
export function buildAwsCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact("aws", "AWS", "awsService");
}

/**
 * Compact GCP catalog derived from registered family descriptors.
 *
 * Same shape as the AWS compact block: categories with service ids. The
 * `awsService` tool parameter carries the GCP service id for gcp-* nodeTypes
 * (addComponent maps it onto `gcpService`).
 */
export function buildGcpCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact(
    "gcp",
    "GCP",
    "awsService (same add_node parameter; maps onto gcpService)",
  );
}

/**
 * Compact Azure catalog derived from registered family descriptors.
 *
 * Same shape as the GCP compact block. The `awsService` tool parameter carries
 * the Azure service id for azure-* nodeTypes (addComponent maps it onto
 * `azureService`).
 */
export function buildAzureCatalogCompact(): string {
  return buildCloudFamilyCatalogCompact(
    "azure",
    "Azure",
    "awsService (same add_node parameter; maps onto azureService)",
  );
}

function buildCloudFamilyCatalogCompact(
  familyId: "aws" | "gcp" | "azure",
  label: string,
  serviceParamHint: string,
): string {
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

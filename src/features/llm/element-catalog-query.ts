import { allElements, getElement } from "@/features/elements/element.registry";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";
import type { Component } from "@/features/diagram/model/component.types";
import i18n from "@/infrastructure/i18n";

const CATALOG_LOCALE = "en";

export interface ElementFamilyCategorySummary {
  id: string;
  label: string;
  serviceCount: number;
}

export interface ElementFamilySummary {
  id: string;
  label: string;
  elementCount: number;
  categories: ElementFamilyCategorySummary[];
}

export interface ListElementFamiliesResult {
  families: ElementFamilySummary[];
  diagramFamilyMix: Array<{ familyId: string; nodes: number }>;
}

export interface SearchElementsResultItem {
  elementType: string;
  /** Create-time service id (`add_node.awsService` → `cloudServiceId`). */
  serviceId: string | null;
  familyId: string;
  label: string;
  description: string;
  requiredFields: string[];
}

export interface SearchElementsResult {
  results: SearchElementsResultItem[];
  truncated: boolean;
}

function t(key: string): string {
  return i18n.t(key, { lng: CATALOG_LOCALE });
}

/** Count nodes in the active diagram snapshot by element-registry family. */
export function computeDiagramFamilyMix(
  components: Record<string, Component>,
): Array<{ familyId: string; nodes: number }> {
  const counts = new Map<string, number>();
  for (const component of Object.values(components)) {
    const family = getElement(component.type)?.family ?? "unknown";
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([familyId, nodes]) => ({ familyId, nodes }))
    .sort((a, b) => b.nodes - a.nodes || a.familyId.localeCompare(b.familyId));
}

/**
 * Families + categories for the hierarchical LLM catalog (decision 10).
 *
 * Services are intentionally omitted — callers must use `searchElements`.
 */
export function listElementFamilies(
  components: Record<string, Component> = {},
): ListElementFamiliesResult {
  const structural = allElements().filter((element) => element.family === "structural");
  const c4 = allElements().filter((element) => element.family === "c4");

  const families: ElementFamilySummary[] = [
    {
      id: "structural",
      label: "Structural & Canvas",
      elementCount: structural.length,
      categories: [],
    },
    {
      id: "c4",
      label: "C4 Model",
      elementCount: c4.length,
      categories: [],
    },
  ];

  for (const family of allCloudFamilies()) {
    const categories = family.categories.map((category) => ({
      id: category.id,
      label: t(category.labelKey),
      serviceCount: family.services.filter((service) => service.categoryId === category.id).length,
    }));
    families.push({
      id: family.id,
      label: t(family.labelKey),
      elementCount: family.services.length,
      categories,
    });
  }

  return {
    families,
    diagramFamilyMix: computeDiagramFamilyMix(components),
  };
}

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

/**
 * Text search over structural/C4 elements and cloud-family services.
 *
 * Returns `elementType` + `serviceId` ready for `add_node` (serviceId maps to
 * the shared `awsService` parameter → `cloudServiceId`).
 */
export function searchElements(params: {
  query: string;
  familyId?: string;
  categoryId?: string;
  limit?: number;
}): SearchElementsResult {
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 50);
  const query = params.query.trim();
  const results: SearchElementsResultItem[] = [];

  if (!query) {
    return { results: [], truncated: false };
  }

  const pushStructuralLike = (familyFilter: "structural" | "c4") => {
    if (params.familyId && params.familyId !== familyFilter) return;
    if (params.categoryId) return;
    for (const element of allElements().filter((entry) => entry.family === familyFilter)) {
      const label = t(element.labelKey);
      const description = t(element.descriptionKey);
      const keys = [element.id, label, description, ...(element.palette.searchKeys ?? [])];
      if (!keys.some((key) => matchesQuery(key, query))) continue;
      results.push({
        elementType: element.id,
        serviceId: null,
        familyId: familyFilter,
        label,
        description,
        requiredFields: element.model.requiredFields ? [...element.model.requiredFields] : [],
      });
    }
  };

  pushStructuralLike("structural");
  pushStructuralLike("c4");

  for (const family of allCloudFamilies()) {
    if (params.familyId && params.familyId !== family.id) continue;
    for (const category of family.categories) {
      if (params.categoryId && params.categoryId !== category.id) continue;
      const categoryLabel = t(category.labelKey);
      const categoryDescription = t(category.descriptionKey);
      const services = family.services.filter((service) => service.categoryId === category.id);
      for (const service of services) {
        // A service may describe itself; otherwise it inherits the category's
        // line. Without this the model saw the same sentence for every service
        // in a category — "AWS compute services (EC2, Lambda, …)" as the
        // description of both EC2 and Lambda.
        const description = service.descriptionKey
          ? t(service.descriptionKey)
          : categoryDescription;
        const keys = [
          service.id,
          service.name,
          service.iconName,
          description,
          category.id,
          categoryLabel,
          categoryDescription,
          family.id,
        ];
        if (!keys.some((key) => matchesQuery(key, query))) continue;
        results.push({
          elementType: category.id,
          serviceId: service.id,
          familyId: family.id,
          label: service.name,
          description,
          requiredFields: [],
        });
      }
    }
  }

  const truncated = results.length > limit;
  return {
    results: results.slice(0, limit),
    truncated,
  };
}

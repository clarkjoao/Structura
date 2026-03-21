import { getPanelKindDef } from "@/lib/catalogs/panels";
import { AWS_CATEGORIES } from "@/lib/catalogs/aws";
import type { AwsCategory } from "@/lib/catalogs/aws";
import type { ServiceDefinition } from "@/features/diagram";
import type { CanvasPickerOption } from "./elementPickerModal.types";
import type { C4PickerOption } from "./buildPickerOptions";

export function canvasOptionMatchesQuery(
  opt: CanvasPickerOption,
  query: string,
): boolean {
  const fields: string[] = [opt.label.toLowerCase()];
  if (opt.panelKind) {
    fields.push(getPanelKindDef(opt.panelKind).defaultName.toLowerCase());
    fields.push(String(opt.panelKind).toLowerCase());
  }
  return fields.some((f) => f.includes(query));
}

export function filterC4ByQuery(
  q: string,
  options: C4PickerOption[],
): C4PickerOption[] {
  return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
}

export function filterCanvasByQuery(
  q: string,
  options: CanvasPickerOption[],
): CanvasPickerOption[] {
  return q
    ? options.filter((o) => canvasOptionMatchesQuery(o, q))
    : options;
}

export function filterAwsCategoriesForQuery(
  q: string,
): AwsCategory[] {
  if (!q) return AWS_CATEGORIES;
  return AWS_CATEGORIES.map((cat) => ({
    ...cat,
    services: cat.services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.includes(q),
    ),
  })).filter((cat) => cat.services.length > 0);
}

export function flattenAwsServices(
  categories: AwsCategory[],
): { categoryId: string; id: string; name: string; iconName: string }[] {
  return categories.flatMap((cat) =>
    cat.services.map((s) => ({ ...s, categoryId: cat.id })),
  );
}

export function filterServicesByQuery(
  q: string,
  services: ServiceDefinition[],
): ServiceDefinition[] {
  if (!q) return services;
  return services.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.technology.some((tech) => tech.toLowerCase().includes(q)) ||
      (s.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
  );
}

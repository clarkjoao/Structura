import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Cloud,
  GitFork,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Server,
  Shapes,
} from "lucide-react";
import { ElementCategory, type PickerCategoryId } from "../../enums";
import { offeredElements } from "@/features/elements/element.registry";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";
import i18n from "@/infrastructure/i18n";

export interface CategoryNavItem {
  id: PickerCategoryId;
  label: string;
  icon: LucideIcon;
  count: number;
}

/**
 * Palette categories that already have a tab: the fixed ones this file writes
 * out, plus one per catalog family.
 */
function tabbedCategoryIds(): Set<string> {
  return new Set<string>([
    ElementCategory.All,
    ElementCategory.C4,
    ElementCategory.Canvas,
    ElementCategory.Services,
    ElementCategory.NodeTemplate,
    ElementCategory.Flowchart,
    ...allCloudFamilies().map((family) => family.paletteCategoryId),
  ]);
}

/**
 * A tab for every other `palette.categoryId` the registry holds.
 *
 * Without this the picker only opened for catalog families, so a vocabulary
 * registered through `registerElement` — a BPMN or UML set, say — rendered on
 * the canvas with no way to insert it. The body for these tabs is the generic
 * registry grid in `ElementPickerModal`.
 *
 * Labels follow the same `elements.families.<id>.label` convention the LLM
 * catalog uses, falling back to the id so a new category is unlabelled rather
 * than showing a raw i18n key.
 */
function registryCategoryItems(counts: Record<string, number>): CategoryNavItem[] {
  const tabbed = tabbedCategoryIds();
  const seen = new Set<string>();
  const items: CategoryNavItem[] = [];

  for (const element of offeredElements()) {
    const id = element.palette.categoryId;
    if (tabbed.has(id) || seen.has(id)) continue;
    seen.add(id);

    const key = `elements.families.${id}.label`;
    const label = i18n.t(key);
    items.push({
      id,
      label: label === key ? id : label,
      icon: Shapes,
      count: counts[id] ?? 0,
    });
  }

  return items;
}

export function buildCategoryNavItems(
  t: (key: string) => string,
  counts: {
    all: number;
    c4: number;
    canvas: number;
    registry: number;
    nodeTemplates: number;
    flowchart: number;
    /** service counts keyed by family.paletteCategoryId */
    byFamily: Record<string, number>;
  },
): CategoryNavItem[] {
  const familyItems: CategoryNavItem[] = allCloudFamilies().map((family) => ({
    id: family.paletteCategoryId,
    label: i18n.t(family.labelKey),
    icon: Cloud,
    count: counts.byFamily[family.paletteCategoryId] ?? 0,
  }));

  const otherRegistryItems = registryCategoryItems(counts.byFamily);

  return [
    {
      id: ElementCategory.All,
      label: t("elementPicker.categoryAll"),
      icon: LayoutGrid,
      count: counts.all,
    },
    {
      id: ElementCategory.C4,
      label: t("elementPicker.c4Model"),
      icon: Layers,
      count: counts.c4,
    },
    {
      id: ElementCategory.Canvas,
      label: t("elementPicker.canvasGroups"),
      icon: LayoutTemplate,
      count: counts.canvas,
    },
    ...familyItems,
    {
      id: ElementCategory.Services,
      label: t("elementPicker.services"),
      icon: Server,
      count: counts.registry,
    },
    {
      id: ElementCategory.NodeTemplate,
      label: t("elementPresets.myPresets"),
      icon: Bookmark,
      count: counts.nodeTemplates,
    },
    {
      id: ElementCategory.Flowchart,
      label: t("elementPicker.flowchart"),
      icon: GitFork,
      count: counts.flowchart,
    },
    ...otherRegistryItems,
  ];
}

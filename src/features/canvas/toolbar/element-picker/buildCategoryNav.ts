import type { LucideIcon } from "lucide-react";
import { Cloud, GitFork, LayoutGrid, LayoutTemplate, Layers, Server, Bookmark } from "lucide-react";
import { ElementCategory, type PickerCategoryId } from "../../enums";
import { allCloudFamilies } from "@/features/elements/families/cloud-family.registry";
import i18n from "@/infrastructure/i18n";

export interface CategoryNavItem {
  id: PickerCategoryId;
  label: string;
  icon: LucideIcon;
  count: number;
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
      id: ElementCategory.Registry,
      label: t("elementPicker.registry"),
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
  ];
}

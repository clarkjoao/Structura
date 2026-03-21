import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  LayoutGrid,
  LayoutTemplate,
  Layers,
  Server,
} from "lucide-react";
import { ElementCategory } from "../../enums";

export interface CategoryNavItem {
  id: ElementCategory;
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
    aws: number;
    registry: number;
  },
): CategoryNavItem[] {
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
    {
      id: ElementCategory.Aws,
      label: t("canvasToolbar.awsServices"),
      icon: Cloud,
      count: counts.aws,
    },
    {
      id: ElementCategory.Registry,
      label: t("elementPicker.registry"),
      icon: Server,
      count: counts.registry,
    },
  ];
}

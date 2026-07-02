import type { LucideIcon } from "lucide-react";
import { Cloud, GitFork, LayoutGrid, LayoutTemplate, Layers, Server, Bookmark } from "lucide-react";
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
    gcp: number;
    azure: number;
    registry: number;
    nodeTemplates: number;
    flowchart: number;
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
      id: ElementCategory.Gcp,
      label: t("canvasToolbar.gcpServices"),
      icon: Cloud,
      count: counts.gcp,
    },
    {
      id: ElementCategory.Azure,
      label: t("canvasToolbar.azureServices"),
      icon: Cloud,
      count: counts.azure,
    },
    {
      id: ElementCategory.Registry,
      label: t("elementPicker.registry"),
      icon: Server,
      count: counts.registry,
    },
    {
      id: ElementCategory.NodeTemplate,
      label: t("customComponents.customComponents"),
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

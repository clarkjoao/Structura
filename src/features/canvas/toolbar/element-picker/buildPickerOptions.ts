import type { LucideIcon } from "lucide-react";
import {
  Circle,
  Database,
  Diamond,
  ExternalLink,
  GitBranch,
  Hexagon,
  Network,
  Server,
  Square,
  SquareStack,
  User,
} from "lucide-react";
import { type ComponentType, type FlowNodeShape } from "@/features/diagram";
import type { CanvasPickerOption } from "./types";

export type C4PickerOption = {
  type: "person" | "system" | "container" | "component";
  label: string;
  icon: LucideIcon;
};

export function buildC4PickerOptions(t: (key: string) => string): C4PickerOption[] {
  return [
    { type: "person", label: t("quickInsert.typePerson"), icon: User },
    { type: "system", label: t("quickInsert.typeSystem"), icon: Network },
    { type: "container", label: t("quickInsert.typeContainer"), icon: Server },
    { type: "component", label: t("quickInsert.typeComponent"), icon: Database },
  ];
}

export function buildCanvasPickerOptions(t: (key: string) => string): CanvasPickerOption[] {
  // Everything else in this category now comes from the element registry; only
  // the types still on the legacy path are listed here.
  return [{ type: "external-element", label: t("externalElement.nodeBadge"), icon: ExternalLink }];
}

export function buildFlowchartPickerOptions(t: (key: string) => string): CanvasPickerOption[] {
  const shapes: Array<{ shape: FlowNodeShape; labelKey: string; icon: LucideIcon }> = [
    { shape: "rectangle", labelKey: "flowchart.shapes.rectangle", icon: Square },
    { shape: "rounded", labelKey: "flowchart.shapes.rounded", icon: Square },
    { shape: "stadium", labelKey: "flowchart.shapes.stadium", icon: Circle },
    { shape: "diamond", labelKey: "flowchart.shapes.diamond", icon: Diamond },
    { shape: "hexagon", labelKey: "flowchart.shapes.hexagon", icon: Hexagon },
    { shape: "parallelogram", labelKey: "flowchart.shapes.parallelogram", icon: GitBranch },
    { shape: "cylinder", labelKey: "flowchart.shapes.cylinder", icon: Database },
    { shape: "circle", labelKey: "flowchart.shapes.circle", icon: Circle },
    { shape: "subroutine", labelKey: "flowchart.shapes.subroutine", icon: SquareStack },
  ];

  return shapes.map(({ shape, labelKey, icon }) => ({
    type: "process-node" as ComponentType,
    label: t(labelKey),
    icon,
    flowShape: shape,
  }));
}

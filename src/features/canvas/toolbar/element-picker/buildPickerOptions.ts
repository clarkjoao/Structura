import type { LucideIcon } from "lucide-react";
import {
  Circle,
  CircleDot,
  CircleStop,
  Database,
  Diamond,
  Eye,
  FileText,
  GitBranch,
  Hexagon,
  MessageSquareText,
  Play,
  Square,
  SquareStack,
  Zap,
} from "lucide-react";
import { type ComponentType, type FlowNodeShape } from "@/features/diagram";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import type { CanvasPickerOption } from "./types";

export type C4PickerOption = {
  type: "person" | "system" | "container" | "component";
  label: string;
  icon: LucideIcon;
};

/** C4 options from the element registry (F9) — replaces the hand-curated list. */
export function buildC4PickerOptions(_t?: (key: string) => string): C4PickerOption[] {
  return paletteEntriesForCategory("c4").map((entry) => ({
    type: entry.type as C4PickerOption["type"],
    label: entry.label,
    icon: entry.icon,
  }));
}

export function buildCanvasPickerOptions(): CanvasPickerOption[] {
  // Empty: every canvas type is on the element registry now, and the picker
  // reads them from there.
  return [];
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
    { shape: "subroutine", labelKey: "flowchart.shapes.subroutine", icon: SquareStack },
    { shape: "start", labelKey: "flowchart.shapes.start", icon: Play },
    { shape: "end", labelKey: "flowchart.shapes.end", icon: CircleStop },
    { shape: "document", labelKey: "flowchart.shapes.document", icon: FileText },
    { shape: "event", labelKey: "flowchart.shapes.event", icon: Zap },
    { shape: "junction-and", labelKey: "flowchart.shapes.junction-and", icon: CircleDot },
    { shape: "junction-or", labelKey: "flowchart.shapes.junction-or", icon: Circle },
    { shape: "annotation", labelKey: "flowchart.shapes.annotation", icon: MessageSquareText },
    { shape: "evidence", labelKey: "flowchart.shapes.evidence", icon: Eye },
  ];

  return shapes.map(({ shape, labelKey, icon }) => ({
    type: "process-node" as ComponentType,
    label: t(labelKey),
    icon,
    flowShape: shape,
  }));
}

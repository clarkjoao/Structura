import type { LucideIcon } from "lucide-react";
import { type ComponentType } from "@/features/diagram";
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

/**
 * The flowchart shapes, read from the `process-node` palette variants in the
 * order they are declared there.
 */
export function buildFlowchartPickerOptions(_t?: (key: string) => string): CanvasPickerOption[] {
  return paletteEntriesForCategory("flowchart", "declared").map((entry) => ({
    type: entry.type as ComponentType,
    label: entry.label,
    icon: entry.icon,
    searchKeys: entry.searchKeys,
    flowShape: entry.createOptions.flowShape,
  }));
}

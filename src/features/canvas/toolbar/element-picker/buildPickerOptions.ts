import type { LucideIcon } from "lucide-react";
import {
  Braces,
  Database,
  Globe,
  Network,
  Server,
  Square,
  StickyNote,
  Table,
  User,
} from "lucide-react";
import { PANEL_KINDS } from "@/lib/catalogs/panels";
import { PanelKind } from "@/features/diagram";
import type { CanvasPickerOption } from "./types";

export type C4PickerOption = {
  type: "person" | "system" | "container" | "component";
  label: string;
  icon: LucideIcon;
};

export function buildC4PickerOptions(
  t: (key: string) => string,
): C4PickerOption[] {
  return [
    { type: "person", label: t("quickInsert.typePerson"), icon: User },
    { type: "system", label: t("quickInsert.typeSystem"), icon: Network },
    { type: "container", label: t("quickInsert.typeContainer"), icon: Server },
    { type: "component", label: t("quickInsert.typeComponent"), icon: Database },
  ];
}

export function buildCanvasPickerOptions(
  t: (key: string) => string,
): CanvasPickerOption[] {
  const swim = PANEL_KINDS.find((p) => p.id === PanelKind.Swimlane);
  const restPanels = PANEL_KINDS.filter(
    (p) => p.id !== PanelKind.Default && p.id !== PanelKind.Swimlane,
  );
  const core: CanvasPickerOption[] = [
    {
      type: "panel",
      label: t("canvasToolbar.panel"),
      icon: Square,
      panelKind: PanelKind.Default,
    },
  ];
  if (swim) {
    core.push({
      type: "panel",
      label: t("swimlane.title"),
      icon: swim.icon,
      panelKind: PanelKind.Swimlane,
      awsIconName: swim.awsIconName,
    });
  }
  core.push(
    { type: "note", label: t("canvasToolbar.note"), icon: StickyNote },
    { type: "api-group", label: t("quickInsert.typeApiGroup"), icon: Globe },
    { type: "endpoint", label: t("quickInsert.typeEndpoint"), icon: Globe },
    { type: "db-table", label: t("nodeTypes.db-table"), icon: Table },
    { type: "json-viewer", label: t("nodeTypes.json-viewer"), icon: Braces },
  );
  for (const p of restPanels) {
    core.push({
      type: "panel",
      label: p.label,
      icon: p.icon,
      panelKind: p.id as PanelKind,
      awsIconName: p.awsIconName,
    });
  }
  return core;
}

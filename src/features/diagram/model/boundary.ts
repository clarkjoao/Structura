import { PanelKind } from "../enums";
import type { Component, PanelComponent } from "./component.types";
import { isPanelComponent } from "./component.guards";
import type { BoundaryType } from "./boundary-type";
import { getPanelKindDef } from "@/lib/catalogs/panels";

type BorderStyle = NonNullable<PanelComponent["borderStyle"]>;

/** Colour and outline by type, for a boundary with no domain to take its colour from. */
const TYPE_APPEARANCE: Record<BoundaryType, { color: string; borderStyle: BorderStyle }> = {
  quantum: { color: "#6366f1", borderStyle: "solid" },
  system: { color: "#0ea5e9", borderStyle: "solid" },
  network: { color: "#64748b", borderStyle: "dashed" },
};

/** Mid-tones that read on both themes; a domain takes one by its name. */
export const DOMAIN_PALETTE: readonly string[] = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#f43f5e",
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#f97316",
];

function foldName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** The same domain name gets the same colour in every diagram: no registry, no migration. */
export function domainColor(name: string): string {
  let hash = 0;
  for (const char of foldName(name)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DOMAIN_PALETTE[hash % DOMAIN_PALETTE.length];
}

/**
 * The domain of an element is the group it sits in (D1): there is no list of domains to keep, each
 * architect groups as they see fit. `null` for an element at the top level.
 */
export function elementDomain(
  component: Pick<Component, "parentId">,
  components: Readonly<Record<string, Component>>,
): { id: string; name: string } | null {
  const parent = component.parentId ? components[component.parentId] : undefined;
  if (!parent || !isPanelComponent(parent)) return null;
  const name = parent.name.trim();
  return name ? { id: parent.id, name } : null;
}

export type BoundaryAppearanceSource = "domain" | "type" | "custom";

export interface BoundaryAppearance {
  color: string;
  borderStyle: BorderStyle;
  /** Where the colour came from: the domain, the type, or a colour the author picked. */
  colorSource: BoundaryAppearanceSource;
  /** Where the outline came from: the type, or an outline the author picked. */
  borderSource: "type" | "custom";
}

/**
 * A colour the author picked: one that is not the panel kind's own default. It wins over what is
 * derived, so no existing group loses its colour.
 */
function hasCustomPanelColor(panel: PanelComponent): boolean {
  if (!panel.panelColor) return false;
  return panel.panelColor !== getPanelKindDef(panel.panelKind).defaultColor;
}

/**
 * The colours and outline a boundary shows. Only a boundary with a type derives its look; a panel
 * with none, a swimlane or an infrastructure kind is drawn as it always was (`null`).
 */
export function resolveBoundaryAppearance(
  panel: PanelComponent,
  components: Readonly<Record<string, Component>>,
): BoundaryAppearance | null {
  if (!panel.boundaryType || panel.panelKind === PanelKind.Swimlane) return null;
  const fromType = TYPE_APPEARANCE[panel.boundaryType];
  const domain = elementDomain(panel, components);
  const custom = hasCustomPanelColor(panel);
  const customBorder = panel.borderStyle !== undefined && panel.borderStyle !== "solid";
  return {
    color:
      custom && panel.panelColor
        ? panel.panelColor
        : domain
          ? domainColor(domain.name)
          : fromType.color,
    borderStyle: customBorder && panel.borderStyle ? panel.borderStyle : fromType.borderStyle,
    colorSource: custom ? "custom" : domain ? "domain" : "type",
    borderSource: customBorder ? "custom" : "type",
  };
}

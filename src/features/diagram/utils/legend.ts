import type { BoundaryType } from "../model/boundary-type";
import { resolveBoundaryAppearance } from "../model/boundary";
import { isPanelComponent } from "../model/component.guards";
import type { Component } from "../model/component.types";
import { resolveConnectionSemantics } from "../model/connection-defaults";
import type { Connection } from "../model/connection.types";
import type { ConnectionInteraction } from "../model/connection.types";

/**
 * What a diagram's legend says: only what the diagram uses. Nothing to keep by hand — add a
 * Network boundary and it appears, delete the last asynchronous connection and it goes.
 */
export interface LegendModel {
  /** Boundary types in use, each with the outline it is drawn with. */
  boundaryTypes: Array<{ type: BoundaryType; borderStyle: "solid" | "dashed" | "dotted" }>;
  /** Domains that colour a boundary, with the colour. */
  domains: Array<{ name: string; color: string }>;
  /** Interactions in use: synchronous is solid, asynchronous dashed. */
  interactions: ConnectionInteraction[];
}

const TYPE_ORDER: readonly BoundaryType[] = ["quantum", "system", "network"];

export function isLegendEmpty(legend: LegendModel): boolean {
  return (
    legend.boundaryTypes.length === 0 &&
    legend.domains.length === 0 &&
    legend.interactions.length === 0
  );
}

/**
 * The legend of what is shown. `components` are the scene-resolved ones (ancestry is read through
 * them); `shownIds` and `connections` are what is actually drawn.
 */
export function buildLegend(
  components: Readonly<Record<string, Component>>,
  shownIds: ReadonlySet<string>,
  connections: readonly Connection[],
): LegendModel {
  const types = new Map<BoundaryType, "solid" | "dashed" | "dotted">();
  const domains = new Map<string, { name: string; color: string }>();
  for (const component of Object.values(components)) {
    if (!shownIds.has(component.id) || !isPanelComponent(component)) continue;
    const appearance = resolveBoundaryAppearance(component, components);
    if (!appearance || !component.boundaryType) continue;
    if (!types.has(component.boundaryType))
      types.set(component.boundaryType, appearance.borderStyle);
    if (appearance.colorSource === "domain") {
      const parent = component.parentId ? components[component.parentId] : undefined;
      const name = parent?.name.trim();
      if (name && !domains.has(name.toLowerCase())) {
        domains.set(name.toLowerCase(), { name, color: appearance.color });
      }
    }
  }
  const interactions = new Set<ConnectionInteraction>();
  for (const connection of connections) {
    interactions.add(resolveConnectionSemantics(connection).interaction);
  }
  return {
    boundaryTypes: TYPE_ORDER.filter((type) => types.has(type)).map((type) => ({
      type,
      borderStyle: types.get(type) ?? "solid",
    })),
    domains: [...domains.values()].sort((a, b) => a.name.localeCompare(b.name)),
    interactions: (["sync", "async"] as const).filter((interaction) =>
      interactions.has(interaction),
    ),
  };
}

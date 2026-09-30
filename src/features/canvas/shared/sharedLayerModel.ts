import type { Component, Connection } from "@/features/diagram";
import { getElement } from "@/features/elements/element.registry";
import {
  refsOf,
  sharedMode,
  sharedUses,
  suggestedShared,
  usageCount,
} from "@/features/diagram/utils/shared";

/**
 * What the shared layer draws, from the diagram alone (no positions): the
 * shared elements drawn as badges or references, their chips, the badges
 * each consumer wears, and who uses each one with what protocol.
 */
export interface SharedOriginal {
  id: string;
  name: string;
  accent: string;
  mode: "badge" | "ref";
  uses: number;
  refs: string[];
  /** Consumers, each once, with the protocols they use it by. */
  consumers: { id: string; name: string; protocols: string[] }[];
  connectionIds: string[];
}

export interface SharedLayerModel {
  originals: SharedOriginal[];
  /** consumer id → the badge-mode originals it wears a badge for. */
  badgesByConsumer: Map<string, string[]>;
  /** Elements drawn with their edges that enough things use to suggest sharing: id → consumers. */
  suggestions: Map<string, number>;
  /** Every element the layer needs a box for. */
  anchorIds: string[];
}

export const EMPTY_SHARED_LAYER: SharedLayerModel = {
  originals: [],
  badgesByConsumer: new Map(),
  suggestions: new Map(),
  anchorIds: [],
};

/** The element's accent as its palette declares it (or its own colour), for its badges. */
export function elementAccent(component: Component): string {
  const own = (component as { customColor?: string }).customColor;
  if (own) return own;
  const accent = getElement(component.type)?.palette.accent;
  return accent?.kind === "token" ? `hsl(var(${accent.cssVar}))` : "hsl(var(--muted-foreground))";
}

export function buildSharedLayer(
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): SharedLayerModel {
  const originals: SharedOriginal[] = [];
  const badgesByConsumer = new Map<string, string[]>();
  const anchors = new Set<string>();
  for (const component of Object.values(components)) {
    const mode = sharedMode(component);
    if (mode !== "badge" && mode !== "ref") continue;
    const uses = sharedUses(component.id, components, connections);
    const byConsumer = new Map<string, Set<string>>();
    for (const use of uses) {
      const protocols = byConsumer.get(use.consumerId) ?? new Set<string>();
      if (use.label.trim()) protocols.add(use.label.trim());
      byConsumer.set(use.consumerId, protocols);
    }
    const consumers = [...byConsumer.entries()].map(([id, protocols]) => ({
      id,
      name: components[id]?.name ?? id,
      protocols: [...protocols],
    }));
    const refs = refsOf(component.id, components);
    originals.push({
      id: component.id,
      name: component.name,
      accent: elementAccent(component),
      mode,
      uses: usageCount(component.id, components, connections),
      refs,
      consumers,
      connectionIds: uses.map((use) => use.connectionId),
    });
    anchors.add(component.id);
    for (const id of refs) anchors.add(id);
    for (const consumer of consumers) {
      anchors.add(consumer.id);
      if (mode === "badge") {
        const worn = badgesByConsumer.get(consumer.id) ?? [];
        worn.push(component.id);
        badgesByConsumer.set(consumer.id, worn);
      }
    }
  }
  const suggestions = suggestedShared(components, connections);
  for (const id of suggestions.keys()) anchors.add(id);
  if (originals.length === 0 && suggestions.size === 0) return EMPTY_SHARED_LAYER;
  return { originals, badgesByConsumer, suggestions, anchorIds: [...anchors] };
}

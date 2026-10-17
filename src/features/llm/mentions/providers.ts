import { isSharedRefComponent, type Diagram } from "@/features/diagram";
import type { MentionRef } from "./mention-ref";

/**
 * Mention providers: pure functions that turn the current diagram (and the
 * canvas selection) into the items of the `@` menu, one section per provider.
 */

export type MentionIcon = "selection" | "node" | "edge" | "flow" | "diagram";

export interface MentionSearchData {
  /** The active diagram as the canvas shows it, or null. */
  diagram: Diagram | null;
  /** Node ids selected on the canvas, in selection order. */
  selectionIds: readonly string[];
  /** Translates the few labels that are not names (counts). */
  translate: (key: string, params?: Record<string, unknown>) => string;
}

/** The part of `label` that matched the query, for highlighting. */
export interface MentionMatch {
  start: number;
  end: number;
}

export interface MentionOption {
  /** Unique within the menu. */
  key: string;
  ref: MentionRef;
  label: string;
  /** Already translated. */
  secondary: string;
  icon: MentionIcon;
  /** The component type, for node icons. */
  nodeType?: string;
  match: MentionMatch | null;
}

export interface MentionProvider {
  id: string;
  /** i18n key of the section header. */
  labelKey: string;
  /** Items in a section before "+N more". */
  limit: number;
  /** Every item that matches `query`, best first. */
  search: (query: string, data: MentionSearchData) => MentionOption[];
}

export interface MentionSection {
  providerId: string;
  labelKey: string;
  items: MentionOption[];
  /** How many matched before the cap. */
  total: number;
}

const SECTION_LIMIT = 5;

function normalize(text: string): string {
  return text.toLowerCase();
}

/** Where `query` sits in `label`, case-insensitive; null when it does not. */
export function findMatch(label: string, query: string): MentionMatch | null {
  if (query.length === 0) return null;
  const start = normalize(label).indexOf(normalize(query));
  return start === -1 ? null : { start, end: start + query.length };
}

/** 0: label starts with the query, 1: label contains it, 2: only the secondary text does. */
function rank(option: MentionOption, query: string): number {
  if (query.length === 0) return 0;
  if (option.match?.start === 0) return 0;
  if (option.match) return 1;
  return 2;
}

function matches(option: MentionOption, query: string, extra: string): boolean {
  return query.length === 0 || option.match !== null || normalize(extra).includes(normalize(query));
}

function sortByRank(options: MentionOption[], query: string): MentionOption[] {
  return [...options].sort(
    (a, b) => rank(a, query) - rank(b, query) || a.label.localeCompare(b.label),
  );
}

export const selectionProvider: MentionProvider = {
  id: "selection",
  labelKey: "llmChat.mention.section.selection",
  limit: 1,
  search: (query, { diagram, selectionIds, translate }) => {
    if (!diagram || selectionIds.length === 0) return [];
    const nodeIds = selectionIds.filter((id) => id in diagram.snapshot.components);
    if (nodeIds.length === 0) return [];
    const first = diagram.snapshot.components[nodeIds[0] ?? ""];
    const label =
      nodeIds.length === 1 && first
        ? first.name
        : translate("llmChat.mention.selectionCount", { count: nodeIds.length });
    const option: MentionOption = {
      key: `selection:${nodeIds.join(",")}`,
      ref: { kind: "selection", nodeIds, label },
      label,
      secondary: translate("llmChat.mention.secondary.selected", { count: nodeIds.length }),
      icon: "selection",
      ...(nodeIds.length === 1 && first ? { nodeType: first.type } : {}),
      match: findMatch(label, query),
    };
    return matches(option, query, "") ? [option] : [];
  },
};

export const nodesProvider: MentionProvider = {
  id: "nodes",
  labelKey: "llmChat.mention.section.nodes",
  limit: SECTION_LIMIT,
  search: (query, { diagram }) => {
    if (!diagram) return [];
    const options = Object.values(diagram.snapshot.components)
      .filter((component) => !isSharedRefComponent(component))
      .map((component): MentionOption => {
        const label = component.name || component.id;
        return {
          key: `node:${component.id}`,
          ref: { kind: "node", id: component.id, label },
          label,
          secondary: component.type,
          icon: "node",
          nodeType: component.type,
          match: findMatch(label, query),
        };
      })
      .filter((option) => matches(option, query, option.secondary));
    return sortByRank(options, query);
  },
};

export const edgesProvider: MentionProvider = {
  id: "edges",
  labelKey: "llmChat.mention.section.edges",
  limit: SECTION_LIMIT,
  search: (query, { diagram, translate }) => {
    if (!diagram) return [];
    const name = (id: string) => diagram.snapshot.components[id]?.name || id;
    const options = Object.values(diagram.snapshot.connections)
      .map((edge): MentionOption => {
        const route = translate("llmChat.mention.secondary.route", {
          source: name(edge.sourceId),
          target: name(edge.targetId),
        });
        const label = edge.label || route;
        return {
          key: `edge:${edge.id}`,
          ref: { kind: "edge", id: edge.id, label },
          label,
          secondary: route,
          icon: "edge",
          match: findMatch(label, query),
        };
      })
      .filter((option) => matches(option, query, option.secondary));
    return sortByRank(options, query);
  },
};

export const flowsProvider: MentionProvider = {
  id: "flows",
  labelKey: "llmChat.mention.section.flows",
  limit: SECTION_LIMIT,
  search: (query, { diagram, translate }) => {
    if (!diagram) return [];
    const options = Object.values(diagram.snapshot.flows)
      .map((flow): MentionOption => {
        const label = flow.name || flow.id;
        return {
          key: `flow:${flow.id}`,
          ref: { kind: "flow", id: flow.id, label },
          label,
          secondary: translate("llmChat.mention.secondary.steps", {
            count: Object.keys(flow.steps).length,
          }),
          icon: "flow",
          match: findMatch(label, query),
        };
      })
      .filter((option) => matches(option, query, ""));
    return sortByRank(options, query);
  },
};

export const diagramProvider: MentionProvider = {
  id: "diagram",
  labelKey: "llmChat.mention.section.diagram",
  limit: 1,
  search: (query, { diagram, translate }) => {
    if (!diagram) return [];
    const label = translate("llmChat.mention.wholeDiagram");
    const option: MentionOption = {
      key: `diagram:${diagram.id}`,
      ref: { kind: "diagram", id: diagram.id, label: diagram.name },
      label,
      secondary: translate("llmChat.mention.secondary.diagramSize", {
        nodes: Object.keys(diagram.snapshot.components).length,
        edges: Object.keys(diagram.snapshot.connections).length,
      }),
      icon: "diagram",
      match: findMatch(label, query),
    };
    return matches(option, query, diagram.name) ? [option] : [];
  },
};

/** The `@` menu's sections, in order. Later phases may register more providers. */
export class MentionProviderRegistry {
  private readonly providers: MentionProvider[] = [];

  register(provider: MentionProvider): void {
    if (this.providers.some((existing) => existing.id === provider.id)) {
      throw new Error(`A mention provider named "${provider.id}" is already registered`);
    }
    this.providers.push(provider);
  }

  /** Non-empty sections for `query`, each capped at its provider's limit. */
  search(query: string, data: MentionSearchData): MentionSection[] {
    return this.providers.flatMap((provider) => {
      const found = provider.search(query.trim(), data);
      if (found.length === 0) return [];
      return [
        {
          providerId: provider.id,
          labelKey: provider.labelKey,
          items: found.slice(0, provider.limit),
          total: found.length,
        },
      ];
    });
  }
}

export function createMentionRegistry(): MentionProviderRegistry {
  const registry = new MentionProviderRegistry();
  for (const provider of [
    selectionProvider,
    nodesProvider,
    edgesProvider,
    flowsProvider,
    diagramProvider,
  ]) {
    registry.register(provider);
  }
  return registry;
}

import { useMemo } from "react";
import { type Diagram, getCachedCanvasSnapshot, useActiveDiagramModel } from "@/features/diagram";
import type { MentionItem } from "@/features/llm";

interface UseMentionSearchResult {
  search: (query: string) => MentionItem[];
  allItems: MentionItem[];
}

function buildNodeMentionItem(component: {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
}): MentionItem {
  const label = component.name || component.id;
  const parent = component.parentId ?? "none";
  return {
    id: component.id,
    kind: "node",
    label,
    subLabel: component.type,
    serialized: `node id=${component.id} type=${component.type} label="${label}" parent=${parent}`,
  };
}

function buildEdgeMentionItem(
  connection: { id: string; sourceId: string; targetId: string; label: string },
  componentNameById: Record<string, string>,
): MentionItem {
  const sourceName = componentNameById[connection.sourceId] ?? connection.sourceId;
  const targetName = componentNameById[connection.targetId] ?? connection.targetId;
  const edgeLabel = connection.label || `${sourceName} -> ${targetName}`;
  return {
    id: connection.id,
    kind: "edge",
    label: edgeLabel,
    subLabel: `${sourceName} -> ${targetName}`,
    serialized: `edge id=${connection.id} source=${connection.sourceId} target=${connection.targetId} label="${edgeLabel}"`,
  };
}

function rankMentionItem(item: MentionItem, normalizedQuery: string): number {
  const normalizedLabel = item.label.toLowerCase();
  const normalizedSubLabel = item.subLabel.toLowerCase();
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 0;
  }
  if (normalizedLabel.includes(normalizedQuery)) {
    return 1;
  }
  if (normalizedSubLabel.includes(normalizedQuery)) {
    return 2;
  }
  return 3;
}

function searchMentionItems(allItems: MentionItem[], query: string): MentionItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return allItems.slice(0, 8);
  }

  return allItems
    .filter((item) => {
      const normalizedLabel = item.label.toLowerCase();
      const normalizedSubLabel = item.subLabel.toLowerCase();
      return (
        normalizedLabel.includes(normalizedQuery) ||
        normalizedSubLabel.includes(normalizedQuery)
      );
    })
    .sort((itemA, itemB) => {
      const rankDifference =
        rankMentionItem(itemA, normalizedQuery) - rankMentionItem(itemB, normalizedQuery);
      if (rankDifference !== 0) {
        return rankDifference;
      }
      return itemA.label.localeCompare(itemB.label);
    })
    .slice(0, 8);
}

export function useMentionSearch(): UseMentionSearchResult {
  const activeModel = useActiveDiagramModel();

  const allItems = useMemo(() => {
    if (!activeModel) {
      return [];
    }

    const activeDiagram: Diagram = {
      ...activeModel,
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const snapshot = getCachedCanvasSnapshot(activeDiagram);
    const components = Object.values(snapshot.components).sort((componentA, componentB) =>
      componentA.id.localeCompare(componentB.id),
    );
    const connections = Object.values(snapshot.connections).sort((connectionA, connectionB) =>
      connectionA.id.localeCompare(connectionB.id),
    );
    const componentNameById = Object.fromEntries(
      components.map((component) => [component.id, component.name || component.id]),
    );

    const nodeItems = components.map((component) => buildNodeMentionItem(component));
    const edgeItems = connections.map((connection) =>
      buildEdgeMentionItem(connection, componentNameById),
    );
    return [...nodeItems, ...edgeItems];
  }, [activeModel]);

  const search = (query: string) => searchMentionItems(allItems, query);

  return { search, allItems };
}


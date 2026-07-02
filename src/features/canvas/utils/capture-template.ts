import type {
  Component,
  Connection,
  UserTemplate,
  UserTemplateComponent,
  ViewNodeLayout,
} from "@/features/diagram";
import { generateId, isPanelComponent } from "@/features/diagram";

export function expandSelectionWithChildren(
  selectedIds: string[],
  allComponents: Record<string, Component>,
): string[] {
  const expanded = new Set(selectedIds.filter((id) => allComponents[id]));

  const addChildren = (parentId: string): void => {
    for (const component of Object.values(allComponents)) {
      if (component.parentId === parentId && !expanded.has(component.id)) {
        expanded.add(component.id);
        addChildren(component.id);
      }
    }
  };

  for (const id of selectedIds) {
    const component = allComponents[id];
    if (component && isPanelComponent(component)) {
      addChildren(id);
    }
  }

  return orderExpandedComponentsTopologically(expanded, allComponents, selectedIds);
}

function orderExpandedComponentsTopologically(
  expanded: Set<string>,
  allComponents: Record<string, Component>,
  selectionOrder: string[],
): string[] {
  const priority = new Map<string, number>();
  selectionOrder.forEach((id, index) => {
    if (!priority.has(id)) priority.set(id, index);
  });

  const roots = [...expanded].filter((id) => {
    const record = allComponents[id];
    if (!record) return false;
    const parent = record.parentId;
    return parent === null || !expanded.has(parent);
  });

  roots.sort((a, b) => {
    const priorityA = priority.has(a) ? priority.get(a)! : 1e9;
    const priorityB = priority.has(b) ? priority.get(b)! : 1e9;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.localeCompare(b);
  });

  const result: string[] = [];
  const seen = new Set<string>();

  const visit = (id: string): void => {
    if (!expanded.has(id) || seen.has(id) || !allComponents[id]) return;
    seen.add(id);
    result.push(id);
    const childIds = Object.values(allComponents)
      .filter((child) => child.parentId === id && expanded.has(child.id))
      .map((child) => child.id)
      .sort((a, b) => {
        const priorityA = priority.has(a) ? priority.get(a)! : 1e9;
        const priorityB = priority.has(b) ? priority.get(b)! : 1e9;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.localeCompare(b);
      });
    for (const childId of childIds) visit(childId);
  };

  for (const root of roots) visit(root);
  for (const id of expanded) {
    if (!seen.has(id) && allComponents[id]) visit(id);
  }

  return result;
}

function isTemplateRootInSelection(component: Component, expandedSet: Set<string>): boolean {
  const parentId = component.parentId;
  if (parentId === null) return true;
  return !expandedSet.has(parentId);
}

export function captureSelectionAsTemplate(
  selectedComponentIds: string[],
  allComponents: Record<string, Component>,
  allConnections: Record<string, Connection>,
  nodeLayouts: ViewNodeLayout[],
  name: string,
  description?: string,
  category?: string,
): UserTemplate {
  const expandedIds = expandSelectionWithChildren(selectedComponentIds, allComponents);
  const expandedSet = new Set(expandedIds);

  const selectedComponents = expandedIds
    .map((id) => allComponents[id])
    .filter((component): component is Component => component !== undefined);

  if (selectedComponents.length === 0) {
    return {
      id: generateId("tpl"),
      name,
      description,
      category,
      createdAt: Date.now(),
      components: [],
      connections: [],
    };
  }

  const indexMap = new Map(selectedComponents.map((c, i) => [c.id, i]));

  const rootComponents = selectedComponents.filter((c) =>
    isTemplateRootInSelection(c, expandedSet),
  );

  const rootLayouts = rootComponents.map((c) => {
    const layout = nodeLayouts.find((entry) => entry.elementId === c.id);
    return { id: c.id, x: layout?.x ?? 0, y: layout?.y ?? 0 };
  });

  const centerX = rootLayouts.reduce((sum, entry) => sum + entry.x, 0) / (rootLayouts.length || 1);
  const centerY = rootLayouts.reduce((sum, entry) => sum + entry.y, 0) / (rootLayouts.length || 1);

  const templateComponents: UserTemplateComponent[] = selectedComponents.map((component) => {
    const layout = nodeLayouts.find((entry) => entry.elementId === component.id);
    const { id, parentId, x: _discardX, y: _discardY, ...rest } = component;
    const isRoot = isTemplateRootInSelection(component, expandedSet);

    let relX: number;
    let relY: number;
    if (isRoot) {
      relX = (layout?.x ?? 0) - centerX;
      relY = (layout?.y ?? 0) - centerY;
    } else {
      relX = layout?.x ?? 0;
      relY = layout?.y ?? 0;
    }

    const parentIndex =
      parentId !== null && indexMap.has(parentId) ? indexMap.get(parentId) : undefined;

    const entry: UserTemplateComponent = {
      ...rest,
      _relX: relX,
      _relY: relY,
      ...(typeof layout?.width === "number" ? { width: layout.width } : {}),
      ...(typeof layout?.height === "number" ? { height: layout.height } : {}),
      ...(parentIndex !== undefined ? { parentIndex } : {}),
    };
    return entry;
  });

  const relevantConnections = Object.values(allConnections).filter(
    (connection) => expandedSet.has(connection.sourceId) && expandedSet.has(connection.targetId),
  );

  const templateConnections = relevantConnections.map((connection) => {
    const { id, sourceId, targetId, ...rest } = connection;
    return {
      ...rest,
      sourceIndex: selectedComponents.findIndex((c) => c.id === sourceId),
      targetIndex: selectedComponents.findIndex((c) => c.id === targetId),
    };
  });

  return {
    id: generateId("tpl"),
    name,
    description,
    category,
    createdAt: Date.now(),
    components: templateComponents,
    connections: templateConnections,
  };
}

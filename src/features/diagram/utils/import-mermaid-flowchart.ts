import type {
  Component,
  Connection,
  PanelComponent,
  ProcessNodeComponent,
  FlowNodeShape,
  NodeLayout,
  DiagramDirection,
} from "../model/diagram.types";
import { PanelKind } from "../enums";
import { generateId } from "./generate-id";

/** A non-fatal note about the import, translated by the caller (`flows.importDialog.warnings.*`). */
export interface FlowchartImportWarning {
  key: "subgraphDirectionIgnored" | "subgraphEdgeInside" | "subgraphUnclosed" | "subgraphStrayEnd";
  params: Record<string, string | number>;
}

export interface FlowchartImportPlan {
  newComponents: Component[];
  newConnections: Connection[];
  layouts: NodeLayout[];
  errors: string[];
  warnings: FlowchartImportWarning[];
  /**
   * The direction the header asks for (ADR-0013): `TD`/`TB` read top-to-bottom,
   * `LR` left-to-right. `BT` and `RL` have no Structura equivalent and take the
   * nearest, with `directionApproximated` set.
   */
  direction: DiagramDirection;
  directionApproximated: boolean;
}

/** The Structura direction for a Mermaid flowchart header's. */
function directionOfHeader(header: string): { direction: DiagramDirection; approximated: boolean } {
  const token = header.trim().split(/\s+/)[1]?.toUpperCase() ?? "LR";
  return {
    direction: token === "TD" || token === "TB" || token === "BT" ? "TB" : "LR",
    approximated: token === "BT" || token === "RL",
  };
}

const GRID_COLUMNS = 3;
const GRID_H_GAP = 220;
const GRID_V_GAP = 100;
const NODE_W = 160;
const NODE_H = 60;
const PANEL_PADDING = 40;
const EMPTY_PANEL_W = 240;
const EMPTY_PANEL_H = 140;

const FLOWCHART_HEADER_RE = /^flowchart\s+(LR|TD|TB|RL|BT)$/i;
const NODE_ID_RE = /^[A-Za-z0-9_]+/;
const BARE_NODE_RE = /^[A-Za-z0-9_]+$/;

const NODE_SHAPE_PATTERNS: ReadonlyArray<{
  re: RegExp;
  shape: FlowNodeShape;
}> = [
  { re: /^\[\[(.+?)\]\]/, shape: "subroutine" },
  { re: /^\{\{(.+?)\}\}/, shape: "hexagon" },
  { re: /^\(\[(.+?)\]\)/, shape: "stadium" },
  { re: /^\(\((.+?)\)\)/, shape: "start" },
  { re: /^\[\((.+?)\)\]/, shape: "cylinder" },
  { re: /^\/(.+?)\//, shape: "parallelogram" },
  { re: /^\{(.+?)\}/, shape: "diamond" },
  { re: /^\[(.+?)\]/, shape: "rectangle" },
  { re: /^\((.+?)\)/, shape: "rounded" },
];

type ParsedNodeDef = {
  alias: string;
  label: string;
  shape: FlowNodeShape;
  consumed: number;
};

type ParsedEdge = {
  sourceAlias: string;
  targetAlias: string;
  label: string;
  consumed: number;
  targetNodeDef?: ParsedNodeDef;
};

type AliasInfo = {
  label: string;
  shape: FlowNodeShape;
};

type SubgraphInfo = {
  id: string;
  title: string;
  parentSubgraph: string | null;
  panelId: string;
};

const SUBGRAPH_LINE_RE = /^subgraph(?:\s+(.*))?$/;
const SUBGRAPH_ID_TITLE_RE = /^([A-Za-z0-9_]+)\s*\[\s*(.*?)\s*\]$/;
const SUBGRAPH_DIRECTION_RE = /^direction\s+(TB|TD|BT|LR|RL)$/i;

function unquote(text: string): string {
  const trimmed = text.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

/** `subgraph id`, `subgraph id [Title]`, `subgraph id["Title"]`, `subgraph Title with spaces`. */
function parseSubgraphHeader(rest: string): { id: string; title: string } | null {
  const body = rest.trim();
  if (!body) return null;
  const withTitle = body.match(SUBGRAPH_ID_TITLE_RE);
  if (withTitle) {
    const title = unquote(withTitle[2]);
    return { id: withTitle[1], title: title || withTitle[1] };
  }
  const title = unquote(body);
  return title ? { id: title, title } : null;
}

function emptyPlan(errors: string[]): FlowchartImportPlan {
  return {
    newComponents: [],
    newConnections: [],
    layouts: [],
    errors,
    warnings: [],
    direction: "LR",
    directionApproximated: false,
  };
}

function isCommentLine(line: string): boolean {
  return line.startsWith("%%");
}

function findConnectionByEndpoints(
  connections: Record<string, Connection>,
  sourceId: string,
  targetId: string,
): Connection | undefined {
  return Object.values(connections).find(
    (connection) => connection.sourceId === sourceId && connection.targetId === targetId,
  );
}

function parseNodePrefix(line: string): ParsedNodeDef | null {
  const idMatch = line.match(NODE_ID_RE);
  if (!idMatch) return null;

  const alias = idMatch[0];
  const rest = line.slice(alias.length);

  for (const { re, shape } of NODE_SHAPE_PATTERNS) {
    const match = rest.match(re);
    if (!match) continue;

    const consumed = alias.length + match[0].length;
    const tail = line.slice(consumed).trim();
    if (tail.length > 0 && !/^(-->|==>|-\.->)/.test(tail)) continue;

    return {
      alias,
      label: match[1].trim(),
      shape,
      consumed,
    };
  }

  return null;
}

function finalizeEdgeWithOptionalTargetShape(
  trimmed: string,
  sourceAlias: string,
  targetAlias: string,
  label: string,
): ParsedEdge | null {
  const targetIndex = trimmed.indexOf(targetAlias);
  if (targetIndex < 0) return null;

  const nodeDef = parseNodePrefix(trimmed.slice(targetIndex));
  const hasShapeSuffix =
    nodeDef !== null && nodeDef.alias === targetAlias && nodeDef.consumed > targetAlias.length;

  const consumed = hasShapeSuffix
    ? targetIndex + nodeDef.consumed
    : targetIndex + targetAlias.length;

  if (trimmed.slice(consumed).trim().length > 0) return null;

  return {
    sourceAlias,
    targetAlias,
    label,
    consumed,
    ...(hasShapeSuffix ? { targetNodeDef: nodeDef } : {}),
  };
}

function parseEdgeSegment(line: string, implicitSource?: string): ParsedEdge | null {
  const trimmed = line.trim();

  if (implicitSource) {
    const chainPipeLabeled = trimmed.match(/^(-->|==>|-\.->)\s*\|([^|]+)\|\s*([A-Za-z0-9_]+)/);
    if (chainPipeLabeled) {
      return finalizeEdgeWithOptionalTargetShape(
        trimmed,
        implicitSource,
        chainPipeLabeled[3],
        chainPipeLabeled[2].trim(),
      );
    }

    const chainLabeled = trimmed.match(/^(-->|==>|-\.->)\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (chainLabeled) {
      return {
        sourceAlias: implicitSource,
        targetAlias: chainLabeled[2],
        label: chainLabeled[3].trim(),
        consumed: chainLabeled[0].length,
      };
    }

    const chain = trimmed.match(/^(-->|==>|-\.->)\s*([A-Za-z0-9_]+)/);
    if (chain) {
      return finalizeEdgeWithOptionalTargetShape(trimmed, implicitSource, chain[2], "");
    }

    return null;
  }

  const labeledArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
  if (labeledArrow) {
    return {
      sourceAlias: labeledArrow[1],
      targetAlias: labeledArrow[2],
      label: labeledArrow[3].trim(),
      consumed: labeledArrow[0].length,
    };
  }

  const pipeLabeledArrow = trimmed.match(
    /^([A-Za-z0-9_]+)\s*(-->|==>|-\.->)\s*\|([^|]+)\|\s*([A-Za-z0-9_]+)/,
  );
  if (pipeLabeledArrow) {
    return finalizeEdgeWithOptionalTargetShape(
      trimmed,
      pipeLabeledArrow[1],
      pipeLabeledArrow[4],
      pipeLabeledArrow[3].trim(),
    );
  }

  const plainArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*(-->|==>|-\.->)\s*([A-Za-z0-9_]+)/);
  if (plainArrow) {
    return finalizeEdgeWithOptionalTargetShape(trimmed, plainArrow[1], plainArrow[3], "");
  }

  const textArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*--\s*(.+?)\s*-->\s*([A-Za-z0-9_]+)/);
  if (textArrow) {
    return finalizeEdgeWithOptionalTargetShape(
      trimmed,
      textArrow[1],
      textArrow[3],
      textArrow[2].trim(),
    );
  }

  const thickArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*==>\s*([A-Za-z0-9_]+)/);
  if (thickArrow) {
    return finalizeEdgeWithOptionalTargetShape(trimmed, thickArrow[1], thickArrow[2], "");
  }

  const dottedArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*-\.->\s*([A-Za-z0-9_]+)/);
  if (dottedArrow) {
    return finalizeEdgeWithOptionalTargetShape(trimmed, dottedArrow[1], dottedArrow[2], "");
  }

  return null;
}

function parseEdgesFromLine(
  segment: string,
  onEdge: (edge: Omit<ParsedEdge, "consumed">) => void,
  initialImplicitSource?: string,
): boolean {
  let remaining = segment.trim();
  if (!remaining) return false;

  let implicitSource = initialImplicitSource;
  let parsedAny = false;

  while (remaining.length > 0) {
    const edge = parseEdgeSegment(remaining, implicitSource);
    if (!edge) return false;

    onEdge({
      sourceAlias: edge.sourceAlias,
      targetAlias: edge.targetAlias,
      label: edge.label,
      targetNodeDef: edge.targetNodeDef,
    });
    parsedAny = true;
    implicitSource = edge.targetAlias;
    remaining = remaining.slice(edge.consumed).trim();
  }

  return parsedAny;
}

function resolveConnection(
  sourceId: string,
  targetId: string,
  label: string,
  existingConnections: Record<string, Connection>,
  newConnections: Connection[],
): Connection {
  const existing = findConnectionByEndpoints(existingConnections, sourceId, targetId);
  if (existing) return existing;

  const fromNew = findConnectionByEndpoints(
    Object.fromEntries(newConnections.map((connection) => [connection.id, connection])),
    sourceId,
    targetId,
  );
  if (fromNew) return fromNew;

  const created: Connection = {
    id: generateId("conn"),
    sourceId,
    targetId,
    label,
    interaction: "sync",
    kind: "dependency",
  };
  newConnections.push(created);
  return created;
}

/**
 * One panel per subgraph, sized to hold its members (nested panels included). Member layouts
 * come in absolute and leave relative to their parent, like the sequence importer's boxes; the
 * scoped layout then arranges them and refits the panels.
 */
function buildSubgraphPanels(
  subgraphs: Map<string, SubgraphInfo>,
  nodes: Component[],
  layouts: NodeLayout[],
): { components: PanelComponent[]; layouts: NodeLayout[] } {
  if (subgraphs.size === 0) return { components: [], layouts: [] };

  const layoutById = new Map(layouts.map((l) => [l.elementId, l]));
  const subByPanelId = new Map([...subgraphs.values()].map((sub) => [sub.panelId, sub]));
  const childrenOf = new Map<string, string[]>();
  const addChild = (parentPanelId: string, childId: string) => {
    childrenOf.set(parentPanelId, [...(childrenOf.get(parentPanelId) ?? []), childId]);
  };
  for (const node of nodes) if (node.parentId) addChild(node.parentId, node.id);
  for (const sub of subgraphs.values()) {
    const parent = sub.parentSubgraph ? subgraphs.get(sub.parentSubgraph) : undefined;
    if (parent) addChild(parent.panelId, sub.panelId);
  }

  const bounds = new Map<string, NodeLayout>();
  const heightOf = new Map<string, number>();
  const measure = (panelId: string): NodeLayout => {
    const known = bounds.get(panelId);
    if (known) return known;
    const children = childrenOf.get(panelId) ?? [];
    const boxes = children.map((childId) =>
      subByPanelId.has(childId) ? measure(childId) : layoutById.get(childId),
    );
    const placed = boxes.filter((box): box is NodeLayout => box !== undefined);
    heightOf.set(
      panelId,
      1 + Math.max(0, ...children.map((childId) => heightOf.get(childId) ?? 0)),
    );
    const box: NodeLayout =
      placed.length === 0
        ? { elementId: panelId, x: 0, y: 0, width: EMPTY_PANEL_W, height: EMPTY_PANEL_H }
        : (() => {
            const minX = Math.min(...placed.map((b) => b.x)) - PANEL_PADDING;
            const minY = Math.min(...placed.map((b) => b.y)) - PANEL_PADDING;
            const maxX = Math.max(...placed.map((b) => b.x + (b.width ?? NODE_W))) + PANEL_PADDING;
            const maxY = Math.max(...placed.map((b) => b.y + (b.height ?? NODE_H))) + PANEL_PADDING;
            return {
              elementId: panelId,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
          })();
    bounds.set(panelId, box);
    return box;
  };
  for (const sub of subgraphs.values()) measure(sub.panelId);

  const absolute = new Map<string, { x: number; y: number }>();
  for (const [id, box] of bounds) absolute.set(id, { x: box.x, y: box.y });
  for (const l of layouts) absolute.set(l.elementId, { x: l.x, y: l.y });

  const components: PanelComponent[] = [];
  const panelLayouts: NodeLayout[] = [];
  for (const sub of subgraphs.values()) {
    const box = bounds.get(sub.panelId)!;
    const parent = sub.parentSubgraph ? subgraphs.get(sub.parentSubgraph) : undefined;
    components.push({
      id: sub.panelId,
      name: sub.title,
      description: "",
      parentId: parent ? parent.panelId : null,
      type: "panel",
      panelKind: PanelKind.Default,
    });
    const origin = parent ? absolute.get(parent.panelId)! : { x: 0, y: 0 };
    panelLayouts.push({
      ...box,
      x: box.x - origin.x,
      y: box.y - origin.y,
      zIndex: -(heightOf.get(sub.panelId) ?? 1),
    });
  }

  // Members leave relative to their panel (panel origins are the absolute ones read above).
  for (const node of nodes) {
    const layout = layoutById.get(node.id);
    const origin = node.parentId ? absolute.get(node.parentId) : undefined;
    if (layout && origin) {
      layout.x -= origin.x;
      layout.y -= origin.y;
    }
  }

  return { components, layouts: panelLayouts };
}

export function parseMermaidFlowchart(
  text: string,
  existingComponents: Record<string, Component>,
  existingConnections: Record<string, Connection>,
  anchor: { x: number; y: number },
): FlowchartImportPlan {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const firstContentLine = lines.find((line) => !isCommentLine(line));
  if (!firstContentLine || !FLOWCHART_HEADER_RE.test(firstContentLine)) {
    return emptyPlan(["Not a flowchart diagram"]);
  }
  const header = directionOfHeader(firstContentLine);

  const errors: string[] = [];
  const warnings: FlowchartImportWarning[] = [];
  const subgraphs = new Map<string, SubgraphInfo>();
  const subgraphStack: string[] = [];
  const membership = new Map<string, string>();
  let directionsIgnored = 0;
  const aliasOrder: string[] = [];
  const aliasInfo = new Map<string, AliasInfo>();
  const pendingEdges: Array<Omit<ParsedEdge, "consumed">> = [];

  const registerAlias = (alias: string, info?: Partial<AliasInfo>) => {
    if (!aliasInfo.has(alias)) {
      aliasOrder.push(alias);
      aliasInfo.set(alias, {
        label: info?.label ?? alias,
        shape: info?.shape ?? "rectangle",
      });
      return;
    }
    const current = aliasInfo.get(alias)!;
    aliasInfo.set(alias, {
      label: info?.label ?? current.label,
      shape: info?.shape ?? current.shape,
    });
  };

  for (const line of lines) {
    if (isCommentLine(line)) continue;
    if (FLOWCHART_HEADER_RE.test(line)) continue;

    const subgraphMatch = line.match(SUBGRAPH_LINE_RE);
    if (subgraphMatch) {
      const header = parseSubgraphHeader(subgraphMatch[1] ?? "");
      if (!header) {
        errors.push(`Failed to parse line: ${line}`);
        continue;
      }
      if (!subgraphs.has(header.id)) {
        subgraphs.set(header.id, {
          id: header.id,
          title: header.title,
          parentSubgraph: subgraphStack[subgraphStack.length - 1] ?? null,
          panelId: generateId("comp"),
        });
      }
      subgraphStack.push(header.id);
      continue;
    }
    if (line === "end") {
      if (subgraphStack.pop() === undefined) {
        warnings.push({ key: "subgraphStrayEnd", params: {} });
      }
      continue;
    }
    if (subgraphStack.length > 0 && SUBGRAPH_DIRECTION_RE.test(line)) {
      // A subgraph's own direction has no field on the panel; the diagram's reads along its axis.
      directionsIgnored += 1;
      continue;
    }

    const currentSubgraph = subgraphStack[subgraphStack.length - 1];
    const assign = (alias: string) => {
      // Mermaid keeps a node in the last subgraph that mentions it.
      if (currentSubgraph) membership.set(alias, currentSubgraph);
    };

    if (BARE_NODE_RE.test(line)) {
      registerAlias(line);
      assign(line);
      continue;
    }

    let remaining = line;
    let lineHandled = false;

    const nodeDef = parseNodePrefix(remaining);
    if (nodeDef) {
      registerAlias(nodeDef.alias, { label: nodeDef.label, shape: nodeDef.shape });
      assign(nodeDef.alias);
      remaining = remaining.slice(nodeDef.consumed).trim();
      lineHandled = true;
    }

    if (remaining.length > 0) {
      const chainedFromNode =
        nodeDef && /^(-->|==>|-\.->)/.test(remaining) ? nodeDef.alias : undefined;
      const edgesParsed = parseEdgesFromLine(
        remaining,
        (edge) => {
          registerAlias(edge.sourceAlias);
          assign(edge.sourceAlias);
          assign(edge.targetAlias);
          registerAlias(
            edge.targetAlias,
            edge.targetNodeDef
              ? { label: edge.targetNodeDef.label, shape: edge.targetNodeDef.shape }
              : undefined,
          );
          pendingEdges.push(edge);
        },
        chainedFromNode,
      );
      if (edgesParsed) lineHandled = true;
    }

    if (!lineHandled) {
      errors.push(`Failed to parse line: ${line}`);
    }
  }

  if (subgraphStack.length > 0) {
    warnings.push({ key: "subgraphUnclosed", params: { count: subgraphStack.length } });
  }
  if (directionsIgnored > 0) {
    warnings.push({ key: "subgraphDirectionIgnored", params: { count: directionsIgnored } });
  }

  // A subgraph id used as an edge endpoint is the panel, not a node of its own.
  for (let i = aliasOrder.length - 1; i >= 0; i -= 1) {
    if (subgraphs.has(aliasOrder[i])) aliasOrder.splice(i, 1);
  }

  const componentByLowerName = new Map<string, Component>();
  for (const component of Object.values(existingComponents)) {
    componentByLowerName.set(component.name.toLowerCase(), component);
  }

  const aliasToComponentId = new Map<string, string>();
  for (const sub of subgraphs.values()) aliasToComponentId.set(sub.id, sub.panelId);
  const newComponents: Component[] = [];
  const layouts: NodeLayout[] = [];
  const newConnections: Connection[] = [];

  let newComponentIndex = 0;
  for (const alias of aliasOrder) {
    const info = aliasInfo.get(alias)!;
    const existing = componentByLowerName.get(info.label.toLowerCase());
    if (existing) {
      aliasToComponentId.set(alias, existing.id);
      continue;
    }

    const id = generateId("comp");
    const owner = membership.get(alias);
    const component: ProcessNodeComponent = {
      id,
      name: info.label,
      description: "",
      parentId: owner ? subgraphs.get(owner)!.panelId : null,
      type: "process-node",
      flowShape: info.shape,
    };
    newComponents.push(component);
    aliasToComponentId.set(alias, id);

    const column = newComponentIndex % GRID_COLUMNS;
    const row = Math.floor(newComponentIndex / GRID_COLUMNS);
    layouts.push({
      elementId: id,
      x: anchor.x + column * GRID_H_GAP,
      y: anchor.y + row * GRID_V_GAP,
      width: NODE_W,
      height: NODE_H,
    });
    newComponentIndex += 1;
  }

  const subgraphOfAlias = (alias: string): string | undefined =>
    subgraphs.has(alias) ? alias : undefined;
  /** Whether `alias` (a node or a subgraph) sits inside the subgraph `outer`, or is it. */
  const isWithin = (alias: string, outer: string): boolean => {
    let cursor: string | null | undefined = subgraphs.has(alias)
      ? alias
      : (membership.get(alias) ?? null);
    while (cursor) {
      if (cursor === outer) return true;
      cursor = subgraphs.get(cursor)?.parentSubgraph;
    }
    return false;
  };

  for (const edge of pendingEdges) {
    const sourceId = aliasToComponentId.get(edge.sourceAlias);
    const targetId = aliasToComponentId.get(edge.targetAlias);
    if (!sourceId || !targetId) {
      errors.push(`Unresolved nodes in edge ${edge.sourceAlias} -> ${edge.targetAlias}`);
      continue;
    }
    const sourceSub = subgraphOfAlias(edge.sourceAlias);
    const targetSub = subgraphOfAlias(edge.targetAlias);
    if (
      (sourceSub && isWithin(edge.targetAlias, sourceSub)) ||
      (targetSub && isWithin(edge.sourceAlias, targetSub))
    ) {
      // A panel pointing at its own contents (or the reverse) says nothing a panel does not.
      warnings.push({
        key: "subgraphEdgeInside",
        params: { source: edge.sourceAlias, target: edge.targetAlias },
      });
      continue;
    }
    resolveConnection(sourceId, targetId, edge.label, existingConnections, newConnections);
  }

  const panels = buildSubgraphPanels(subgraphs, newComponents, layouts);
  newComponents.push(...panels.components);
  layouts.unshift(...panels.layouts);

  return {
    newComponents,
    newConnections,
    layouts,
    errors,
    warnings,
    direction: header.direction,
    directionApproximated: header.approximated,
  };
}

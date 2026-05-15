import type {
  Component,
  Connection,
  FlowNodeComponent,
  FlowNodeShape,
  NodeLayout,
} from "../model/diagram.types";
import { generateId } from "./generate-id";

export interface FlowchartImportPlan {
  newComponents: Component[];
  newConnections: Connection[];
  layouts: NodeLayout[];
  errors: string[];
}

const GRID_COLUMNS = 3;
const GRID_H_GAP = 220;
const GRID_V_GAP = 100;
const NODE_W = 160;
const NODE_H = 60;

const FLOWCHART_HEADER_RE = /^flowchart\s+(LR|TD|TB|RL|BT)$/i;
const NODE_ID_RE = /^[A-Za-z0-9_]+/;

const NODE_SHAPE_PATTERNS: ReadonlyArray<{
  re: RegExp;
  shape: FlowNodeShape;
}> = [
  { re: /^\[\[(.+?)\]\]/, shape: "subroutine" },
  { re: /^\{\{(.+?)\}\}/, shape: "hexagon" },
  { re: /^\(\[(.+?)\]\)/, shape: "stadium" },
  { re: /^\(\((.+?)\)\)/, shape: "circle" },
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

function emptyPlan(errors: string[]): FlowchartImportPlan {
  return {
    newComponents: [],
    newConnections: [],
    layouts: [],
    errors,
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
    (connection) =>
      connection.sourceId === sourceId && connection.targetId === targetId,
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
    nodeDef !== null &&
    nodeDef.alias === targetAlias &&
    nodeDef.consumed > targetAlias.length;

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

function parseEdgeSegment(
  line: string,
  implicitSource?: string,
): ParsedEdge | null {
  const trimmed = line.trim();

  if (implicitSource) {
    const chainPipeLabeled = trimmed.match(
      /^(-->|==>|-\.->)\s*\|([^|]+)\|\s*([A-Za-z0-9_]+)/,
    );
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
      return finalizeEdgeWithOptionalTargetShape(
        trimmed,
        implicitSource,
        chain[2],
        "",
      );
    }

    return null;
  }

  const labeledArrow = trimmed.match(
    /^([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/,
  );
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
    return finalizeEdgeWithOptionalTargetShape(
      trimmed,
      plainArrow[1],
      plainArrow[3],
      "",
    );
  }

  const textArrow = trimmed.match(
    /^([A-Za-z0-9_]+)\s*--\s*(.+?)\s*-->\s*([A-Za-z0-9_]+)/,
  );
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
    return finalizeEdgeWithOptionalTargetShape(
      trimmed,
      thickArrow[1],
      thickArrow[2],
      "",
    );
  }

  const dottedArrow = trimmed.match(/^([A-Za-z0-9_]+)\s*-\.->\s*([A-Za-z0-9_]+)/);
  if (dottedArrow) {
    return finalizeEdgeWithOptionalTargetShape(
      trimmed,
      dottedArrow[1],
      dottedArrow[2],
      "",
    );
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
    intent: "dependency",
  };
  newConnections.push(created);
  return created;
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

  const errors: string[] = [];
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

    let remaining = line;
    let lineHandled = false;

    const nodeDef = parseNodePrefix(remaining);
    if (nodeDef) {
      registerAlias(nodeDef.alias, { label: nodeDef.label, shape: nodeDef.shape });
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

  const componentByLowerName = new Map<string, Component>();
  for (const component of Object.values(existingComponents)) {
    componentByLowerName.set(component.name.toLowerCase(), component);
  }

  const aliasToComponentId = new Map<string, string>();
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
    const component: FlowNodeComponent = {
      id,
      name: info.label,
      description: "",
      parentId: null,
      type: "processos",
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

  for (const edge of pendingEdges) {
    const sourceId = aliasToComponentId.get(edge.sourceAlias);
    const targetId = aliasToComponentId.get(edge.targetAlias);
    if (!sourceId || !targetId) {
      errors.push(
        `Unresolved nodes in edge ${edge.sourceAlias} -> ${edge.targetAlias}`,
      );
      continue;
    }
    resolveConnection(
      sourceId,
      targetId,
      edge.label,
      existingConnections,
      newConnections,
    );
  }

  return {
    newComponents,
    newConnections,
    layouts,
    errors,
  };
}

import { PanelKind } from "@/features/diagram/enums";
import type { ComponentType } from "@/features/diagram/model/component.types";
import type { GeneratedEdgeInput, GeneratedNodeInput } from "@/features/diagram";
import type { AslComponentType, AslImportPlan, AslPlanNode, AslTransportPreset } from "@/lib/asl";
import { isPlanNote } from "@/lib/asl";
import type { LayoutBox, LayoutGraphEdge, LayoutGraphNode } from "../layout/graphLayoutEngine";
import { EMPTY_CONTAINER_H, EMPTY_CONTAINER_W } from "../layout/graphLayoutEngine";

/**
 * ASL import plan -> store input.
 *
 * Pure: everything that depends on ELK or on the store is resolved by the
 * caller, so the type mapping, the containment offsets and the note placement
 * are testable without either.
 */

/**
 * The neutral plan's component types resolved to the real domain union. A total
 * record rather than a cast: adding a type to the plan then fails to compile
 * here, which is where the decision belongs.
 */
const COMPONENT_TYPE: Record<AslComponentType, ComponentType> = {
  panel: "panel",
  note: "note",
  container: "container",
  "aws-compute": "aws-compute",
  "aws-database": "aws-database",
  "aws-integration": "aws-integration",
  "aws-networking": "aws-networking",
  "azure-database": "azure-database",
};

/** Same treatment for the transport presets the connection model accepts. */
const TRANSPORT_PRESET: Record<AslTransportPreset, "sync" | "async" | "event"> = {
  sync: "sync",
  async: "async",
  event: "event",
};

/** Gap between a note and the node it annotates, in flow units. */
const NOTE_GAP = 64;
const NOTE_W = 320;
const NOTE_H = 220;

/**
 * Nodes that take part in the layout. Notes are excluded for the same reason
 * the canvas auto-layout excludes them: an annotation is not a step in the
 * flow, and feeding it to ELK distorts the layers in exchange for nothing.
 */
export function toLayoutGraph(plan: AslImportPlan): {
  nodes: LayoutGraphNode[];
  edges: LayoutGraphEdge[];
} {
  const laidOut = plan.nodes.filter((node) => !isPlanNote(node));
  const laidOutKeys = new Set(laidOut.map((node) => node.key));

  return {
    nodes: laidOut.map((node) => ({
      id: node.key,
      parentId: node.parentKey !== null && laidOutKeys.has(node.parentKey) ? node.parentKey : null,
      isContainer: node.isContainer || node.componentType === "panel",
    })),
    edges: plan.edges
      .filter((edge) => laidOutKeys.has(edge.sourceKey) && laidOutKeys.has(edge.targetKey))
      .map((edge) => ({ id: edge.key, sourceId: edge.sourceKey, targetId: edge.targetKey })),
  };
}

/** Absolute position of a box, walking up the parent chain. */
function absolutePosition(
  key: string,
  parentByKey: ReadonlyMap<string, string>,
  boxes: ReadonlyMap<string, LayoutBox>,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: string | undefined = key;
  const seen = new Set<string>();
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const box = boxes.get(current);
    if (box) {
      x += box.x;
      y += box.y;
    }
    current = parentByKey.get(current);
  }
  return { x, y };
}

/** Right edge of everything that was laid out — where unanchored notes stack up. */
function layoutRightEdge(boxes: ReadonlyMap<string, LayoutBox>): number {
  let right = 0;
  for (const box of boxes.values()) {
    right = Math.max(right, box.x + box.width);
  }
  return right;
}

export interface AslGraphInputs {
  nodes: GeneratedNodeInput[];
  edges: GeneratedEdgeInput[];
}

function baseNode(node: AslPlanNode): Omit<GeneratedNodeInput, "x" | "y"> {
  const type = COMPONENT_TYPE[node.componentType];
  return {
    externalId: node.key,
    type,
    name: node.name,
    parentExternalId: node.parentKey,
    ...(type === "panel" ? { panelKind: PanelKind.Default } : {}),
    ...(node.cloudService !== undefined ? { awsService: node.cloudService } : {}),
    ...(node.technology !== undefined ? { technology: node.technology } : {}),
    ...(node.description !== "" ? { description: node.description } : {}),
    ...(node.tags.length > 0 ? { tags: node.tags } : {}),
  };
}

/**
 * Turns a laid-out ASL plan into store input.
 *
 * Root positions are canvas-absolute, child positions are relative to the
 * parent — the same convention React Flow uses, and what ELK hands back. Only
 * containers are sized from the layout: their box has to hold the children,
 * while leaf nodes keep their intrinsic DOM size.
 */
export function buildAslGraphInputs(
  plan: AslImportPlan,
  boxes: ReadonlyMap<string, LayoutBox>,
  origin: { x: number; y: number },
  labelPositions: ReadonlyMap<string, number> = new Map(),
): AslGraphInputs {
  const parentByKey = new Map<string, string>();
  for (const node of plan.nodes) {
    if (node.parentKey !== null) parentByKey.set(node.key, node.parentKey);
  }

  const nodes: GeneratedNodeInput[] = [];
  let noteStackY = 0;
  const noteColumnX = layoutRightEdge(boxes) + NOTE_GAP;

  plan.nodes.forEach((node, index) => {
    if (isPlanNote(node)) return;

    const box = boxes.get(node.key);
    const isRoot = node.parentKey === null;
    const x = (box?.x ?? index * 240) + (isRoot ? origin.x : 0);
    const y = (box?.y ?? 0) + (isRoot ? origin.y : 0);

    const isContainer = node.componentType === "panel" || node.isContainer;
    nodes.push({
      ...baseNode(node),
      x,
      y,
      ...(isContainer && box !== undefined
        ? {
            width: Math.max(box.width, EMPTY_CONTAINER_W),
            height: Math.max(box.height, EMPTY_CONTAINER_H),
          }
        : {}),
    });
  });

  // Notes are placed once the geometry is known: beside the node they annotate,
  // or stacked to the right of the diagram when the document names no target.
  for (const node of plan.nodes) {
    if (!isPlanNote(node)) continue;

    let x: number;
    let y: number;
    const anchorBox = node.anchorKey !== undefined ? boxes.get(node.anchorKey) : undefined;
    if (node.anchorKey !== undefined && anchorBox !== undefined) {
      const absolute = absolutePosition(node.anchorKey, parentByKey, boxes);
      x = absolute.x + anchorBox.width + NOTE_GAP + origin.x;
      y = absolute.y + origin.y;
    } else {
      x = noteColumnX + origin.x;
      y = noteStackY + origin.y;
      noteStackY += NOTE_H + NOTE_GAP;
    }

    nodes.push({
      ...baseNode(node),
      // A note is never nested: `canBeParent` is false for it on the canvas, so
      // it always lands at the root whatever the plan said about its anchor.
      parentExternalId: null,
      x,
      y,
      width: NOTE_W,
      height: NOTE_H,
    });
  }

  const edges: GeneratedEdgeInput[] = plan.edges.map((edge) => ({
    sourceExternalId: edge.sourceKey,
    targetExternalId: edge.targetKey,
    label: edge.label,
    ...(edge.description !== "" ? { description: edge.description } : {}),
    intent: edge.intent,
    ...(edge.transportPreset !== undefined
      ? { transportPreset: TRANSPORT_PRESET[edge.transportPreset] }
      : {}),
    ...(labelPositions.has(edge.key) ? { labelPosition: labelPositions.get(edge.key) } : {}),
  }));

  return { nodes, edges };
}

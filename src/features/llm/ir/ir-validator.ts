import {
  isBoundaryNode,
  isIRDiagramType,
  isSemanticType,
  isTier,
  type DiagramIR,
  type IREdge,
  type IRNode,
} from "./ir.types";

/**
 * Issue codes double as i18n key suffixes (`llmChat.ir.issue.<code>`), so the
 * validator stays free of user-visible strings while still explaining itself.
 */
export type IRIssueCode =
  | "invalidJson"
  | "notAnObject"
  | "invalidDiagramType"
  | "nodesNotArray"
  | "edgesNotArray"
  | "emptyNodes"
  | "nodeNotAnObject"
  | "nodeMissingId"
  | "nodeDuplicateId"
  | "nodeMissingName"
  | "nodeInvalidSemanticType"
  | "nodeInvalidTier"
  | "nodeInvalidParentId"
  | "nodeInvalidBoundary"
  | "nodeChildrenWithoutBoundary"
  | "nodeParentNotFound"
  | "nodeSelfParent"
  | "containmentCycle"
  | "edgeNotAnObject"
  | "edgeMissingId"
  | "edgeDuplicateId"
  | "edgeSourceNotFound"
  | "edgeTargetNotFound";

export interface IRValidationIssue {
  code: IRIssueCode;
  /** Interpolation values for the matching i18n message. */
  params?: Record<string, string | number>;
}

export type IRValidationResult =
  { ok: true; ir: DiagramIR } | { ok: false; issues: IRValidationIssue[] };

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pulls the IR object out of a raw model response: bare JSON, a ```json fence,
 * or JSON surrounded by prose. Mirrors the tolerance of `parseLLMResponse`.
 */
export function extractIRJson(rawResponse: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = rawResponse.trim();
  if (!trimmed) {
    return { ok: false };
  }

  const candidates: string[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }
  candidates.push(trimmed.replace(ZERO_WIDTH_RE, "").trim());

  const firstObject = trimmed.match(/\{[\s\S]*\}/);
  if (firstObject) {
    candidates.push(firstObject[0]);
  }

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown };
    } catch {
      // try the next candidate
    }
  }

  return { ok: false };
}

/** Walks parentId chains and reports every containment cycle exactly once. */
function collectContainmentCycles(parentById: Map<string, string>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();

  for (const startId of parentById.keys()) {
    if (state.has(startId)) continue;

    const path: string[] = [];
    const indexInPath = new Map<string, number>();
    let currentId: string | undefined = startId;

    while (currentId !== undefined && !state.has(currentId)) {
      indexInPath.set(currentId, path.length);
      path.push(currentId);
      state.set(currentId, "visiting");
      currentId = parentById.get(currentId);
    }

    if (currentId !== undefined && state.get(currentId) === "visiting") {
      const cycleStart = indexInPath.get(currentId);
      if (cycleStart !== undefined) {
        cycles.push(path.slice(cycleStart));
      }
    }

    for (const id of path) {
      state.set(id, "done");
    }
  }

  return cycles;
}

function validateNodes(
  rawNodes: unknown[],
  issues: IRValidationIssue[],
): { nodes: IRNode[]; idsSeen: Set<string> } {
  const nodes: IRNode[] = [];
  const idsSeen = new Set<string>();

  rawNodes.forEach((rawNode, index) => {
    if (!isObject(rawNode)) {
      issues.push({ code: "nodeNotAnObject", params: { index } });
      return;
    }
    if (!nonEmptyString(rawNode.id)) {
      issues.push({ code: "nodeMissingId", params: { index } });
      return;
    }
    const id = rawNode.id;
    if (idsSeen.has(id)) {
      issues.push({ code: "nodeDuplicateId", params: { id } });
      return;
    }
    idsSeen.add(id);

    let valid = true;
    if (!nonEmptyString(rawNode.name)) {
      issues.push({ code: "nodeMissingName", params: { id } });
      valid = false;
    }
    if (!isSemanticType(rawNode.semanticType)) {
      issues.push({
        code: "nodeInvalidSemanticType",
        params: { id, value: String(rawNode.semanticType) },
      });
      valid = false;
    }
    if (!isTier(rawNode.tier)) {
      issues.push({ code: "nodeInvalidTier", params: { id, value: String(rawNode.tier) } });
      valid = false;
    }
    const parentIdRaw = rawNode.parentId ?? null;
    if (parentIdRaw !== null && !nonEmptyString(parentIdRaw)) {
      issues.push({ code: "nodeInvalidParentId", params: { id } });
      valid = false;
    }
    const boundaryRaw = rawNode.isBoundary;
    if (boundaryRaw !== undefined && typeof boundaryRaw !== "boolean") {
      issues.push({ code: "nodeInvalidBoundary", params: { id } });
      valid = false;
    }

    if (!valid || !isSemanticType(rawNode.semanticType) || !isTier(rawNode.tier)) {
      return;
    }

    nodes.push({
      id,
      semanticType: rawNode.semanticType,
      name: String(rawNode.name),
      parentId: typeof parentIdRaw === "string" ? parentIdRaw : null,
      tier: rawNode.tier,
      ...(nonEmptyString(rawNode.technology) ? { technology: rawNode.technology } : {}),
      ...(nonEmptyString(rawNode.awsService)
        ? { awsService: rawNode.awsService.trim().toLowerCase() }
        : {}),
      // Normalized so downstream never has to re-derive it from the semanticType.
      ...(isBoundaryNode({ semanticType: rawNode.semanticType, isBoundary: boundaryRaw === true })
        ? { isBoundary: true }
        : {}),
    });
  });

  return { nodes, idsSeen };
}

/**
 * `declaredIds` holds every id the model declared, including nodes dropped for
 * other schema errors — referencing one of those is already reported at the
 * node, so re-reporting it here would just be noise.
 */
function validateContainment(
  nodes: IRNode[],
  declaredIds: Set<string>,
  issues: IRValidationIssue[],
): void {
  const nodeIds = declaredIds;
  const parentById = new Map<string, string>();

  for (const node of nodes) {
    if (node.parentId === null) continue;
    if (node.parentId === node.id) {
      issues.push({ code: "nodeSelfParent", params: { id: node.id } });
      continue;
    }
    if (!nodeIds.has(node.parentId)) {
      issues.push({ code: "nodeParentNotFound", params: { id: node.id, parentId: node.parentId } });
      continue;
    }
    parentById.set(node.id, node.parentId);
  }

  for (const cycle of collectContainmentCycles(parentById)) {
    issues.push({ code: "containmentCycle", params: { ids: cycle.join(" -> ") } });
  }

  // Only a boundary may contain other nodes. The reverse is allowed on purpose:
  // an empty VPC or a not-yet-populated AZ is still a boundary.
  const parentsWithChildren = new Set(parentById.values());
  for (const node of nodes) {
    if (parentsWithChildren.has(node.id) && !isBoundaryNode(node)) {
      issues.push({ code: "nodeChildrenWithoutBoundary", params: { id: node.id } });
    }
  }
}

function validateEdges(
  rawEdges: unknown[],
  nodeIds: Set<string>,
  issues: IRValidationIssue[],
): IREdge[] {
  const edges: IREdge[] = [];
  const idsSeen = new Set<string>();

  rawEdges.forEach((rawEdge, index) => {
    if (!isObject(rawEdge)) {
      issues.push({ code: "edgeNotAnObject", params: { index } });
      return;
    }
    if (!nonEmptyString(rawEdge.id)) {
      issues.push({ code: "edgeMissingId", params: { index } });
      return;
    }
    const id = rawEdge.id;
    if (idsSeen.has(id)) {
      issues.push({ code: "edgeDuplicateId", params: { id } });
      return;
    }
    idsSeen.add(id);

    const sourceId = rawEdge.sourceId;
    const targetId = rawEdge.targetId;
    let valid = true;
    if (!nonEmptyString(sourceId) || !nodeIds.has(sourceId)) {
      issues.push({ code: "edgeSourceNotFound", params: { id, ref: String(sourceId) } });
      valid = false;
    }
    if (!nonEmptyString(targetId) || !nodeIds.has(targetId)) {
      issues.push({ code: "edgeTargetNotFound", params: { id, ref: String(targetId) } });
      valid = false;
    }
    if (!valid || typeof sourceId !== "string" || typeof targetId !== "string") {
      return;
    }

    edges.push({
      id,
      sourceId,
      targetId,
      ...(typeof rawEdge.label === "string" ? { label: rawEdge.label } : {}),
    });
  });

  return edges;
}

/** Validates an already-parsed value against the IR schema (spec §4). */
export function validateIR(value: unknown): IRValidationResult {
  const issues: IRValidationIssue[] = [];

  if (!isObject(value)) {
    return { ok: false, issues: [{ code: "notAnObject" }] };
  }

  if (!isIRDiagramType(value.type)) {
    issues.push({ code: "invalidDiagramType", params: { value: String(value.type) } });
  }

  const rawNodes = value.nodes;
  const rawEdges = value.edges ?? [];

  if (!Array.isArray(rawNodes)) {
    issues.push({ code: "nodesNotArray" });
  }
  if (!Array.isArray(rawEdges)) {
    issues.push({ code: "edgesNotArray" });
  }
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
    return { ok: false, issues };
  }

  if (rawNodes.length === 0) {
    issues.push({ code: "emptyNodes" });
  }

  const { nodes, idsSeen } = validateNodes(rawNodes, issues);
  validateContainment(nodes, idsSeen, issues);
  const edges = validateEdges(rawEdges, idsSeen, issues);

  if (issues.length > 0 || !isIRDiagramType(value.type)) {
    return { ok: false, issues };
  }

  return { ok: true, ir: { type: value.type, nodes, edges } };
}

/** Extracts the IR object from a raw model response and validates it. */
export function parseAndValidateIR(rawResponse: string): IRValidationResult {
  const extracted = extractIRJson(rawResponse);
  if (!extracted.ok) {
    return { ok: false, issues: [{ code: "invalidJson" }] };
  }
  return validateIR(extracted.value);
}

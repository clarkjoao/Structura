/**
 * Geometric and semantic validators.
 *
 * These run on the engine's output. Every fix they propose is expressed as an IR edit:
 * the model changes intent, the engine re-derives geometry. None of them may suggest a
 * coordinate.
 */

import { LAYOUT, MAX_PRIMARY_NODES, labelMaskWidth, LABEL_MASK } from "../layout-engine/constants";
import { AWS_SERVICE_MAP } from "../catalogs/aws";
import { hasArrowheadClearance, type Rect } from "../layout-engine/edge-ports";
import {
  boundaryRect,
  nodeRect,
  type LayoutBoundary,
  type LayoutNode,
  type LayoutState,
} from "../layout-engine/types";
import {
  collinearOverlap,
  overlapArea,
  rectCentre,
  rectContains,
  rectToPointDistance,
  segmentIntersectsRect,
  segmentLength,
  segmentsIntersect,
  type Segment,
} from "./geometry";
import { SCORE_WEIGHTS, type Diagnostic, type ReadabilityScore } from "./types";

/** Straight centre-to-centre segment for a connection. */
function connectionSegment(state: LayoutState, from: string, to: string): Segment | null {
  const source = state.nodes.get(from);
  const target = state.nodes.get(to);
  if (!source || !target) return null;
  return { a: rectCentre(nodeRect(source)), b: rectCentre(nodeRect(target)) };
}

function nameOf(state: LayoutState, id: string): string {
  return state.nodes.get(id)?.name ?? id;
}

export function validateNodes(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes = [...state.nodes.values()];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const area = overlapArea(nodeRect(a), nodeRect(b));
      if (area <= 0) continue;

      diagnostics.push({
        code: "node/overlap",
        severity: "error",
        class: "geometry",
        message: `"${a.name}" and "${b.name}" overlap, so both are partly hidden.`,
        subject: { kind: "node", ids: [a.id, b.id] },
        evidence: { overlapArea: Math.round(area), tierA: a.tier, tierB: b.tier },
        supportedFixes:
          a.tier === b.tier
            ? [
                {
                  action: "increase-density",
                  description: `Both sit in the "${a.tier}" tier. Raise the density hint so the tier gets more room, or move one to a different tier.`,
                },
                {
                  action: "reduce-nodes",
                  description: `Drop or merge less important elements in the "${a.tier}" tier.`,
                },
              ]
            : [
                {
                  action: "move-tier",
                  description: `Move "${a.name}" or "${b.name}" to a tier that matches its role.`,
                },
              ],
      });
    }
  }

  for (const node of nodes) {
    if (node.width <= LAYOUT.NODE_MAX_W) continue;
    diagnostics.push({
      code: "node/clipped-label",
      severity: "error",
      class: "geometry",
      message: `The label on "${node.name}" is wider than a node can render, so it will be cut off.`,
      subject: { kind: "node", ids: [node.id] },
      evidence: { measuredWidth: node.width, maxWidth: LAYOUT.NODE_MAX_W },
      supportedFixes: [
        {
          action: "shorten-label",
          description: `Shorten the name, technology or description on "${node.name}".`,
        },
      ],
    });
  }

  return diagnostics;
}

/**
 * Checks every AWS node has a recognised `awsService` name.
 *
 * The icon rendered for an AWS node comes from the `awsService` field — an unknown name
 * silently produces a broken or missing icon. This validator catches that class of error
 * at the structural layer before the user ever sees the canvas.
 */
export function validateAwsServiceNames(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const node of state.nodes.values()) {
    if (!node.type.startsWith("aws-")) continue;
    if (!node.awsService) {
      diagnostics.push({
        code: "aws/unknown-service",
        severity: "error",
        class: "geometry",
        message: `"${node.name}" is an AWS node but has no aws_service. Pick one from the catalog, e.g. "lambda", "rds", "sqs".`,
        subject: { kind: "node", ids: [node.id] },
        evidence: { type: node.type },
        supportedFixes: [
          {
            action: "set-aws-service",
            description: `Add an aws_service field to "${node.name}" with a valid service id.`,
          },
        ],
      });
      continue;
    }

    if (!AWS_SERVICE_MAP.has(node.awsService)) {
      // Try a fuzzy suggestion — partial match on known names.
      const suggestions: string[] = [];
      for (const [id] of AWS_SERVICE_MAP) {
        if (id.includes(node.awsService) || node.awsService.includes(id)) {
          suggestions.push(id);
          if (suggestions.length >= 3) break;
        }
      }

      diagnostics.push({
        code: "aws/unknown-service",
        severity: "error",
        class: "geometry",
        message: `"${node.awsService}" is not a known AWS service for "${node.name}".`,
        subject: { kind: "node", ids: [node.id] },
        evidence: { given: node.awsService, suggestions: suggestions.join(", ") },
        supportedFixes: [
          {
            action: "set-aws-service",
            description: suggestions.length
              ? `Did you mean: ${suggestions.join(", ")}?`
              : `Check the AWS service catalog and set a valid aws_service id.`,
          },
        ],
      });
    }
  }

  return diagnostics;
}

export function validateBoundaries(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const boundary of state.boundaries.values()) {
    if (boundary.contains.length === 0 && !hasChildBoundary(state, boundary)) {
      diagnostics.push({
        code: "boundary/empty",
        severity: "warning",
        class: "geometry",
        message: `Boundary "${boundary.name}" has no members, so it adds a box without adding meaning.`,
        subject: { kind: "boundary", ids: [boundary.id] },
        supportedFixes: [
          {
            action: "remove-boundary",
            description: `Remove "${boundary.name}", or assign the nodes that belong to it.`,
          },
        ],
      });
      continue;
    }

    for (const nodeId of boundary.contains) {
      const node = state.nodes.get(nodeId);
      if (!node) continue;
      if (rectContains(boundaryRect(boundary), nodeRect(node))) continue;

      diagnostics.push({
        code: "boundary/child-outside",
        severity: "error",
        class: "geometry",
        message: `"${node.name}" is listed inside "${boundary.name}" but is drawn outside it.`,
        subject: { kind: "boundary", ids: [boundary.id, node.id] },
        evidence: { nodeTier: node.tier },
        supportedFixes: [
          {
            action: "unassign-boundary",
            description: `Remove "${node.name}" from "${boundary.name}" if it does not belong there.`,
          },
          {
            action: "split-boundary",
            description: `Split "${boundary.name}" so its members sit in adjacent tiers.`,
          },
        ],
      });
    }
  }

  return diagnostics;
}

function hasChildBoundary(state: LayoutState, boundary: LayoutBoundary): boolean {
  for (const candidate of state.boundaries.values()) {
    if (candidate.parentBoundaryId === boundary.id) return true;
  }
  return false;
}

export function validateEdges(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const segments = new Map<string, Segment>();

  for (const connection of state.connections) {
    const segment = connectionSegment(state, connection.from, connection.to);
    if (segment) segments.set(connection.id, segment);
  }

  // An edge running through an unrelated node is the single worst readability defect.
  for (const connection of state.connections) {
    const segment = segments.get(connection.id);
    if (!segment) continue;

    // Edges into the cross-cutting band are exempt. The band sits below the whole flow by
    // design, so an edge reaching it must cross whatever rows lie between — that is a
    // consequence of the layout convention, not something the author can fix by changing
    // intent. Reporting it would leave the model with no valid move: this validator would
    // push it to drop the edge while c4/cross-cutting-no-entry pushes it to add one.
    const touchesCrossCuttingBand =
      state.nodes.get(connection.from)?.tier === "cross-cutting" ||
      state.nodes.get(connection.to)?.tier === "cross-cutting";
    if (touchesCrossCuttingBand) continue;

    for (const node of state.nodes.values()) {
      if (node.id === connection.from || node.id === connection.to) continue;
      if (!segmentIntersectsRect(segment, nodeRect(node))) continue;

      diagnostics.push({
        code: "edge/crosses-node",
        severity: "error",
        class: "geometry",
        message: `The connection from "${nameOf(state, connection.from)}" to "${nameOf(
          state,
          connection.to,
        )}" runs straight through "${node.name}".`,
        subject: { kind: "edge", ids: [connection.id, node.id] },
        evidence: { blockingNode: node.name, blockingTier: node.tier },
        supportedFixes: [
          {
            action: "increase-density",
            description: `Raise the density hint so tiers get wider routing corridors.`,
          },
        ],
      });
    }
  }

  // Collinear runs read as one line, hiding a relationship.
  const entries = [...segments.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [idA, segmentA] = entries[i]!;
      const [idB, segmentB] = entries[j]!;
      if (!collinearOverlap(segmentA, segmentB, LAYOUT.ARROWHEAD_CLEARANCE)) continue;

      diagnostics.push({
        code: "edge/stacked",
        severity: "warning",
        class: "geometry",
        message: `Connections "${idA}" and "${idB}" run along the same line, so they read as one.`,
        subject: { kind: "edge", ids: [idA, idB] },
        supportedFixes: [
          {
            action: "drop-edge",
            description: `Remove one if it is redundant, or move an endpoint so the paths separate.`,
          },
        ],
      });
    }
  }

  for (const connection of state.connections) {
    const source = state.nodes.get(connection.from);
    const target = state.nodes.get(connection.to);
    if (!source || !target) continue;
    if (hasArrowheadClearance(nodeRect(source), nodeRect(target))) continue;

    diagnostics.push({
      code: "edge/arrowhead-clearance",
      severity: "warning",
      class: "geometry",
      message: `"${source.name}" and "${target.name}" sit too close for the arrow between them to render cleanly.`,
      subject: { kind: "edge", ids: [connection.id] },
      evidence: { required: LAYOUT.ARROWHEAD_CLEARANCE },
      supportedFixes: [
        {
          action: "increase-density",
          description: `Raise the density hint to widen the gap between tiers.`,
        },
      ],
    });
  }

  return diagnostics;
}

export function validateLabels(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const connection of state.connections) {
    if (!connection.label) continue;
    const segment = connectionSegment(state, connection.from, connection.to);
    if (!segment) continue;

    const midpoint = {
      x: (segment.a.x + segment.b.x) / 2,
      y: (segment.a.y + segment.b.y) / 2,
    };
    const required = labelMaskWidth(connection.label) / 2 + LABEL_MASK.BREATHING_ROOM;

    for (const node of state.nodes.values()) {
      if (node.id === connection.from || node.id === connection.to) continue;
      const distance = rectToPointDistance(nodeRect(node), midpoint);
      if (distance >= required) continue;

      diagnostics.push({
        code: "label/clearance",
        severity: "warning",
        class: "geometry",
        message: `The label "${connection.label}" sits too close to "${node.name}" to stay readable.`,
        subject: { kind: "label", ids: [connection.id, node.id] },
        evidence: { clearance: Math.round(distance), required: Math.round(required) },
        supportedFixes: [
          {
            action: "shorten-label",
            description: `Shorten "${connection.label}" so it needs less room.`,
          },
          {
            action: "remove-label",
            description: `Drop the label if the connection is self-evident.`,
          },
        ],
      });
      break;
    }
  }

  // Labels colliding with each other.
  const labelled = state.connections.filter((connection) => connection.label);
  for (let i = 0; i < labelled.length; i += 1) {
    for (let j = i + 1; j < labelled.length; j += 1) {
      const a = labelled[i]!;
      const b = labelled[j]!;
      const segmentA = connectionSegment(state, a.from, a.to);
      const segmentB = connectionSegment(state, b.from, b.to);
      if (!segmentA || !segmentB) continue;

      const midA = { x: (segmentA.a.x + segmentA.b.x) / 2, y: (segmentA.a.y + segmentA.b.y) / 2 };
      const midB = { x: (segmentB.a.x + segmentB.b.x) / 2, y: (segmentB.a.y + segmentB.b.y) / 2 };

      const required = (labelMaskWidth(a.label!) + labelMaskWidth(b.label!)) / 2;
      const distance = Math.hypot(midA.x - midB.x, midA.y - midB.y);
      if (distance >= required) continue;

      diagnostics.push({
        code: "label/collision",
        severity: "warning",
        class: "geometry",
        message: `Labels "${a.label}" and "${b.label}" overlap each other.`,
        subject: { kind: "label", ids: [a.id, b.id] },
        evidence: { distance: Math.round(distance), required: Math.round(required) },
        supportedFixes: [
          {
            action: "remove-label",
            description: `Drop whichever of "${a.label}" / "${b.label}" adds less information.`,
          },
        ],
      });
    }
  }

  return diagnostics;
}

export function validateFlow(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tierIndex = new Map(state.tiers.map((tier, index) => [tier, index]));

  for (const connection of state.connections) {
    if (!connection.isPrimaryPath) continue;
    const source = state.nodes.get(connection.from);
    const target = state.nodes.get(connection.to);
    if (!source || !target) continue;

    const from = tierIndex.get(source.tier) ?? 0;
    const to = tierIndex.get(target.tier) ?? 0;
    if (to >= from) continue;

    diagnostics.push({
      code: "flow/non-monotonic",
      severity: "warning",
      class: "ir",
      message: `The main flow doubles back: "${source.name}" (${source.tier}) points to "${target.name}" (${target.tier}), against the left-to-right reading order.`,
      subject: { kind: "edge", ids: [connection.id] },
      evidence: { fromTier: source.tier, toTier: target.tier },
      supportedFixes: [
        {
          action: "reverse-edge",
          description: `Reverse the connection if the direction is wrong.`,
        },
      ],
    });
  }

  const connected = new Set<string>();
  for (const connection of state.connections) {
    connected.add(connection.from);
    connected.add(connection.to);
  }

  for (const node of state.nodes.values()) {
    // Cross-cutting services are deliberately unconnected; that is the convention.
    if (node.tier === "cross-cutting") continue;
    if (connected.has(node.id)) continue;

    diagnostics.push({
      code: "flow/orphan-node",
      severity: "warning",
      class: "ir",
      message: `"${node.name}" has no connections, so its role in the diagram is unclear.`,
      subject: { kind: "node", ids: [node.id] },
      supportedFixes: [
        { action: "add-edge", description: `Connect "${node.name}" to what it talks to.` },
        {
          action: "mark-cross-cutting",
          description: `Move "${node.name}" to the cross-cutting tier if it is a supporting service.`,
        },
        { action: "reduce-nodes", description: `Remove "${node.name}" if it is not relevant.` },
      ],
    });
  }

  return diagnostics;
}

export function validateComposition(state: LayoutState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const crossCutting = [...state.nodes.values()].filter((node) => node.tier === "cross-cutting");
  const primary = [...state.nodes.values()].filter((node) => node.tier !== "cross-cutting");

  if (primary.length > MAX_PRIMARY_NODES) {
    diagnostics.push({
      code: "c4/too-many-primary",
      severity: "warning",
      class: "geometry",
      message: `This diagram has ${primary.length} primary elements. Past about ${MAX_PRIMARY_NODES} it stops being readable at a glance.`,
      subject: { kind: "node", ids: primary.map((node) => node.id) },
      evidence: { count: primary.length, limit: MAX_PRIMARY_NODES },
      supportedFixes: [
        {
          action: "reduce-nodes",
          description: `Split this into a higher-level diagram plus one per subsystem, or drop secondary elements.`,
        },
        {
          action: "mark-cross-cutting",
          description: `Move supporting services to the cross-cutting tier.`,
        },
      ],
    });
  }

  const referenced = new Set<string>();
  for (const connection of state.connections) {
    referenced.add(connection.from);
    referenced.add(connection.to);
  }

  for (const node of crossCutting) {
    if (referenced.has(node.id)) continue;
    diagnostics.push({
      code: "c4/cross-cutting-no-entry",
      severity: "warning",
      class: "geometry",
      message: `"${node.name}" sits in the cross-cutting band with nothing pointing at it, so a reader cannot tell what uses it.`,
      subject: { kind: "node", ids: [node.id] },
      supportedFixes: [
        {
          action: "add-edge",
          description: `Connect "${node.name}" to at least one representative consumer.`,
        },
        {
          action: "reduce-nodes",
          description: `Remove "${node.name}" if it is not part of this diagram's story.`,
        },
      ],
    });
  }

  return diagnostics;
}

/** Readability score. Lower is better; never blocks. */
export function scoreReadability(state: LayoutState): ReadabilityScore {
  const routes: Array<{ segment: Segment; from: string; to: string }> = [];
  let throughVertexRoutes = 0;
  let totalEdgeLength = 0;

  for (const connection of state.connections) {
    const segment = connectionSegment(state, connection.from, connection.to);
    if (!segment) continue;
    routes.push({ segment, from: connection.from, to: connection.to });
    totalEdgeLength += segmentLength(segment);

    for (const node of state.nodes.values()) {
      if (node.id === connection.from || node.id === connection.to) continue;
      if (segmentIntersectsRect(segment, nodeRect(node))) throughVertexRoutes += 1;
    }
  }

  let edgeCrossings = 0;
  for (let i = 0; i < routes.length; i += 1) {
    for (let j = i + 1; j < routes.length; j += 1) {
      const a = routes[i]!;
      const b = routes[j]!;

      // Edges meeting at a shared node are not a crossing — they are a fan-out, and the
      // centre-to-centre segments trivially intersect at that shared centre. Counting them
      // would penalise every hub in proportion to its degree and drown out real crossings.
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;

      if (segmentsIntersect(a.segment, b.segment)) edgeCrossings += 1;
    }
  }

  const score =
    throughVertexRoutes * SCORE_WEIGHTS.THROUGH_VERTEX +
    edgeCrossings * SCORE_WEIGHTS.CROSSING +
    totalEdgeLength * SCORE_WEIGHTS.LENGTH;

  return {
    throughVertexRoutes,
    edgeCrossings,
    totalEdgeLength: Math.round(totalEdgeLength),
    score: Math.round(score * 100) / 100,
  };
}

/** Absolute rect of any laid-out element, for callers outside the engine. */
export function rectOf(element: LayoutNode | LayoutBoundary): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

/**
 * Structural validators (`ir/*`).
 *
 * These run on the IR before the layout engine does any work. They are cheap, and a bad
 * reference here makes every geometric finding downstream meaningless — an edge to a node
 * that does not exist cannot be checked for crossings.
 */

import type { Diagnostic } from "./types";

/** Minimal IR shape these validators need. Keeps them independent of the Zod schema. */
export interface StructuralInput {
  nodes: ReadonlyArray<{ id: string; name: string; tier: string }>;
  boundaries?: ReadonlyArray<{
    id: string;
    name: string;
    contains: readonly string[];
    parent_boundary_id?: string;
  }>;
  connections?: ReadonlyArray<{ id: string; from: string; to: string; label?: string }>;
}

export function validateStructure(ir: StructuralInput): Diagnostic[] {
  return [
    ...duplicateIds(ir),
    ...unknownReferences(ir),
    ...boundaryCycles(ir),
    ...nodesInTwoBoundaries(ir),
  ];
}

function duplicateIds(ir: StructuralInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, string>();
  const duplicates = new Map<string, string[]>();

  const record = (id: string, kind: string) => {
    const previous = seen.get(id);
    if (previous) {
      const existing = duplicates.get(id) ?? [previous];
      existing.push(kind);
      duplicates.set(id, existing);
      return;
    }
    seen.set(id, kind);
  };

  for (const node of ir.nodes) record(node.id, "node");
  for (const boundary of ir.boundaries ?? []) record(boundary.id, "boundary");
  for (const connection of ir.connections ?? []) record(connection.id, "connection");

  for (const [id, kinds] of duplicates) {
    diagnostics.push({
      code: "ir/duplicate-id",
      severity: "error",
      message: `The id "${id}" is used by more than one element (${kinds.join(", ")}). Ids must be unique across nodes, boundaries and connections.`,
      subject: { kind: "node", ids: [id] },
      evidence: { occurrences: kinds.length },
      supportedFixes: [
        {
          action: "rename-id",
          description: `Give each element using "${id}" its own id.`,
        },
      ],
    });
  }

  return diagnostics;
}

function unknownReferences(ir: StructuralInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodeIds = new Set(ir.nodes.map((node) => node.id));
  const boundaryIds = new Set((ir.boundaries ?? []).map((boundary) => boundary.id));

  for (const connection of ir.connections ?? []) {
    for (const [end, id] of [
      ["from", connection.from],
      ["to", connection.to],
    ] as const) {
      if (nodeIds.has(id)) continue;
      diagnostics.push({
        code: "ir/unknown-node-ref",
        severity: "error",
        message: `Connection "${connection.id}" points ${end} "${id}", which is not a node in this diagram.`,
        subject: { kind: "edge", ids: [connection.id] },
        evidence: { missingId: id, end },
        supportedFixes: [
          {
            action: "drop-edge",
            description: `Remove connection "${connection.id}".`,
          },
          {
            action: "rename-id",
            description: `Point ${end} at an existing node, or add a node with id "${id}".`,
          },
        ],
      });
    }
  }

  for (const boundary of ir.boundaries ?? []) {
    for (const nodeId of boundary.contains) {
      if (nodeIds.has(nodeId)) continue;
      diagnostics.push({
        code: "ir/unknown-node-ref",
        severity: "error",
        message: `Boundary "${boundary.name}" lists "${nodeId}" as a member, but no such node exists.`,
        subject: { kind: "boundary", ids: [boundary.id] },
        evidence: { missingId: nodeId },
        supportedFixes: [
          {
            action: "unassign-boundary",
            description: `Remove "${nodeId}" from boundary "${boundary.name}".`,
          },
        ],
      });
    }

    if (boundary.parent_boundary_id && !boundaryIds.has(boundary.parent_boundary_id)) {
      diagnostics.push({
        code: "ir/unknown-node-ref",
        severity: "error",
        message: `Boundary "${boundary.name}" names parent "${boundary.parent_boundary_id}", which is not a boundary in this diagram.`,
        subject: { kind: "boundary", ids: [boundary.id] },
        evidence: { missingId: boundary.parent_boundary_id },
        supportedFixes: [
          {
            action: "remove-boundary",
            description: `Make "${boundary.name}" top-level, or add the missing parent boundary.`,
          },
        ],
      });
    }
  }

  return diagnostics;
}

function boundaryCycles(ir: StructuralInput): Diagnostic[] {
  const boundaries = ir.boundaries ?? [];
  const parentOf = new Map(boundaries.map((b) => [b.id, b.parent_boundary_id]));
  const nameOf = new Map(boundaries.map((b) => [b.id, b.name]));
  const diagnostics: Diagnostic[] = [];
  const reported = new Set<string>();

  for (const boundary of boundaries) {
    const path: string[] = [];
    const visiting = new Set<string>();
    let current: string | undefined = boundary.id;

    while (current) {
      if (visiting.has(current)) {
        const cycle = path.slice(path.indexOf(current));
        const key = [...cycle].sort().join("|");
        if (!reported.has(key)) {
          reported.add(key);
          diagnostics.push({
            code: "ir/boundary-cycle",
            severity: "error",
            message: `Boundaries contain each other in a loop: ${cycle
              .map((id) => `"${nameOf.get(id) ?? id}"`)
              .join(" -> ")}. A boundary cannot be inside itself.`,
            subject: { kind: "boundary", ids: cycle },
            evidence: { cycleLength: cycle.length },
            supportedFixes: [
              {
                action: "remove-boundary",
                description: `Break the loop by clearing the parent of one boundary in ${cycle
                  .map((id) => `"${nameOf.get(id) ?? id}"`)
                  .join(", ")}.`,
              },
            ],
          });
        }
        break;
      }

      visiting.add(current);
      path.push(current);
      current = parentOf.get(current);
    }
  }

  return diagnostics;
}

function nodesInTwoBoundaries(ir: StructuralInput): Diagnostic[] {
  const boundaries = ir.boundaries ?? [];
  const owners = new Map<string, string[]>();

  for (const boundary of boundaries) {
    for (const nodeId of boundary.contains) {
      const list = owners.get(nodeId);
      if (list) list.push(boundary.id);
      else owners.set(nodeId, [boundary.id]);
    }
  }

  const nameOfNode = new Map(ir.nodes.map((node) => [node.id, node.name]));
  const nameOfBoundary = new Map(boundaries.map((b) => [b.id, b.name]));
  const diagnostics: Diagnostic[] = [];

  for (const [nodeId, boundaryIds] of owners) {
    if (boundaryIds.length < 2) continue;

    diagnostics.push({
      code: "ir/node-in-two-boundaries",
      severity: "error",
      message: `"${nameOfNode.get(nodeId) ?? nodeId}" is claimed by ${boundaryIds.length} boundaries (${boundaryIds
        .map((id) => `"${nameOfBoundary.get(id) ?? id}"`)
        .join(", ")}). A node can belong to only one.`,
      subject: { kind: "node", ids: [nodeId] },
      evidence: { boundaryCount: boundaryIds.length },
      supportedFixes: [
        {
          action: "unassign-boundary",
          description: `Keep "${nameOfNode.get(nodeId) ?? nodeId}" in one boundary and remove it from the others.`,
        },
        {
          action: "split-boundary",
          description: `If both groupings matter, nest one boundary inside the other instead of overlapping them.`,
        },
      ],
    });
  }

  return diagnostics;
}

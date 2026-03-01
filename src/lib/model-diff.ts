import type { ModelDraft, ArchElement, ArchRelationship } from "./model-types";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface ElementDiff {
  id: string;
  status: DiffStatus;
  element: ArchElement; // current version (or old for "removed")
  oldElement?: ArchElement; // previous version (for "modified")
  changes?: string[]; // list of changed field names
}

export interface RelationshipDiff {
  id: string;
  status: DiffStatus;
  relationship: ArchRelationship;
  oldRelationship?: ArchRelationship;
  changes?: string[];
}

export interface ModelDiffResult {
  elements: Record<string, ElementDiff>;
  relationships: Record<string, RelationshipDiff>;
  summary: {
    elementsAdded: number;
    elementsRemoved: number;
    elementsModified: number;
    elementsUnchanged: number;
    relationshipsAdded: number;
    relationshipsRemoved: number;
    relationshipsModified: number;
    relationshipsUnchanged: number;
  };
}

function diffElement(oldEl: ArchElement | undefined, newEl: ArchElement | undefined): ElementDiff | null {
  if (!oldEl && newEl) {
    return { id: newEl.id, status: "added", element: newEl };
  }
  if (oldEl && !newEl) {
    return { id: oldEl.id, status: "removed", element: oldEl };
  }
  if (oldEl && newEl) {
    const changes: string[] = [];
    if (oldEl.name !== newEl.name) changes.push("name");
    if (oldEl.type !== newEl.type) changes.push("type");
    if (oldEl.description !== newEl.description) changes.push("description");
    if (oldEl.technology !== newEl.technology) changes.push("technology");
    if (oldEl.parentId !== newEl.parentId) changes.push("parentId");
    if (JSON.stringify(oldEl.tags) !== JSON.stringify(newEl.tags)) changes.push("tags");

    return {
      id: newEl.id,
      status: changes.length > 0 ? "modified" : "unchanged",
      element: newEl,
      oldElement: changes.length > 0 ? oldEl : undefined,
      changes: changes.length > 0 ? changes : undefined,
    };
  }
  return null;
}

function diffRelationship(oldRel: ArchRelationship | undefined, newRel: ArchRelationship | undefined): RelationshipDiff | null {
  if (!oldRel && newRel) {
    return { id: newRel.id, status: "added", relationship: newRel };
  }
  if (oldRel && !newRel) {
    return { id: oldRel.id, status: "removed", relationship: oldRel };
  }
  if (oldRel && newRel) {
    const changes: string[] = [];
    if (oldRel.sourceId !== newRel.sourceId) changes.push("sourceId");
    if (oldRel.targetId !== newRel.targetId) changes.push("targetId");
    if (oldRel.label !== newRel.label) changes.push("label");
    if (oldRel.technology !== newRel.technology) changes.push("technology");
    if (oldRel.description !== newRel.description) changes.push("description");

    return {
      id: newRel.id,
      status: changes.length > 0 ? "modified" : "unchanged",
      relationship: newRel,
      oldRelationship: changes.length > 0 ? oldRel : undefined,
      changes: changes.length > 0 ? changes : undefined,
    };
  }
  return null;
}

export function computeDiff(base: ModelDraft, target: ModelDraft): ModelDiffResult {
  const elements: Record<string, ElementDiff> = {};
  const relationships: Record<string, RelationshipDiff> = {};

  // All element IDs from both snapshots
  const allElementIds = new Set([
    ...Object.keys(base.elements),
    ...Object.keys(target.elements),
  ]);

  for (const id of allElementIds) {
    const d = diffElement(base.elements[id], target.elements[id]);
    if (d) elements[id] = d;
  }

  // All relationship IDs from both snapshots
  const allRelIds = new Set([
    ...Object.keys(base.relationships),
    ...Object.keys(target.relationships),
  ]);

  for (const id of allRelIds) {
    const d = diffRelationship(base.relationships[id], target.relationships[id]);
    if (d) relationships[id] = d;
  }

  const elDiffs = Object.values(elements);
  const relDiffs = Object.values(relationships);

  return {
    elements,
    relationships,
    summary: {
      elementsAdded: elDiffs.filter((d) => d.status === "added").length,
      elementsRemoved: elDiffs.filter((d) => d.status === "removed").length,
      elementsModified: elDiffs.filter((d) => d.status === "modified").length,
      elementsUnchanged: elDiffs.filter((d) => d.status === "unchanged").length,
      relationshipsAdded: relDiffs.filter((d) => d.status === "added").length,
      relationshipsRemoved: relDiffs.filter((d) => d.status === "removed").length,
      relationshipsModified: relDiffs.filter((d) => d.status === "modified").length,
      relationshipsUnchanged: relDiffs.filter((d) => d.status === "unchanged").length,
    },
  };
}

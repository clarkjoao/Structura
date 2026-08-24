import { deriveParentKeys } from "./asl-containment";
import {
  hasCloudService,
  isDrawableAsNode,
  isFlowRelationship,
  mapProvider,
  mapRelationship,
} from "./asl-mapping";
import type { AslImportPlan, AslPlanEdge, AslPlanNode } from "./asl-plan";
import {
  isAslBusinessKind,
  isAslOrganizationKind,
  type AslConstraint,
  type AslIssue,
  type AslManifest,
  type AslRelationshipEdge,
} from "./asl.types";
import { collectBelongsToPairs, validateRelationshipEdges } from "./asl-validator";

/**
 * Validated manifests -> neutral import plan.
 *
 * Everything the canvas needs is decided here: component types, containment,
 * connections, note text. What is deliberately *not* decided here is geometry —
 * the ASL carries none, so the adapter runs the layout engine over this plan.
 */

export type AslEdgeLabelMode = "verb" | "description";

export interface BuildAslPlanOptions {
  /**
   * What an edge is labelled with.
   *
   * `verb` (the default) uses the relationship type from the document and keeps
   * the prose in `description`, which the canvas shows in the connection panel.
   * ASL descriptions run 40-60 characters, and the layout engine is never told
   * about labels — a label that long is measured wider than the gap between
   * layers, so it lands on top of its neighbour.
   */
  edgeLabel?: AslEdgeLabelMode;
}

function readString(spec: Record<string, unknown>, field: string): string | undefined {
  const value = spec[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function displayName(manifest: AslManifest): string {
  return readString(manifest.spec, "displayName") ?? manifest.metadata.name;
}

function labelsToTags(manifest: AslManifest): string[] {
  const labels = manifest.metadata.labels;
  if (!labels) return [];
  return Object.entries(labels).map(([key, value]) => `${key}:${value}`);
}

/**
 * The technology line of a node.
 *
 * When the provider resolved to a real catalog service the icon already says
 * which platform it is, so the field carries the more specific fact (the
 * language). When it degraded to a plain box, the provider is what the reader
 * has lost and what the field must show.
 */
function technologyFor(
  manifest: AslManifest,
  provider: string | undefined,
  mappedToService: boolean,
): string | undefined {
  if (!mappedToService) return provider;
  if (manifest.kind === "Application") return readString(manifest.spec, "language");
  return undefined;
}

/**
 * Spec fields that classify rather than describe. They are tags, not part of
 * the name and not the technology: a topic's `type` and a gateway's `exposure`
 * are facets you filter by, and the node already spends its one technology
 * line on the platform.
 */
const CLASSIFYING_SPEC_FIELDS: Partial<Record<AslManifest["kind"], readonly string[]>> = {
  Topic: ["type"],
  APIGateway: ["exposure"],
};

function specTags(manifest: AslManifest): string[] {
  const fields = CLASSIFYING_SPEC_FIELDS[manifest.kind] ?? [];
  return fields.flatMap((field) => {
    const value = readString(manifest.spec, field);
    return value !== undefined ? [`${field}:${value}`] : [];
  });
}

function readConstraints(spec: Record<string, unknown>): AslConstraint[] {
  const raw = spec.constraints;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): AslConstraint[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const condition = typeof record.condition === "string" ? record.condition : "";
    const error = typeof record.error === "string" ? record.error : "";
    if (name === "" && condition === "") return [];
    return [
      {
        name,
        condition,
        error,
        ...(typeof record.action === "string" ? { action: record.action } : {}),
      },
    ];
  });
}

/**
 * Note body for a `BusinessRule`. `NoteNode` renders markdown, so the
 * constraints become a readable list instead of one run-on paragraph.
 */
function businessRuleNote(manifest: AslManifest): string {
  const lines: string[] = [];
  const description = readString(manifest.spec, "description");
  if (description !== undefined) {
    lines.push(description, "");
  }
  for (const constraint of readConstraints(manifest.spec)) {
    lines.push(`- **${constraint.name}**`);
    if (constraint.condition !== "") lines.push(`  - ${constraint.condition}`);
    if (constraint.error !== "") lines.push(`  - \`${constraint.error}\``);
    if (constraint.action !== undefined) lines.push(`  - ${constraint.action}`);
  }
  return lines.join("\n").trim();
}

/** Reads `spec.appliesTo[].name`, the BusinessRule's own way of naming a target. */
function appliesToTargets(manifest: AslManifest): string[] {
  const raw = manifest.spec.appliesTo;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): string[] => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const name = (entry as Record<string, unknown>).name;
    return typeof name === "string" && name.length > 0 ? [name] : [];
  });
}

/**
 * Where a note is placed. A rule states its own target; a business-layer
 * manifest gets the one a relationship points at, or the solution boundary.
 */
function resolveAnchor(
  manifest: AslManifest,
  relationships: readonly AslRelationshipEdge[],
  drawableKeys: ReadonlySet<string>,
  soleServiceKey: string | undefined,
): string | undefined {
  const name = manifest.metadata.name;

  const declared = appliesToTargets(manifest).find((target) => drawableKeys.has(target));
  if (declared !== undefined) return declared;

  const related = relationships.find(
    (edge) => edge.from.id === name && drawableKeys.has(edge.to.id),
  );
  if (related !== undefined) return related.to.id;

  const incoming = relationships.find(
    (edge) => edge.to.id === name && drawableKeys.has(edge.from.id),
  );
  if (incoming !== undefined) return incoming.from.id;

  return soleServiceKey;
}

function collectRelationshipEdges(manifests: readonly AslManifest[]): AslRelationshipEdge[] {
  const kindByName = new Map(manifests.map((m) => [m.metadata.name, m.kind as string]));
  const ignored: AslIssue[] = [];
  return manifests
    .filter((manifest) => manifest.kind === "Relationship")
    .flatMap((manifest) => validateRelationshipEdges(manifest, kindByName, ignored));
}

/** Turns validated manifests into the plan the canvas adapter consumes. */
export function buildAslImportPlan(
  manifests: readonly AslManifest[],
  options: BuildAslPlanOptions = {},
): AslImportPlan {
  const edgeLabel = options.edgeLabel ?? "verb";
  const warnings: AslIssue[] = [];

  const kindByName = new Map(manifests.map((m) => [m.metadata.name, m.kind as string]));
  const relationships = collectRelationshipEdges(manifests);
  const parents = deriveParentKeys(manifests, collectBelongsToPairs(manifests, kindByName));
  const childCount = new Map<string, number>();
  for (const parent of parents.values()) {
    childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
  }

  const drawable = manifests.filter((manifest) => isDrawableAsNode(manifest.kind));
  const drawableKeys = new Set(drawable.map((manifest) => manifest.metadata.name));
  const services = manifests.filter((manifest) => manifest.kind === "ApplicationService");
  const soleServiceKey = services.length === 1 ? services[0].metadata.name : undefined;

  const nodes: AslPlanNode[] = [];

  for (const manifest of drawable) {
    const key = manifest.metadata.name;
    const parentKey = parents.get(key) ?? null;

    // An ApplicationService is the solution boundary: it is a container whether
    // or not anything ended up inside it, which is the only way an empty
    // boundary survives to the canvas.
    if (manifest.kind === "ApplicationService") {
      nodes.push({
        key,
        componentType: "panel",
        name: displayName(manifest),
        description: readString(manifest.spec, "description") ?? "",
        tags: labelsToTags(manifest),
        parentKey,
        isContainer: true,
      });
      continue;
    }

    const provider = readString(manifest.spec, "provider");
    const { mapping, unknownProvider } = mapProvider(manifest.kind, provider);
    if (unknownProvider) {
      warnings.push({
        code: "unknownProvider",
        params: { kind: manifest.kind, name: key, value: provider ?? "" },
      });
    }
    const technology = technologyFor(manifest, provider, hasCloudService(mapping));

    nodes.push({
      key,
      componentType: mapping.componentType,
      ...(mapping.cloudService !== undefined ? { cloudService: mapping.cloudService } : {}),
      name: displayName(manifest),
      description: readString(manifest.spec, "description") ?? "",
      ...(technology !== undefined ? { technology } : {}),
      tags: [...labelsToTags(manifest), ...specTags(manifest)],
      parentKey,
      // A node that ended up holding children is a container regardless of what
      // its kind suggests — holding children is proof enough.
      isContainer: (childCount.get(key) ?? 0) > 0,
    });
  }

  for (const manifest of manifests) {
    const isNoteKind = manifest.kind === "BusinessRule" || isAslBusinessKind(manifest.kind);
    if (!isNoteKind) continue;

    const key = manifest.metadata.name;
    const anchorKey = resolveAnchor(manifest, relationships, drawableKeys, soleServiceKey);
    if (anchorKey === undefined) {
      warnings.push({ code: "unanchoredNote", params: { kind: manifest.kind, name: key } });
    }

    const body =
      manifest.kind === "BusinessRule"
        ? businessRuleNote(manifest)
        : (readString(manifest.spec, "description") ?? "");

    nodes.push({
      key,
      componentType: "note",
      name: displayName(manifest),
      description: body,
      tags: labelsToTags(manifest),
      parentKey: null,
      isContainer: false,
      ...(anchorKey !== undefined ? { anchorKey } : {}),
    });
  }

  const skipped = manifests.filter((manifest) => isAslOrganizationKind(manifest.kind));
  if (skipped.length > 0) {
    warnings.push({ code: "skippedOrganizationKinds", params: { count: skipped.length } });
  }

  const edges: AslPlanEdge[] = [];
  relationships.forEach((edge, index) => {
    if (!isFlowRelationship(edge.type)) return;
    const mapping = mapRelationship(edge.type);
    if (!mapping) return;
    if (!drawableKeys.has(edge.from.id) || !drawableKeys.has(edge.to.id)) return;

    const description = edge.description ?? "";
    edges.push({
      key: `${edge.from.id}--${edge.type}--${edge.to.id}--${index}`,
      sourceKey: edge.from.id,
      targetKey: edge.to.id,
      label: edgeLabel === "verb" ? edge.type : description,
      description,
      intent: mapping.intent,
      ...(mapping.transportPreset !== undefined
        ? { transportPreset: mapping.transportPreset }
        : {}),
    });
  });

  return { nodes, edges, warnings };
}

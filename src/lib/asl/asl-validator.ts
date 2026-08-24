import { collectContainmentCycles } from "../graph/containment-cycles";
import type { AslRawDocument } from "./parse-asl";
import {
  ASL_API_VERSION,
  ASL_NAME_PATTERN,
  ASL_REQUIRED_SPEC_FIELDS,
  isAslKind,
  isAslRelationshipType,
  type AslEndpointRef,
  type AslIssue,
  type AslManifest,
  type AslRelationshipEdge,
} from "./asl.types";

/**
 * ASL validation.
 *
 * Same architecture as the LLM IR validator: issue codes double as i18n key
 * suffixes, every problem is collected instead of failing at the first, and
 * anything still renderable is normalised rather than rejected — a validator
 * refusing what it could draw is the bug, not the safeguard.
 *
 * The split that matters is blocking vs. warning. A structural error (unknown
 * apiVersion, dangling reference, duplicate name) aborts the import, because
 * the result would misrepresent the document. An unexpected enum value only
 * warns, because the manifest still describes a node.
 */

export type AslValidationResult =
  | { ok: true; manifests: AslManifest[]; warnings: AslIssue[] }
  | { ok: false; issues: AslIssue[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readStringMap(value: unknown): Record<string, string> | undefined {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

function validateEnvelope(document: AslRawDocument, issues: AslIssue[]): AslManifest | null {
  const { index, value } = document;
  if (!isObject(value)) {
    issues.push({ code: "documentNotAnObject", params: { index } });
    return null;
  }

  let valid = true;

  if (value.apiVersion !== ASL_API_VERSION) {
    issues.push({
      code: "invalidApiVersion",
      params: { index, value: String(value.apiVersion) },
    });
    valid = false;
  }
  if (!isAslKind(value.kind)) {
    issues.push({ code: "invalidKind", params: { index, value: String(value.kind) } });
    valid = false;
  }
  if (!isObject(value.metadata)) {
    issues.push({ code: "invalidMetadata", params: { index } });
    return null;
  }

  const rawName = value.metadata.name;
  if (!nonEmptyString(rawName)) {
    issues.push({ code: "missingName", params: { index } });
    valid = false;
  } else if (!ASL_NAME_PATTERN.test(rawName)) {
    issues.push({ code: "invalidName", params: { index, name: rawName } });
    valid = false;
  }

  if (!isObject(value.spec)) {
    issues.push({
      code: "invalidSpec",
      params: { index, name: nonEmptyString(rawName) ? rawName : String(index) },
    });
    valid = false;
  }

  if (!valid || !isAslKind(value.kind) || !nonEmptyString(rawName) || !isObject(value.spec)) {
    return null;
  }

  const labels = readStringMap(value.metadata.labels);
  const annotations = readStringMap(value.metadata.annotations);

  return {
    apiVersion: ASL_API_VERSION,
    kind: value.kind,
    metadata: {
      name: rawName,
      ...(labels !== undefined ? { labels } : {}),
      ...(annotations !== undefined ? { annotations } : {}),
    },
    spec: value.spec,
    documentIndex: index,
  };
}

function validateRequiredSpecFields(manifest: AslManifest, issues: AslIssue[]): void {
  for (const field of ASL_REQUIRED_SPEC_FIELDS[manifest.kind]) {
    const present = manifest.spec[field];
    if (present === undefined || present === null || present === "") {
      issues.push({
        code: "missingSpecField",
        params: { kind: manifest.kind, name: manifest.metadata.name, field },
      });
    }
  }
}

function readEndpointRef(value: unknown): AslEndpointRef | null {
  if (!isObject(value)) return null;
  if (!nonEmptyString(value.kind) || !nonEmptyString(value.id)) return null;
  return { kind: value.kind, id: value.id };
}

/**
 * Relationship edges. The `kind` half of an `EndpointRef` is asserted against
 * the manifest the `id` resolves to, exactly as `relationship.schema.yaml`
 * requires — a mismatched pair means the document disagrees with itself, which
 * is worth stopping for rather than guessing which half is right.
 */
export function validateRelationshipEdges(
  manifest: AslManifest,
  kindByName: ReadonlyMap<string, string>,
  issues: AslIssue[],
): AslRelationshipEdge[] {
  const rawEdges = manifest.spec.edges;
  if (!Array.isArray(rawEdges)) {
    issues.push({ code: "edgesNotArray", params: { name: manifest.metadata.name } });
    return [];
  }

  const edges: AslRelationshipEdge[] = [];

  rawEdges.forEach((rawEdge, index) => {
    const name = manifest.metadata.name;
    if (!isObject(rawEdge)) {
      issues.push({ code: "edgeNotAnObject", params: { name, index } });
      return;
    }

    const from = readEndpointRef(rawEdge.from);
    const to = readEndpointRef(rawEdge.to);
    if (!from || !to) {
      issues.push({ code: "edgeMissingEndpoint", params: { name, index } });
      return;
    }
    if (!isAslRelationshipType(rawEdge.type)) {
      issues.push({
        code: "edgeInvalidType",
        params: { name, index, value: String(rawEdge.type) },
      });
      return;
    }

    let resolved = true;
    for (const ref of [from, to]) {
      const resolvedKind = kindByName.get(ref.id);
      if (resolvedKind === undefined) {
        issues.push({ code: "edgeEndpointNotFound", params: { name, index, ref: ref.id } });
        resolved = false;
        continue;
      }
      if (resolvedKind !== ref.kind) {
        issues.push({
          code: "edgeKindMismatch",
          params: { name, index, ref: ref.id, declared: ref.kind, resolved: resolvedKind },
        });
        resolved = false;
      }
    }
    if (!resolved) return;

    edges.push({
      from,
      to,
      type: rawEdge.type,
      ...(nonEmptyString(rawEdge.description) ? { description: rawEdge.description } : {}),
    });
  });

  return edges;
}

/** Reads every `belongsTo` edge as a child -> parent pair. */
export function collectBelongsToPairs(
  manifests: readonly AslManifest[],
  kindByName: ReadonlyMap<string, string>,
): Map<string, string> {
  const parentByChild = new Map<string, string>();
  const ignored: AslIssue[] = [];

  for (const manifest of manifests) {
    if (manifest.kind !== "Relationship") continue;
    for (const edge of validateRelationshipEdges(manifest, kindByName, ignored)) {
      if (edge.type === "belongsTo") {
        parentByChild.set(edge.from.id, edge.to.id);
      }
    }
  }

  return parentByChild;
}

/**
 * Validates a parsed ASL file. On success the manifests are normalised (labels
 * and annotations reduced to string maps) and every non-blocking finding is
 * returned alongside them.
 */
export function validateAslDocuments(documents: readonly AslRawDocument[]): AslValidationResult {
  const issues: AslIssue[] = [];
  const warnings: AslIssue[] = [];
  const manifests: AslManifest[] = [];
  const kindByName = new Map<string, string>();

  for (const document of documents) {
    const manifest = validateEnvelope(document, issues);
    if (!manifest) continue;

    const existing = kindByName.get(manifest.metadata.name);
    if (existing !== undefined) {
      issues.push({ code: "duplicateName", params: { name: manifest.metadata.name } });
      continue;
    }

    validateRequiredSpecFields(manifest, issues);
    kindByName.set(manifest.metadata.name, manifest.kind);
    manifests.push(manifest);
  }

  if (manifests.length === 0 && issues.length === 0) {
    issues.push({ code: "noManifests" });
  }

  for (const manifest of manifests) {
    if (manifest.kind !== "Relationship") continue;
    validateRelationshipEdges(manifest, kindByName, issues);
  }

  for (const cycle of collectContainmentCycles(collectBelongsToPairs(manifests, kindByName))) {
    issues.push({ code: "containmentCycle", params: { names: cycle.join(" -> ") } });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, manifests, warnings };
}

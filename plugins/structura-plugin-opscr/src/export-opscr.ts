import { compileSources, Severity } from "opscr/core";
import { kindFor } from "./generated/opscr-mapping";
import { manifestSource, slugName } from "./engine/adopt";
import { getSession } from "./session";
import type { DiagramSnapshot, ExporterContribution } from "./types/plugin.types";

/**
 * A drawn diagram as opscr YAML (an exporter, plugin API 1.x): one multi-document file, a
 * manifest per element the technical view can draw (`kindFor`), a `belongsTo` for each panel an
 * element sits in, and a `Relationship` holding the canvas connections as `calls` edges. Elements
 * no Kind draws (notes, people, other shapes) are left out and listed in the header, as are
 * the errors opscr finds in the result. Pure: the host hands over a snapshot and gets text back.
 */

const RELATIONSHIP = "diagram-relationships";

interface Exported {
  yaml: string;
  skipped: string[];
  errors: string[];
}

function flowEnd(kind: string, name: string): string {
  return `{ kind: ${kind}, id: ${name} }`;
}

/** Components in an order where a panel comes before what sits in it. */
function parentsFirst(diagram: DiagramSnapshot) {
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const depth = (id: string): number => {
    let d = 0;
    for (let p = byId.get(id)?.parentId; p && d < 64; p = byId.get(p)?.parentId) d++;
    return d;
  };
  return [...diagram.components].sort((a, b) => depth(a.id) - depth(b.id));
}

export function diagramToOpscrDocuments(diagram: DiagramSnapshot): {
  documents: string[];
  skipped: string[];
} {
  const names = new Set<string>();
  const drawn = new Map<string, { kind: string; name: string }>();
  const documents: string[] = [];
  const skipped: string[] = [];
  const edges: string[] = [];

  for (const c of parentsFirst(diagram)) {
    const parent = c.parentId ? drawn.get(c.parentId) : undefined;
    const guess = kindFor(
      { type: c.type, catalogServiceId: c.cloudServiceId, technology: c.technology },
      parent?.kind,
    );
    if (!guess) {
      skipped.push(c.label || c.type);
      continue;
    }
    const base = slugName(c.label);
    let name = base;
    for (let i = 2; names.has(`${guess.kind}/${name}`); i++) name = `${base}-${i}`;
    names.add(`${guess.kind}/${name}`);
    drawn.set(c.id, { kind: guess.kind, name });
    documents.push(manifestSource(guess.kind, name, c.description, guess.provider));
    if (parent) {
      edges.push(
        `- from: ${flowEnd(guess.kind, name)}\n  to: ${flowEnd(parent.kind, parent.name)}\n  type: belongsTo`,
      );
    }
  }

  for (const connection of diagram.connections) {
    const from = drawn.get(connection.sourceId);
    const to = drawn.get(connection.targetId);
    if (!from || !to) continue;
    const description = [connection.label, connection.technology].filter(Boolean).join(" — ");
    edges.push(
      [
        `- from: ${flowEnd(from.kind, from.name)}`,
        `  to: ${flowEnd(to.kind, to.name)}`,
        "  type: calls",
        ...(description ? [`  description: ${JSON.stringify(description)}`] : []),
      ].join("\n"),
    );
  }

  if (edges.length > 0) {
    documents.push(
      [
        "apiVersion: opscr.dev/v1",
        "kind: Relationship",
        "metadata:",
        `  name: ${RELATIONSHIP}`,
        "spec:",
        "  edges:",
        ...edges.map((e) => e.replace(/^/gm, "    ")),
        "",
      ].join("\n"),
    );
  }
  return { documents, skipped };
}

export async function exportOpscr(diagram: DiagramSnapshot): Promise<Exported> {
  const { documents, skipped } = diagramToOpscrDocuments(diagram);
  const body = documents.join("---\n");
  const { result } = await compileSources({
    files: [{ path: "export.opscr.yaml", content: body }],
  });
  const errors = result.diagnostics
    .filter((d) => d.severity === Severity.ERROR)
    .map((d) => `${d.fieldPath ? `${d.fieldPath} ` : ""}${d.message}`);
  const header = [
    `# ${diagram.name} — exported from Structura`,
    ...(skipped.length > 0
      ? [`# Not exported (no opscr Kind draws them): ${skipped.join(", ")}`]
      : []),
    ...errors.slice(0, 20).map((e) => `# opscr: ${e}`),
    ...(errors.length > 20 ? [`# opscr: ${errors.length - 20} more errors`] : []),
    "",
  ];
  return { yaml: header.join("\n") + body, skipped, errors };
}

/**
 * The exporter. A diagram whose bound folder is open in the pane exports that folder's files —
 * the manifests and `opscr.config.yaml`, unsaved edits included — as a zip, in the layout the
 * CLI reads. Any other diagram exports the single file generated from what is drawn.
 */
export const opscrExporter: ExporterContribution = {
  id: "structura-plugin-opscr/yaml",
  label: {
    en: "opscr (YAML, zip when bound to a folder)",
    "pt-BR": "opscr (YAML, zip se ligado a uma pasta)",
  },
  extension: "opscr.yaml",
  mime: "application/yaml",
  export: async (diagram) => {
    const session = getSession();
    if (session?.diagramId === diagram.id) {
      const config = session.config();
      const files = [...session.manifests(), ...(config ? [config] : [])];
      if (files.length > 0) return files.map((f) => ({ path: f.name, content: f.text }));
    }
    return (await exportOpscr(diagram)).yaml;
  },
};

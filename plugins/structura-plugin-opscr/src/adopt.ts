import { elementFor } from "./generated/opscr-mapping";
import {
  addEdge,
  elementSource,
  hasManifest,
  keyOf,
  refOf,
  upsertDocument,
  type SourceText,
} from "./patches";
import type { BindingState } from "./sync";
import type { DiagramSnapshot } from "./types/plugin.types";

/**
 * Elements drawn on the canvas from the palette, written into the YAML (the user picks the Kind;
 * `kindFor` suggests one): a manifest per element, a `belongsTo` to the panel it sits in, and the
 * canvas element bound to the new key — so the sync that follows updates it in place (or redraws
 * it, when the Kind draws a different shape) instead of adding a duplicate.
 */

export interface AddChoice {
  /** Canvas component id. */
  id: string;
  kind: string;
  provider?: string;
}

/** A label as an opscr name: lowercase kebab-case. */
export function slugName(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "element";
}

function uniqueName(files: readonly SourceText[], kind: string, base: string): string {
  let name = base;
  for (let i = 2; hasManifest(files, { kind, name }); i++) name = `${base}-${i}`;
  return name;
}

export function manifestSource(kind: string, name: string, description: string, provider?: string) {
  return [
    "apiVersion: opscr.dev/v1",
    `kind: ${kind}`,
    "metadata:",
    `  name: ${name}`,
    "spec:",
    ...(provider ? [`  provider: ${JSON.stringify(provider)}`] : []),
    `  description: ${JSON.stringify(description)}`,
    "",
  ].join("\n");
}

/** Choices ordered so a panel is written before what sits in it. */
function parentsFirst(choices: readonly AddChoice[], diagram: DiagramSnapshot): AddChoice[] {
  const parentOf = new Map(diagram.components.map((c) => [c.id, c.parentId]));
  const depth = (id: string) => {
    let d = 0;
    for (let p = parentOf.get(id); p && d < 64; p = parentOf.get(p)) d++;
    return d;
  };
  return [...choices].sort((a, b) => depth(a.id) - depth(b.id));
}

export function addElementsToYaml(
  files: readonly SourceText[],
  binding: BindingState,
  diagram: DiagramSnapshot,
  choices: readonly AddChoice[],
): { files: SourceText[]; binding: BindingState; added: string[] } {
  let next = [...files];
  const state: BindingState = structuredClone(binding);
  const byId = new Map(diagram.components.map((c) => [c.id, c]));
  const keyById = () => new Map(Object.entries(state.ids).map(([key, id]) => [id, key]));
  const added: string[] = [];

  for (const choice of parentsFirst(choices, diagram)) {
    const component = byId.get(choice.id);
    if (!component || keyById().has(choice.id) || next.length === 0) continue;
    const parentKey = component.parentId ? keyById().get(component.parentId) : undefined;
    const name = uniqueName(next, choice.kind, slugName(component.label));
    const ref = { kind: choice.kind, name };
    const home = parentKey ? elementSource(next, refOf(parentKey))?.file : undefined;
    const written = upsertDocument(
      next,
      manifestSource(choice.kind, name, component.description, choice.provider),
      home ?? next[0]!.name,
    );
    if (!written) continue;
    next = written.files;
    if (parentKey)
      next = addEdge(next, { from: ref, to: refOf(parentKey), type: "belongsTo" }) ?? next;

    const key = keyOf(ref);
    const element = elementFor({
      kind: choice.kind,
      metadata: { name },
      spec: choice.provider ? { provider: choice.provider } : {},
    });
    state.ids[key] = choice.id;
    // The signature is what the canvas shows now: reconcile sees no canvas edit, and the next
    // sync — finding the manifest's fields different — writes them onto the element. An
    // identity the element does not have (another shape) makes the sync redraw it in place.
    state.signatures[key] = JSON.stringify([component.label, component.description, "", ""]);
    state.signatures[`${key}#id`] =
      component.type === element.type
        ? JSON.stringify([element.type, parentKey ?? null])
        : JSON.stringify(["redraw", parentKey ?? null]);
    added.push(key);
  }
  return { files: next, binding: state, added };
}

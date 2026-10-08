import {
  EDGE_TYPES,
  addEdge,
  countEdges,
  edgeSource,
  elementSource,
  hasManifest,
  keyOf,
  refOf,
  removeEdge,
  removeElements,
  renameElement,
  restoreElement,
  setDescription,
  setEdgeType,
  setParent,
  setSpecField,
  type EdgeMatch,
  type EdgeSource,
  type SourceText,
} from "./patches";
import { PROVIDER_SERVICES, kindFor } from "./generated/opscr-mapping";
import type { BindingState, Tombstones } from "./sync";
import type {
  DiagramSnapshot,
  PluginComponentSnapshot,
  PluginDiagramChanges,
} from "./types/plugin.types";
import { parseDocuments } from "./yaml-text";

/** Tombstones kept per binding; the oldest go first. */
const MAX_ELEMENT_TOMBSTONES = 100;
const MAX_CONNECTION_TOMBSTONES = 200;

/** Edge types a canvas connection can stand for: every type but containment. */
const isFlowType = (label: string) => EDGE_TYPES.has(label) && label !== "belongsTo";

interface ConnectionKey extends EdgeMatch {
  source: string;
  target: string;
}

const connectionKey = (source: string, target: string, type: string, n: number) =>
  `${source}->${target}:${type}#${n}`;

/** Inverse of the connection keys `planSync` writes: `Kind/a->Kind/b:type#n`. */
function parseConnectionKey(key: string): ConnectionKey | null {
  const hash = key.lastIndexOf("#");
  const body = key.slice(0, hash);
  const colon = body.lastIndexOf(":");
  const ends = body.slice(0, colon);
  const arrow = ends.indexOf("->");
  const n = Number(key.slice(hash + 1));
  if (hash < 0 || colon < 0 || arrow < 0 || !Number.isInteger(n)) return null;
  const source = ends.slice(0, arrow);
  const target = ends.slice(arrow + 2);
  return { source, target, from: refOf(source), to: refOf(target), type: body.slice(colon + 1), n };
}

const emptyTombstones = (): Tombstones => ({ elements: {}, connections: {} });

function cap<T>(record: Record<string, T>, max: number): Record<string, T> {
  const entries = Object.entries(record);
  return entries.length <= max ? record : Object.fromEntries(entries.slice(entries.length - max));
}

/**
 * The `spec.provider` a canvas change of catalog service or technology stands for, or null when
 * the manifest cannot say it (another Kind's service, a cleared service, free text on a catalog
 * element). A new catalog service picks the provider listing it; a new technology is a provider
 * of the same service, or — for Applications and external systems without one — itself.
 */
export function providerFromCanvas(
  kind: string,
  component: Pick<PluginComponentSnapshot, "type" | "cloudServiceId" | "technology">,
  serviceChanged: boolean,
): string | null {
  const technology = component.technology?.trim() ?? "";
  const service = component.cloudServiceId ?? "";
  if (serviceChanged) {
    if (!service) return null;
    const guess = kindFor({ type: component.type, catalogServiceId: service, technology });
    return guess?.kind === kind && guess.provider ? guess.provider : null;
  }
  if (!technology) return null;
  if (service) {
    return PROVIDER_SERVICES[kind]?.[technology]?.catalogServiceId === service ? technology : null;
  }
  return kind === "Application" || kind === "ExternalSystem" ? technology : null;
}

/** Signature fields: [name, description, technology, catalog service]. */
const readSignature = (signature: string | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(signature ?? "");
    return Array.isArray(parsed) ? parsed.map(String) : ["", "", "", ""];
  } catch {
    return ["", "", "", ""];
  }
};

/** Drops an element and the connections keyed on it. */
function dropElement(state: BindingState, key: string) {
  delete state.ids[key];
  delete state.signatures[key];
  delete state.signatures[`${key}#id`];
  for (const connection of Object.keys(state.connections)) {
    const parsed = parseConnectionKey(connection);
    if (parsed && (parsed.source === key || parsed.target === key))
      delete state.connections[connection];
  }
}

/** After an edge leaves, equal edges after it move down one index. */
function shiftDown(state: BindingState, removed: ConnectionKey) {
  const next: Record<string, string> = {};
  for (const [key, id] of Object.entries(state.connections)) {
    const p = parseConnectionKey(key);
    const sameBase =
      p && p.source === removed.source && p.target === removed.target && p.type === removed.type;
    next[sameBase && p.n > removed.n ? connectionKey(p.source, p.target, p.type, p.n - 1) : key] =
      id;
  }
  state.connections = next;
}

/** A renamed element keeps its id: re-key it, its children's identity and its connections. */
function rekey(state: BindingState, from: string, to: string) {
  const swap = (key: string) => (key === from ? to : key);
  state.ids[to] = state.ids[from]!;
  delete state.ids[from];
  for (const suffix of ["", "#id"]) {
    const value = state.signatures[`${from}${suffix}`];
    delete state.signatures[`${from}${suffix}`];
    if (value !== undefined) state.signatures[`${to}${suffix}`] = value;
  }
  for (const [key, value] of Object.entries(state.signatures)) {
    if (!key.endsWith("#id")) continue;
    const [type, parent] = JSON.parse(value) as [string, string | null];
    if (parent === from) state.signatures[key] = JSON.stringify([type, to]);
  }
  const connections: Record<string, string> = {};
  for (const [key, id] of Object.entries(state.connections)) {
    const p = parseConnectionKey(key);
    connections[p ? connectionKey(swap(p.source), swap(p.target), p.type, p.n) : key] = id;
  }
  state.connections = connections;
}

/**
 * The binding after a rename made in the text (F2): the element keeps its canvas id, so the
 * sync that follows updates it in place instead of replacing it.
 */
export function renameInBinding(binding: BindingState, from: string, to: string): BindingState {
  const state: BindingState = structuredClone(binding);
  if (!state.ids[from]) return state;
  rekey(state, from, to);
  const [, ...rest] = readSignature(state.signatures[to]);
  state.signatures[to] = JSON.stringify([refOf(to).name, ...rest]);
  return state;
}

export interface ReconcileResult {
  files: SourceText[];
  binding: BindingState;
  /** Whether any file text changed. */
  changed: boolean;
  /** Canvas changes that take back what the YAML refused (empty lists when none). */
  revert: Required<Pick<PluginDiagramChanges, "remove" | "disconnect" | "update">>;
  /** Canvas names a rename could not take (empty, or already used by that Kind). */
  refused: string[];
  /** Elements whose new catalog service or technology the manifest cannot express (reverted). */
  refusedProviders: string[];
  /** Canvas elements the YAML does not declare (drawn from the palette, say). */
  notInYaml: number;
  /** Their ids. */
  outside: string[];
  /** True when a file did not parse and nothing was looked at. */
  skipped: boolean;
}

/**
 * Brings the YAML up to what the canvas shows. The binding is the last state both sides
 * agreed on, so whatever on the canvas differs from it was changed there — by the user or by
 * undo/redo — and is written into the manifests as text patches; the binding is updated to
 * match, so the sync that follows has nothing to take back.
 */
export function reconcile(
  diagram: DiagramSnapshot,
  binding: BindingState,
  input: readonly SourceText[],
): ReconcileResult {
  const revert: ReconcileResult["revert"] = { remove: [], disconnect: [], update: [] };
  const unchanged = {
    files: [...input],
    binding,
    changed: false,
    revert,
    refused: [],
    refusedProviders: [],
    notInYaml: 0,
    outside: [],
  };
  if (input.some((f) => !parseDocuments(f.text))) return { ...unchanged, skipped: true };

  const state: BindingState = structuredClone(binding);
  const tombs = state.tombstones ?? emptyTombstones();
  let files = [...input];
  const refused: string[] = [];
  const live = new Map(diagram.components.map((c) => [c.id, c]));
  const liveConnections = new Map(diagram.connections.map((c) => [c.id, c]));
  type Revert = NonNullable<PluginDiagramChanges["update"]>[number];
  const updates = new Map<string, Revert>();
  const revertUpdate = (id: string, patch: Omit<Revert, "id">) =>
    updates.set(id, { ...(updates.get(id) ?? { id }), ...patch });
  const refusedProviders: string[] = [];

  // 1. Elements deleted on the canvas: their manifests and the edges naming them go.
  const gone = Object.entries(state.ids).filter(([, id]) => !live.has(id));
  if (gone.length > 0) {
    const result = removeElements(
      files,
      gone.map(([key]) => refOf(key)),
    );
    if (!result) return { ...unchanged, skipped: true };
    files = result.files;
    for (const [key, id] of gone) {
      const removed = result.removed.get(key);
      if (removed) {
        tombs.elements[id] = {
          key,
          signature: state.signatures[key] ?? "",
          identity: state.signatures[`${key}#id`] ?? "",
          ...removed,
        };
      }
      dropElement(state, key);
    }
  }

  // 2. Connections deleted on the canvas.
  for (const [key, id] of Object.entries(state.connections)) {
    if (liveConnections.has(id)) continue;
    const parsed = parseConnectionKey(key);
    delete state.connections[key];
    if (!parsed) continue;
    const result = removeEdge(files, parsed);
    if (result) {
      files = result.files;
      tombs.connections[id] = { key, edge: result.edge };
    }
    shiftDown(state, parsed);
  }

  // 3. Renames and descriptions.
  for (const [key, id] of Object.entries(state.ids)) {
    const component = live.get(id)!;
    const [name = "", description = "", ...rest] = readSignature(state.signatures[key]);
    let current = key;
    let nextName = name;
    let nextDescription = description;
    if (component.label !== name) {
      const ref = refOf(key);
      const to = component.label.trim();
      const renamed = to && to !== ref.name ? renameElement(files, ref, to) : null;
      if (renamed) {
        files = renamed;
        current = keyOf({ kind: ref.kind, name: to });
        rekey(state, key, current);
        nextName = to;
      } else {
        revertUpdate(id, { name });
        refused.push(component.label);
      }
    }
    if (component.description !== description) {
      const described = setDescription(files, refOf(current), component.description);
      if (described) {
        files = described;
        nextDescription = component.description;
      } else revertUpdate(id, { description });
    }
    // A new catalog service or technology is a new `spec.provider`, when the Kind has one for it.
    let [technology = "", service = ""] = rest;
    const canvasTechnology = component.technology ?? "";
    const canvasService = component.cloudServiceId ?? "";
    if (canvasTechnology !== technology || canvasService !== service) {
      const provider = providerFromCanvas(
        refOf(current).kind,
        component,
        canvasService !== service,
      );
      const changed =
        provider !== null ? setSpecField(files, refOf(current), "provider", provider) : null;
      if (changed) {
        files = changed;
        technology = canvasTechnology;
        service = canvasService;
      } else {
        revertUpdate(id, { technology, cloudServiceId: service });
        refusedProviders.push(component.label);
      }
    }
    state.signatures[current] = JSON.stringify([nextName, nextDescription, technology, service]);
  }

  // 3b. Elements moved into another panel (or out to the top level): their belongsTo follows.
  //     A panel outside the YAML cannot be a parent yet; the move waits until it is added.
  {
    const keyOfId = new Map(Object.entries(state.ids).map(([key, id]) => [id, key]));
    for (const [key, id] of Object.entries(state.ids)) {
      const component = live.get(id);
      const identity = state.signatures[`${key}#id`];
      if (!component || !identity) continue;
      const [type, parentKey] = JSON.parse(identity) as [string, string | null];
      const canvasParent = component.parentId ? keyOfId.get(component.parentId) : null;
      if (canvasParent === undefined || canvasParent === parentKey) continue;
      const moved = setParent(files, refOf(key), canvasParent ? refOf(canvasParent) : null);
      if (!moved) continue;
      files = moved;
      state.signatures[`${key}#id`] = JSON.stringify([type, canvasParent]);
    }
  }

  // 4. Elements back on the canvas (undo of a removal, either side): their text comes back.
  const bound = () => new Set(Object.values(state.ids));
  const restoredEdges: EdgeSource[] = [];
  for (const [id, tomb] of Object.entries(tombs.elements)) {
    if (!live.has(id) || bound().has(id)) continue;
    delete tombs.elements[id];
    if (state.ids[tomb.key] || hasManifest(files, refOf(tomb.key))) {
      revert.remove.push(id);
      continue;
    }
    files = restoreElement(files, tomb);
    state.ids[tomb.key] = id;
    state.signatures[tomb.key] = tomb.signature;
    state.signatures[`${tomb.key}#id`] = tomb.identity;
    restoredEdges.push(...tomb.edges);
  }
  for (const edge of restoredEdges) {
    const endsExist = hasManifest(files, edge.from) && hasManifest(files, edge.to);
    if (!endsExist || countEdges(files, edge) > 0) continue;
    files = addEdge(files, edge, edge.relationship) ?? files;
  }

  // 5. Canvas connections the binding does not know: drawn by the user, or brought back by an
  //    undo. Adopt an equal edge the binding has not claimed, else add one.
  const keyById = new Map(Object.entries(state.ids).map(([key, id]) => [id, key]));
  const claimed = new Set(Object.values(state.connections));
  for (const connection of diagram.connections) {
    if (claimed.has(connection.id)) continue;
    const source = keyById.get(connection.sourceId);
    const target = keyById.get(connection.targetId);
    if (!source || !target) continue;
    const tomb = tombs.connections[connection.id];
    delete tombs.connections[connection.id];
    const label = connection.label.trim();
    const type = tomb
      ? (parseConnectionKey(tomb.key)?.type ?? "calls")
      : isFlowType(label)
        ? label
        : "calls";
    const match = { from: refOf(source), to: refOf(target), type };
    const count = countEdges(files, match);
    const taken = new Set(
      Object.keys(state.connections)
        .map(parseConnectionKey)
        .filter((p) => p && p.source === source && p.target === target && p.type === type)
        .map((p) => p!.n),
    );
    let n = [...Array(count).keys()].find((i) => !taken.has(i));
    if (n === undefined) {
      const added = addEdge(
        files,
        {
          ...match,
          ...(tomb?.edge.description !== undefined ? { description: tomb.edge.description } : {}),
        },
        tomb?.edge.relationship,
      );
      if (!added) continue;
      files = added;
      n = count;
    }
    state.connections[connectionKey(source, target, type, n)] = connection.id;
  }

  // 6. Connections relabelled with an edge type.
  for (const [key, id] of Object.entries(state.connections)) {
    const label = liveConnections.get(id)?.label.trim() ?? "";
    const parsed = parseConnectionKey(key);
    if (!parsed || label === parsed.type || !isFlowType(label)) continue;
    const retyped = setEdgeType(files, parsed, label);
    if (!retyped) continue;
    files = retyped;
    delete state.connections[key];
    shiftDown(state, parsed);
    const n = countEdges(files, { ...parsed, type: label }) - 1;
    state.connections[connectionKey(parsed.source, parsed.target, label, n)] = id;
  }

  revert.update.push(...updates.values());
  const boundNow = bound();
  const removing = new Set(revert.remove);
  const outside = diagram.components
    .filter((c) => !boundNow.has(c.id) && !removing.has(c.id))
    .map((c) => c.id);
  state.tombstones = {
    elements: cap(tombs.elements, MAX_ELEMENT_TOMBSTONES),
    connections: cap(tombs.connections, MAX_CONNECTION_TOMBSTONES),
  };
  return {
    files,
    binding: state,
    changed: files.some((f, i) => f.text !== input[i]!.text),
    revert,
    refused,
    refusedProviders,
    notInYaml: outside.length,
    outside,
    skipped: false,
  };
}

/**
 * Tombstones for what a sync took out of the binding (the text removed it), from the text as
 * of the previous sync — so a canvas undo of that sync can put the text back.
 */
export function retire(
  previous: BindingState,
  next: BindingState,
  syncedFiles: readonly SourceText[],
): BindingState {
  const tombs = structuredClone(next.tombstones ?? emptyTombstones());
  const ids = new Set(Object.values(next.ids));
  for (const [key, id] of Object.entries(previous.ids)) {
    if (ids.has(id)) continue;
    const source = elementSource(syncedFiles, refOf(key));
    if (!source) continue;
    tombs.elements[id] = {
      key,
      signature: previous.signatures[key] ?? "",
      identity: previous.signatures[`${key}#id`] ?? "",
      ...source,
    };
  }
  const connections = new Set(Object.values(next.connections));
  for (const [key, id] of Object.entries(previous.connections)) {
    if (connections.has(id)) continue;
    const parsed = parseConnectionKey(key);
    const edge = parsed && edgeSource(syncedFiles, parsed);
    if (edge) tombs.connections[id] = { key, edge };
  }
  return {
    ...next,
    tombstones: {
      elements: cap(tombs.elements, MAX_ELEMENT_TOMBSTONES),
      connections: cap(tombs.connections, MAX_CONNECTION_TOMBSTONES),
    },
  };
}

import type {
  Component,
  ComponentType,
  Connection,
  Diagram,
  NodeLayout,
  PanelKind,
  VersionDiff,
} from "../../model/diagram.types";
import { canContain } from "@/features/elements/containment";
import {
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isGcpComponent,
} from "../../model/component.guards";
import { generateId } from "../../utils/generate-id";
import { canBeConnectionSource } from "../../model/connection-rules";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import {
  resolveActiveVersion,
  resolveComponent,
  resolveNodeLayout,
  writeComponentAndLayout,
} from "../helpers/version-helpers";
import { cloudServiceIdClearingPatch } from "../../model/cloud-service-id";
import { buildComponentForType, removeElementsInDraft } from "./components.slice";

/**
 * A node of a graph produced outside the store — the LLM diagram generator and
 * plugin importers. `externalId` is the producer's own id; the store mints the
 * real component id and reports the mapping back.
 */
export interface GeneratedNodeInput {
  externalId: string;
  type: ComponentType;
  name: string;
  description?: string;
  parentExternalId: string | null;
  panelKind?: PanelKind;
  technology?: string;
  /** Cloud provider service id (`cloudServiceId` on the component after F6b). */
  cloudServiceId?: string;
  /** Position is relative to the parent, like React Flow child nodes. */
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface GeneratedEdgeInput {
  sourceExternalId: string;
  targetExternalId: string;
  label: string;
}

export interface InsertGeneratedGraphOptions {
  /**
   * Resolve a parent or edge endpoint that is not in the batch against the
   * active diagram's existing component ids (plugin imports connect to what is
   * already drawn). Off by default: a generator's ids are its own, and must
   * never bind to an existing component by coincidence.
   */
  linkExisting?: boolean;
}

export interface GeneratedGraphResult {
  componentIdByExternalId: Record<string, string>;
  componentIds: string[];
  connectionIds: string[];
}

/** Fields an external producer may change on a component it created (see `applyGraphChanges`). */
export interface GeneratedNodeUpdate {
  id: string;
  name?: string;
  description?: string;
  technology?: string;
  /** Catalog service; written through `cloudServiceIdWrite`, an empty string clears it. */
  cloudServiceId?: string;
}

export interface GeneratedNodeMove {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** Several kinds of change to the active diagram, applied as one undo step. */
export interface GraphChanges {
  remove?: string[];
  disconnect?: string[];
  update?: GeneratedNodeUpdate[];
  move?: GeneratedNodeMove[];
  add?: GeneratedNodeInput[];
  /** Ends are external ids of `add`, or existing component ids. */
  connect?: GeneratedEdgeInput[];
}

export interface GraphChangesResult {
  componentIdByExternalId: Record<string, string>;
  /** Per `connect` entry, in order: the connection created, or null when its ends did not resolve. */
  connectionIds: Array<string | null>;
}

const EMPTY_RESULT: GeneratedGraphResult = {
  componentIdByExternalId: {},
  componentIds: [],
  connectionIds: [],
};

/**
 * Writes generated nodes and edges into a draft that already has its history pushed.
 * Returns, per input edge, the connection it created or null.
 */
function insertGeneratedGraphInDraft(
  diagram: Diagram,
  scene: VersionDiff | null,
  nodes: readonly GeneratedNodeInput[],
  edges: readonly GeneratedEdgeInput[],
  componentIdByExternalId: Record<string, string>,
  linkExisting: boolean,
): Array<string | null> {
  const typeByExternalId = new Map(nodes.map((n) => [n.externalId, n.type]));
  /** Store id and type of an external id: in the batch, else (if allowed) already drawn. */
  const resolve = (externalId: string): { id: string; type: string } | null => {
    const batchId = componentIdByExternalId[externalId];
    if (batchId) return { id: batchId, type: typeByExternalId.get(externalId)! };
    if (!linkExisting) return null;
    const existing = resolveComponent(diagram, scene, externalId);
    return existing ? { id: existing.id, type: existing.type } : null;
  };

  for (const node of nodes) {
    const id = componentIdByExternalId[node.externalId];
    const parent = node.parentExternalId === null ? null : resolve(node.parentExternalId);
    // A typed container refuses what it does not take: top level instead.
    const parentId = parent && canContain(parent.type, node.type) ? parent.id : null;

    const { component } = buildComponentForType(
      id,
      node.type,
      node.name,
      parentId,
      node.panelKind,
      node.cloudServiceId,
    );

    if (node.description !== undefined) component.description = node.description;
    if (node.technology !== undefined) setTechnology(component, node.technology);

    const layout: NodeLayout = {
      elementId: id,
      x: node.x,
      y: node.y,
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
    };

    writeComponentAndLayout(diagram, scene, component, layout);
  }

  return edges.map((edge) => {
    const source = resolve(edge.sourceExternalId);
    const target = resolve(edge.targetExternalId);
    if (!source || !target) return null;
    // An edge out of a note, a JSON viewer or a db-table is one the canvas
    // can never draw — it would be created and then silently dropped by
    // React Flow. A generated graph is the path that produced these in
    // practice, so it is dropped here with the unresolvable endpoints.
    if (!canBeConnectionSource(source.type)) return null;
    const connection: Connection = {
      id: generateId("conn"),
      sourceId: source.id,
      targetId: target.id,
      label: edge.label,
    };
    if (scene) scene.addedConnections[connection.id] = connection;
    else diagram.snapshot.connections[connection.id] = connection;
    return connection.id;
  });
}

/**
 * Type-based guards, not `isCloudComponent`: that one asks the cloud registry,
 * which is only populated once `features/cloud/bootstrap` has run — so it
 * answers differently in the app and under test.
 */
function setTechnology(component: Component, technology: string): void {
  if (
    isC4Component(component) ||
    isAwsComponent(component) ||
    isGcpComponent(component) ||
    isAzureComponent(component)
  ) {
    component.technology = technology;
  }
}

export const generatedGraphSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  /**
   * Inserts a whole generated graph in one mutation. Doing it node-by-node
   * through `addComponent` would push one undo checkpoint per node and blow
   * past MAX_HISTORY_STEPS on any diagram of interesting size; here the whole
   * generation is a single undo step.
   */
  insertGeneratedGraph: (
    nodes: GeneratedNodeInput[],
    edges: GeneratedEdgeInput[],
    options: InsertGeneratedGraphOptions = {},
  ): GeneratedGraphResult => {
    // Edges alone can only land when they may connect components already drawn.
    if (nodes.length === 0 && (edges.length === 0 || !options.linkExisting)) {
      return EMPTY_RESULT;
    }

    const componentIdByExternalId: Record<string, string> = {};
    for (const node of nodes) {
      componentIdByExternalId[node.externalId] = generateId("el");
    }
    let connectionIds: Array<string | null> = [];
    let committed = false;

    set((state) => {
      const diagram = getActiveDiagram(state);
      if (!diagram) return;
      committed = true;

      const scene = resolveActiveVersion(diagram);
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      connectionIds = insertGeneratedGraphInDraft(
        diagram,
        scene,
        nodes,
        edges,
        componentIdByExternalId,
        options.linkExisting === true,
      );
      touchDiagram(diagram);
    });

    if (!committed) {
      return EMPTY_RESULT;
    }

    return {
      componentIdByExternalId,
      componentIds: nodes.map((node) => componentIdByExternalId[node.externalId]),
      connectionIds: connectionIds.filter((id): id is string => id !== null),
    };
  },

  /**
   * Removes, updates, moves, adds and connects in one mutation and one undo step — for
   * producers that keep a diagram in sync with an outside source (a plugin syncing a
   * folder of manifests). Ids that are not in the diagram are skipped. Adds link to
   * existing components (`linkExisting`).
   */
  applyGraphChanges: (changes: GraphChanges): GraphChangesResult => {
    const add = changes.add ?? [];
    const componentIdByExternalId: Record<string, string> = {};
    for (const node of add) componentIdByExternalId[node.externalId] = generateId("el");
    let connectionIds: Array<string | null> = (changes.connect ?? []).map(() => null);

    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      const exists = (id: string) => resolveComponent(d, scene, id) !== undefined;
      const remove = (changes.remove ?? []).filter(exists);
      const connections = scene
        ? { ...d.snapshot.connections, ...scene.addedConnections }
        : d.snapshot.connections;
      const disconnect = (changes.disconnect ?? []).filter((id) => connections[id] !== undefined);
      if (remove.length > 0 || disconnect.length > 0)
        removeElementsInDraft(state, d, remove, disconnect);

      for (const update of changes.update ?? []) {
        const component = resolveComponent(d, scene, update.id);
        if (!component) continue;
        if (update.name !== undefined) component.name = update.name;
        if (update.description !== undefined) component.description = update.description;
        if (update.technology !== undefined) setTechnology(component, update.technology);
        if (update.cloudServiceId !== undefined) {
          Object.assign(component, cloudServiceIdClearingPatch(update.cloudServiceId));
        }
      }

      let moved = false;
      for (const move of changes.move ?? []) {
        const layout = resolveNodeLayout(d, scene, move.id);
        if (!layout || !Number.isFinite(move.x) || !Number.isFinite(move.y)) continue;
        layout.x = move.x;
        layout.y = move.y;
        if (move.width !== undefined) layout.width = move.width;
        if (move.height !== undefined) layout.height = move.height;
        moved = true;
      }
      // The canvas keeps a local copy of node positions; tell it these did not come from
      // the pointer (see `applyAutoLayout`).
      if (moved) state._lastLayoutWriteAt = (state._lastLayoutWriteAt ?? 0) + 1;

      connectionIds = insertGeneratedGraphInDraft(
        d,
        scene,
        add,
        changes.connect ?? [],
        componentIdByExternalId,
        true,
      );
      touchDiagram(d);
    });

    return { componentIdByExternalId, connectionIds };
  },
});

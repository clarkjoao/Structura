import type { ComponentType, Connection, NodeLayout, PanelKind } from "../../model/diagram.types";
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
  writeComponentAndLayout,
} from "../helpers/version-helpers";
import { buildComponentForType } from "./components.slice";

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

const EMPTY_RESULT: GeneratedGraphResult = {
  componentIdByExternalId: {},
  componentIds: [],
  connectionIds: [],
};

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
    const resolvedEdges: Connection[] = [];
    let committed = false;

    set((state) => {
      const diagram = getActiveDiagram(state);
      if (!diagram) return;
      committed = true;

      const scene = resolveActiveVersion(diagram);
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      const typeByExternalId = new Map(nodes.map((n) => [n.externalId, n.type]));
      /** Store id and type of an external id: in the batch, else (if allowed) already drawn. */
      const resolve = (externalId: string): { id: string; type: string } | null => {
        const batchId = componentIdByExternalId[externalId];
        if (batchId) return { id: batchId, type: typeByExternalId.get(externalId)! };
        if (!options.linkExisting) return null;
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

        // Type-based guards, not `isCloudComponent`: that one asks the cloud
        // registry, which is only populated once `features/cloud/bootstrap`
        // has run — so it answers differently in the app and under test.
        if (node.description !== undefined) component.description = node.description;
        if (
          node.technology !== undefined &&
          (isC4Component(component) ||
            isAwsComponent(component) ||
            isGcpComponent(component) ||
            isAzureComponent(component))
        ) {
          component.technology = node.technology;
        }

        const layout: NodeLayout = {
          elementId: id,
          x: node.x,
          y: node.y,
          ...(node.width !== undefined ? { width: node.width } : {}),
          ...(node.height !== undefined ? { height: node.height } : {}),
        };

        writeComponentAndLayout(diagram, scene, component, layout);
      }

      for (const edge of edges) {
        const source = resolve(edge.sourceExternalId);
        const target = resolve(edge.targetExternalId);
        if (!source || !target) continue;
        // An edge out of a note, a JSON viewer or a db-table is one the canvas
        // can never draw — it would be created and then silently dropped by
        // React Flow. A generated graph is the path that produced these in
        // practice, so it is dropped here with the unresolvable endpoints.
        if (!canBeConnectionSource(source.type)) continue;
        resolvedEdges.push({
          id: generateId("conn"),
          sourceId: source.id,
          targetId: target.id,
          label: edge.label,
        });
      }

      for (const connection of resolvedEdges) {
        if (scene) {
          scene.addedConnections[connection.id] = connection;
        } else {
          diagram.snapshot.connections[connection.id] = connection;
        }
      }

      touchDiagram(diagram);
    });

    if (!committed) {
      return EMPTY_RESULT;
    }

    return {
      componentIdByExternalId,
      componentIds: nodes.map((node) => componentIdByExternalId[node.externalId]),
      connectionIds: resolvedEdges.map((connection) => connection.id),
    };
  },
});

import type {
  ComponentType,
  Connection,
  ConnectionIntent,
  NodeLayout,
  PanelKind,
} from "../../model/diagram.types";
import {
  isAwsComponent,
  isAzureComponent,
  isC4Component,
  isGcpComponent,
} from "../../model/component.guards";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { resolveActiveScene, writeComponentAndLayout } from "../helpers/scene-helpers";
import { buildComponentForType } from "./components.slice";

/**
 * A node of a graph produced outside the store — today, the LLM diagram
 * generator. `externalId` is the producer's own id; the store mints the real
 * component id and reports the mapping back.
 */
export interface GeneratedNodeInput {
  externalId: string;
  type: ComponentType;
  name: string;
  parentExternalId: string | null;
  panelKind?: PanelKind;
  technology?: string;
  /** Cloud service id, resolved by the canvas against the provider catalog. */
  awsService?: string;
  /** Free text for the node body. Producers that have none omit it. */
  description?: string;
  tags?: string[];
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
  /** Position along the edge path, 0–1, where 0.5 is the midpoint. */
  labelPosition?: number;
  /** Semantic fields a producer may know; omitted ones keep the model default. */
  description?: string;
  intent?: ConnectionIntent;
  transportPreset?: Connection["transportPreset"];
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
  ): GeneratedGraphResult => {
    if (nodes.length === 0) {
      return EMPTY_RESULT;
    }

    const componentIdByExternalId: Record<string, string> = {};
    for (const node of nodes) {
      componentIdByExternalId[node.externalId] = generateId("el");
    }
    const resolvedEdges = edges.flatMap((edge): Connection[] => {
      const sourceId = componentIdByExternalId[edge.sourceExternalId];
      const targetId = componentIdByExternalId[edge.targetExternalId];
      if (!sourceId || !targetId) return [];
      return [
        {
          id: generateId("conn"),
          sourceId,
          targetId,
          label: edge.label,
          ...(edge.description !== undefined ? { description: edge.description } : {}),
          ...(edge.intent !== undefined ? { intent: edge.intent } : {}),
          ...(edge.transportPreset !== undefined ? { transportPreset: edge.transportPreset } : {}),
          ...(edge.labelPosition !== undefined
            ? { style: { labelPosition: edge.labelPosition } }
            : {}),
        },
      ];
    });

    let committed = false;

    set((state) => {
      const diagram = getActiveDiagram(state);
      if (!diagram) return;
      committed = true;

      const scene = resolveActiveScene(diagram);
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const node of nodes) {
        const id = componentIdByExternalId[node.externalId];
        const parentId =
          node.parentExternalId === null
            ? null
            : (componentIdByExternalId[node.parentExternalId] ?? null);

        const { component } = buildComponentForType(
          id,
          node.type,
          node.name,
          parentId,
          node.panelKind,
          node.awsService,
        );

        if (node.description !== undefined) {
          component.description = node.description;
        }
        if (node.tags !== undefined && node.tags.length > 0) {
          component.tags = [...node.tags];
        }

        // Type-based guards, not `isCloudComponent`: that one asks the cloud
        // registry, which is only populated once `features/cloud/bootstrap`
        // has run — so it answers differently in the app and under test.
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

/**
 * Applies a laid-out architecture proposal to the active diagram.
 *
 * One transaction, one history entry: the whole diagram lands or none of it does. That is
 * the point of separating propose from commit — the generation path can iterate on a
 * proposal without leaving half-built diagrams on the canvas, and the user gets a single
 * undo for "the assistant drew this".
 *
 * Geometry arrives already resolved by the layout engine. Nothing here computes a position.
 */

import type { Component } from "../../model/diagram.types";
import type { Connection } from "../../model/connection.types";
import type { ComponentType } from "../../model/component.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";

/** One node of a committed proposal, with geometry the engine derived. */
export interface ArchitectureNodePayload {
  /** IR id. Mapped to a fresh element id so repeated commits never collide. */
  irId: string;
  type: ComponentType;
  name: string;
  description?: string;
  technology?: string;
  awsService?: string;
  /** IR id of the owning boundary, if any. */
  parentIrId?: string;
  /** Absolute canvas position. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchitectureConnectionPayload {
  fromIrId: string;
  toIrId: string;
  label?: string;
}

export interface ArchitecturePayload {
  /** Boundaries first: parents must exist before the children that reference them. */
  nodes: ArchitectureNodePayload[];
  connections: ArchitectureConnectionPayload[];
}

export interface ArchitectureApplyResult {
  /** IR id -> created element id. */
  idMap: Record<string, string>;
  createdNodeIds: string[];
  createdConnectionIds: string[];
}

export const architectureSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  applyArchitecture: (payload: ArchitecturePayload): ArchitectureApplyResult => {
    // Ids are minted outside `set` so the mapping is available regardless of commit outcome.
    const idMap: Record<string, string> = {};
    for (const node of payload.nodes) {
      idMap[node.irId] = generateId("el");
    }

    const createdNodeIds: string[] = [];
    const createdConnectionIds: string[] = [];
    let committed = false;

    set((state) => {
      const diagram = getActiveDiagram(state);
      if (!diagram) return;
      committed = true;

      const sceneId = diagram.activeSceneId ?? null;
      const scene = sceneId && diagram.scenes?.[sceneId] ? diagram.scenes[sceneId] : null;

      // A single history entry for the whole diagram.
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const node of payload.nodes) {
        const id = idMap[node.irId];
        const parentId = node.parentIrId ? (idMap[node.parentIrId] ?? null) : null;

        const component = {
          id,
          name: node.name,
          type: node.type,
          description: node.description ?? "",
          parentId,
          ...(node.technology ? { technology: node.technology } : {}),
          ...(node.awsService ? { awsService: node.awsService } : {}),
        } as Component;

        const layout = {
          elementId: id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        };

        if (scene) {
          scene.addedComponents[id] = component;
          scene.nodeLayouts[id] = layout;
        } else {
          diagram.snapshot.components[id] = component;
          diagram.nodeLayouts[id] = layout;
        }
        createdNodeIds.push(id);
      }

      for (const connection of payload.connections) {
        const sourceId = idMap[connection.fromIrId];
        const targetId = idMap[connection.toIrId];
        // The engine already rejects unknown endpoints; skip defensively rather than
        // writing a dangling connection into the store.
        if (!sourceId || !targetId) continue;

        const connectionId = generateId("conn");
        const record: Connection = {
          id: connectionId,
          sourceId,
          targetId,
          // Connections always carry a label field; an unlabelled edge is an empty string,
          // which is what the canvas renders as no label.
          label: connection.label ?? "",
        };

        if (scene) {
          scene.addedConnections[connectionId] = record;
        } else {
          diagram.snapshot.connections[connectionId] = record;
        }
        createdConnectionIds.push(connectionId);
      }

      touchDiagram(diagram);
    });

    if (!committed) {
      return { idMap: {}, createdNodeIds: [], createdConnectionIds: [] };
    }

    return { idMap, createdNodeIds, createdConnectionIds };
  },
});

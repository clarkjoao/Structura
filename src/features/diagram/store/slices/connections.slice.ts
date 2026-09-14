import type { Connection, Diagram } from "../../model/diagram.types";
import type { EdgeStyle } from "../../model/connection.types";
import { EdgeStyle as EdgeStyleEnum } from "../../enums";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { repairFlowsAfterRemovingDiagramElements } from "../../utils/flow-repair";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { publishSewNotices } from "../helpers/publish-sew-notices";
import { resolveActiveScene } from "../helpers/scene-helpers";
import { mutateRemoveConnectionInScene } from "../../utils/scene-mutations";
import { canBeConnectionSource } from "../../model/connection-rules";

/**
 * The source component's type, looked up where the active scene can see it: a
 * node added by a scene lives in the scene, not in the base snapshot, and a
 * connection drawn from it has to be judged by the same rule.
 */
function sourceTypeIn(diagram: Diagram, sourceId: string): string | undefined {
  const scene = resolveActiveScene(diagram);
  return scene?.addedComponents?.[sourceId]?.type ?? diagram.snapshot.components[sourceId]?.type;
}

export const connectionsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
  /**
   * Creates a connection, or returns `null` when the source is a type nothing
   * may leave — see `canBeConnectionSource`. Refusing here rather than at the
   * handles is what makes the rule hold for quick insert, generation, an LLM
   * patch and a scene, none of which go through a handle.
   */
  addConnection: (
    sourceId: string,
    targetId: string,
    label: string,
    edgeStyle: EdgeStyle = EdgeStyleEnum.EditableStep,
  ): Connection | null => {
    const state = get();
    const active = state.diagrams[state.activeDiagramId ?? ""];
    if (active && !canBeConnectionSource(sourceTypeIn(active, sourceId) ?? "")) return null;

    const connection: Connection = {
      id: generateId("conn"),
      sourceId,
      targetId,
      label,
      style: {
        edgeStyle,
      },
    };
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      if (scene) {
        scene.addedConnections[connection.id] = connection;
      } else {
        d.snapshot.connections[connection.id] = connection;
      }
      touchDiagram(d);
    });
    return connection;
  },

  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      // Repointing a source is another way to create what `addConnection`
      // refuses, so the same rule applies to the patch.
      if (patch.sourceId !== undefined) {
        const sourceType = d.snapshot.components[patch.sourceId]?.type;
        if (sourceType !== undefined && !canBeConnectionSource(sourceType)) return;
      }
      const scene = resolveActiveScene(d);
      const inScene = !!(scene && scene.addedConnections[id]);
      if (!inScene) pushHistory(state);
      const conn = inScene ? scene!.addedConnections[id] : d.snapshot.connections[id];
      if (conn) Object.assign(conn, patch);
      touchDiagram(d);
    });
  },

  removeConnection: (id: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      if (scene) {
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        publishSewNotices(state, mutateRemoveConnectionInScene(d, scene.id, id));
        touchDiagram(d);
        return;
      }
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      delete d.snapshot.connections[id];
      repairFlowsAfterRemovingDiagramElements(d.snapshot.flows, new Set<string>(), new Set([id]));
      touchDiagram(d);
    });
  },
});

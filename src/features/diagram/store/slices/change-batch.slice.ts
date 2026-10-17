import type { Diagram, VersionDiff } from "../../model/diagram.types";
import type { ComponentPatch, ComponentType } from "../../model/component.types";
import type { EdgeStyle } from "../../model/connection.types";
import type { PanelKind } from "../../enums";
import type { PatternFragment } from "../../model/pattern-fragment.types";
import { canContain } from "@/features/elements/containment";
import { canBeConnectionSource } from "../../model/connection-rules";
import { generateId } from "../../utils/generate-id";
import type { AppState, DiagramSnapshot } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { resolveActiveVersion, resolveComponent } from "../helpers/version-helpers";
import { pushHistory } from "./history.slice";
import {
  buildComponentForType,
  mutateRemoveElements,
  mutateUpdateComponent,
  placeNewComponent,
} from "./components.slice";
import { buildConnection, writeConnection } from "./connections.slice";
import { insertFragment } from "./patterns.slice";

/**
 * One change in a batch. Ids are the diagram's own, or the `ref` of a node
 * added earlier in the same batch.
 */
export type DiagramChange =
  | {
      kind: "addNode";
      ref: string;
      type: ComponentType;
      name: string;
      parentId: string | null;
      position?: { x: number; y: number };
      /** Catalog service id; written through `buildComponentForType`. */
      serviceId?: string;
      /** Panels only: which group kind to build; ignored for other types. */
      panelKind?: PanelKind;
    }
  | { kind: "updateNode"; id: string; patch: ComponentPatch }
  | { kind: "removeNode"; id: string }
  | { kind: "addEdge"; sourceId: string; targetId: string; label: string; edgeStyle?: EdgeStyle }
  | { kind: "removeEdge"; id: string }
  | { kind: "insertPattern"; fragment: PatternFragment; position: { x: number; y: number } };

/** Why a change was not applied. */
export type DiagramChangeSkipReason =
  "noDiagram" | "missingNode" | "missingEdge" | "edgeNotAllowed";

export interface DiagramChangeBatchResult {
  /** The id each added node got, by its ref. */
  idByRef: Record<string, string>;
  /** Indexes into the batch of the changes that were not applied, with why. */
  skipped: Array<{ index: number; reason: DiagramChangeSkipReason }>;
  /**
   * The undo checkpoint the batch took, or null when it took none (nothing
   * applied, or an undo had just run). Opaque: hand it to
   * `takeChangeBatchReceipt`.
   */
  checkpoint?: DiagramSnapshot | null;
}

/**
 * What a batch left behind, so it can be taken back while nothing else has
 * changed the diagram since (see `revertChangeBatch`).
 */
export interface ChangeBatchReceipt {
  diagramId: string;
  checkpoint: DiagramSnapshot;
  /** The diagram's model right after the batch and anything that finished it (its layout). */
  after: Pick<Diagram, "snapshot" | "versions">;
}

function nodeExists(d: Diagram, scene: VersionDiff | null, id: string): boolean {
  if (scene?.addedComponents[id]) return true;
  return !!d.snapshot.components[id] && !(scene?.removedComponentIds.includes(id) ?? false);
}

function edgeExists(d: Diagram, scene: VersionDiff | null, id: string): boolean {
  if (scene?.addedConnections[id]) return true;
  return !!d.snapshot.connections[id] && !(scene?.removedConnectionIds.includes(id) ?? false);
}

/** Applies one change to the draft; returns why it was skipped, or null. */
function applyChange(
  state: AppState,
  d: Diagram,
  change: DiagramChange,
  idByRef: Record<string, string>,
): DiagramChangeSkipReason | null {
  const scene = resolveActiveVersion(d);
  const resolve = (id: string) => idByRef[id] ?? id;

  switch (change.kind) {
    case "addNode": {
      // A parent that is gone or does not take this type: top level instead,
      // as `addComponent` does.
      const requestedParent = change.parentId === null ? null : resolve(change.parentId);
      const parent = requestedParent ? resolveComponent(d, scene, requestedParent) : undefined;
      const parentId =
        parent && nodeExists(d, scene, parent.id) && canContain(parent.type, change.type)
          ? parent.id
          : null;
      const { component, resolvedPanelKind } = buildComponentForType(
        generateId("el"),
        change.type,
        change.name,
        parentId,
        change.panelKind,
        change.serviceId,
      );
      placeNewComponent(state, d, scene, {
        type: change.type,
        component,
        resolvedPanelKind,
        parentId,
        position: change.position,
      });
      idByRef[change.ref] = component.id;
      return null;
    }
    case "updateNode":
      if (!nodeExists(d, scene, change.id)) return "missingNode";
      mutateUpdateComponent(d, change.id, change.patch);
      return null;
    case "removeNode":
      if (!nodeExists(d, scene, change.id)) return "missingNode";
      mutateRemoveElements(state, d, [change.id], []);
      return null;
    case "addEdge": {
      const sourceId = resolve(change.sourceId);
      const targetId = resolve(change.targetId);
      if (!nodeExists(d, scene, sourceId) || !nodeExists(d, scene, targetId)) {
        return "missingNode";
      }
      const sourceType = resolveComponent(d, scene, sourceId)?.type;
      if (sourceType === undefined || !canBeConnectionSource(sourceType)) return "edgeNotAllowed";
      writeConnection(
        d,
        scene,
        buildConnection(sourceId, targetId, change.label, change.edgeStyle),
      );
      touchDiagram(d);
      return null;
    }
    case "removeEdge":
      if (!edgeExists(d, scene, change.id)) return "missingEdge";
      mutateRemoveElements(state, d, [], [change.id]);
      return null;
    case "insertPattern":
      insertFragment(
        state,
        change.fragment,
        change.position,
        change.fragment.nodes.map(() => generateId("el")),
      );
      touchDiagram(d);
      return null;
  }
}

export const changeBatchSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
  /**
   * Applies a batch of changes as ONE undo step: one `set()`, one history
   * checkpoint, then every change through the same per-item mutation code the
   * single actions use. A change whose target no longer exists is skipped and
   * reported; the rest still apply.
   */
  applyChangeBatch: (changes: DiagramChange[]): DiagramChangeBatchResult => {
    const result: DiagramChangeBatchResult = { idByRef: {}, skipped: [] };
    if (changes.length === 0) return result;

    let applied = false;
    let checkpointed = false;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      applied = true;
      checkpointed = pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      changes.forEach((change, index) => {
        const reason = applyChange(state, d, change, result.idByRef);
        if (reason) result.skipped.push({ index, reason });
      });
    });

    if (!applied) {
      result.skipped = changes.map((_change, index) => ({ index, reason: "noDiagram" }));
    }
    const past = get().past;
    result.checkpoint = checkpointed ? (past[past.length - 1] ?? null) : null;
    return result;
  },

  /**
   * Records the active diagram as a batch left it. Call it once whatever
   * finishes the batch (a layout without history) has run. Null without a
   * checkpoint: such a batch cannot be taken back as one step.
   */
  takeChangeBatchReceipt: (checkpoint: DiagramSnapshot | null | undefined) => {
    const state = get();
    const d = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    if (!checkpoint || !d || checkpoint.diagramId !== d.id) return null;
    const receipt: ChangeBatchReceipt = {
      diagramId: d.id,
      checkpoint,
      after: { snapshot: d.snapshot, versions: d.versions },
    };
    return receipt;
  },

  /**
   * Takes a batch back, as if it never ran: the diagram returns to its
   * checkpoint and the checkpoint leaves the history, with nothing to redo.
   * Only while the batch is the last thing that happened to the diagram;
   * returns false, changing nothing, otherwise.
   */
  revertChangeBatch: (receipt: ChangeBatchReceipt): boolean => {
    const state = get();
    const d = state.diagrams[receipt.diagramId];
    const isLast =
      state.activeDiagramId === receipt.diagramId &&
      state.past[state.past.length - 1] === receipt.checkpoint &&
      d !== undefined &&
      // The model must be untouched. Layouts may differ: the canvas measures
      // new nodes without history, and those writes go with the batch.
      d.snapshot === receipt.after.snapshot &&
      d.versions === receipt.after.versions;
    if (!isLast) return false;
    set((draft) => {
      const entry = draft.past.pop();
      const target = draft.diagrams[receipt.diagramId];
      if (!entry || !target) return;
      target.snapshot = entry.snapshot;
      target.nodeLayouts = entry.nodeLayouts;
      target.edgeLayouts = entry.edgeLayouts;
      target.versions = entry.versions;
      touchDiagram(target);
    });
    return true;
  },

  /** Whether the batch's checkpoint is still in the undo history (it was not undone). */
  isChangeBatchInHistory: (receipt: ChangeBatchReceipt): boolean =>
    get().past.includes(receipt.checkpoint),
});

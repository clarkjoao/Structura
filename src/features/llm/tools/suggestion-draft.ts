import { isAddNodeAction, type AddNodeAction } from "../patch-actions";
import type { DiagramPatchAction } from "../types";

const REF_PREFIX = "new-";

/**
 * The changes the write tools queue during one reply. They become one pending
 * suggestion; nothing here touches the diagram.
 */
export class SuggestionDraft {
  private readonly queued: DiagramPatchAction[] = [];
  private nextRef = 1;

  /** Queues a new node and returns the ref later changes use to point at it. */
  addNode(payload: Omit<AddNodeAction["payload"], "ref">): string {
    const ref = `${REF_PREFIX}${this.nextRef}`;
    this.nextRef += 1;
    this.queued.push({ type: "ADD_NODE", payload: { ...payload, ref } });
    return ref;
  }

  queue(action: Exclude<DiagramPatchAction, AddNodeAction>): void {
    this.queued.push(action);
  }

  /** True when `id` is the ref of a node queued earlier in this draft. */
  hasRef(id: string): boolean {
    return this.queued.some((action) => isAddNodeAction(action) && action.payload.ref === id);
  }

  /** The ref of the node most recently queued with this name (case-insensitive), if any. */
  refByName(name: string): string | undefined {
    const wanted = name.trim().toLowerCase();
    for (let index = this.queued.length - 1; index >= 0; index -= 1) {
      const action = this.queued[index];
      if (
        action &&
        isAddNodeAction(action) &&
        action.payload.name.trim().toLowerCase() === wanted
      ) {
        return action.payload.ref;
      }
    }
    return undefined;
  }

  /**
   * The ref of a node already queued with the same name, type, panel kind and
   * service: a model that retries after an error often queues it again.
   */
  sameNodeRef(payload: Omit<AddNodeAction["payload"], "ref">): string | undefined {
    const wanted = payload.name.trim().toLowerCase();
    const match = this.queued.find(
      (action): action is AddNodeAction =>
        isAddNodeAction(action) &&
        action.payload.name.trim().toLowerCase() === wanted &&
        action.payload.nodeType === payload.nodeType &&
        action.payload.panelKind === payload.panelKind &&
        action.payload.serviceId === payload.serviceId,
    );
    return match?.payload.ref;
  }

  get actions(): readonly DiagramPatchAction[] {
    return this.queued;
  }

  get isEmpty(): boolean {
    return this.queued.length === 0;
  }
}

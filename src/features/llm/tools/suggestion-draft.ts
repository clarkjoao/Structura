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

  get actions(): readonly DiagramPatchAction[] {
    return this.queued;
  }

  get isEmpty(): boolean {
    return this.queued.length === 0;
  }
}

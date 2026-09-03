import type { FlowSewNotice } from "../../utils/flow-repair";
import type { AppState } from "../store.types";

/**
 * Hands the UI the joins a removal just made in the scripts.
 *
 * The id is what tells one batch from the next: the same removal repeated
 * produces the same notices, and only a new id means there is something new
 * to say. An empty batch is not published at all, so nothing is said when
 * nothing was sewn.
 */
export function publishSewNotices(state: AppState, notices: FlowSewNotice[]): void {
  if (notices.length === 0) return;
  state._flowSewNotices = { id: (state._flowSewNotices?.id ?? 0) + 1, notices };
}

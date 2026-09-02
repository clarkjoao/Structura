import type { TFunction } from "i18next";
import type { FlowStoreRefusalCode, SewBlockedStep } from "@/features/diagram";

/**
 * Every refusal the flow actions can return, and what to say about it.
 *
 * A total map rather than a key built from the code at the call site: adding a
 * refusal without a message is then a type error, instead of a toast that
 * shows a raw key to whoever hit it.
 */
const REFUSAL_KEYS: Record<FlowStoreRefusalCode, string> = {
  unknown_flow: "flowRefusal.unknown_flow",
  unknown_step: "flowRefusal.unknown_step",
  unknown_condition: "flowRefusal.unknown_condition",
  unknown_target: "flowRefusal.unknown_target",
  self_target: "flowRefusal.self_target",
  duplicate_step_id: "flowRefusal.duplicate_step_id",
  invalid_branch_index: "flowRefusal.invalid_branch_index",
  invalid_input: "flowRefusal.invalid_input",
  branch_point_move: "flowRefusal.branch_point_move",
  target_after_branch_point: "flowRefusal.target_after_branch_point",
  join_broken: "flowRefusal.join_broken",
  unlabeled_cursor: "flowRefusal.unlabeled_cursor",
  invariant_violated: "flowRefusal.invariant_violated",
};

/** Removals that were held back rather than guessed at. */
const HELD_BACK_KEYS: Record<SewBlockedStep["code"], string> = {
  branch_point: "flowRefusal.branch_point_removal",
};

export function refusalMessage(t: TFunction, code: FlowStoreRefusalCode): string {
  return t(REFUSAL_KEYS[code]);
}

export function heldBackMessage(t: TFunction, code: SewBlockedStep["code"]): string {
  return t(HELD_BACK_KEYS[code]);
}

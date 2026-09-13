import {
  claimShortcutEvent,
  type KeyHandler,
} from "./helpers";

/**
 * Run shortcut handlers in order. The first that returns true claims the event
 * (preventDefault + stopImmediatePropagation) and stops the chain.
 */
export async function runClaimingChain(
  event: KeyboardEvent,
  handlers: readonly KeyHandler[],
): Promise<boolean> {
  for (const handler of handlers) {
    if (await handler(event)) {
      claimShortcutEvent(event);
      return true;
    }
  }
  return false;
}

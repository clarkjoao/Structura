/**
 * The attribute that turns on the arrange transition in `index.css`: nodes glide
 * to their new place, edges hide until the nodes have landed.
 */
export const LAYOUT_TRANSITION_ATTRIBUTE = "data-layout-animating";

/** A little over the CSS transition, so the last frame lands before edges return. */
export const LAYOUT_TRANSITION_MS = 320;

const pending = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Marks `root` (React Flow's wrapper) as arranging for `LAYOUT_TRANSITION_MS`.
 * Call it right before the store write that moves the nodes. A second run while
 * one is still animating extends the window instead of cutting it short.
 *
 * Returns a function that ends the transition at once — for unmount.
 */
export function startLayoutTransition(root: HTMLElement | null | undefined): () => void {
  if (!root) return () => {};
  const end = (): void => {
    const timer = pending.get(root);
    if (timer !== undefined) clearTimeout(timer);
    pending.delete(root);
    root.removeAttribute(LAYOUT_TRANSITION_ATTRIBUTE);
  };

  const running = pending.get(root);
  if (running !== undefined) clearTimeout(running);
  root.setAttribute(LAYOUT_TRANSITION_ATTRIBUTE, "");
  pending.set(root, setTimeout(end, LAYOUT_TRANSITION_MS));
  return end;
}

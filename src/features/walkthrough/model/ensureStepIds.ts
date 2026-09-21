import { generateId } from "@/features/diagram";
import type { WalkthroughPresentation, WalkthroughStepRef } from "./walkthrough.types";

/** A new scene's identity. */
export function newStepId(): string {
  return generateId("wts");
}

/**
 * Backfills ids on scenes recorded before they had one.
 *
 * Scenes used to be identified by their position in the array, which is fine
 * until they move: React keyed the rail by index, so dragging one past another
 * handed the second scene's row the first one's state, and anything that ever
 * wants to hang off a scene — where a reader got to, a comment — had nothing
 * stable to hang from.
 *
 * Returns the same object when every scene already has an id, so hydrating an
 * up-to-date library does not churn the store.
 */
export function ensureStepIds(presentation: WalkthroughPresentation): WalkthroughPresentation {
  const seen = new Set<string>();
  let changed = false;

  const steps: WalkthroughStepRef[] = presentation.steps.map((step) => {
    // A duplicated id is as bad as a missing one — it is what a copied scene
    // would carry — so the second occurrence is reissued.
    if (step.id && !seen.has(step.id)) {
      seen.add(step.id);
      return step;
    }
    changed = true;
    const id = newStepId();
    seen.add(id);
    return { ...step, id };
  });

  return changed ? { ...presentation, steps } : presentation;
}

/** Backfills a whole library, keeping the record identity when nothing changed. */
export function ensureStepIdsIn(
  presentations: Record<string, WalkthroughPresentation>,
): Record<string, WalkthroughPresentation> {
  let changed = false;
  const next: Record<string, WalkthroughPresentation> = {};
  for (const [id, presentation] of Object.entries(presentations)) {
    const migrated = ensureStepIds(presentation);
    if (migrated !== presentation) changed = true;
    next[id] = migrated;
  }
  return changed ? next : presentations;
}

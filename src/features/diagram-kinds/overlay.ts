import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindOverlay } from "./kind.types";
import { isKindActive, resolveKindPolicy } from "./policy";

const cache = new WeakMap<
  object,
  { layouts: unknown; kindId: string; result: KindOverlay | null }
>();

/**
 * The active kind's overlay (spec guided-journey-phases), memoised on the
 * snapshot and the layouts, so the selector that reads it returns the same
 * object while nothing it draws changed. Null outside kind mode.
 */
export function kindOverlayFor(diagram: DiagramModel | null | undefined): KindOverlay | null {
  if (!diagram) return null;
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy) || !policy.descriptor.overlay) return null;
  const hit = cache.get(diagram.snapshot);
  if (hit && hit.layouts === diagram.nodeLayouts && hit.kindId === policy.descriptor.id)
    return hit.result;
  const result = policy.descriptor.overlay(diagram);
  cache.set(diagram.snapshot, {
    layouts: diagram.nodeLayouts,
    kindId: policy.descriptor.id,
    result,
  });
  return result;
}

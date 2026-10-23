import { useEffect, useRef } from "react";
import { useDiagramStore } from "@/features/diagram";
import { watchAutoArrange } from "./autoArrangeWatcher";

/**
 * The automatic mode on the editor canvas: while `enabled`, a structural edit
 * to a diagram in automatic mode places what it touched once the edits come to
 * rest (`watchAutoArrange`). `arrange` is read through a ref, so the run always
 * uses the latest measured nodes and resolved snapshot.
 */
export function useAutoArrange({
  enabled,
  arrange,
}: {
  enabled: boolean;
  arrange: (dirtyIds: string[]) => Promise<void> | void;
}): void {
  const arrangeRef = useRef(arrange);
  const enabledRef = useRef(enabled);
  arrangeRef.current = arrange;
  enabledRef.current = enabled;

  useEffect(
    () =>
      watchAutoArrange({
        store: useDiagramStore,
        arrange: (dirtyIds) => arrangeRef.current(dirtyIds),
        isEnabled: () => enabledRef.current,
      }),
    [],
  );
}

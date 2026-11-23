import { useMemo } from "react";
import { useDiagramStore } from "@/features/diagram";
import { currentRevisionChanges } from "../journey-outline";
import type { JourneyRevision } from "../types";

/** A change's dependency group: the changes that only apply together. */
export const groupOf = (change: { key: string; group?: string }) => change.group ?? change.key;

/** How many of the revision's changes apply now: those still there and not unticked. */
export function useRevisionSelection(revision: JourneyRevision | undefined): {
  current: ReadonlySet<string>;
  selected: number;
} {
  const snapshot = useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId]?.snapshot : undefined,
  );
  // Read again whenever the diagram (the snapshot) changes.
  return useMemo(() => {
    void snapshot;
    if (!revision) return { current: new Set<string>(), selected: 0 };
    const changes = currentRevisionChanges(revision);
    const unticked = new Set(revision.unticked);
    return {
      current: new Set(changes.map((c) => c.key)),
      selected: changes.filter((c) => !unticked.has(groupOf(c))).length,
    };
  }, [revision, snapshot]);
}

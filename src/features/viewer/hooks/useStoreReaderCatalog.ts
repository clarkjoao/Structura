import { useMemo } from "react";
import type { Diagram } from "@/features/diagram/model";
import { useDiagramStore } from "@/features/diagram/store";
import { buildReaderCatalog, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";

/**
 * The names `diagram` shows, from the reader's own workspace.
 *
 * For a reader on the author's machine — a diagram opened by id, a file off
 * disk, a walkthrough scene — the workspace the editor reads is right here, so
 * the reader shows the same service and linked-diagram names the editor does.
 * A link's reader has no such workspace, and uses the names the link carried.
 */
export function useStoreReaderCatalog(
  diagram: Diagram | null | undefined,
): ReaderCatalog | undefined {
  const services = useDiagramStore((state) => state.services);
  const diagrams = useDiagramStore((state) => state.diagrams);
  return useMemo(
    () => (diagram ? buildReaderCatalog(diagram, services, diagrams) : undefined),
    [diagram, services, diagrams],
  );
}

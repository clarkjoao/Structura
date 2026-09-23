import { useShallow } from "zustand/react/shallow";
import type { Diagram } from "../../model";
import { buildReaderCatalog, type ReaderCatalog } from "../../utils/reader-catalog";
import { useDiagramStore } from "../diagram.store";

export const useServiceIds = () => useDiagramStore(useShallow((s) => Object.keys(s.services)));

export const useService = (id: string) => useDiagramStore((s) => s.services[id]);

export const useAllServices = () => useDiagramStore(useShallow((s) => Object.values(s.services)));

export const useServices = () => useDiagramStore(useShallow((s) => s.services));

/**
 * The names `diagram` shows, read once from the store — for a link being
 * written, which is a snapshot anyway. Not a subscription: the share dialogs
 * that call it stay mounted, and a subscription would re-render them on every
 * store write with nobody looking.
 */
export const readerCatalogFromStore = (diagram: Diagram): ReaderCatalog => {
  const { services, diagrams } = useDiagramStore.getState();
  return buildReaderCatalog(diagram, services, diagrams);
};

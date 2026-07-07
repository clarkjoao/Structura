import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useServiceIds = () =>
  useDiagramStore(useShallow((s) => Object.keys(s.serviceCatalog)));

export const useService = (id: string) => useDiagramStore((s) => s.serviceCatalog[id]);

export const useAllServices = () =>
  useDiagramStore(useShallow((s) => Object.values(s.serviceCatalog)));

export const useServiceCatalog = () => useDiagramStore(useShallow((s) => s.serviceCatalog));

/** @deprecated Use `useServiceCatalog`. The alias is kept for one release
 * to give plugin authors and external consumers time to migrate. */
export const useServiceRegistry = useServiceCatalog;

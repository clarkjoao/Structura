import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useServiceIds = () => useDiagramStore(useShallow((s) => Object.keys(s.services)));

export const useService = (id: string) => useDiagramStore((s) => s.services[id]);

export const useAllServices = () => useDiagramStore(useShallow((s) => Object.values(s.services)));

export const useServices = () => useDiagramStore(useShallow((s) => s.services));

import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useServiceIds = () =>
  useDiagramStore((s) =>
    Object.keys(s.serviceRegistry)
  );

export const useService = (id: string) =>
  useDiagramStore((s) =>
    s.serviceRegistry[id]
  );

export const useAllServices = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.serviceRegistry))
  );

export const useServiceRegistry = () =>
  useDiagramStore(useShallow((s) => s.serviceRegistry));

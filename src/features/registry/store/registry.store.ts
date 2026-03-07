import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "@/features/diagram";

export { useDiagramStore, useServiceRegistry, useAllServices, useAllComponents, useAllConnections } from "@/features/diagram";

export const useRegistryActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
    })),
  );

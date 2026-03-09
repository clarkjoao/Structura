import type { ServiceDefinition } from "@/features/registry";
import { generateId } from "../../model/diagram.utils";
import type { AppState } from "../store.types";
import { activeDiagram } from "../store.types";

export function servicesSlice(set: (fn: (state: AppState) => void) => void) {
  return {
    addService: (service: Omit<ServiceDefinition, "id">): ServiceDefinition => {
      const svc: ServiceDefinition = { ...service, id: generateId("svc") };
      set((state) => {
        const d = activeDiagram(state);
        if (!d.snapshot.serviceRegistry) d.snapshot.serviceRegistry = {};
        d.snapshot.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => {
      set((state) => {
        const svc = activeDiagram(state).snapshot.serviceRegistry?.[id];
        if (svc) Object.assign(svc, patch);
      });
    },

    removeService: (id: string) => {
      set((state) => {
        const d = activeDiagram(state);
        delete d.snapshot.serviceRegistry[id];
        Object.values(d.snapshot.components).forEach((c) => {
          if (c.serviceId === id) c.serviceId = undefined;
        });
      });
    },

    linkComponentToService: (componentId: string, serviceId: string | undefined) => {
      set((state) => {
        const comp = activeDiagram(state).snapshot.components[componentId];
        if (comp) comp.serviceId = serviceId;
      });
    },

    linkComponentToDiagram: (componentId: string, diagramId: string | undefined) => {
      set((state) => {
        const comp = activeDiagram(state).snapshot.components[componentId];
        if (comp) comp.linkedDiagramId = diagramId;
      });
    },
  };
}

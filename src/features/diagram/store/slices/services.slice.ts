import type { ServiceDefinition } from "@/features/registry";
import { generateId } from "../../model/diagram.utils";
import type { AppState } from "../store.types";
import { activeDiagram } from "../store.types";

export function servicesSlice(set: (fn: (state: AppState) => void) => void) {
  return {
    addService: (service: Omit<ServiceDefinition, "id">): ServiceDefinition => {
      const svc: ServiceDefinition = { ...service, id: generateId("svc") };
      set((state) => {
        state.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => {
      set((state) => {
        const svc = state.serviceRegistry[id];
        if (svc) Object.assign(svc, patch);
      });
    },

    removeService: (id: string) => {
      set((state) => {
        delete state.serviceRegistry[id];
        Object.values(state.diagrams).forEach((entry) => {
          Object.values(entry.snapshot.components).forEach((c) => {
            if (c.serviceId === id) c.serviceId = undefined;
          });
        });
      });
    },

    linkComponentToService: (componentId: string, serviceId: string | undefined) => {
      set((state) => {
        const comp = activeDiagram(state).snapshot.components[componentId];
        if (!comp) return;
        comp.serviceId = serviceId;
        if (!serviceId) return;

        const service = state.serviceRegistry[serviceId];
        if (!service) return;

        comp.name = service.name;
        comp.description = service.description;
        comp.tags = service.tags?.length ? service.tags : undefined;
        if ("technology" in comp) {
          comp.technology = service.technology.length
            ? service.technology.join(", ")
            : undefined;
        }
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

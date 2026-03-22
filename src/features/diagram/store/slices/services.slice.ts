import type { ServiceDefinition } from "../../model/service.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { SEED_SERVICE_REGISTRY } from "@/fixtures/seed";
import { normalizeSources } from "@/integrations/merge-utils";

export const servicesSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    serviceRegistry: import.meta.env.VITE_DISABLE_SEEDS === "true" ? {} : SEED_SERVICE_REGISTRY,
  
    addService: (service: Omit<ServiceDefinition, "id">): ServiceDefinition => {
      const svc: ServiceDefinition = {
        ...service,
        sources: normalizeSources(service),
        id: generateId("svc"),
      };
      set((state) => {
        state.serviceRegistry[svc.id] = svc;
      });
      return svc;
    },

    updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => {
      set((state) => {
        const svc = state.serviceRegistry[id];
        if (svc) {
          Object.assign(svc, patch);
          svc.sources = normalizeSources(svc);
        }
      });
    },

    removeService: (id: string) => {
      set((state) => {
        delete state.serviceRegistry[id];
        Object.values(state.diagrams).forEach((entry) => {
          Object.values(entry.snapshot.components).forEach((c) => {
            if (c.serviceId === id) c.serviceId = undefined;
          });
          Object.values(entry.scenes ?? {}).forEach((sc) => {
            Object.values(sc.addedComponents).forEach((c) => {
              if (c.serviceId === id) c.serviceId = undefined;
            });
          });
        });
      });
    },

    linkComponentToService: (componentId: string, serviceId: string | undefined) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        const comp =
          scene?.addedComponents[componentId] ?? d.snapshot.components[componentId];
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
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        const comp =
          scene?.addedComponents[componentId] ?? d.snapshot.components[componentId];
        if (comp) comp.linkedDiagramId = diagramId;
      });
    },
  });

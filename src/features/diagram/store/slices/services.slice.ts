import type { Component } from "../../model/diagram.types";
import type { ServiceDefinition } from "../../model/service.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { SEED_SERVICE_REGISTRY } from "@/fixtures/seeds";
import { normalizeSources } from "@/integrations/merge-utils";
import { getActiveDiagram } from "./get-active-diagram";

function patchTouchesLinkedComponentFields(
  patch: Partial<Omit<ServiceDefinition, "id">>,
): boolean {
  return (
    "name" in patch ||
    "description" in patch ||
    "tags" in patch ||
    "technology" in patch ||
    "externalLinks" in patch
  );
}

/** Core fields copied from registry when linking or when the service is updated. */
function copyServiceCoreFieldsToComponent(
  comp: Component,
  service: ServiceDefinition,
): void {
  comp.name = service.name;
  comp.description = service.description;
  comp.tags = service.tags?.length ? service.tags : undefined;
  if ("technology" in comp) {
    comp.technology = service.technology.length
      ? service.technology.join(", ")
      : undefined;
  }
}

/** Used when first linking: add any service URLs missing on the component. */
function mergeServiceExternalLinksIntoComponent(
  comp: Component,
  service: ServiceDefinition,
): void {
  if (!service.externalLinks?.length) return;
  const existing = new Set((comp.externalLinks ?? []).map((link) => link.url));
  const toAdd = service.externalLinks.filter((link) => !existing.has(link.url));
  if (toAdd.length) {
    comp.externalLinks = [...(comp.externalLinks ?? []), ...toAdd];
  }
}

/** Used when registry externalLinks change: drop removed service URLs, merge new. */
function reconcileExternalLinksFromRegistry(
  comp: Component,
  previousServiceUrls: Set<string>,
  service: ServiceDefinition,
): void {
  const newServiceLinks = service.externalLinks ?? [];
  const newUrls = new Set(newServiceLinks.map((link) => link.url));

  let links = [...(comp.externalLinks ?? [])];
  links = links.filter(
    (link) => !previousServiceUrls.has(link.url) || newUrls.has(link.url),
  );

  const existing = new Set(links.map((link) => link.url));
  for (const serviceLink of newServiceLinks) {
    if (!existing.has(serviceLink.url)) {
      links.push({ ...serviceLink });
      existing.add(serviceLink.url);
    }
  }

  comp.externalLinks = links.length > 0 ? links : undefined;
}

function syncLinkedComponentsFromRegistry(
  state: AppState,
  serviceId: string,
  service: ServiceDefinition,
  previousExternalLinkUrls: Set<string> | null,
): void {
  const apply = (comp: Component): boolean => {
    if (comp.serviceId !== serviceId) return false;
    copyServiceCoreFieldsToComponent(comp, service);
    if (previousExternalLinkUrls !== null) {
      reconcileExternalLinksFromRegistry(comp, previousExternalLinkUrls, service);
    }
    return true;
  };

  for (const diagram of Object.values(state.diagrams)) {
    let touched = false;
    for (const comp of Object.values(diagram.snapshot.components)) {
      if (apply(comp)) touched = true;
    }
    for (const scene of Object.values(diagram.scenes ?? {})) {
      for (const comp of Object.values(scene.addedComponents)) {
        if (apply(comp)) touched = true;
      }
    }
    if (touched) {
      diagram.updatedAt = new Date().toISOString();
    }
  }
}

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
        if (!svc) return;

        const shouldSyncDiagrams = patchTouchesLinkedComponentFields(patch);
        const previousExternalLinkUrls =
          shouldSyncDiagrams && "externalLinks" in patch
            ? new Set((svc.externalLinks ?? []).map((link) => link.url))
            : null;

        Object.assign(svc, patch);
        svc.sources = normalizeSources(svc);

        if (shouldSyncDiagrams) {
          syncLinkedComponentsFromRegistry(
            state,
            id,
            svc,
            previousExternalLinkUrls,
          );
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
        const d = getActiveDiagram(state);
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

        copyServiceCoreFieldsToComponent(comp, service);
        mergeServiceExternalLinksIntoComponent(comp, service);
      });
    },

    linkComponentToDiagram: (componentId: string, diagramId: string | undefined) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        const comp =
          scene?.addedComponents[componentId] ?? d.snapshot.components[componentId];
        if (comp) comp.linkedDiagramId = diagramId;
      });
    },
  });

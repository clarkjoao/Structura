import type { ExternalLink } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { pushHistory } from "./history.slice";
import { resolveActiveVersion, writableComponent } from "../helpers/version-helpers";

export const componentLinksSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  updateHandleOrder: (
    componentId: string,
    side: "incoming" | "outgoing",
    orderedConnectionIds: string[],
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const comp = writableComponent(d, resolveActiveVersion(d), componentId)?.component;
      if (!comp) return;
      if (!comp.handleOrder) comp.handleOrder = { incoming: [], outgoing: [] };
      comp.handleOrder[side] = orderedConnectionIds;
      touchDiagram(d);
    });
  },

  addExternalLink: (componentId: string, link: Omit<ExternalLink, "id">) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const sceneOwned = !!(
        scene &&
        (scene.addedComponents[componentId] || scene.modifiedComponents?.[componentId])
      );
      if (!sceneOwned) pushHistory(state);
      const comp = writableComponent(d, scene, componentId)?.component;
      if (!comp) return;
      if (!comp.externalLinks) comp.externalLinks = [];
      comp.externalLinks.push({ ...link, id: generateId("lnk") });
      touchDiagram(d);
    });
  },

  updateExternalLink: (
    componentId: string,
    linkId: string,
    patch: Partial<Omit<ExternalLink, "id">>,
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const sceneOwned = !!(
        scene &&
        (scene.addedComponents[componentId] || scene.modifiedComponents?.[componentId])
      );
      if (!sceneOwned) pushHistory(state);
      const comp = writableComponent(d, scene, componentId)?.component;
      if (!comp) return;
      const link = comp.externalLinks?.find((l) => l.id === linkId);
      if (link) Object.assign(link, patch);
      touchDiagram(d);
    });
  },

  removeExternalLink: (componentId: string, linkId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const sceneOwned = !!(
        scene &&
        (scene.addedComponents[componentId] || scene.modifiedComponents?.[componentId])
      );
      if (!sceneOwned) pushHistory(state);
      const comp = writableComponent(d, scene, componentId)?.component;
      if (!comp) return;
      comp.externalLinks = (comp.externalLinks ?? []).filter((l) => l.id !== linkId);
      touchDiagram(d);
    });
  },
});

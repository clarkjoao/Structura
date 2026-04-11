import type { ExternalLink } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { getActiveDiagram } from "./get-active-diagram";
import { pushHistory } from "./history.slice";
import { resolveActiveScene } from "./scene-helpers";

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
      const scene = resolveActiveScene(d);
      const comp =
        scene?.addedComponents[componentId] ?? d.snapshot.components[componentId];
      if (!comp) return;
      if (!comp.handleOrder) comp.handleOrder = { incoming: [], outgoing: [] };
      comp.handleOrder[side] = orderedConnectionIds;
      d.updatedAt = new Date().toISOString();
    });
  },

  addExternalLink: (componentId: string, link: Omit<ExternalLink, "id">) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      const inSceneAdds = !!(scene && scene.addedComponents[componentId]);
      if (!scene || !inSceneAdds) pushHistory(state);
      const comp = inSceneAdds
        ? scene!.addedComponents[componentId]
        : d.snapshot.components[componentId];
      if (!comp) return;
      if (!comp.externalLinks) comp.externalLinks = [];
      comp.externalLinks.push({ ...link, id: generateId("lnk") });
      d.updatedAt = new Date().toISOString();
    });
  },

  updateExternalLink: (componentId: string, linkId: string, patch: Partial<Omit<ExternalLink, "id">>) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      const inSceneAdds = !!(scene && scene.addedComponents[componentId]);
      if (!scene || !inSceneAdds) pushHistory(state);
      const comp = inSceneAdds
        ? scene!.addedComponents[componentId]
        : d.snapshot.components[componentId];
      if (!comp) return;
      const link = comp.externalLinks?.find((l) => l.id === linkId);
      if (link) Object.assign(link, patch);
      d.updatedAt = new Date().toISOString();
    });
  },

  removeExternalLink: (componentId: string, linkId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      const inSceneAdds = !!(scene && scene.addedComponents[componentId]);
      if (!scene || !inSceneAdds) pushHistory(state);
      const comp = inSceneAdds
        ? scene!.addedComponents[componentId]
        : d.snapshot.components[componentId];
      if (!comp) return;
      comp.externalLinks = (comp.externalLinks ?? []).filter((l) => l.id !== linkId);
      d.updatedAt = new Date().toISOString();
    });
  },
});

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getDefaultNameForNewComponent,
  getLastEdgeStyle,
  useDiagramActions,
  type NewConnectedEdge,
} from "@/features/diagram";
import { useElementPresetLibrary } from "@/features/element-presets";
import type { CatalogEntry } from "@/features/elements/search";
import { panelKindDefaultName } from "@/lib/catalogs/panels";
import { useCanvasPreferencesStore } from "../preferences";

export interface CatalogInsertTarget {
  /** Flow position of the new node. */
  position: { x: number; y: number };
  /** Draw an edge from this node to the new one, in the same undo step. */
  sourceNodeId?: string | null;
}

/** A catalog element's default name: a cloud service keeps its proper name. */
function defaultNameFor(entry: CatalogEntry): string {
  if (entry.insert.kind !== "element") return entry.label;
  const { type, createOptions } = entry.insert;
  if (createOptions.serviceId) return entry.label;
  const panelDefault = createOptions.panelKind
    ? panelKindDefaultName(createOptions.panelKind)
    : undefined;
  return getDefaultNameForNewComponent(type, entry.label, panelDefault);
}

/**
 * Inserts a catalog entry and returns the new node's id (null when nothing was
 * created). Every surface — the catalog, the toolbar, quick insert, a drop —
 * goes through here, so they name, size and connect a node the same way, and
 * all of them feed Recents.
 */
export function useCatalogInsert(): (
  entry: CatalogEntry,
  target: CatalogInsertTarget,
) => string | null {
  const { t } = useTranslation();
  const { addComponent, addComponentConnectedFrom, linkComponentToService } = useDiagramActions();
  const { instantiatePreset } = useElementPresetLibrary();
  const recordUse = useCanvasPreferencesStore((state) => state.recordCatalogEntryUse);

  return useCallback(
    (entry, { position, sourceNodeId }) => {
      const edge: NewConnectedEdge = {
        label: t("canvas.usesEdgeLabel"),
        edgeStyle: getLastEdgeStyle(),
      };
      const connectFrom = sourceNodeId ? { sourceId: sourceNodeId, edge } : undefined;
      let createdId: string | null = null;

      switch (entry.insert.kind) {
        case "element": {
          const { type, createOptions } = entry.insert;
          const name = defaultNameFor(entry);
          createdId = connectFrom
            ? addComponentConnectedFrom(
                connectFrom.sourceId,
                {
                  type,
                  name,
                  position,
                  serviceId: createOptions.serviceId,
                  panelKind: createOptions.panelKind,
                  flowShape: createOptions.flowShape,
                  createOptions,
                },
                edge,
              ).component.id
            : addComponent(
                type,
                name,
                null,
                position,
                createOptions.serviceId,
                createOptions.panelKind,
                createOptions.flowShape,
                createOptions,
              ).id;
          break;
        }
        case "service": {
          // Linking writes no history: the node, its edge and the link undo together.
          const component = connectFrom
            ? addComponentConnectedFrom(
                connectFrom.sourceId,
                { type: "system", name: entry.label, position },
                edge,
              ).component
            : addComponent("system", entry.label, null, position);
          linkComponentToService(component.id, entry.insert.serviceId);
          createdId = component.id;
          break;
        }
        case "preset":
          createdId = instantiatePreset({
            presetId: entry.insert.presetId,
            position,
            connectFrom,
          });
          break;
      }

      if (createdId) recordUse(entry.id);
      return createdId;
    },
    [
      t,
      addComponent,
      addComponentConnectedFrom,
      linkComponentToService,
      instantiatePreset,
      recordUse,
    ],
  );
}

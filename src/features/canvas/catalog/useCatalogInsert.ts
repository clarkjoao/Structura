import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getDefaultNameForNewComponent,
  isTextType,
  getLastEdgeStyle,
  useDiagramActions,
  type NewConnectedEdge,
} from "@/features/diagram";
import { useElementPresetLibrary } from "@/features/element-presets";
import type { CatalogEntry } from "@/features/elements/search";
import { panelKindDefaultName } from "@/lib/catalogs/panels";
import { useCanvasPreferencesStore } from "../preferences";
import { useTextToolStore } from "../text/textLayer.store";
import { toast } from "sonner";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { isKindActive, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";

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
  // A text starts empty: it opens for typing, and has no name to be called.
  if (isTextType(type)) return "";
  if (createOptions.serviceId) return entry.label;
  const panelDefault = createOptions.panelKind
    ? panelKindDefaultName(createOptions.panelKind)
    : undefined;
  return getDefaultNameForNewComponent(type, entry.label, panelDefault);
}

/**
 * The insert as the active diagram's kind does it, or `undefined` when no kind
 * takes it (freehand, or a kind without an `insert`). A refusal is shown and
 * yields null.
 */
function insertThroughKind(
  entry: CatalogEntry,
  sourceNodeId: string | null,
): string | null | undefined {
  if (entry.insert.kind !== "element") return undefined;
  const state = useDiagramStore.getState();
  const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
  const policy = resolveKindPolicy(diagram);
  if (!diagram || !isKindActive(policy) || !policy.descriptor.insert) return undefined;
  const { type, createOptions } = entry.insert;
  if (isTextType(type)) return undefined;
  const selection = useCanvasSelectionStore.getState();
  const selectedIds = sourceNodeId ? [sourceNodeId] : [...selection.selectedNodeIds];
  const outcome = policy.descriptor.insert(kindCommandContextFor(diagram, selectedIds), {
    type,
    ...(createOptions.flowShape && { flowShape: createOptions.flowShape }),
  });
  if ("refused" in outcome) {
    toast.info(resolveKindText(outcome.refused));
    return null;
  }
  const result = state.applyKindEdit(outcome.edit);
  return outcome.select ? (result.idsByKey[outcome.select] ?? outcome.select) : null;
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
  const showTextLayer = useTextToolStore((state) => state.setLayerVisible);
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

      // A diagram kind places what is inserted (ADR-0014): into the selected lane, after the
      // selected step. The position asked for is the kind's to decide.
      const kindInsert = insertThroughKind(entry, sourceNodeId ?? null);
      if (kindInsert !== undefined) {
        if (kindInsert) recordUse(entry.id);
        return kindInsert;
      }

      switch (entry.insert.kind) {
        case "element": {
          const { type, createOptions } = entry.insert;
          const name = defaultNameFor(entry);
          // A text is drawn only while the layer is on: inserting one turns it on.
          if (isTextType(type)) showTextLayer(true);
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
      showTextLayer,
      instantiatePreset,
      recordUse,
    ],
  );
}

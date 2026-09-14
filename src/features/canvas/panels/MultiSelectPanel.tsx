import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  LayoutDashboard,
  LayoutGrid,
  Copy,
  Trash2,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  resolveSceneSnapshot,
} from "@/features/diagram";
import {
  collectBoundaryConnectionIds,
  collectConnectionIdsToResetWaypoints,
  resetWaypointsForConnections,
} from "@/features/canvas/edges/reset-edge-waypoints";
import type { Component, ComponentType } from "@/features/diagram";
import { captureSelectionAsTemplate } from "@/features/canvas/utils/capture-template";
import { duplicateSelection } from "@/features/canvas/utils/duplicateSelection";
import { SaveTemplateModal } from "@/features/canvas/components/SaveTemplateModal";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { layoutScopedNodes } from "@/features/canvas/layout/layoutScopedNodes";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";

function readTechnology(component: Component): string | undefined {
  if ("technology" in component && typeof component.technology === "string") {
    return component.technology;
  }
  return undefined;
}

function tagsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((tag, index) => tag === right[index]);
}

interface MultiSelectPanelProps {
  selectedNodes: Node[];
  onClose: () => void;
}

export function MultiSelectPanel({ selectedNodes, onClose }: MultiSelectPanelProps) {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const reactFlowInstance = useReactFlow();
  const setSelectedNodeIds = useCanvasSelectionStore((state) => state.setSelectedNodeIds);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagsAreMixed, setTagsAreMixed] = useState(false);
  const typeLabelKeys: Record<string, string> = useMemo(
    () => ({
      person: "multiSelect.typePerson",
      system: "multiSelect.typeSystem",
      container: "multiSelect.typeContainer",
      component: "multiSelect.typeComponent",
      panel: "multiSelect.typePanel",
      note: "multiSelect.typeNote",
    }),
    [],
  );
  const diagram = useActiveDiagram();
  const {
    groupNodes,
    removeElements,
    updateComponent,
    copyToClipboard,
    pasteFromClipboard,
    saveUserTemplate,
    resetEdgeControlPoints,
    applyAutoLayout,
  } = useDiagramActions();

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const idsKey = ids.join(",");
  const resolved = useMemo(
    () => (diagram ? resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null) : null),
    [diagram],
  );
  const components = useMemo(
    () => (resolved ? ids.map((id) => resolved.components[id]).filter(Boolean) : []),
    [resolved, ids],
  );
  const tagsHydratedForIdsRef = useRef("");

  useEffect(() => {
    if (tagsHydratedForIdsRef.current !== idsKey) {
      tagsHydratedForIdsRef.current = "";
    }
    if (components.length === 0) {
      setTags([]);
      setTagsAreMixed(false);
      setTagInput("");
      return;
    }
    if (tagsHydratedForIdsRef.current === idsKey) return;
    tagsHydratedForIdsRef.current = idsKey;
    const first = components[0].tags ?? [];
    const allSame = components.every((component) => tagsEqual(component.tags ?? [], first));
    setTags(allSame ? [...first] : []);
    setTagsAreMixed(!allSame);
    setTagInput("");
  }, [idsKey, components]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedNodes.forEach((n) => {
      const nodeType = (n.data?.type as string) ?? "component";
      counts[nodeType] = (counts[nodeType] ?? 0) + 1;
    });
    return counts;
  }, [selectedNodes]);

  const typeSummary = useMemo(
    () =>
      Object.entries(typeCounts)
        .map(([type, count]) => {
          const key = typeLabelKeys[type];
          const label = key ? t(key) : type;
          return `${count} ${label}${count > 1 ? "s" : ""}`;
        })
        .join(", "),
    [typeCounts, t, typeLabelKeys],
  );

  const allSameType = useMemo(() => {
    if (selectedNodes.length <= 1) return true;
    const first = (selectedNodes[0].data?.type as ComponentType) ?? "component";
    return selectedNodes.every((n) => ((n.data?.type as ComponentType) ?? "component") === first);
  }, [selectedNodes]);

  const sharedTechnology = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = readTechnology(components[0]) ?? "";
    const allSame = components.every((c) => (readTechnology(c) ?? "") === first);
    return allSame ? first : null;
  }, [components]);

  const sharedDescription = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = components[0].description ?? "";
    const allSame = components.every((c) => (c.description ?? "") === first);
    return allSame ? first : null;
  }, [components]);

  const applyTagsToSelection = (nextTags: string[]) => {
    ids.forEach((id) => updateComponent(id, { tags: nextTags }));
    setTags(nextTags);
    setTagsAreMixed(false);
  };

  const handleCommitTagInput = () => {
    const newTag = tagInput.trim();
    if (!newTag) return;
    if (!tags.includes(newTag)) {
      applyTagsToSelection([...tags, newTag]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    applyTagsToSelection(tags.filter((item) => item !== tag));
  };

  const handleGroup = () => {
    const panelId = groupNodes(ids);
    if (panelId) onClose();
  };

  const handleDuplicate = () => {
    if (!diagram) return;
    const newIds = duplicateSelection({
      diagram,
      nodes: selectedNodes,
      copyToClipboard,
      pasteFromClipboard,
    });
    if (newIds.length === 0) return;
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
    );
    setSelectedNodeIds(new Set(newIds));
  };

  const handleDelete = () => {
    removeElements(ids, []);
    onClose();
  };

  const handleTechnologyChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { technology: value || undefined }));
  };

  const handleDescriptionChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { description: value }));
  };

  const handleResetWaypoints = () => {
    if (!activeDiagramId || !diagram) return;
    const connectionIds = collectConnectionIdsToResetWaypoints({
      edgeLayouts: diagram.edgeLayouts,
      selectedEdgeId: null,
      reactFlowEdges: [],
    });
    resetWaypointsForConnections(activeDiagramId, connectionIds, resetEdgeControlPoints);
  };

  /**
   * Arrange just what is selected, where it already sits.
   *
   * The engine takes a subset as it stands: `fromDiagram` is handed only the
   * selected components, and a `parentId` pointing outside the subset is
   * treated as a root. What it cannot do is hold the rest of the diagram
   * still while it works — `LayoutNode` carries no position, so there is no
   * way to tell ELK "this neighbour is fixed at (x, y)". So the selection is
   * arranged among itself, and connections to the rest are not considered.
   *
   * Those crossing connections are the one thing that needs cleaning up after.
   * `fromDiagram` drops an edge unless both ends are in scope, so a crossing
   * one never reaches the layout, and its stored path would go on describing a
   * route to where the node used to be.
   */
  const handleAutoLayoutSelection = () => {
    if (!activeDiagramId || !resolved || ids.length === 0) return;

    const selected = new Set(ids);
    const connectionValues = Object.values(resolved.connections);
    const inside = connectionValues.filter(
      (connection) => selected.has(connection.sourceId) && selected.has(connection.targetId),
    );

    // Where the selection sits now, so the result lands under the user's eyes
    // rather than at the origin.
    const boxes = ids.map((id) => resolved.nodeLayouts[id]).filter(Boolean);
    if (boxes.length === 0) return;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + (b.width ?? DEFAULT_NODE_W)));
    const maxY = Math.max(...boxes.map((b) => b.y + (b.height ?? DEFAULT_NODE_H)));

    void layoutScopedNodes({
      nodeIds: ids,
      connectionIds: inside.map((connection) => connection.id),
      components: resolved.components,
      connections: resolved.connections,
      nodeLayouts: resolved.nodeLayouts,
      anchor: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      activeDiagramId,
      applyAutoLayout,
      resetPaths: true,
    }).then((applied) => {
      if (!applied) return;
      resetWaypointsForConnections(
        activeDiagramId,
        collectBoundaryConnectionIds(connectionValues, selected),
        resetEdgeControlPoints,
      );
    });
  };

  const handleSaveTemplate = (name: string, description: string, category: string) => {
    if (!resolved) return;
    const template = captureSelectionAsTemplate(
      ids,
      resolved.components,
      resolved.connections,
      Object.values(resolved.nodeLayouts),
      name,
      description || undefined,
      category || undefined,
    );
    saveUserTemplate(template);
    setSaveTemplateOpen(false);
    toast.success(t("saveTemplate.saved"));
  };

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("multiSelect.title")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">
          {t("multiSelect.selectedCount", { count: selectedNodes.length })}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{typeSummary}</p>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("common.actions")}
        </p>
        <div className="flex flex-col gap-2">
          {ids.length >= 2 && (
            <button
              type="button"
              onClick={handleGroup}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t("multiSelect.group")}
            </button>
          )}
          {selectedNodes.length >= 2 && resolved && (
            <button
              type="button"
              onClick={() => setSaveTemplateOpen(true)}
              title={t("canvas.multiSelect.saveAsTemplate")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
            >
              <BookmarkPlus size={14} className="shrink-0" aria-hidden />
              {t("canvas.multiSelect.saveAsTemplate")}
            </button>
          )}
          <button
            type="button"
            onClick={handleAutoLayoutSelection}
            title={t("multiSelect.autoLayoutSelectionHint")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t("multiSelect.autoLayoutSelection")}
          </button>
          <button
            type="button"
            onClick={handleResetWaypoints}
            title={t("multiSelect.resetWaypointsShortcut")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("multiSelect.resetWaypoints")}
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("multiSelect.duplicate")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("multiSelect.delete")}
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("multiSelect.commonProps")}
        </p>
        <p className="text-[10px] text-muted-foreground italic">{t("multiSelect.editAllHint")}</p>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.tags")}
          </label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-foreground leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onBlur={handleCommitTagInput}
            onKeyDown={(event) => {
              if (keyIs(event, KEY.ENTER) && tagInput.trim()) {
                event.preventDefault();
                handleCommitTagInput();
              }
            }}
            placeholder={
              tagsAreMixed ? t("common.multipleValues") : t("elementPanel.tagsPlaceholder")
            }
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm",
              tagsAreMixed && tags.length === 0 && "italic text-muted-foreground",
            )}
          />
        </div>

        {allSameType && (
          <>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                {t("common.technology")}
              </label>
              <input
                value={sharedTechnology ?? ""}
                onChange={(e) => handleTechnologyChange(e.target.value)}
                placeholder={
                  sharedTechnology === null ? t("common.multipleValues") : t("common.techExample")
                }
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm",
                  sharedTechnology === null && "italic text-muted-foreground",
                )}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                {t("common.description")}
              </label>
              <textarea
                value={sharedDescription ?? ""}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder={
                  sharedDescription === null ? t("common.multipleValues") : t("common.description")
                }
                rows={2}
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm resize-none",
                  sharedDescription === null && "italic text-muted-foreground",
                )}
              />
            </div>
          </>
        )}
      </div>

      {saveTemplateOpen && resolved && (
        <SaveTemplateModal
          selectedComponentIds={ids}
          components={resolved.components}
          onSave={handleSaveTemplate}
          onClose={() => setSaveTemplateOpen(false)}
        />
      )}
    </div>
  );
}

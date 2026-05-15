import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, LayoutDashboard, Copy, Trash2, BookmarkPlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  resolveSceneSnapshot,
} from "@/features/diagram";
import {
  collectConnectionIdsToResetWaypoints,
  resetWaypointsForConnections,
} from "@/features/canvas/edges/reset-edge-waypoints";
import type { Component, ComponentType } from "@/features/diagram";
import { isPanelType } from "@/features/diagram";
import { captureSelectionAsTemplate } from "@/features/canvas/utils/capture-template";
import { SaveTemplateModal } from "@/features/canvas/components/SaveTemplateModal";
import { cn } from "@/lib/utils";

function readTechnology(component: Component): string | undefined {
  if ("technology" in component && typeof component.technology === "string") {
    return component.technology;
  }
  return undefined;
}

function readAwsService(component: Component): string | undefined {
  if ("awsService" in component && typeof component.awsService === "string") {
    return component.awsService;
  }
  return undefined;
}

interface MultiSelectPanelProps {
  selectedNodes: Node[];
  onClose: () => void;
}

export function MultiSelectPanel({ selectedNodes, onClose }: MultiSelectPanelProps) {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
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
    removeComponent,
    addComponent,
    updateComponent,
    saveUserTemplate,
    clearEdgeWaypoints,
  } = useDiagramActions();

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const resolved = useMemo(
    () =>
      diagram ? resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null) : null,
    [diagram],
  );
  const components = useMemo(
    () => (resolved ? ids.map((id) => resolved.components[id]).filter(Boolean) : []),
    [resolved, ids],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedNodes.forEach((n) => {
      const t = (n.data?.type as string) ?? "component";
      counts[t] = (counts[t] ?? 0) + 1;
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
    return selectedNodes.every(
      (n) => ((n.data?.type as ComponentType) ?? "component") === first,
    );
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

  const sharedTags = useMemo(() => {
    if (components.length === 0) return undefined;
    const first = components[0].tags?.join(", ") ?? "";
    const allSame = components.every(
      (c) => (c.tags?.join(", ") ?? "") === first,
    );
    return allSame ? first : null;
  }, [components]);

  const handleGroup = () => {
    const panelId = groupNodes(ids);
    if (panelId) onClose();
  };

  const handleDuplicate = () => {
    if (!diagram || !resolved) return;
    ids.forEach((id, index) => {
      const comp = resolved.components[id];
      if (!comp || isPanelType(comp.type)) return;
      const layout = resolved.nodeLayouts[id];
      addComponent(
        comp.type,
        `${comp.name}${t("common.copySuffix")}`,
        comp.parentId,
        {
          x: (layout?.x ?? 0) + 30 * (index + 1),
          y: (layout?.y ?? 0) + 30 * (index + 1),
        },
        readAwsService(comp),
      );
    });
    onClose();
  };

  const handleDelete = () => {
    ids.forEach((id) => removeComponent(id));
    onClose();
  };

  const handleTechnologyChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { technology: value || undefined }));
  };

  const handleDescriptionChange = (value: string) => {
    ids.forEach((id) => updateComponent(id, { description: value }));
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      ? value.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    ids.forEach((id) => updateComponent(id, { tags }));
  };

  const handleResetWaypoints = () => {
    if (!activeDiagramId || !diagram) return;
    const connectionIds = collectConnectionIdsToResetWaypoints({
      edgeLayouts: diagram.edgeLayouts,
      selectedEdgeId: null,
      reactFlowEdges: [],
    });
    resetWaypointsForConnections(activeDiagramId, connectionIds, clearEdgeWaypoints);
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
        <p className="text-[10px] text-muted-foreground italic">
          {t("multiSelect.editAllHint")}
        </p>

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.tags")}
          </label>
          <input
            value={sharedTags !== null ? sharedTags : ""}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder={sharedTags === null ? t("common.multipleValues") : t("common.commaSeparatedTags")}
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm",
              sharedTags === null && "italic text-muted-foreground",
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
                placeholder={sharedTechnology === null ? t("common.multipleValues") : t("common.techExample")}
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
                placeholder={sharedDescription === null ? t("common.multipleValues") : t("common.description")}
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

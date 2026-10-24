import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  BookmarkPlus,
  Copy,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import {
  useActiveDiagramModel,
  useActiveDiagramId,
  useDiagramActions,
  resolveVersionSnapshot,
  isPanelComponent,
  isNoteComponent,
  isDbTableComponent,
  isProcessNodeComponent,
} from "@/features/diagram";
import {
  collectBoundaryConnectionIds,
  collectConnectionIdsToResetWaypoints,
  resetWaypointsForConnections,
} from "@/features/canvas/edges/reset-edge-waypoints";
import type { Component, ComponentPatch, ComponentType } from "@/features/diagram";
import { cloudServiceIdClearingPatch } from "@/features/diagram/model/cloud-service-id";
import {
  selectionRoots,
  type AlignMode,
  type DistributeAxis,
} from "@/features/diagram/utils/alignment";
import { getElement } from "@/features/elements/element.registry";
import { captureSelectionAsTemplate } from "@/features/canvas/utils/capture-template";
import { duplicateSelection } from "@/features/canvas/utils/duplicateSelection";
import { SaveTemplateModal } from "@/features/canvas/components/SaveTemplateModal";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { cn } from "@/lib/utils";
import { layoutScopedNodes } from "@/features/canvas/layout/layoutScopedNodes";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import {
  CommitField,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
  PanelFrame,
  PanelHeader,
  PanelSection,
} from "./ElementPanel/shell";
import { ElementTypeSelect } from "./ElementPanel/sections/ElementTypeSelect";

function readTechnology(component: Component): string | undefined {
  if ("technology" in component && typeof component.technology === "string") {
    return component.technology;
  }
  return undefined;
}

const CHIP_KEYS = new Set(["person", "system", "container", "component", "panel", "note"]);

/** The one value every item shares, or `null` when they differ. */
function shared<T>(values: readonly T[]): T | null {
  if (values.length === 0) return null;
  return values.every((value) => value === values[0]) ? values[0] : null;
}

interface MultiSelectPanelProps {
  selectedNodes: Node[];
  onClose: () => void;
}

interface IconAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

function IconButton({ action }: { action: IconAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      disabled={action.disabled}
      onClick={action.onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function MultiSelectPanel({ selectedNodes, onClose }: MultiSelectPanelProps) {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const reactFlowInstance = useReactFlow();
  const setSelectedNodeIds = useCanvasSelectionStore((state) => state.setSelectedNodeIds);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const diagram = useActiveDiagramModel();
  const {
    groupNodes,
    removeElements,
    batchUpdateComponents,
    alignNodes,
    distributeNodes,
    copyToClipboard,
    pasteFromClipboard,
    saveUserTemplate,
    resetEdgeControlPoints,
    applyAutoLayout,
  } = useDiagramActions();

  const ids = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const resolved = useMemo(
    () => (diagram ? resolveVersionSnapshot(diagram, diagram.activeVersionId ?? null) : null),
    [diagram],
  );
  const components = useMemo(
    () =>
      resolved
        ? ids.map((id) => resolved.components[id]).filter((c): c is Component => Boolean(c))
        : [],
    [resolved, ids],
  );

  // Chips: how many of each type, in the order they first appear.
  const typeGroups = useMemo(() => {
    const groups = new Map<ComponentType, string[]>();
    for (const component of components) {
      const list = groups.get(component.type) ?? [];
      list.push(component.id);
      groups.set(component.type, list);
    }
    return [...groups.entries()].map(([type, groupIds]) => ({ type, ids: groupIds }));
  }, [components]);

  const chipLabel = (type: ComponentType, count: number) => {
    if (CHIP_KEYS.has(type)) return t(`multiSelect.chip.${type}`, { count });
    const descriptor = getElement(type);
    return t("multiSelect.chip.other", {
      count,
      type: descriptor ? t(descriptor.labelKey) : type,
    });
  };

  const selectOnly = (onlyIds: readonly string[]) => {
    const keep = new Set(onlyIds);
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) => ({ ...node, selected: keep.has(node.id) })),
    );
    setSelectedNodeIds(keep);
  };

  const roots = useMemo(
    () => selectionRoots(ids, (id) => resolved?.components[id]?.parentId ?? null).length,
    [ids, resolved],
  );

  // Common properties; what differs reads "Mixed".
  const sharedType = shared(components.map((c) => c.type));
  const typeEditable =
    components.length > 0 &&
    components.every(
      (c) =>
        !isPanelComponent(c) &&
        !isNoteComponent(c) &&
        !isDbTableComponent(c) &&
        !isProcessNodeComponent(c) &&
        (c.type === "person" ||
          c.type === "system" ||
          c.type === "container" ||
          c.type === "component" ||
          getElement(c.type)?.family !== "structural"),
    );
  const technologyEditable =
    components.length > 0 &&
    components.every(
      (c) => !isPanelComponent(c) && !isNoteComponent(c) && !isProcessNodeComponent(c),
    );
  const sharedTechnology = shared(components.map((c) => readTechnology(c) ?? ""));

  const tagSets = components.map((c) => c.tags ?? []);
  const commonTags = tagSets.length
    ? (tagSets[0] ?? []).filter((tag) => tagSets.every((set) => set.includes(tag)))
    : [];
  const tagsDiffer = tagSets.some((set) => set.some((tag) => !commonTags.includes(tag)));

  const handleAddTag = () => {
    const newTag = tagInput.trim();
    setTagInput("");
    if (!newTag) return;
    // Added to each element, keeping what each already carries.
    batchUpdateComponents(ids, (component) => ({
      tags: (component.tags ?? []).includes(newTag)
        ? (component.tags ?? [])
        : [...(component.tags ?? []), newTag],
    }));
  };

  const handleRemoveTag = (tag: string) =>
    batchUpdateComponents(ids, (component) => ({
      tags: (component.tags ?? []).filter((item) => item !== tag),
    }));

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
    selectOnly(newIds);
  };

  const handleDelete = () => {
    removeElements(ids, []);
    onClose();
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
      resetPaths: false,
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

  const alignActions: IconAction[] = (
    [
      ["left", "multiSelect.align.left", AlignStartVertical],
      ["center-h", "multiSelect.align.centerH", AlignCenterVertical],
      ["right", "multiSelect.align.right", AlignEndVertical],
      ["top", "multiSelect.align.top", AlignStartHorizontal],
      ["center-v", "multiSelect.align.centerV", AlignCenterHorizontal],
      ["bottom", "multiSelect.align.bottom", AlignEndHorizontal],
    ] satisfies [AlignMode, string, LucideIcon][]
  ).map(([mode, key, icon]) => ({
    key: mode,
    label: t(key),
    icon,
    disabled: roots < 2,
    onClick: () => alignNodes(ids, mode),
  }));

  const distributeActions: IconAction[] = (
    [
      ["horizontal", "multiSelect.distribute.horizontal", AlignHorizontalDistributeCenter],
      ["vertical", "multiSelect.distribute.vertical", AlignVerticalDistributeCenter],
    ] satisfies [DistributeAxis, string, LucideIcon][]
  ).map(([axis, key, icon]) => ({
    key: axis,
    label: roots < 3 ? t("multiSelect.needThree") : t(key),
    icon,
    disabled: roots < 3,
    onClick: () => distributeNodes(ids, axis),
  }));

  const quickActions: IconAction[] = [
    { key: "duplicate", label: t("multiSelect.duplicate"), icon: Copy, onClick: handleDuplicate },
    {
      key: "auto-layout",
      label: t("multiSelect.autoLayoutSelectionHint"),
      icon: LayoutGrid,
      onClick: handleAutoLayoutSelection,
    },
    {
      key: "reset-paths",
      label: t("multiSelect.resetWaypoints"),
      icon: RotateCcw,
      onClick: handleResetWaypoints,
    },
  ];

  return (
    <PanelFrame>
      <PanelHeader
        icon={<Layers className="h-3.5 w-3.5" />}
        typeLabel={t("multiSelect.title")}
        name={t("multiSelect.elements", { count: selectedNodes.length })}
        namePlaceholder={t("multiSelect.title")}
        subheader={
          <div
            className="flex flex-wrap gap-1 px-0.5"
            role="group"
            aria-label={t("multiSelect.filterByType")}
          >
            {typeGroups.map((group) => (
              <button
                key={group.type}
                type="button"
                title={t("multiSelect.filterByType")}
                disabled={typeGroups.length === 1}
                onClick={() => selectOnly(group.ids)}
                className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-foreground disabled:cursor-default"
              >
                {chipLabel(group.type, group.ids.length)}
              </button>
            ))}
          </div>
        }
        menu={[
          {
            key: "save-template",
            label: t("canvas.multiSelect.saveAsTemplate"),
            icon: BookmarkPlus,
            onSelect: () => setSaveTemplateOpen(true),
          },
          {
            key: "delete",
            label: t("multiSelect.delete"),
            icon: Trash2,
            destructive: true,
            separated: true,
            onSelect: handleDelete,
          },
        ]}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={handleGroup}
            className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t("multiSelect.group")}
          </button>
          {quickActions.map((action) => (
            <IconButton key={action.key} action={action} />
          ))}
        </div>

        <PanelSection title={t("multiSelect.alignSection")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {alignActions.map((action) => (
              <IconButton key={action.key} action={action} />
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {distributeActions.map((action) => (
              <IconButton key={action.key} action={action} />
            ))}
          </div>
        </PanelSection>

        <PanelSection title={t("multiSelect.commonProps")}>
          {typeEditable && (
            <ElementTypeSelect
              value={sharedType}
              mixedLabel={t("multiSelect.mixed")}
              onChange={(nextType) =>
                batchUpdateComponents(ids, {
                  type: nextType,
                  ...cloudServiceIdClearingPatch(undefined),
                } as unknown as ComponentPatch)
              }
            />
          )}
          {technologyEditable && (
            <CommitField
              label={t("common.technology")}
              value={sharedTechnology ?? ""}
              placeholder={sharedTechnology === null ? t("multiSelect.mixed") : undefined}
              addLabel={sharedTechnology === null ? undefined : t("panelShell.addTechnology")}
              onCommit={(value) =>
                batchUpdateComponents(ids, { technology: value || undefined } as ComponentPatch)
              }
            />
          )}
          <div>
            <span className={PANEL_LABEL_CLASS}>{t("common.tags")}</span>
            {(commonTags.length > 0 || tagsDiffer) && (
              <div className="mb-2 flex flex-wrap gap-1">
                {commonTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={t("panelShell.removeTag")}
                      onClick={() => handleRemoveTag(tag)}
                      className="leading-none hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {tagsDiffer && (
                  <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] italic text-muted-foreground">
                    {t("multiSelect.mixed")}
                  </span>
                )}
              </div>
            )}
            <input
              type="text"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onBlur={handleAddTag}
              onKeyDown={(event) => {
                if (keyIs(event, KEY.ENTER) && tagInput.trim()) {
                  event.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder={`+ ${t("panelShell.addTag")}`}
              className={cn(PANEL_INPUT_CLASS)}
            />
          </div>
        </PanelSection>
      </div>

      {saveTemplateOpen && resolved && (
        <SaveTemplateModal
          selectedComponentIds={ids}
          components={resolved.components}
          onSave={handleSaveTemplate}
          onClose={() => setSaveTemplateOpen(false)}
        />
      )}
    </PanelFrame>
  );
}

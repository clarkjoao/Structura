import { useEffect, useState } from "react";
import ElementPickerModal from "./ElementPickerModal";
import { Plus, ChevronUp, Puzzle } from "lucide-react";
import { useActiveDiagram } from "@/features/diagram";
import { useInteractionMode } from "../hooks/useInteractionMode";
import PatternPicker from "./PatternPicker";
import { LayerFilterPopover } from "./LayerFilterPopover";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CanvasToolbarDiagramPanel } from "./components/CanvasToolbarDiagramPanel";
import { CanvasToolbarScenesButton } from "./components/CanvasToolbarScenesButton";

interface CanvasToolbarProps {
  onDrillUp?: () => void;
  isPanelOpen?: boolean;
  onInsert?: (nodeId: string) => void;
  onClearSelection?: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  onOpenScenes?: () => void;
  allTags: string[];
  /** null means "no tag filter active" (all tags visible). */
  visibleTags: Set<string> | null;
  onToggleTag: (tag: string) => void;
  onShowAllTags: () => void;
  onShowNoTags: () => void;
  journeysInDiagramCount?: number;
  journeysPanelOpen?: boolean;
  onToggleJourneysPanel?: () => void;
  isFlowActive?: boolean;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const CanvasToolbar = ({
  onDrillUp,
  onInsert,
  onClearSelection,
  setSelectedNodeId,
  setSelectedNodeIds,
  setSelectedEdgeId,
  onOpenScenes,
  allTags,
  visibleTags,
  onToggleTag,
  onShowAllTags,
  onShowNoTags,
  journeysInDiagramCount = 0,
  journeysPanelOpen = false,
  onToggleJourneysPanel,
  isFlowActive = false,
  focusMode = false,
}: CanvasToolbarProps) => {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { canEditCanvas, canEditScenes } = useInteractionMode(diagram);
  const toolbarEditLocked = !canEditCanvas;
  const scenesPickerLocked = !canEditScenes;
  const [showPatterns, setShowPatterns] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const STORAGE_KEY = "structura:toolbar-collapsed";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (isFlowActive) {
      setShowPatterns(false);
      setShowModal(false);
    }
  }, [isFlowActive]);

  useEffect(() => {
    if (focusMode) {
      setCollapsed(true);
    }
  }, [focusMode]);

  if (!diagram) return null;

  const addButton = (
    <button
      type="button"
      onClick={() => {
        if (toolbarEditLocked) return;
        onClearSelection?.();
        setShowModal(true);
      }}
      disabled={toolbarEditLocked}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-primary hover:bg-surface-hover transition-colors",
        toolbarEditLocked && "opacity-50 pointer-events-none",
      )}
    >
      <Plus className="h-3.5 w-3.5" /> {t("canvasToolbar.addElement")}
    </button>
  );

  return (
    <div className="absolute top-4 left-4 z-10 flex w-[220px] flex-col gap-2">
      <CanvasToolbarDiagramPanel
        diagram={diagram}
        toolbarEditLocked={toolbarEditLocked}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        focusMode={focusMode}
      />

      {!collapsed && (
        <>
          <CanvasToolbarScenesButton
            diagram={diagram}
            scenesPickerLocked={scenesPickerLocked || isFlowActive}
            onOpenScenes={onOpenScenes}
          />

          {onToggleJourneysPanel ? (
            <button
              type="button"
              onClick={isFlowActive ? undefined : onToggleJourneysPanel}
              disabled={isFlowActive}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-medium backdrop-blur-sm transition-colors",
                journeysPanelOpen && !isFlowActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                isFlowActive && "pointer-events-none cursor-not-allowed opacity-40",
              )}
            >
              <span aria-hidden>✦</span>
              <span>{t("walkthroughs.inDiagram.title")}</span>
              {journeysInDiagramCount > 0 ? (
                <span className="ml-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                  {journeysInDiagramCount}
                </span>
              ) : null}
            </button>
          ) : null}

          <LayerFilterPopover
            allTags={allTags}
            visibleTags={visibleTags}
            scenesPickerLocked={scenesPickerLocked || isFlowActive}
            onToggle={onToggleTag}
            onShowAll={onShowAllTags}
            onShowNoTags={onShowNoTags}
          />

          {onDrillUp && (
            <button
              type="button"
              onClick={onDrillUp}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" /> {t("canvasToolbar.drillUp")}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (toolbarEditLocked || isFlowActive) return;
              onClearSelection?.();
              setShowPatterns(true);
            }}
            disabled={toolbarEditLocked || isFlowActive}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
              (toolbarEditLocked || isFlowActive) &&
                "opacity-40 pointer-events-none cursor-not-allowed",
            )}
          >
            <Puzzle className="h-3.5 w-3.5" /> {t("canvasToolbar.patterns")}
          </button>
        </>
      )}
      {addButton}

      {showPatterns && (
        <PatternPicker
          onClose={() => setShowPatterns(false)}
          onBeforeInsert={onClearSelection}
          setSelectedNodeId={setSelectedNodeId}
          setSelectedNodeIds={setSelectedNodeIds}
          setSelectedEdgeId={setSelectedEdgeId}
        />
      )}
      {showModal && (
        <ElementPickerModal
          onClose={() => setShowModal(false)}
          onInsert={(nodeId) => {
            onInsert?.(nodeId);
            setSelectedNodeId(nodeId);
            setSelectedNodeIds(new Set([nodeId]));
            setSelectedEdgeId(null);
          }}
        />
      )}
    </div>
  );
};

export default CanvasToolbar;

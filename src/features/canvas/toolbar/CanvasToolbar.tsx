import { useState } from "react";
import ElementPickerModal from "./ElementPickerModal";
import { Plus, ChevronUp, Puzzle } from "lucide-react";
import { isDiagramCompareMode, useActiveDiagram } from "@/features/diagram";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import PatternPicker from "./PatternPicker";
import { LayerFilterPopover } from "./LayerFilterPopover";
import { useTranslation } from "react-i18next";
import { CanvasToolbarDiagramPanel } from "./components/CanvasToolbarDiagramPanel";

interface CanvasToolbarProps {
  onDrillUp?: () => void;
  isPanelOpen?: boolean;
  selectedCount?: number;
  onInsert?: (nodeId: string) => void;
  onClearSelection?: () => void;
  onOpenScenes?: () => void;
  allTags: string[];
  hiddenTags: Set<string>;
  onToggleTag: (tag: string) => void;
  onShowAllTags: () => void;
}

const CanvasToolbar = ({
  onDrillUp,
  selectedCount = 0,
  onInsert,
  onClearSelection,
  onOpenScenes,
  allTags,
  hiddenTags,
  onToggleTag,
  onShowAllTags,
}: CanvasToolbarProps) => {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { isRecording, isPlaying } = useFlowMode();
  const toolbarEditLocked =
    isRecording || isPlaying || (diagram ? isDiagramCompareMode(diagram) : false);
  const scenesPickerLocked = isRecording || isPlaying;
  const [showPatterns, setShowPatterns] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!diagram) return null;

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <CanvasToolbarDiagramPanel
        diagram={diagram}
        toolbarEditLocked={toolbarEditLocked}
        scenesPickerLocked={scenesPickerLocked}
        onOpenScenes={onOpenScenes}
        selectedCount={selectedCount}
      />

      <LayerFilterPopover
        allTags={allTags}
        hiddenTags={hiddenTags}
        scenesPickerLocked={scenesPickerLocked}
        onToggle={onToggleTag}
        onShowAll={onShowAllTags}
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
          if (toolbarEditLocked) return;
          onClearSelection?.();
          setShowPatterns(true);
        }}
        disabled={toolbarEditLocked}
        className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${toolbarEditLocked ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Puzzle className="h-3.5 w-3.5" /> {t("canvasToolbar.patterns")}
      </button>

      <button
        type="button"
        onClick={() => {
          if (toolbarEditLocked) return;
          onClearSelection?.();
          setShowModal(true);
        }}
        disabled={toolbarEditLocked}
        className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-primary hover:bg-surface-hover transition-colors ${toolbarEditLocked ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Plus className="h-3.5 w-3.5" /> {t("canvasToolbar.addElement")}
      </button>

      {showPatterns && (
        <PatternPicker
          onClose={() => setShowPatterns(false)}
          onBeforeInsert={onClearSelection}
        />
      )}
      {showModal && (
        <ElementPickerModal onClose={() => setShowModal(false)} onInsert={onInsert} />
      )}
    </div>
  );
};

export default CanvasToolbar;

import { useState, useRef, useEffect, useMemo } from "react";
import ElementPickerModal from "./ElementPickerModal";
import {
  Plus,
  User,
  Network,
  Server,
  Database,
  Layers,
  ChevronRight,
  ChevronUp,
  Cloud,
  Square,
  StickyNote,
  Puzzle,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useActiveDiagram, useDiagramActions } from "@/features/diagram";
import { useRecordingMode } from "@/features/canvas/flow/RecordingModeContext";
import { useFlowPlayback } from "@/features/canvas/flow/FlowPlaybackContext";
import type { ComponentType } from "@/features/diagram";
import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/catalogs/aws";
import AwsIcon from "../nodes/AwsIcon";
import PatternPicker from "./PatternPicker";
import { getViewportCenter } from "../viewport-utils";
import { useTranslation } from "react-i18next";

const CanvasToolbar = ({
  onDrillUp,
  isPanelOpen,
  selectedCount = 0,
  onInsert,
  onClearSelection,
}: {
  onDrillUp?: () => void;
  isPanelOpen?: boolean;
  selectedCount?: number;
  onInsert?: (nodeId: string) => void;
  onClearSelection?: () => void;
}) => {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { addComponent, updateDiagram } = useDiagramActions();
  const rfInstance = useReactFlow();
  const { isRecording } = useRecordingMode();
  const { isPlaying } = useFlowPlayback();
  const disabledWhileBusy = isRecording || isPlaying;
  const [showAdd, setShowAdd] = useState(false);
  const [showAws, setShowAws] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showPatterns, setShowPatterns] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const c4Options = useMemo(
    () =>
      [
        { type: "person" as const, label: t("quickInsert.typePerson"), icon: User },
        { type: "system" as const, label: t("quickInsert.typeSystem"), icon: Network },
        { type: "container" as const, label: t("quickInsert.typeContainer"), icon: Server },
        { type: "component" as const, label: t("quickInsert.typeComponent"), icon: Database },
      ],
    [t],
  );

  const levelLabels = useMemo(
    (): Record<string, string> => ({
      context: t("canvasToolbar.levelContext"),
      container: t("canvasToolbar.levelContainer"),
      component: t("canvasToolbar.levelComponent"),
    }),
    [t],
  );

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const commitRename = () => {
    if (!diagram) return;
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== diagram.name) {
      updateDiagram(diagram.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const handleAddC4 = (type: ComponentType) => {
    const opt = c4Options.find((o) => o.type === type);
    const name = opt ? t("quickInsert.newNamed", { name: opt.label }) : type;
    addComponent(type, name, null, getViewportCenter(rfInstance, isPanelOpen));
    setShowAdd(false);
  };

  const handleAddAws = (
    categoryId: AwsCategoryId,
    serviceId: string,
    serviceName: string,
  ) => {
    addComponent(categoryId, serviceName, null, getViewportCenter(rfInstance, isPanelOpen), serviceId);
    setShowAws(false);
    setShowAdd(false);
    setExpandedCat(null);
  };

  if (!diagram) return null;

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setEditNameValue(diagram.name);
                setIsEditingName(false);
              }
            }}
            className="text-xs font-semibold bg-transparent border-b border-primary/50 outline-none min-w-[80px] max-w-[200px]"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditNameValue(diagram.name);
              setIsEditingName(true);
            }}
            className="text-xs font-semibold cursor-pointer select-none hover:text-primary/80"
            title={t("canvasToolbar.renameTitle")}
          >
            {diagram.name}
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground rounded bg-secondary px-1.5 py-0.5 shrink-0">
          {levelLabels[diagram.level]}
        </span>
        {selectedCount > 1 && (
          <span className="text-xs text-muted-foreground ml-1">
            {t("canvasToolbar.selectedCount", { count: selectedCount })}
          </span>
        )}
      </div>

      {onDrillUp && (
        <button
          onClick={onDrillUp}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" /> {t("canvasToolbar.drillUp")}
        </button>
      )}

      <button
        onClick={() => {
          if (disabledWhileBusy) return;
          onClearSelection?.();
          setShowPatterns(true);
          setShowAdd(false);
        }}
        disabled={disabledWhileBusy}
        className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Puzzle className="h-3.5 w-3.5" /> {t("canvasToolbar.patterns")}
      </button>

      <div className="relative">
        <button
          onClick={() => {
            if (disabledWhileBusy) return;
            onClearSelection?.();
            setShowModal(true);
          }}
          disabled={disabledWhileBusy}
          className={`flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-primary hover:bg-surface-hover transition-colors ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Plus className="h-3.5 w-3.5" /> {t("canvasToolbar.addElement")}
        </button>
        {/* <ElementDropdown /> — replaced by ElementPickerModal, kept for reference */}
        {showAdd && (
          <div className="absolute top-full left-0 mt-1 rounded-lg border border-border bg-card shadow-xl py-1 min-w-[200px]">
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("canvasToolbar.c4Model")}
              </span>
            </div>
            {c4Options.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAddC4(opt.type)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
              >
                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                {opt.label}
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => {
                addComponent("panel", t("canvasToolbar.newPanel"), null, getViewportCenter(rfInstance, isPanelOpen));
                setShowAdd(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
            >
              <Square className="h-3.5 w-3.5 text-muted-foreground" /> {t("canvasToolbar.panel")}
            </button>
            <button
              onClick={() => {
                addComponent("note", "", null, getViewportCenter(rfInstance, isPanelOpen));
                setShowAdd(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
            >
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> {t("canvasToolbar.note")}
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={() => setShowAws(!showAws)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors font-medium text-[hsl(var(--aws-orange))]"
            >
              <Cloud className="h-3.5 w-3.5" /> {t("canvasToolbar.awsServices")}
              <ChevronRight
                className={`h-3 w-3 ml-auto transition-transform ${showAws ? "rotate-90" : ""}`}
              />
            </button>
          </div>
        )}
        {showAdd && showAws && (
          <div className="absolute top-full left-[208px] mt-1 rounded-lg border border-border bg-card shadow-xl py-1 min-w-[240px] max-h-[70vh] overflow-auto">
            {AWS_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <button
                  onClick={() =>
                    setExpandedCat(expandedCat === cat.id ? null : cat.id)
                  }
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold hover:bg-surface-hover transition-colors"
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${expandedCat === cat.id ? "rotate-90" : ""}`}
                  />
                  <span className="text-foreground">{cat.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                    {cat.services.length}
                  </span>
                </button>
                {expandedCat === cat.id && (
                  <div className="pl-2">
                    {cat.services.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() =>
                          handleAddAws(
                            cat.id as AwsCategoryId,
                            svc.id,
                            svc.name,
                          )
                        }
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] hover:bg-surface-hover transition-colors"
                      >
                        <AwsIcon iconName={svc.iconName} size={18} />{" "}
                        <span className="text-foreground truncate">
                          {svc.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

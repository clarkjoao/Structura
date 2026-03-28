import { LayoutDashboard, Lock, Plus, Sparkles, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { useCollab } from "@/features/collaboration";

export interface LinkedDiagramOption {
  id: string;
  name: string;
}

export interface LinkedDiagramSectionProps {
  componentId: string;
  linkedDiagramId: string | null | undefined;
  canCreateLinked: boolean;
  createdDiagramName: string | null;
  diagrams?: ReadonlyArray<LinkedDiagramOption>;
  suggestedDiagram?: LinkedDiagramOption | null;
  onCreateLinked: () => void;
  onChangeLinked: (diagramId: string | undefined) => void;
}

export function LinkedDiagramSection({
  componentId,
  linkedDiagramId,
  canCreateLinked,
  createdDiagramName,
  diagrams = [],
  suggestedDiagram,
  onCreateLinked,
  onChangeLinked,
}: LinkedDiagramSectionProps) {
  const { t } = useTranslation();
  const { isGuest } = useCollab();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasLinked = Boolean(linkedDiagramId);

  const selectedDiagram =
    diagrams.find((d) => d.id === linkedDiagramId) ??
    (suggestedDiagram?.id === linkedDiagramId ? suggestedDiagram : null);

  const showSuggestion =
    suggestedDiagram &&
    (diagrams.some(
      (d) =>
        d.id === suggestedDiagram.id ||
        d.name.toLowerCase().includes(suggestedDiagram.name.toLowerCase()),
    ) ||
      !diagrams.some((d) => d.id === suggestedDiagram.id));

  const isSuggestionSelected = linkedDiagramId === suggestedDiagram?.id;

  function select(id: string | undefined) {
    onChangeLinked(id);
    setOpen(false);
  }

  return (
    <div id={`element-panel-linked-${componentId}`} className="relative flex flex-col gap-2">
      {isGuest && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed rounded-md bg-background/60 backdrop-blur-[1px] flex items-center justify-center"
          title={t("collaboration.notAvailableInCollab")}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-md px-2 py-1 shadow-sm">
            <Lock className="h-3 w-3" />
            {t("collaboration.notAvailableInCollab")}
          </div>
        </div>
      )}

      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
        <LayoutDashboard className="h-3 w-3" />
        {t("elementPanel.linkToDiagram")}
      </label>

      {!hasLinked && showSuggestion && (
        <p className="text-[11px] text-primary/70 flex items-center gap-1">
          <Sparkles className="h-3 w-3 shrink-0" />
          {t("elementPanel.suggestedNudge", { name: suggestedDiagram?.name })}
        </p>
      )}

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={[
            "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            isSuggestionSelected
              ? "border-primary/50 bg-primary/5 text-primary font-medium"
              : hasLinked
                ? "border-border bg-secondary text-foreground"
                : "border-dashed border-border bg-secondary text-muted-foreground",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 truncate">
            {isSuggestionSelected && <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {selectedDiagram ? selectedDiagram.name : t("elementPanel.noneOption")}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {hasLinked && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  select(undefined);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), select(undefined))}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
            
            {showSuggestion && suggestedDiagram && (
              <button
                type="button"
                onClick={() => select(suggestedDiagram.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors bg-primary/10 hover:bg-primary/15 text-primary font-medium border-b border-primary/20"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{suggestedDiagram.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide bg-primary/20 text-primary rounded px-1.5 py-0.5">
                  {t("elementPanel.suggested")}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => select(undefined)}
              className="w-full flex items-center px-3 py-2 text-sm text-left text-muted-foreground hover:bg-accent transition-colors"
            >
              {t("elementPanel.noneOption")}
            </button>

            {diagrams
              .filter((d) => d.id !== suggestedDiagram?.id)
              .map((diagram) => (
                <button
                  key={diagram.id}
                  type="button"
                  onClick={() => select(diagram.id)}
                  className={[
                    "w-full flex items-center px-3 py-2 text-sm text-left transition-colors",
                    diagram.id === linkedDiagramId
                      ? "bg-accent text-foreground font-medium"
                      : "hover:bg-accent text-foreground",
                  ].join(" ")}
                >
                  {diagram.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {canCreateLinked && !hasLinked && (
        createdDiagramName ? (
          <p className="text-xs text-primary bg-primary/10 rounded-md px-3 py-2">
            {t("elementPanel.linkedDiagramCreated", { name: createdDiagramName })}
          </p>
        ) : (
          <button
            type="button"
            onClick={onCreateLinked}
            className="flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("elementPanel.createLinkedDiagram")}
          </button>
        )
      )}
    </div>
  );
}

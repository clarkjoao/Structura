import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ExternalLink, X } from "lucide-react";
import { useAllDiagrams, useDiagramStore } from "@/features/diagram";
import type { ExternalElementComponent, ComponentPatch } from "@/features/diagram";
import { useTranslation } from "react-i18next";

interface ExternalElementPanelProps {
  component: ExternalElementComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
}

export default function ExternalElementPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
}: ExternalElementPanelProps) {
  const { t } = useTranslation();
  const allDiagrams = useAllDiagrams();
  const diagrams = useDiagramStore((s) => s.diagrams);

  const [diagramOpen, setDiagramOpen] = useState(false);
  const [elementOpen, setElementOpen] = useState(false);

  const selectedDiagram = allDiagrams.find((d) => d.id === component.linkedDiagramId);

  const targetComponents = useMemo(() => {
    if (!component.linkedDiagramId) return [];
    const diagram = diagrams[component.linkedDiagramId];
    if (!diagram) return [];
    return Object.values(diagram.snapshot.components)
      .filter((c) => c.type !== "endpoint" && c.type !== "api-group")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [component.linkedDiagramId, diagrams]);

  const selectedElement = targetComponents.find((c) => c.id === component.linkedElementId);

  function handleSelectDiagram(diagramId: string | undefined) {
    updateComponent(component.id, {
      linkedDiagramId: diagramId ?? "",
      linkedDiagramName: diagramId ? allDiagrams.find((d) => d.id === diagramId)?.name : undefined,
      linkedElementId: undefined,
      linkedElementName: undefined,
    });
    setDiagramOpen(false);
    setElementOpen(false);
  }

  function handleSelectElement(elementId: string | undefined) {
    const el = targetComponents.find((c) => c.id === elementId);
    updateComponent(component.id, {
      linkedElementId: elementId,
      linkedElementName: el?.name,
    });
    setElementOpen(false);
  }

  function handleOpen() {
    if (!component.linkedDiagramId) return;
    const nodeParam = component.linkedElementId ? `?nodeId=${component.linkedElementId}` : "";
    window.open(`/model/${component.linkedDiagramId}${nodeParam}`, "_blank");
  }

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("externalElement.panelTitle")}
          </h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("externalElement.labelName")}
          </label>
          <input
            value={component.name}
            onChange={(e) => updateComponent(component.id, { name: e.target.value })}
            placeholder={t("externalElement.placeholderName")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="relative">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("externalElement.labelDiagram")}
          </label>
          <button
            type="button"
            onClick={() => { setDiagramOpen((v) => !v); setElementOpen(false); }}
            className={[
              "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
              selectedDiagram
                ? "border-border bg-secondary text-foreground"
                : "border-dashed border-border bg-secondary text-muted-foreground",
            ].join(" ")}
          >
            <span className="truncate">
              {selectedDiagram?.name ?? t("externalElement.selectDiagram")}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selectedDiagram && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleSelectDiagram(undefined); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), handleSelectDiagram(undefined))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${diagramOpen ? "rotate-180" : ""}`} />
            </span>
          </button>

          {diagramOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => handleSelectDiagram(undefined)}
                className="w-full flex items-center px-3 py-2 text-sm text-left text-muted-foreground hover:bg-accent transition-colors"
              >
                {t("externalElement.noneOption")}
              </button>
              <div className="max-h-48 overflow-y-auto">
                {allDiagrams.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDiagram(d.id)}
                    className={[
                      "w-full flex items-center px-3 py-2 text-sm text-left transition-colors",
                      d.id === component.linkedDiagramId
                        ? "bg-accent text-foreground font-medium"
                        : "hover:bg-accent text-foreground",
                    ].join(" ")}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {component.linkedDiagramId && (
          <div className="relative">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("externalElement.labelElement")}
            </label>
            <button
              type="button"
              onClick={() => { setElementOpen((v) => !v); setDiagramOpen(false); }}
              className={[
                "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
                selectedElement
                  ? "border-border bg-secondary text-foreground"
                  : "border-dashed border-border bg-secondary text-muted-foreground",
              ].join(" ")}
            >
              <span className="truncate">
                {selectedElement?.name ?? t("externalElement.selectElement")}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {selectedElement && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleSelectElement(undefined); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), handleSelectElement(undefined))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${elementOpen ? "rotate-180" : ""}`} />
              </span>
            </button>

            {elementOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleSelectElement(undefined)}
                  className="w-full flex items-center px-3 py-2 text-sm text-left text-muted-foreground hover:bg-accent transition-colors"
                >
                  {t("externalElement.noneOption")}
                </button>
                <div className="max-h-48 overflow-y-auto">
                  {targetComponents.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectElement(c.id)}
                      className={[
                        "w-full flex items-center px-3 py-2 text-sm text-left transition-colors",
                        c.id === component.linkedElementId
                          ? "bg-accent text-foreground font-medium"
                          : "hover:bg-accent text-foreground",
                      ].join(" ")}
                    >
                      <span className="truncate">{c.name || t("externalElement.unnamed")}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground font-mono pl-2">
                        {c.type}
                      </span>
                    </button>
                  ))}
                  {targetComponents.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground italic">
                      {t("externalElement.noElements")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {component.linkedDiagramId && (
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center justify-center gap-1.5 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t("externalElement.openButton")}
          </button>
        )}

        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => removeComponent(component.id)}
            className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            {t("externalElement.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

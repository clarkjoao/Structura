import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
import { useDiagramStore } from "@/features/diagram";
import type { ExternalElementComponent, ComponentPatch } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { DiagramLinkField } from "@/features/canvas/palette/DiagramLinkField";
import { stripImportedSuffix } from "@/features/canvas/palette/diagramLinkItems";
import { ElementScaffold, PanelSection } from "./shell";

interface ExternalElementPanelProps {
  component: ExternalElementComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

export default function ExternalElementPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger,
  onFocusElement,
}: ExternalElementPanelProps) {
  const { t } = useTranslation();
  // The id the node, the export and navigation all read. This panel once wrote `linkedDiagramId`
  // (the C4 drill-down field), so a chosen target never reached the canvas.
  const referenceDiagramId = component.referenceDiagramId || undefined;
  const targetComponentMap = useDiagramStore((s) =>
    referenceDiagramId ? s.diagrams[referenceDiagramId]?.snapshot.components : undefined,
  );

  const [elementOpen, setElementOpen] = useState(false);

  const targetComponents = useMemo(() => {
    if (!targetComponentMap) return [];
    return Object.values(targetComponentMap)
      .filter((c) => c.type !== "endpoint" && c.type !== "api-group")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targetComponentMap]);

  const selectedElement = targetComponents.find((c) => c.id === component.linkedElementId);

  function handleLinkDiagram(diagramId: string | undefined) {
    const name = diagramId ? useDiagramStore.getState().diagrams[diagramId]?.name : undefined;
    updateComponent(component.id, {
      referenceDiagramId: diagramId ?? "",
      linkedDiagramName: name ? stripImportedSuffix(name).name : undefined,
      linkedElementId: undefined,
      linkedElementName: undefined,
    });
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
    if (!referenceDiagramId) return;
    const nodeParam = component.linkedElementId ? `?nodeId=${component.linkedElementId}` : "";
    window.open(`/model/${referenceDiagramId}${nodeParam}`, "_blank");
  }

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("externalElement.placeholderName")}
    >
      <PanelSection title={t("panelShell.sectionRelates")}>
        <DiagramLinkField
          componentId={component.id}
          label={t("diagramLink.target")}
          elementName={component.name}
          linkedDiagramId={referenceDiagramId}
          canCreate={false}
          onLink={handleLinkDiagram}
          onCreateAndLink={() => undefined}
        />

        {referenceDiagramId && (
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("externalElement.labelElement")}
            </label>
            <button
              type="button"
              onClick={() => {
                setElementOpen((v) => !v);
              }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectElement(undefined);
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.stopPropagation(), handleSelectElement(undefined))
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${elementOpen ? "rotate-180" : ""}`}
                />
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

        {referenceDiagramId && (
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center justify-center gap-1.5 w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t("externalElement.openButton")}
          </button>
        )}
      </PanelSection>
    </ElementScaffold>
  );
}

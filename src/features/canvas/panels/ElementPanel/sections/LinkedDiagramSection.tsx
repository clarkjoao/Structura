import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface LinkedDiagramOption {
  id: string;
  name: string;
}

export interface LinkedDiagramSectionProps {
  mode: "create" | "select";
  componentId: string;
  linkedDiagramId: string | null | undefined;
  canCreateLinked: boolean;
  createdDiagramName: string | null;
  /** Required when `mode === "select"`. */
  diagrams?: ReadonlyArray<LinkedDiagramOption>;
  onCreateLinked: () => void;
  onChangeLinked: (diagramId: string | undefined) => void;
}

export function LinkedDiagramSection({
  mode,
  componentId,
  linkedDiagramId,
  canCreateLinked,
  createdDiagramName,
  diagrams = [],
  onCreateLinked,
  onChangeLinked,
}: LinkedDiagramSectionProps) {
  const { t } = useTranslation();

  if (mode === "create") {
    if (!canCreateLinked || linkedDiagramId) return null;
    return (
      <div id={`element-panel-linked-create-${componentId}`}>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
          <LayoutDashboard className="h-3 w-3 inline mr-1" />
          {t("elementPanel.linkedDiagram")}
        </label>
        {createdDiagramName ? (
          <p className="text-xs text-primary bg-primary/10 rounded-md px-3 py-2">
            {t("elementPanel.linkedDiagramCreated", { name: createdDiagramName })}
          </p>
        ) : (
          <button
            type="button"
            onClick={onCreateLinked}
            className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            {t("elementPanel.createLinkedDiagram")}
          </button>
        )}
      </div>
    );
  }

  if (!(!canCreateLinked || linkedDiagramId)) return null;

  return (
    <div id={`element-panel-linked-select-${componentId}`}>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
        <LayoutDashboard className="h-3 w-3 inline mr-1" />
        {t("elementPanel.linkToDiagram")}
      </label>
      <select
        value={linkedDiagramId ?? ""}
        onChange={(event) => onChangeLinked(event.target.value || undefined)}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">{t("elementPanel.noneOption")}</option>
        {diagrams.map((diagram) => (
          <option key={diagram.id} value={diagram.id}>
            {diagram.name}
          </option>
        ))}
      </select>
    </div>
  );
}

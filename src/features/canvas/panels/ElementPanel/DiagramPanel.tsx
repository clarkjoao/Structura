import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import {
  useActiveDiagramId,
  useConnections,
  useDiagramActions,
  useDiagramStore,
  useResolvedComponents,
} from "@/features/diagram";
import { buildLegend } from "@/features/diagram/utils/legend";
import { LegendContent } from "@/features/canvas/nodes/LegendNode";
import type { Level } from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCanvasPreferencesStore } from "@/features/canvas/preferences";
import {
  CommitField,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
  PanelHeader,
  PanelSection,
} from "./shell";

const LEVELS = ["context", "container", "component", "deployment"] as const;

/**
 * What the side panel shows when nothing is selected: the diagram itself — name, level,
 * description, and the generated legend. Each field subscribes alone, so an edit elsewhere in the
 * diagram does not re-render the panel.
 */
export default function DiagramPanel() {
  const { t } = useTranslation();
  const diagramId = useActiveDiagramId();
  const name = useDiagramStore((s) => (diagramId ? s.diagrams[diagramId]?.name : undefined));
  const level = useDiagramStore((s) => (diagramId ? s.diagrams[diagramId]?.level : undefined));
  const description = useDiagramStore((s) =>
    diagramId ? s.diagrams[diagramId]?.description : undefined,
  );
  const showLegend = useDiagramStore((s) =>
    diagramId ? s.diagrams[diagramId]?.showLegend === true : false,
  );
  const { updateDiagram, updateDiagramDescription, setShowLegend } = useDiagramActions();
  const setCollapsed = useCanvasPreferencesStore((s) => s.setElementPanelCollapsed);
  const components = useResolvedComponents();
  const connections = useConnections();
  // What the legend will say, whether or not it is on the canvas yet.
  const legend = useMemo(
    () => buildLegend(components, new Set(Object.keys(components)), Object.values(connections)),
    [components, connections],
  );

  if (!diagramId || name === undefined || level === undefined) return null;

  const levelLabels: Record<(typeof LEVELS)[number], string> = {
    context: t("canvasToolbar.levelContext"),
    container: t("canvasToolbar.levelContainer"),
    component: t("canvasToolbar.levelComponent"),
    deployment: t("canvasToolbar.levelDeployment"),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        icon={<Workflow className="h-3.5 w-3.5" />}
        typeLabel={t("diagramPanel.title")}
        name={name}
        namePlaceholder={t("diagramPanel.untitled")}
        onCommitName={(value) => updateDiagram(diagramId, { name: value })}
        menu={[]}
        onClose={() => setCollapsed(true)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelSection title={t("panelShell.sectionWhat")}>
          <div>
            <label htmlFor="diagram-level" className={PANEL_LABEL_CLASS}>
              {t("diagramPanel.level")}
            </label>
            <select
              id="diagram-level"
              value={level}
              onChange={(event) => updateDiagram(diagramId, { level: event.target.value as Level })}
              className={PANEL_INPUT_CLASS}
            >
              {LEVELS.map((value) => (
                <option key={value} value={value}>
                  {levelLabels[value]}
                </option>
              ))}
              {!LEVELS.some((value) => value === level) && <option value={level}>{level}</option>}
            </select>
          </div>
          <CommitField
            label={t("common.description")}
            value={description ?? ""}
            multiline
            addLabel={t("panelShell.addDescription")}
            onCommit={(value) => updateDiagramDescription(diagramId, value)}
          />
        </PanelSection>
        <PanelSection title={t("diagramPanel.legend")}>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="diagram-show-legend" className="text-sm font-medium">
                {t("diagramPanel.showLegend")}
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("diagramPanel.legendHint")}
              </p>
            </div>
            <Switch
              id="diagram-show-legend"
              checked={showLegend}
              onCheckedChange={(checked) => setShowLegend(diagramId, checked)}
            />
          </div>
          <LegendContent legend={legend} />
        </PanelSection>
      </div>
    </div>
  );
}

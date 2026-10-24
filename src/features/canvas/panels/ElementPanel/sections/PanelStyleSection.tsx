import { useTranslation } from "react-i18next";
import type { ComponentPatch, PanelComponent, SwimlaneStyle } from "@/features/diagram";
import { PanelKind } from "@/features/diagram";
import { SwimlaneOrientation } from "@/features/canvas/enums";
import { PANEL_KINDS, getPanelKindDef, panelKindLabel } from "@/lib/catalogs/panels";
import type { NodeLayout } from "@/features/diagram";
import { SWIMLANE_DEFAULT_H, SWIMLANE_DEFAULT_W } from "@/features/canvas/canvas.constants";
import Field from "../components/Field";

function mergeSwimlane(
  current: SwimlaneStyle | undefined,
  partial: Partial<SwimlaneStyle>,
): SwimlaneStyle {
  return {
    orientation: partial.orientation ?? current?.orientation ?? SwimlaneOrientation.Horizontal,
    laneColor: partial.laneColor ?? current?.laneColor ?? "#6366f1",
    opacity: partial.opacity ?? current?.opacity,
    ...(partial.laneLabel !== undefined
      ? { laneLabel: partial.laneLabel }
      : current?.laneLabel !== undefined
        ? { laneLabel: current.laneLabel }
        : {}),
  };
}

export interface PanelStyleSectionProps {
  component: PanelComponent;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  componentNodeLayout: NodeLayout | undefined;
}

export function PanelStyleSection({
  component,
  updateComponent,
  updateNodeLayout,
  componentNodeLayout,
}: PanelStyleSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("endpointPanel.groupingType")}
        </label>
        <select
          value={component.panelKind ?? "default"}
          onChange={(event) => {
            const kind = event.target.value as PanelKind;
            const def = getPanelKindDef(kind);
            const layout = componentNodeLayout;
            if (kind === PanelKind.Swimlane) {
              updateComponent(component.id, {
                panelKind: kind,
                panelColor: def.defaultColor,
                swimlane: {
                  orientation: SwimlaneOrientation.Horizontal,
                  laneColor: "#6366f1",
                  laneLabel: t("swimlane.defaultLaneLabel"),
                },
              } as ComponentPatch);
              if (layout) {
                updateNodeLayout(
                  component.id,
                  { x: layout.x, y: layout.y },
                  { width: SWIMLANE_DEFAULT_W, height: SWIMLANE_DEFAULT_H },
                );
              }
            } else {
              updateComponent(component.id, {
                panelKind: kind,
                panelColor: def.defaultColor,
                swimlane: undefined,
              } as ComponentPatch);
            }
          }}
          className="h-8 w-full rounded-md border border-border bg-secondary px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {PANEL_KINDS.map((panelKind) => (
            <option key={panelKind.id} value={panelKind.id}>
              {panelKind.id === PanelKind.Swimlane
                ? t("swimlane.title")
                : panelKindLabel(panelKind.id)}
            </option>
          ))}
        </select>
      </div>
      {component.panelKind === PanelKind.Swimlane ? (
        <>
          <Field
            label={t("swimlane.laneLabel")}
            value={component.swimlane?.laneLabel ?? ""}
            onChange={(value) => {
              updateComponent(component.id, {
                swimlane: mergeSwimlane(component.swimlane, { laneLabel: value }),
              } as ComponentPatch);
            }}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("swimlane.orientation")}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  updateComponent(component.id, {
                    swimlane: mergeSwimlane(component.swimlane, {
                      orientation: SwimlaneOrientation.Horizontal,
                    }),
                  } as ComponentPatch);
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  (component.swimlane?.orientation ?? SwimlaneOrientation.Horizontal) ===
                  SwimlaneOrientation.Horizontal
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("swimlane.horizontal")}
              </button>
              <button
                type="button"
                onClick={() => {
                  updateComponent(component.id, {
                    swimlane: mergeSwimlane(component.swimlane, {
                      orientation: SwimlaneOrientation.Vertical,
                    }),
                  } as ComponentPatch);
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  component.swimlane?.orientation === SwimlaneOrientation.Vertical
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("swimlane.vertical")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

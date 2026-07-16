import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentPatch, PanelComponent, SwimlaneStyle } from "@/features/diagram";
import { PanelKind } from "@/features/diagram";
import { SwimlaneOrientation } from "@/features/canvas/enums";
import { PANEL_KINDS, getPanelKindDef } from "@/lib/catalogs/panels";
import type { NodeLayout } from "@/features/diagram";
import { SWIMLANE_DEFAULT_H, SWIMLANE_DEFAULT_W } from "@/features/canvas/canvas.constants";
import Field from "../components/Field";
import PanelColorPicker from "../components/PanelColorPicker";
import { LANE_COLORS } from "../swimlaneLaneColors";
import { DEFAULT_PANEL_OPACITY, MIN_PANEL_WIDTH, MIN_PANEL_HEIGHT } from "../../../constants/panel.constants";

function mergeSwimlane(
  current: SwimlaneStyle | undefined,
  partial: Partial<SwimlaneStyle>,
): SwimlaneStyle {
  return {
    orientation: partial.orientation ?? current?.orientation ?? SwimlaneOrientation.Horizontal,
    laneColor: partial.laneColor ?? current?.laneColor ?? "#6366f1",
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
  const [widthInput, setWidthInput] = useState<string>("");
  const [heightInput, setHeightInput] = useState<string>("");

  useEffect(() => {
    if (!componentNodeLayout) {
      setWidthInput("");
      setHeightInput("");
      return;
    }
    setWidthInput(String(Math.round(componentNodeLayout.width ?? 0)));
    setHeightInput(String(Math.round(componentNodeLayout.height ?? 0)));
  }, [componentNodeLayout]);

  useEffect(() => {
    if (!componentNodeLayout) return;
    const timeoutId = window.setTimeout(() => {
      const parsedWidth = Number(widthInput);
      const parsedHeight = Number(heightInput);
      if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) return;

      const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.round(parsedWidth));
      const clampedHeight = Math.max(MIN_PANEL_HEIGHT, Math.round(parsedHeight));

      if (
        clampedWidth === componentNodeLayout.width &&
        clampedHeight === componentNodeLayout.height
      )
        return;

      updateNodeLayout(
        component.id,
        { x: componentNodeLayout.x, y: componentNodeLayout.y },
        { width: clampedWidth, height: clampedHeight },
      );
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [component.id, componentNodeLayout, heightInput, updateNodeLayout, widthInput]);

  return (
    <>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
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
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {PANEL_KINDS.map((panelKind) => (
            <option key={panelKind.id} value={panelKind.id}>
              {panelKind.id === PanelKind.Swimlane ? t("swimlane.title") : panelKind.label}
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
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
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
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
              {t("swimlane.laneColor")}
            </label>
            <div className="flex flex-wrap gap-2">
              {LANE_COLORS.map((laneColor) => {
                const current = component.swimlane?.laneColor ?? "#6366f1";
                const active = current === laneColor.value;
                return (
                  <button
                    key={laneColor.value}
                    type="button"
                    title={laneColor.label}
                    aria-label={laneColor.label}
                    onClick={() => {
                      updateComponent(component.id, {
                        swimlane: mergeSwimlane(component.swimlane, {
                          laneColor: laneColor.value,
                        }),
                        panelColor: laneColor.value,
                      } as ComponentPatch);
                    }}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${
                      active
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: laneColor.value }}
                  />
                );
              })}
            </div>
          </div>
          {componentNodeLayout && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  {t("elementPanel.widthLabel")}
                </label>
                <input
                  type="number"
                  min={MIN_PANEL_WIDTH}
                  value={widthInput}
                  onChange={(event) => setWidthInput(event.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  {t("elementPanel.heightLabel")}
                </label>
                <input
                  type="number"
                  min={MIN_PANEL_HEIGHT}
                  value={heightInput}
                  onChange={(event) => setHeightInput(event.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <PanelColorPicker
            componentId={component.id}
            currentColor={component.panelColor ?? getPanelKindDef(component.panelKind).defaultColor}
            currentOpacity={component.panelOpacity ?? DEFAULT_PANEL_OPACITY}
            updateComponent={updateComponent}
          />
          {componentNodeLayout && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  {t("elementPanel.widthLabel")}
                </label>
                <input
                  type="number"
                  min={MIN_PANEL_WIDTH}
                  value={widthInput}
                  onChange={(event) => setWidthInput(event.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  {t("elementPanel.heightLabel")}
                </label>
                <input
                  type="number"
                  min={MIN_PANEL_HEIGHT}
                  value={heightInput}
                  onChange={(event) => setHeightInput(event.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
              {t("elementPanel.border")}
            </label>
            <select
              value={component.borderStyle ?? "solid"}
              onChange={(event) =>
                updateComponent(component.id, {
                  borderStyle: event.target.value as "solid" | "dashed" | "dotted",
                } as ComponentPatch)
              }
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="solid">{t("common.strokeSolid")}</option>
              <option value="dashed">{t("common.strokeDashed")}</option>
              <option value="dotted">{t("common.strokeDotted")}</option>
            </select>
          </div>
        </>
      )}
    </>
  );
}

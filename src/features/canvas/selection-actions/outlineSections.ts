import type { Component, ComponentPatch } from "@/features/diagram";
import { PanelKind } from "@/features/diagram/enums";
import { isPanelComponent } from "@/features/diagram";
import {
  defaultStrokeFor,
  resolveFlowAppearance,
  type FlowAppearanceInput,
} from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { getElement } from "@/features/elements/element.registry";
import type { OutlineSection } from "./OutlineControl";

/**
 * What the outline control offers for this element: the border of a boundary, the stroke of a lane,
 * the fill and stroke of a flow-skinned element. Nothing for the rest.
 */
export function buildOutlineSections(
  component: Component,
  defaultAccent: string | undefined,
  updateComponent: (id: string, patch: ComponentPatch) => void,
  t: (key: string) => string,
): OutlineSection[] {
  const write = (patch: ComponentPatch) => updateComponent(component.id, patch);
  if (isPanelComponent(component)) {
    if (component.panelKind === PanelKind.Swimlane) {
      return [
        {
          label: t("elementPanel.stroke"),
          value: component.borderStyle === "dashed" ? "dashed" : "solid",
          options: [
            { value: "solid", label: t("elementPanel.strokeSolid") },
            { value: "dashed", label: t("elementPanel.strokeDashed") },
          ],
          onChange: (value) => write({ borderStyle: value === "solid" ? undefined : "dashed" }),
        },
      ];
    }
    return [
      {
        label: t("elementPanel.border"),
        value: component.borderStyle ?? "solid",
        options: [
          { value: "solid", label: t("common.strokeSolid") },
          { value: "dashed", label: t("common.strokeDashed") },
          { value: "dotted", label: t("common.strokeDotted") },
        ],
        onChange: (value) =>
          write({ borderStyle: value === "dashed" || value === "dotted" ? value : "solid" }),
      },
    ];
  }
  if (getElement(component.type)?.skin) {
    const appearance = component as Component & FlowAppearanceInput;
    const resolved = resolveFlowAppearance(appearance, defaultAccent);
    return [
      {
        label: t("elementPanel.fill"),
        value: resolved.fill,
        options: [
          { value: "none", label: t("elementPanel.fillNone") },
          { value: "soft", label: t("elementPanel.fillSoft") },
          { value: "solid", label: t("elementPanel.fillSolid") },
        ],
        onChange: (value) =>
          write({
            fill: value === "none" ? undefined : value === "soft" ? "soft" : "solid",
            // A legacy nodeColor implies a solid fill; choosing a fill turns it into the plain
            // accent it stands for, or "none" could not stick.
            ...(appearance.nodeColor && !appearance.customColor
              ? { customColor: appearance.nodeColor, nodeColor: undefined }
              : {}),
          }),
      },
      {
        label: t("elementPanel.stroke"),
        value: resolved.stroke,
        options: [
          { value: "solid", label: t("elementPanel.strokeSolid") },
          { value: "dashed", label: t("elementPanel.strokeDashed") },
        ],
        onChange: (value) => {
          const stroke = value === "dashed" ? "dashed" : "solid";
          write({ stroke: stroke === defaultStrokeFor(appearance.flowShape) ? undefined : stroke });
        },
      },
    ];
  }
  return [];
}

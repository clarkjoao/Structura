import { useTranslation } from "react-i18next";
import type { ComponentPatch, NodeFillMode, NodeStrokeMode } from "@/features/diagram";
import { ColorPicker } from "@/features/canvas/selection-actions/ColorPicker";
import {
  accentToStore,
  defaultStrokeFor,
  resolveFlowAppearance,
  type FlowAppearanceInput,
} from "@/features/canvas/nodes/ProcessNode/flowAppearance";
import { SegmentedControl } from "../components/SegmentedControl";

export interface FlowAppearanceSectionProps {
  /** The three stored parts (and the legacy fill), exactly as on the component. */
  appearance: FlowAppearanceInput;
  onChange: (patch: ComponentPatch) => void;
  /** The element's default accent (`ElementSkin.defaultAccent`); slate when omitted. */
  defaultAccent?: string;
}

/**
 * Colour in parts: accent, fill and stroke, each its own control. The accent is
 * the same picker (and the same `customColor` field) the canvas toolbar uses.
 *
 * Picking a part's default clears it rather than storing it: the defaults are
 * resolved at render, and an unset part keeps the diagram's checksum where an
 * explicitly-default one would move it.
 */
export function FlowAppearanceSection({
  appearance,
  onChange,
  defaultAccent,
}: FlowAppearanceSectionProps) {
  const { t } = useTranslation();
  const resolved = resolveFlowAppearance(appearance, defaultAccent);
  // Only a flow node can carry the legacy nodeColor; clearing it elsewhere
  // would only add an empty key.
  const clearLegacy = appearance.nodeColor !== undefined ? { nodeColor: undefined } : {};

  return (
    <section className="space-y-3" aria-label={t("elementPanel.appearance")}>
      <p className="text-xs font-semibold text-foreground">{t("elementPanel.appearance")}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
          {t("elementPanel.accent")}
        </span>
        <ColorPicker
          group="flow"
          align="end"
          selectedColor={resolved.accent}
          onSelectColor={(color) =>
            // A legacy nodeColor is cleared with it, or it would keep winning as the fill.
            onChange({ customColor: accentToStore(color, defaultAccent), ...clearLegacy })
          }
          onReset={() => onChange({ customColor: undefined, ...clearLegacy })}
        />
      </div>
      <SegmentedControl<NodeFillMode>
        label={t("elementPanel.fill")}
        value={resolved.fill}
        options={[
          { value: "none", label: t("elementPanel.fillNone") },
          { value: "soft", label: t("elementPanel.fillSoft") },
          { value: "solid", label: t("elementPanel.fillSolid") },
        ]}
        onChange={(fill) =>
          onChange({
            fill: fill === "none" ? undefined : fill,
            // A legacy nodeColor implies a solid fill; choosing a fill turns it
            // into the plain accent it stands for, or "none" could not stick.
            ...(appearance.nodeColor && !appearance.customColor
              ? { customColor: appearance.nodeColor, nodeColor: undefined }
              : {}),
          })
        }
      />
      <SegmentedControl<NodeStrokeMode>
        label={t("elementPanel.stroke")}
        value={resolved.stroke}
        options={[
          { value: "solid", label: t("elementPanel.strokeSolid") },
          { value: "dashed", label: t("elementPanel.strokeDashed") },
        ]}
        onChange={(stroke) =>
          onChange({
            stroke: stroke === defaultStrokeFor(appearance.flowShape) ? undefined : stroke,
          })
        }
      />
    </section>
  );
}

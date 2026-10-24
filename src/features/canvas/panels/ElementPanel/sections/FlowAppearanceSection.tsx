import { useTranslation } from "react-i18next";
import type { ComponentPatch, NodeFillMode, NodeStrokeMode } from "@/features/diagram";
import {
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
 * Fill and stroke of a flow-skinned element. The accent is not here: the floating toolbar owns
 * colour, and the panel is configuration.
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

  return (
    <section className="space-y-3" aria-label={t("elementPanel.appearance")}>
      <p className="text-xs font-semibold text-foreground">{t("elementPanel.appearance")}</p>
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

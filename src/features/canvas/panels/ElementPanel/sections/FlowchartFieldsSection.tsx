import { useTranslation } from "react-i18next";
import type { FlowNodeShape } from "@/features/diagram";
import { COMPONENT_TYPE_PROCESSOS } from "@/features/diagram";

const FLOW_SHAPES: FlowNodeShape[] = [
  "rectangle",
  "rounded",
  "stadium",
  "diamond",
  "hexagon",
  "parallelogram",
  "cylinder",
  "circle",
  "subroutine",
];

export interface FlowchartFieldsSectionProps {
  flowShape: FlowNodeShape;
  onFlowShapeChange: (shape: FlowNodeShape) => void;
}

export function FlowchartFieldsSection({
  flowShape,
  onFlowShapeChange,
}: FlowchartFieldsSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
          {t("endpointPanel.type")}
        </label>
        <select
          value={COMPONENT_TYPE_PROCESSOS}
          disabled
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground opacity-80 cursor-default"
        >
          <option value={COMPONENT_TYPE_PROCESSOS}>{t("nodeTypes.processos")}</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
          {t("elementPanel.flowShape")}
        </label>
        <select
          value={flowShape}
          onChange={(event) => onFlowShapeChange(event.target.value as FlowNodeShape)}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {FLOW_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`flowchart.shapes.${shape}`)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

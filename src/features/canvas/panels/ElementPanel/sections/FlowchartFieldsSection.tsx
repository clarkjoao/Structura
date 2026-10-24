import { useTranslation } from "react-i18next";
import type { FlowNodeShape } from "@/features/diagram";
import { COMPONENT_TYPE_PROCESS_NODE } from "@/features/diagram";
import { readFlowShape } from "@/features/canvas/nodes/ProcessNode/flowShapeGeometry";

const FLOW_SHAPES: FlowNodeShape[] = [
  "rectangle",
  "rounded",
  "stadium",
  "diamond",
  "hexagon",
  "parallelogram",
  "cylinder",
  "subroutine",
  "start",
  "end",
  "document",
  "event",
  "junction-and",
  "junction-or",
  "annotation",
  "evidence",
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
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("endpointPanel.type")}
        </label>
        <select
          value={COMPONENT_TYPE_PROCESS_NODE}
          disabled
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground opacity-80 cursor-default"
        >
          <option value={COMPONENT_TYPE_PROCESS_NODE}>{t("nodeTypes.processos")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("elementPanel.flowShape")}
        </label>
        <select
          // A legacy "start / end" circle shows as the start it is drawn as.
          value={readFlowShape(flowShape)}
          onChange={(event) => onFlowShapeChange(event.target.value as FlowNodeShape)}
          className="h-8 w-full rounded-md border border-border bg-secondary px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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

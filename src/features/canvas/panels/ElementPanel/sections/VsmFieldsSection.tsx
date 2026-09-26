import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import {
  generateId,
  isFlowDividerComponent,
  isVsmExternalComponent,
  isVsmInventoryComponent,
  isVsmProcessComponent,
  isVsmTimelineComponent,
  type Component,
  type ComponentPatch,
  type VsmMetric,
  type NodeStrokeMode,
  type VsmRole,
  type VsmTimelineSegment,
  type VsmTimeUnit,
} from "@/features/diagram";
import { DEFAULT_VSM_TIME_UNIT, vsmTimelineTotals } from "@/features/diagram/utils/vsm-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "../components/SegmentedControl";

const LABEL_CLASS = "text-[11px] text-muted-foreground uppercase tracking-wider font-semibold";

/** A whole number or nothing: an empty field clears the value instead of storing 0. */
function parseCount(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/** A free-text field whose empty value clears the field instead of storing "". */
function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`${LABEL_CLASS} block`}>
        {label}
      </label>
      <Input
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className="h-9"
      />
    </div>
  );
}

const TIME_UNITS: readonly VsmTimeUnit[] = ["s", "min", "h", "d"];

/** A duration field: a number, with blank or invalid input read as zero. */
function parseDuration(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function SegmentsEditor({
  segments,
  unit,
  onChange,
}: {
  segments: VsmTimelineSegment[];
  unit: string;
  onChange: (segments: VsmTimelineSegment[]) => void;
}) {
  const { t } = useTranslation();
  const totals = vsmTimelineTotals(segments);
  const set = (index: number, patch: Partial<VsmTimelineSegment>) =>
    onChange(segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
  return (
    <div className="space-y-1.5">
      <p className={LABEL_CLASS}>{t("vsm.fields.segments")}</p>
      {segments.map((segment, index) => (
        <div key={segment.id} className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            aria-label={t("vsm.fields.wait")}
            placeholder={t("vsm.fields.wait")}
            value={segment.wait}
            onChange={(event) => set(index, { wait: parseDuration(event.target.value) })}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Input
            type="number"
            min={0}
            aria-label={t("vsm.fields.process")}
            placeholder={t("vsm.fields.process")}
            value={segment.process}
            onChange={(event) => set(index, { process: parseDuration(event.target.value) })}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("vsm.fields.removeSegment")}
            onClick={() => onChange(segments.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full text-xs"
        onClick={() => onChange([...segments, { id: generateId("s"), wait: 0, process: 0 }])}
      >
        <Plus />
        {t("vsm.fields.addSegment")}
      </Button>
      {/* Computed, never typed: the totals only ever come from the segments. */}
      <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("vsm.timeline.leadTime")}</dt>
          <dd className="font-mono font-semibold" data-testid="vsm-lead-time">
            {totals.leadTime} {unit}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("vsm.timeline.valueAdded")}</dt>
          <dd className="font-mono font-semibold" data-testid="vsm-value-added">
            {totals.valueAdded} {unit}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function MetricsEditor({
  metrics,
  onChange,
}: {
  metrics: VsmMetric[];
  onChange: (metrics: VsmMetric[]) => void;
}) {
  const { t } = useTranslation();
  const set = (index: number, patch: Partial<VsmMetric>) =>
    onChange(metrics.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)));
  return (
    <div className="space-y-1.5">
      <p className={LABEL_CLASS}>{t("vsm.fields.metrics")}</p>
      {metrics.map((metric, index) => (
        <div key={metric.id} className="flex items-center gap-1.5">
          <Input
            aria-label={t("vsm.fields.metricKey")}
            value={metric.key}
            onChange={(event) => set(index, { key: event.target.value })}
            className="h-8 w-24 font-mono text-xs"
          />
          <Input
            aria-label={t("vsm.fields.metricValue")}
            value={metric.value}
            onChange={(event) => set(index, { value: event.target.value })}
            className="h-8 flex-1 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("vsm.fields.removeMetric")}
            onClick={() => onChange(metrics.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full text-xs"
        onClick={() => onChange([...metrics, { id: generateId("m"), key: "", value: "" }])}
      >
        <Plus />
        {t("vsm.fields.addMetric")}
      </Button>
    </div>
  );
}

export interface VsmFieldsSectionProps {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}

/**
 * The fields each VSM element carries beyond a name and a description — and
 * the named line's stroke, which shares the same inspector.
 */
export function VsmFieldsSection({ component, onChange }: VsmFieldsSectionProps) {
  const { t } = useTranslation();

  if (isFlowDividerComponent(component)) {
    return (
      <SegmentedControl<NodeStrokeMode>
        label={t("blueprint.fields.stroke")}
        value={component.stroke ?? "solid"}
        options={[
          { value: "solid", label: t("elementPanel.strokeSolid") },
          { value: "dashed", label: t("elementPanel.strokeDashed") },
        ]}
        onChange={(stroke) => onChange({ stroke: stroke === "solid" ? undefined : stroke })}
      />
    );
  }

  if (isVsmExternalComponent(component)) {
    return (
      <SegmentedControl<VsmRole>
        label={t("vsm.fields.role")}
        value={component.role ?? "supplier"}
        options={[
          { value: "supplier", label: t("vsm.role.supplier") },
          { value: "customer", label: t("vsm.role.customer") },
        ]}
        // Supplier is the default and is stored as nothing.
        onChange={(role) => onChange({ role: role === "supplier" ? undefined : role })}
      />
    );
  }

  if (isVsmProcessComponent(component)) {
    return (
      <>
        <div className="space-y-1.5">
          <label htmlFor="vsm-operators" className={`${LABEL_CLASS} block`}>
            {t("vsm.fields.operators")}
          </label>
          <Input
            id="vsm-operators"
            type="number"
            min={0}
            value={component.operators ?? ""}
            onChange={(event) => onChange({ operators: parseCount(event.target.value) })}
            className="h-9"
          />
        </div>
        <MetricsEditor
          metrics={component.metrics ?? []}
          onChange={(metrics) => onChange({ metrics })}
        />
      </>
    );
  }

  if (isVsmInventoryComponent(component)) {
    return (
      <>
        <TextField
          id="vsm-quantity"
          label={t("vsm.fields.quantity")}
          value={component.quantity}
          onChange={(quantity) => onChange({ quantity })}
        />
        <TextField
          id="vsm-duration"
          label={t("vsm.fields.duration")}
          value={component.duration}
          onChange={(duration) => onChange({ duration })}
        />
      </>
    );
  }

  if (isVsmTimelineComponent(component)) {
    const unit = component.unit ?? DEFAULT_VSM_TIME_UNIT;
    return (
      <>
        <SegmentedControl<VsmTimeUnit>
          label={t("vsm.fields.unit")}
          value={unit}
          options={TIME_UNITS.map((value) => ({ value, label: t(`vsm.units.${value}`) }))}
          onChange={(next) => onChange({ unit: next === DEFAULT_VSM_TIME_UNIT ? undefined : next })}
        />
        <SegmentsEditor
          segments={component.segments ?? []}
          unit={t(`vsm.units.${unit}`)}
          onChange={(segments) => onChange({ segments })}
        />
      </>
    );
  }

  return null;
}

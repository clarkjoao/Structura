import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import {
  generateId,
  isVsmExternalComponent,
  isVsmInventoryComponent,
  isVsmProcessComponent,
  type Component,
  type ComponentPatch,
  type VsmMetric,
  type VsmRole,
} from "@/features/diagram";
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

/** The fields each VSM element carries beyond a name and a description. */
export function VsmFieldsSection({ component, onChange }: VsmFieldsSectionProps) {
  const { t } = useTranslation();

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

  return null;
}

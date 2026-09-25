import { useTranslation } from "react-i18next";
import {
  isK8sClusterComponent,
  isK8sIngressComponent,
  isK8sNamespaceComponent,
  isK8sServiceComponent,
  isK8sWorkloadComponent,
  type Component,
  type ComponentPatch,
  type K8sServiceComponent,
  type K8sWorkloadComponent,
  type K8sWorkloadKind,
} from "@/features/diagram";
import { DEFAULT_WORKLOAD_KIND } from "@/features/diagram/utils/k8s-workload";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DeployTextField as TextField } from "./DeployTextField";
import { DEPLOY_LABEL_CLASS, list, positive, text, whole } from "./deployFieldValues";

const KINDS: readonly K8sWorkloadKind[] = [
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "Job",
  "CronJob",
  "Pod",
];
const SERVICE_TYPES: readonly NonNullable<K8sServiceComponent["serviceType"]>[] = [
  "ClusterIP",
  "NodePort",
  "LoadBalancer",
  "ExternalName",
];
const POLICIES: readonly NonNullable<K8sWorkloadComponent["concurrencyPolicy"]>[] = [
  "Allow",
  "Forbid",
  "Replace",
];

const SELECT_CLASS =
  "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className={DEPLOY_LABEL_CLASS}>{label}</p>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The fields each Kubernetes structural element carries beyond a name and a description. */
export function K8sFieldsSection({
  component,
  onChange,
}: {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}) {
  const { t } = useTranslation();

  if (isK8sClusterComponent(component)) {
    return (
      <>
        <TextField
          id="k8s-distribution"
          label={t("k8s.fields.distribution")}
          value={component.distribution}
          onChange={(value) => onChange({ distribution: text(value) })}
        />
        <TextField
          id="k8s-version"
          label={t("k8s.fields.version")}
          value={component.version}
          onChange={(value) => onChange({ version: text(value) })}
        />
        <TextField
          id="k8s-nodes"
          type="number"
          label={t("k8s.fields.nodeCount")}
          value={component.nodeCount}
          onChange={(value) => onChange({ nodeCount: positive(value) })}
        />
        <TextField
          id="k8s-zones"
          type="number"
          label={t("k8s.fields.zoneCount")}
          value={component.zoneCount}
          onChange={(value) => onChange({ zoneCount: positive(value) })}
        />
      </>
    );
  }

  if (isK8sNamespaceComponent(component)) {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="k8s-mesh">{t("k8s.fields.meshInjection")}</Label>
        <Switch
          id="k8s-mesh"
          checked={component.meshInjection === true}
          onCheckedChange={(on) => onChange({ meshInjection: on ? true : undefined })}
        />
      </div>
    );
  }

  if (isK8sWorkloadComponent(component)) {
    const kind = component.kind ?? DEFAULT_WORKLOAD_KIND;
    return (
      <>
        <Select
          label={t("k8s.fields.kind")}
          value={kind}
          options={KINDS}
          onChange={(next) => onChange({ kind: next === DEFAULT_WORKLOAD_KIND ? undefined : next })}
        />
        {(kind === "Deployment" || kind === "StatefulSet") && (
          <>
            <TextField
              id="k8s-replicas"
              type="number"
              label={t("k8s.fields.replicas")}
              value={component.replicas}
              onChange={(value) => onChange({ replicas: whole(value) })}
            />
            <div className="grid grid-cols-2 gap-2">
              <TextField
                id="k8s-hpa-min"
                type="number"
                label={t("k8s.fields.hpaMin")}
                value={component.hpaMin}
                onChange={(value) => onChange({ hpaMin: positive(value) })}
              />
              <TextField
                id="k8s-hpa-max"
                type="number"
                label={t("k8s.fields.hpaMax")}
                value={component.hpaMax}
                onChange={(value) => onChange({ hpaMax: positive(value) })}
              />
            </div>
          </>
        )}
        {kind === "Deployment" && (
          <TextField
            id="k8s-zone-list"
            label={t("k8s.fields.zones")}
            value={component.zones?.join(", ")}
            onChange={(value) => onChange({ zones: list(value) })}
          />
        )}
        {kind === "CronJob" && (
          <>
            <TextField
              id="k8s-schedule"
              label={t("k8s.fields.schedule")}
              value={component.schedule}
              onChange={(value) => onChange({ schedule: text(value) })}
            />
            <Select
              label={t("k8s.fields.concurrencyPolicy")}
              value={component.concurrencyPolicy ?? "Allow"}
              options={POLICIES}
              onChange={(next) =>
                onChange({ concurrencyPolicy: next === "Allow" ? undefined : next })
              }
            />
          </>
        )}
        <TextField
          id="k8s-image"
          label={t("k8s.fields.image")}
          value={component.image}
          onChange={(value) => onChange({ image: text(value) })}
        />
        <TextField
          id="k8s-resources"
          label={t("k8s.fields.resources")}
          value={component.resources}
          onChange={(value) => onChange({ resources: text(value) })}
        />
      </>
    );
  }

  if (isK8sServiceComponent(component)) {
    return (
      <>
        <Select
          label={t("k8s.fields.serviceType")}
          value={component.serviceType ?? "ClusterIP"}
          options={SERVICE_TYPES}
          onChange={(next) => onChange({ serviceType: next === "ClusterIP" ? undefined : next })}
        />
        <TextField
          id="k8s-port"
          type="number"
          label={t("k8s.fields.port")}
          value={component.port}
          onChange={(value) => onChange({ port: positive(value) })}
        />
      </>
    );
  }

  if (isK8sIngressComponent(component)) {
    return (
      <>
        <TextField
          id="k8s-host"
          label={t("k8s.fields.host")}
          value={component.host}
          onChange={(value) => onChange({ host: text(value) })}
        />
        <TextField
          id="k8s-class"
          label={t("k8s.fields.ingressClass")}
          value={component.ingressClass}
          onChange={(value) => onChange({ ingressClass: text(value) })}
        />
      </>
    );
  }

  return null;
}

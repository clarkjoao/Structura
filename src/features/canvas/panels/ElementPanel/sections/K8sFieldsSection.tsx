import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  isK8sClusterComponent,
  isK8sContainerComponent,
  isK8sIngressComponent,
  isK8sNamespaceComponent,
  isK8sServiceComponent,
  isK8sWorkloadComponent,
  type Component,
  type ComponentPatch,
  type K8sServiceComponent,
  type K8sWorkloadComponent,
  type K8sWorkloadKind,
  type K8sContainerRole,
  useDiagramActions,
  useResolvedComponents,
  useResolvedNodeLayouts,
} from "@/features/diagram";
import { podContainers, SIDECAR_PURPOSES } from "@/features/diagram/utils/k8s-pod";
import { Button } from "@/components/ui/button";
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

const ROLES: readonly K8sContainerRole[] = ["main", "sidecar", "init"];
/** "8080, 9090" → [8080, 9090]; nothing valid left clears it. */
const portList = (value: string) => {
  const ports = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ports.length > 0 ? ports : undefined;
};

/*
 * Where a new container goes inside its workload, workload-relative: inits in
 * a row under the card's header, then sidecars in a column with the main one
 * beside them. Nothing already there moves.
 */
const POD_HEADER = 116;
/** Under the init row: an init is as tall as any container (88), plus a gap. */
const POD_BODY = POD_HEADER + 100;
const SLOT = { width: 180, height: 88, rowStep: 100, initStep: 192, mainX: 204 } as const;

function containerSlot(role: K8sContainerRole, index: number): { x: number; y: number } {
  if (role === "init") return { x: 12 + index * SLOT.initStep, y: POD_HEADER };
  if (role === "sidecar") return { x: 12, y: POD_BODY + index * SLOT.rowStep };
  return { x: SLOT.mainX, y: POD_BODY + index * SLOT.rowStep };
}

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
  const components = useResolvedComponents();
  const layouts = useResolvedNodeLayouts();
  const { addComponent, updateNodeLayout } = useDiagramActions();

  /** Adds a container in its slot and grows the workload to hold it, if it has to. */
  const addContainer = (workloadId: string, role: K8sContainerRole) => {
    const workload = layouts[workloadId];
    if (!workload) return;
    const pod = podContainers(workloadId, components, layouts);
    const index =
      role === "init"
        ? pod.inits.length
        : role === "sidecar"
          ? pod.sidecars.length
          : pod.main.length;
    const slot = containerSlot(role, index);
    const name = role === "main" ? "app" : role === "sidecar" ? "sidecar" : `init-${index + 1}`;
    const added = addComponent(
      "k8s-container",
      name,
      workloadId,
      { x: workload.x + slot.x, y: workload.y + slot.y },
      undefined,
      undefined,
      undefined,
      role === "main" ? {} : { podRole: role, ...(role === "init" ? { order: index + 1 } : {}) },
    );
    if (!added || added.parentId !== workloadId) return;
    const width = Math.max(workload.width ?? 0, slot.x + SLOT.width + 12);
    const height = Math.max(workload.height ?? 0, slot.y + SLOT.height + 12);
    if (width !== workload.width || height !== workload.height) {
      updateNodeLayout(workloadId, { x: workload.x, y: workload.y }, { width, height });
    }
  };

  if (isK8sContainerComponent(component)) {
    const role = component.podRole ?? "main";
    return (
      <>
        <Select
          label={t("k8s.fields.podRole")}
          value={role}
          options={ROLES}
          onChange={(next) => onChange({ podRole: next === "main" ? undefined : next })}
        />
        {role === "sidecar" && (
          <div className="space-y-1.5">
            <label htmlFor="k8s-purpose" className={`${DEPLOY_LABEL_CLASS} block`}>
              {t("k8s.fields.purpose")}
            </label>
            <input
              id="k8s-purpose"
              list="k8s-purpose-presets"
              value={component.purpose ?? ""}
              onChange={(event) => onChange({ purpose: text(event.target.value) })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <datalist id="k8s-purpose-presets">
              {SIDECAR_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose} />
              ))}
            </datalist>
          </div>
        )}
        {role === "init" && (
          <TextField
            id="k8s-order"
            type="number"
            label={t("k8s.fields.order")}
            value={component.order}
            onChange={(value) => onChange({ order: positive(value) })}
          />
        )}
        <TextField
          id="k8s-container-image"
          label={t("k8s.fields.image")}
          value={component.image}
          onChange={(value) => onChange({ image: text(value) })}
        />
        <TextField
          id="k8s-ports"
          label={t("k8s.fields.ports")}
          value={component.ports?.join(", ")}
          onChange={(value) => onChange({ ports: portList(value) })}
        />
        <TextField
          id="k8s-container-resources"
          label={t("k8s.fields.resources")}
          value={component.resources}
          onChange={(value) => onChange({ resources: text(value) })}
        />
      </>
    );
  }

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
        <div className="flex flex-wrap gap-2">
          {(["main", "sidecar", "init"] as const).map((role) => (
            <Button
              key={role}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => addContainer(component.id, role)}
            >
              <Plus />
              {t(
                role === "main"
                  ? "k8s.addContainer"
                  : role === "sidecar"
                    ? "k8s.addSidecar"
                    : "k8s.addInit",
              )}
            </Button>
          ))}
        </div>
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

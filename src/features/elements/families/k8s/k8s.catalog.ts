import type { ElementTypeId } from "@/features/elements/element.types";

/**
 * Kubernetes catalog-shaped family data.
 *
 * Categories follow the resource groups architects draw most often. Namespace
 * and Cluster are intentionally omitted as categories: they are grouping
 * containers (closer to `panel` / PANEL_KINDS) than card services, and
 * `CloudFamilyDefinition` can only produce cards — every category it builds is
 * `role: "card"`, `canBeParent: false` (see `build-cloud-family-descriptors`).
 *
 * That is a known limit of the family contract, not an oversight in this
 * catalog. The options for lifting it are weighed in
 * `docs/audits/correcao-achados-auditoria.md` (item 6); it is an open decision,
 * so nothing here should be changed to work around it in the meantime.
 */
export type K8sCategoryId = "k8s-workloads" | "k8s-networking" | "k8s-storage" | "k8s-config";

export interface K8sService {
  id: string;
  name: string;
  /** Filename stem under `./icons/` (community unlabeled SVG). */
  iconName: string;
  categoryId: K8sCategoryId;
}

export interface K8sCategory {
  id: K8sCategoryId;
  name: string;
  services: readonly K8sService[];
}

/** Cast once at the catalog boundary — do not grow `ComponentType` per family. */
export function asK8sCategoryType(id: K8sCategoryId): ElementTypeId {
  return id as ElementTypeId;
}

export const K8S_CATEGORIES: readonly K8sCategory[] = [
  {
    id: "k8s-workloads",
    name: "Workloads",
    services: [
      { id: "deployment", name: "Deployment", iconName: "deploy", categoryId: "k8s-workloads" },
      { id: "statefulset", name: "StatefulSet", iconName: "sts", categoryId: "k8s-workloads" },
      { id: "daemonset", name: "DaemonSet", iconName: "ds", categoryId: "k8s-workloads" },
      { id: "job", name: "Job", iconName: "job", categoryId: "k8s-workloads" },
      { id: "cronjob", name: "CronJob", iconName: "cronjob", categoryId: "k8s-workloads" },
      { id: "pod", name: "Pod", iconName: "pod", categoryId: "k8s-workloads" },
    ],
  },
  {
    id: "k8s-networking",
    name: "Networking",
    services: [
      { id: "service", name: "Service", iconName: "svc", categoryId: "k8s-networking" },
      { id: "ingress", name: "Ingress", iconName: "ing", categoryId: "k8s-networking" },
      {
        id: "networkpolicy",
        name: "NetworkPolicy",
        iconName: "netpol",
        categoryId: "k8s-networking",
      },
    ],
  },
  {
    id: "k8s-storage",
    name: "Storage",
    services: [
      {
        id: "persistentvolume",
        name: "PersistentVolume",
        iconName: "pv",
        categoryId: "k8s-storage",
      },
      {
        id: "persistentvolumeclaim",
        name: "PersistentVolumeClaim",
        iconName: "pvc",
        categoryId: "k8s-storage",
      },
      { id: "storageclass", name: "StorageClass", iconName: "sc", categoryId: "k8s-storage" },
    ],
  },
  {
    id: "k8s-config",
    name: "Config",
    services: [
      { id: "configmap", name: "ConfigMap", iconName: "cm", categoryId: "k8s-config" },
      { id: "secret", name: "Secret", iconName: "secret", categoryId: "k8s-config" },
    ],
  },
];

export const K8S_SERVICE_MAP = new Map<string, K8sService>(
  K8S_CATEGORIES.flatMap((category) => category.services.map((service) => [service.id, service])),
);

export function isK8sCategoryId(type: string): type is K8sCategoryId {
  return (
    type === "k8s-workloads" ||
    type === "k8s-networking" ||
    type === "k8s-storage" ||
    type === "k8s-config"
  );
}

export interface SizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
}

/**
 * How small each deployment and Kubernetes element, reference and the named
 * line may be resized — on the canvas and in the inspector's size fields alike.
 */
export const ELEMENT_SIZE_LIMITS: Readonly<Record<string, SizeLimits>> = {
  "flow-divider": { minWidth: 120, minHeight: 24 },
  "deploy-sharded-store": { minWidth: 240, minHeight: 84 },
  "deploy-shard": { minWidth: 140, minHeight: 64 },
  "deploy-shard-router": { minWidth: 120, minHeight: 48 },
  "k8s-cluster": { minWidth: 280, minHeight: 64 },
  "k8s-namespace": { minWidth: 240, minHeight: 64 },
  "k8s-workload": { minWidth: 200, minHeight: 64 },
  "k8s-service": { minWidth: 160, minHeight: 56 },
  "k8s-ingress": { minWidth: 160, minHeight: 56 },
  "k8s-container": { minWidth: 140, minHeight: 56 },
  "shared-ref": { minWidth: 120, minHeight: 40 },
};

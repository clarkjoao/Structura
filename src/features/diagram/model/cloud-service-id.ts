/**
 * Resolve the cloud-provider service id on a persisted component (lambda, rds, …).
 *
 * F6b writes `cloudServiceId`. F6a-era and older payloads may still carry
 * `awsService` / `gcpService` / `azureService` until migrateUnifyCloudServiceId
 * runs. Catalog `serviceId` (business registry, v11) stays last so it never
 * shadows a real cloud icon id.
 *
 * Order:
 * `cloudServiceId ?? awsService ?? gcpService ?? azureService ?? serviceId`
 *
 * @example
 * resolveCloudServiceId({ cloudServiceId: "lambda", serviceId: "svc-pay" }) // "lambda"
 * resolveCloudServiceId({ awsService: "lambda" }) // "lambda" (pre-migration)
 */

export type CloudServiceIdFields = {
  cloudServiceId?: string;
  serviceId?: string;
  /** @deprecated F6b — kept for tolerant reads of unmigrated payloads */
  awsService?: string;
  /** @deprecated F6b */
  gcpService?: string;
  /** @deprecated F6b */
  azureService?: string;
};

export function resolveCloudServiceId(component: CloudServiceIdFields): string | undefined {
  return (
    nonEmpty(component.cloudServiceId) ??
    nonEmpty(component.awsService) ??
    nonEmpty(component.gcpService) ??
    nonEmpty(component.azureService) ??
    nonEmpty(component.serviceId)
  );
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

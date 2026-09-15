/**
 * Resolve the cloud-provider service id on a persisted component (lambda, rds, …).
 *
 * F6a — tolerant **read**. Writes still go to `awsService` / `gcpService` /
 * `azureService` until F6b.
 *
 * Order is **legacy fields first**, then `serviceId`:
 *
 * `awsService ?? gcpService ?? azureService ?? serviceId`
 *
 * The plan’s written order (`serviceId` first) is unsafe today:
 * `BaseComponent.serviceId` already means the **business service catalog** link
 * (v11 `registryServiceId` → `serviceId`). Preferring it would treat `svc-pay`
 * as a cloud icon id whenever a cloud node is also linked to the catalog.
 * Putting `serviceId` last still accepts a future F6b peer that writes only the
 * unified field, once F6b has decided what happens to catalog links.
 *
 * @example
 * resolveCloudServiceId({ awsService: "lambda", serviceId: "svc-pay" }) // "lambda"
 * resolveCloudServiceId({ serviceId: "lambda" }) // "lambda" (F6b-shaped write)
 */

export type CloudServiceIdFields = {
  serviceId?: string;
  awsService?: string;
  gcpService?: string;
  azureService?: string;
};

export function resolveCloudServiceId(component: CloudServiceIdFields): string | undefined {
  const fromLegacy =
    nonEmpty(component.awsService) ??
    nonEmpty(component.gcpService) ??
    nonEmpty(component.azureService);
  if (fromLegacy !== undefined) return fromLegacy;
  return nonEmpty(component.serviceId);
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

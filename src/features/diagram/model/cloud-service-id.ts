/**
 * Resolve the cloud-provider service id on a persisted component (lambda, rds, …).
 *
 * F6b writes `cloudServiceId`. F6a-era and older payloads may still carry
 * `awsService` / `gcpService` / `azureService` until migrateUnifyCloudServiceId
 * runs.
 *
 * **Never** falls through to `BaseComponent.serviceId` (business catalog, v11).
 * F6a put catalog `serviceId` last so it would not shadow a legacy cloud field
 * when both were present; that still treated a lone business link as a cloud
 * icon id — exactly what leaks a C4 `system` linked to `svc-pay` into the LLM
 * serializer as `awsService="svc-pay"`, and what made k8s/oss (no legacy field)
 * resolve every business `serviceId` as a platform service.
 *
 * Order: `cloudServiceId ?? awsService ?? gcpService ?? azureService`
 *
 * @example
 * resolveCloudServiceId({ cloudServiceId: "lambda", serviceId: "svc-pay" }) // "lambda"
 * resolveCloudServiceId({ awsService: "lambda" }) // "lambda" (pre-migration)
 * resolveCloudServiceId({ type: "system", serviceId: "svc-pay" }) // undefined
 */

export type CloudServiceIdFields = {
  cloudServiceId?: string;
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
    nonEmpty(component.azureService)
  );
}

/* ────────────────────────── F6b write side ────────────────────────── */

/**
 * Env name of the F6b release gate. Opt-in, like `VITE_ENABLE_GITHUB_IMPORT`.
 *
 * Exported so the Vite build guard and the bypass test name the same string
 * instead of repeating a literal that could drift.
 */
export const CLOUD_SERVICE_ID_WRITE_FLAG = "VITE_ENABLE_CLOUD_SERVICE_ID_WRITE";

/**
 * Whether this build was explicitly cleared to persist `cloudServiceId`.
 *
 * Read by the Vite build guard (`vite.config.ts`), **not** by the write
 * helpers below — see `cloudServiceIdWrite` for why the gate is a build gate
 * and not a runtime switch.
 */
export function isCloudServiceIdWriteEnabled(): boolean {
  return import.meta.env?.[CLOUD_SERVICE_ID_WRITE_FLAG] === "true";
}

/**
 * The persisted cloud-service field, for an object literal being built.
 *
 * **This is the single control point for writing `cloudServiceId`.** Nothing
 * else in `src/` may emit the field name; `cloud-service-id.write-gate.test.ts`
 * fails the suite if something does. Concentrating the writes is what makes the
 * F6b release gate reviewable: one call site to look at instead of thirteen.
 *
 * Returns the field only when there is a value, so a component literal keeps
 * the same shape it had before the helper existed. Use
 * `cloudServiceIdClearingPatch` when the caller needs to *erase* the field.
 *
 * ### Why this helper does not switch on the release flag
 *
 * The obvious design — flag off ⇒ write the legacy `awsService` / `gcpService`
 * / `azureService` field, so the runtime behaves like F6a — does not work here,
 * and shipping it would be worse than shipping nothing, because it reads as
 * protection while providing none:
 *
 * 1. `migrateUnifyCloudServiceId` (`store/persist.config.ts`) runs on **every**
 *    rehydrate and unconditionally `delete`s the three legacy fields after
 *    copying them into `cloudServiceId`. A legacy write would survive until the
 *    next page load and no longer.
 * 2. `AwsComponent` / `GcpComponent` / `AzureComponent` no longer declare the
 *    legacy fields at all, so the "off" branch could not type-check without
 *    re-opening the union that F6b closed.
 * 3. `k8s` and `oss` never had a legacy field. There is no F6a behaviour for
 *    them to fall back to. They still share this build gate: the cutover is
 *    "any `cloudServiceId` writer in the production bundle", not
 *    "hyperscaler legacy only". Exempting them needs a per-family gate
 *    redesign — see `docs/audits/correcao-achados-auditoria.md` (fatia 2+3).
 *
 * The cutover is schema v13 as a whole — migration included — not a choice of
 * field name at the write sites. So the gate lives where the cutover actually
 * happens: a production **build** refuses to run unless
 * `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true` is set deliberately. Dev and test
 * are unaffected. See ADR-0010 and `docs/architecture/element-registry.md`.
 *
 * @example
 * const component = { ...base, type: "aws-compute", ...cloudServiceIdWrite("lambda") };
 */
export function cloudServiceIdWrite(serviceId: string | undefined): { cloudServiceId?: string } {
  const value = nonEmpty(serviceId);
  return value === undefined ? {} : { cloudServiceId: value };
}

/**
 * The persisted cloud-service field for a **patch**, where absent and empty
 * mean different things.
 *
 * `updateComponent` merges its patch, so omitting the key leaves the old value
 * in place. A user clearing the service select has to write `undefined`
 * explicitly, which is what this returns for an empty input.
 *
 * @example
 * updateComponent(id, { ...cloudServiceIdClearingPatch(next) }) // next === "" erases
 */
export function cloudServiceIdClearingPatch(serviceId: string | undefined): {
  cloudServiceId: string | undefined;
} {
  return { cloudServiceId: nonEmpty(serviceId) };
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

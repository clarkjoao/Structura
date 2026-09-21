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
  /**
   * Business-catalog link (`BaseComponent.serviceId`). Present so a full
   * `Component` stays assignable to this reader; **never** read by
   * `resolveCloudServiceId`.
   */
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
    nonEmpty(component.azureService)
  );
}

/* ────────────────────────── F6b write side ────────────────────────── */

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
 * ### Why the writes stay in one place
 *
 * They were concentrated for the F6b release gate: thirteen unconditional
 * write sites and a release rule that lived only in ADR prose, so an audit
 * had thirteen places to check. The gate is gone — the cutover was taken on
 * 2026-09-20, see ADR-0010 — but the concentration is worth keeping on its
 * own: `cloud-service-id.write-gate.test.ts` still fails if a fourteenth
 * producer appears, and the next change to how cloud service ids persist has
 * one call site to reason about instead of thirteen.
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

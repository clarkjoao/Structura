import { SERVICE_ROLES, ServiceSource, effectiveServiceRole } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { normalizeSources } from "@/features/integrations/merge-utils";
import type { GroupBy, RoleFilter } from "./types";

export interface ServiceGroup {
  /** Stable key: a role, a technology, a source or `none`. */
  key: string;
  services: ServiceDefinition[];
}

/** Role chips count the already-searched list, so the numbers match what a click would show. */
export function countByRole(services: ServiceDefinition[]): Record<RoleFilter, number> {
  const counts: Record<string, number> = { all: services.length, none: 0 };
  for (const role of SERVICE_ROLES) counts[role] = 0;
  for (const svc of services) counts[effectiveServiceRole(svc) ?? "none"] += 1;
  return counts as Record<RoleFilter, number>;
}

function groupKeys(svc: ServiceDefinition, groupBy: GroupBy): string[] {
  switch (groupBy) {
    case "role":
      return [effectiveServiceRole(svc) ?? "none"];
    case "technology":
      return [svc.technology[0]?.trim() || "none"];
    case "source":
      return [normalizeSources(svc)[0]?.type ?? ServiceSource.Manual];
  }
}

/** Groups keep a fixed order for roles and sources; technologies sort by name. "none" is last. */
export function groupServices(services: ServiceDefinition[], groupBy: GroupBy): ServiceGroup[] {
  const byKey = new Map<string, ServiceDefinition[]>();
  for (const svc of services) {
    for (const key of groupKeys(svc, groupBy)) {
      byKey.set(key, [...(byKey.get(key) ?? []), svc]);
    }
  }
  const order: readonly string[] =
    groupBy === "role"
      ? SERVICE_ROLES
      : groupBy === "source"
        ? [ServiceSource.Manual, ServiceSource.Github, ServiceSource.Defectdojo]
        : [...byKey.keys()].filter((key) => key !== "none").sort((a, b) => a.localeCompare(b));
  return [...order, "none"]
    .filter((key) => byKey.has(key))
    .map((key) => ({
      key,
      services: [...(byKey.get(key) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

import { VERSION_STATUSES, type VersionDiff, type VersionStatus } from "@/features/diagram";

/** i18n key of each Version status. */
export const STATUS_LABEL: Record<VersionStatus, string> = {
  proposed: "versions.statusProposed",
  approved: "versions.statusApproved",
  "in-progress": "versions.statusInProgress",
  done: "versions.statusDone",
};

/** Versions by status, in lifecycle order, then those without a status; empty groups left out. */
export function groupVersionsByStatus(
  versions: readonly VersionDiff[],
): Array<{ status: VersionStatus | null; versions: VersionDiff[] }> {
  const order: Array<VersionStatus | null> = [...VERSION_STATUSES, null];
  return order
    .map((status) => ({ status, versions: versions.filter((v) => (v.status ?? null) === status) }))
    .filter((group) => group.versions.length > 0);
}

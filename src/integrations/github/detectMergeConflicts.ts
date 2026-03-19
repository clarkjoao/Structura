import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";

export interface MergeConflict {
  repo: GithubRepo;
  existingService: ServiceDefinition;
}

export function detectConflicts(
  repos: GithubRepo[],
  existingServices: ServiceDefinition[],
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  for (const repo of repos) {
    const existingService = existingServices.find(
      (svc) => svc.repositoryUrl === repo.html_url,
    );

    if (existingService) {
      conflicts.push({ repo, existingService });
    }
  }

  // Priority: defectdojo first so the dialog suggests merging against it.
  conflicts.sort((a, b) => {
    const aPri = a.existingService.source === "defectdojo" ? 0 : 1;
    const bPri = b.existingService.source === "defectdojo" ? 0 : 1;
    return aPri - bPri;
  });

  return conflicts;
}


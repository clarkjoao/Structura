import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { normalizeSources, repoUrlsMatch } from "../merge-utils";

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
    const matchingServices = existingServices.filter((svc) =>
      repoUrlsMatch(svc.repositoryUrl, repo.html_url),
    );

    for (const existingService of matchingServices) {
      conflicts.push({ repo, existingService });
    }
  }

  conflicts.sort((a, b) => {
    const aPri = normalizeSources(a.existingService).some(
      (source) => source.type === ServiceSource.Defectdojo,
    )
      ? 0
      : 1;
    const bPri = normalizeSources(b.existingService).some(
      (source) => source.type === ServiceSource.Defectdojo,
    )
      ? 0
      : 1;
    return aPri - bPri;
  });

  return conflicts;
}

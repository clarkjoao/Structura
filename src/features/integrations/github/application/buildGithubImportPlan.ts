import { ServiceSource, type ServiceDefinition } from "@/features/diagram";
import { detectConflicts, type MergeConflict } from "../detectMergeConflicts";
import type { GithubRepo } from "../github.types";
import type { MergeResolution } from "../github-merge.types";
import { normalizeSources } from "../../merge-utils";

export interface GithubImportPlan {
  conflictsForImport: MergeConflict[];
  crossConflicts: MergeConflict[];
  autoResolutions: MergeResolution[];
}

interface BuildGithubImportPlanParams {
  selectedRepos: GithubRepo[];
  allServices: ServiceDefinition[];
}

function hasSource(service: ServiceDefinition, sourceType: ServiceSource): boolean {
  return normalizeSources(service).some((source) => source.type === sourceType);
}

function conflictScore(conflict: MergeConflict): number {
  if (hasSource(conflict.existingService, ServiceSource.Defectdojo)) return 3;
  if (hasSource(conflict.existingService, ServiceSource.Github)) return 2;
  return 1;
}

export function buildGithubImportPlan({
  selectedRepos,
  allServices,
}: BuildGithubImportPlanParams): GithubImportPlan {
  const detectedAll = detectConflicts(selectedRepos, allServices);

  const bestByRepoId = new Map<number, MergeConflict>();
  for (const conflict of detectedAll) {
    const prev = bestByRepoId.get(conflict.repo.id);
    if (!prev || conflictScore(conflict) > conflictScore(prev)) {
      bestByRepoId.set(conflict.repo.id, conflict);
    }
  }

  const conflictsForImport = Array.from(bestByRepoId.values());
  const githubExistingConflicts = conflictsForImport.filter((conflict) =>
    hasSource(conflict.existingService, ServiceSource.Github),
  );
  const crossConflicts = conflictsForImport.filter(
    (conflict) => !hasSource(conflict.existingService, ServiceSource.Github),
  );

  const autoResolutions: MergeResolution[] = githubExistingConflicts.map((conflict) => ({
    existingServiceId: conflict.existingService.id,
    fields: {
      name: "github",
      description: "github",
      technology: "merge",
      tags: "merge",
    },
  }));

  return {
    conflictsForImport,
    crossConflicts,
    autoResolutions,
  };
}

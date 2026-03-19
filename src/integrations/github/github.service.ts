import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";
import type { MergeConflict } from "./detectMergeConflicts";
import type { MergeResolution } from "./GithubMergeDialog";
import { githubRepoToService } from "./githubMapper";
import { dedupeStringsPreserveOrder } from "../merge-utils";

type CommitParams = {
  selectedRepos: GithubRepo[];
  conflictsForImport: MergeConflict[];
  resolutions: MergeResolution[];
  addService: (service: Omit<ServiceDefinition, "id">) => ServiceDefinition;
  updateService: (
    id: string,
    patch: Partial<Omit<ServiceDefinition, "id">>,
  ) => void;
};

export async function commitGithubImport({
  selectedRepos,
  conflictsForImport,
  resolutions,
  addService,
  updateService,
}: CommitParams) {
  const conflictByRepoId = new Map(
    conflictsForImport.map((c) => [c.repo.id, c]),
  );
  const resolutionByExistingServiceId = new Map(
    resolutions.map((r) => [r.existingServiceId, r]),
  );

  for (const repo of selectedRepos) {
    const conflict = conflictByRepoId.get(repo.id);
    const githubService = githubRepoToService(repo);

    if (conflict) {
      const existing = conflict.existingService;
      const resolution = resolutionByExistingServiceId.get(existing.id);

      if (!resolution) {
        throw new Error(
          "Resolução ausente para um conflito. Feche e tente novamente.",
        );
      }

      const mergedName =
        resolution.fields.name === "github" ? githubService.name : existing.name;
      const mergedDescription =
        resolution.fields.description === "github"
          ? githubService.description
          : existing.description;

      const mergedTechnology =
        resolution.fields.technology === "merge"
          ? dedupeStringsPreserveOrder([
              ...existing.technology,
              ...githubService.technology,
            ])
          : resolution.fields.technology === "github"
            ? githubService.technology
            : existing.technology;

      const mergedTags =
        resolution.fields.tags === "merge"
          ? dedupeStringsPreserveOrder([
              ...(existing.tags ?? []),
              ...(githubService.tags ?? []),
            ])
          : resolution.fields.tags === "github"
            ? githubService.tags ?? []
            : existing.tags ?? [];

      const prevGithub = existing.metadata?.github;
      const prevDefectDojo = existing.metadata?.defectdojo;

      // Preserva a source original: se o serviço veio do DefectDojo, mantém defectdojo.
      // O GitHub apenas enriquece com metadata, não "rouba" a ownership.
      const keepSource = existing.source === "defectdojo";

      updateService(existing.id, {
        name: mergedName,
        description: mergedDescription,
        repositoryUrl: existing.repositoryUrl || githubService.repositoryUrl,
        technology: mergedTechnology,
        tags: mergedTags,
        source: keepSource ? existing.source : "github",
        sourceId: keepSource ? existing.sourceId : githubService.sourceId,
        metadata: {
          github: {
            ...(prevGithub ?? {}),
            ...(githubService.metadata?.github ?? {}),
          },
          defectdojo: prevDefectDojo,
        },
      });
    } else {
      addService(githubService);
    }
  }
}

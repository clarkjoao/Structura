import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";
import type { MergeConflict } from "./detectMergeConflicts";
import type { MergeResolution } from "./components/GithubMergeDialog";
import { githubRepoToService } from "./githubMapper";
import {
  dedupeStringsPreserveOrder,
  ensureMergedSourceTags,
} from "../merge-utils";

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

      const isCrossSourceMerge =
        existing.source === "defectdojo" || Boolean(existing.metadata?.defectdojo);
      const finalTags = isCrossSourceMerge
        ? ensureMergedSourceTags(mergedTags)
        : mergedTags;

      const prevGithub = existing.metadata?.github;
      const prevDefectDojo = existing.metadata?.defectdojo;
      const nextGithubMeta = githubService.metadata?.github ?? prevGithub;

      // Preserva a source original: se o serviço veio do DefectDojo, mantém defectdojo.
      // O GitHub apenas enriquece com metadata, não "rouba" a ownership.
      const keepSource = existing.source === "defectdojo";

      updateService(existing.id, {
        name: mergedName,
        description: mergedDescription,
        repositoryUrl: existing.repositoryUrl || githubService.repositoryUrl,
        technology: mergedTechnology,
        tags: finalTags,
        source: keepSource ? existing.source : "github",
        sourceId: keepSource ? existing.sourceId : githubService.sourceId,
        metadata: {
          github: nextGithubMeta,
          defectdojo: prevDefectDojo,
        },
      });
    } else {
      addService(githubService);
    }
  }
}

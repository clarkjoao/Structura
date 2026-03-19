import type { GithubRepo } from "./github.types";
import type { ServiceDefinition } from "@/features/diagram";
import type { MergeConflict } from "./detectMergeConflicts";
import type { MergeResolution } from "./GithubMergeDialog";
import { githubRepoToService } from "./githubMapper";

function dedupeStringsPreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function normalizeDefectDojoMetadata(
  meta: unknown,
): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object") return undefined;

  const m = meta as Record<string, unknown>;
  const defectdojo = m.defectdojo;
  if (defectdojo && typeof defectdojo === "object") {
    return defectdojo as Record<string, unknown>;
  }

  // Backward compatibility: older persisted services stored DefectDojo data at top-level metadata.
  const hasKnownDefectDojoKeys =
    m.businessCriticality !== undefined ||
    m.platform !== undefined ||
    m.lifecycle !== undefined ||
    m.prodType !== undefined;
  if (!hasKnownDefectDojoKeys) return undefined;

  return m;
}

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
      const prevDefectDojo = normalizeDefectDojoMetadata(existing.metadata);

      // Preserve repositoryUrl by not changing it explicitly.
      updateService(existing.id, {
        name: mergedName,
        description: mergedDescription,
        technology: mergedTechnology,
        tags: mergedTags,
        source: "github",
        sourceId: githubService.sourceId,
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


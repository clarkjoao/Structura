import type { ServiceDefinition, ServiceRole } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import type { RepoMetadata } from "./repo.types";

export interface RepoServiceEdits {
  name: string;
  description: string;
  owner: string;
  role: ServiceRole | "";
  technology: string[];
  /** Keep the service linked to its source (so Sync works) or only remember the URL. */
  sync: boolean;
}

/**
 * A service from a repository. With sync on it carries the source and its metadata; with sync
 * off it is a manual service that remembers the repository URL, and the page offers to sync later.
 */
export function repoToService(
  repo: RepoMetadata,
  edits: RepoServiceEdits,
  suggestedRole: ServiceRole | undefined,
): Omit<ServiceDefinition, "id"> {
  const declared = edits.role || suggestedRole;
  const base: Omit<ServiceDefinition, "id"> = {
    name: edits.name.trim(),
    description: edits.description.trim(),
    repositoryUrl: repo.webUrl,
    technology: edits.technology,
    ...(edits.owner.trim() ? { owner: edits.owner.trim() } : {}),
    ...(declared
      ? { role: declared, roleSource: edits.role ? ("user" as const) : ("suggested" as const) }
      : {}),
    tags: repo.topics,
  };
  if (!edits.sync) return { ...base, sources: [{ type: ServiceSource.Manual }] };

  const language = repo.languages[0] ?? null;
  if (repo.kind === "github") {
    return {
      ...base,
      sources: [{ type: ServiceSource.Github, sourceId: repo.fullName }],
      metadata: {
        github: {
          repoId: repo.remoteId,
          fullName: repo.fullName,
          topics: repo.topics,
          language,
          updatedAt: repo.updatedAt,
        },
      },
    };
  }
  return {
    ...base,
    sources: [{ type: ServiceSource.Gitlab, sourceId: repo.fullName }],
    metadata: {
      gitlab: {
        projectId: repo.remoteId,
        fullName: repo.fullName,
        topics: repo.topics,
        language,
        updatedAt: repo.updatedAt,
      },
    },
  };
}

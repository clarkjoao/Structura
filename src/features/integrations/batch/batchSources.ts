import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { createGithubClient } from "../github/githubClient";
import type { GithubConfig } from "../github/github.types";
import { githubRepoToService } from "../github/githubMapper";
import { createGitlabClient } from "../gitlab/gitlabClient";
import type { GitlabConfig } from "../gitlab/gitlab.types";
import { DefectDojoClient } from "../defectdojo/defectdojo.client";
import { mapToServiceDefinition, searchProducts } from "../defectdojo/defectdojo.service";
import type { DefectDojoConfig } from "../defectdojo/types";
import { normalizeSources, repoUrlsMatch } from "../merge-utils";
import { gitlabProjectToMetadata } from "../repo/repoLookup";
import { repoToService } from "../repo/repoToService";

export type BatchKind = "github" | "gitlab" | "defectdojo";

/** One row of the selection list: a service ready to be added, not yet added. */
export interface BatchCandidate {
  key: string;
  service: Omit<ServiceDefinition, "id">;
}

const PAGE_SIZE = 100;
/** Stops a very large organisation from turning one click into hundreds of requests. */
const MAX_PAGES = 5;

async function collectPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  cap = MAX_PAGES,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= cap; page += 1) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return all;
}

export async function loadGithubOrg(org: string, config: GithubConfig): Promise<BatchCandidate[]> {
  const client = createGithubClient(config);
  const repos = await collectPages((page) => client.listOrgRepositories(org, page, PAGE_SIZE));
  return repos
    .filter((repo) => !repo.archived)
    .map((repo) => ({ key: `github:${repo.full_name}`, service: githubRepoToService(repo) }));
}

export async function loadGitlabGroup(
  group: string,
  config: GitlabConfig,
): Promise<BatchCandidate[]> {
  const client = createGitlabClient(config);
  const projects = await collectPages((page) => client.listGroupProjects(group, page, PAGE_SIZE));
  // The project list carries no languages; filling them would cost one request per project.
  return projects
    .filter((project) => !project.archived)
    .map((project) => ({
      key: `gitlab:${project.path_with_namespace}`,
      service: repoToService(
        gitlabProjectToMetadata(project, []),
        {
          name: project.name,
          description: project.description ?? "",
          owner: "",
          role: "",
          technology: [],
          sync: true,
        },
        undefined,
      ),
    }));
}

export async function loadDefectdojoProducts(
  query: string,
  config: DefectDojoConfig,
): Promise<BatchCandidate[]> {
  const products = await searchProducts(new DefectDojoClient(config), query.trim(), {});
  return products.map((product) => ({
    key: `defectdojo:${product.id}`,
    service: mapToServiceDefinition(product),
  }));
}

/** A candidate is in the catalog when a service has the same source id or the same repository. */
export function findInCatalog(
  candidate: BatchCandidate,
  services: ServiceDefinition[],
): ServiceDefinition | undefined {
  const incoming = normalizeSources(candidate.service);
  return services.find(
    (svc) =>
      normalizeSources(svc).some((source) =>
        incoming.some(
          (other) =>
            other.type !== ServiceSource.Manual &&
            other.type === source.type &&
            other.sourceId !== undefined &&
            other.sourceId === source.sourceId,
        ),
      ) || repoUrlsMatch(svc.repositoryUrl, candidate.service.repositoryUrl),
  );
}

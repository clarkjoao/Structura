import { i18n } from "@/infrastructure/i18n";
import { createGitlabClient } from "@/features/integrations/gitlab/gitlabClient";
import {
  DEFAULT_GITLAB_CONFIG,
  readGitlabConfig,
} from "@/features/integrations/gitlab/useGitlabConfig";
import { gitlabProjectToMetadata, languagesBySize } from "@/features/integrations/repo/repoLookup";
import type { RepoMetadata } from "@/features/integrations/repo/repo.types";
import { createGithubClient } from "@/features/integrations/github/githubClient";
import type { GithubConfig, GithubRepo } from "@/features/integrations/github/github.types";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import {
  dedupeStringsPreserveOrder,
  mergeSources,
  normalizeSources,
  pickMoreCompleteString,
} from "@/features/integrations/merge-utils";

export interface SyncServiceFromSourcesParams {
  service: ServiceDefinition;
  githubConfig: GithubConfig | null;
}

type DefectDojoConfig = {
  baseUrl: string;
  apiToken: string;
};

function readDefectDojoConfig(): DefectDojoConfig {
  const rawConfig =
    localStorage.getItem("structura_defectdojo:config") ??
    localStorage.getItem("structura:defectdojo:config");
  if (!rawConfig) throw new Error(i18n.t("services.errorDefectDojoNotConfigured"));
  return JSON.parse(rawConfig) as DefectDojoConfig;
}

async function fetchGithubRepository(params: {
  service: ServiceDefinition;
  githubConfig: GithubConfig | null;
}): Promise<GithubRepo | null> {
  const { service, githubConfig } = params;
  const normalizedSources = normalizeSources(service);
  const hasGithubData =
    Boolean(service.metadata?.github) ||
    normalizedSources.some((s) => s.type === ServiceSource.Github);
  if (!hasGithubData) return null;

  const githubSourceId = normalizedSources.find(
    (sourceEntry) => sourceEntry.type === ServiceSource.Github,
  )?.sourceId;
  const githubIdentifier =
    githubSourceId ?? (service.metadata?.github as { fullName?: string } | undefined)?.fullName;

  if (!githubIdentifier) return null;
  const apiBase = githubConfig?.baseUrl ?? "https://api.github.com";
  const token = githubConfig?.token ?? "";
  const client = createGithubClient({
    baseUrl: apiBase,
    token,
    useProxy: githubConfig?.useProxy,
    proxyUrl: githubConfig?.useProxy ? githubConfig?.proxyUrl : undefined,
  });
  return client.getRepository(githubIdentifier);
}

async function fetchGitlabProject(service: ServiceDefinition): Promise<RepoMetadata | null> {
  const gitlabSource = normalizeSources(service).find((s) => s.type === ServiceSource.Gitlab);
  const path = gitlabSource?.sourceId ?? service.metadata?.gitlab?.fullName;
  if (!path) return null;
  const client = createGitlabClient(readGitlabConfig() ?? DEFAULT_GITLAB_CONFIG);
  const project = await client.getProject(path);
  const languages = await client
    .getProjectLanguages(project.id)
    .then(languagesBySize)
    .catch(() => []);
  return gitlabProjectToMetadata(project, languages);
}

async function fetchDefectDojoService(service: ServiceDefinition): Promise<{
  mapped: Omit<ServiceDefinition, "id"> | null;
  sourceId?: string;
}> {
  const normalizedSources = normalizeSources(service);
  const hasDefectDojoData =
    Boolean(service.metadata?.defectdojo) ||
    normalizedSources.some((s) => s.type === ServiceSource.Defectdojo);
  if (!hasDefectDojoData) return { mapped: null };

  const { DefectDojoClient } = await import("@/features/integrations/defectdojo/defectdojo.client");
  const { mapToServiceDefinition } =
    await import("@/features/integrations/defectdojo/defectdojo.service");

  const ddMeta = service.metadata?.defectdojo as
    { productId?: string | number; productLink?: string } | undefined;
  const productIdFromLink = ddMeta?.productLink?.match(/\/product\/(\d+)(?:\/|$)/)?.[1];
  const defectDojoSourceId = normalizedSources.find(
    (sourceEntry) => sourceEntry.type === ServiceSource.Defectdojo,
  )?.sourceId;
  const defectDojoProductId =
    defectDojoSourceId ?? (ddMeta?.productId ? String(ddMeta.productId) : productIdFromLink);
  const cfg = readDefectDojoConfig();
  const client = new DefectDojoClient(cfg);
  if (!defectDojoProductId) return { mapped: null };

  const resp = await client.get<{ results: Record<string, unknown>[] }>("/api/v2/products/", {
    id: String(defectDojoProductId),
  });
  const product = resp.results[0];
  if (!product) return { mapped: null };
  return {
    mapped: mapToServiceDefinition(
      product as unknown as Parameters<typeof mapToServiceDefinition>[0],
    ),
    sourceId: defectDojoProductId,
  };
}

export async function syncServiceFromSources({
  service,
  githubConfig,
}: SyncServiceFromSourcesParams): Promise<Partial<Omit<ServiceDefinition, "id">>> {
  const githubRepo = await fetchGithubRepository({ service, githubConfig });
  const gitlab = await fetchGitlabProject(service);
  const defectDojo = await fetchDefectDojoService(service);
  const defectDojoMapped = defectDojo.mapped;

  if (!githubRepo && !gitlab && !defectDojoMapped) {
    throw new Error(i18n.t("services.errorSyncNoSource"));
  }

  const githubTech = [
    ...(githubRepo?.language ? [githubRepo.language] : []),
    ...(gitlab?.languages ?? []),
  ];
  const githubTags = [...(githubRepo?.topics ?? []), ...(gitlab?.topics ?? [])];
  const ddTags = defectDojoMapped?.tags ?? [];

  const mergedTech = dedupeStringsPreserveOrder([
    ...service.technology,
    ...githubTech,
    ...(defectDojoMapped?.technology ?? []),
  ]);
  const mergedTags = dedupeStringsPreserveOrder([
    ...(service.tags ?? []),
    ...githubTags,
    ...ddTags,
  ]);
  const mergedSourceEntries = mergeSources(normalizeSources(service), [
    ...(githubRepo ? [{ type: ServiceSource.Github, sourceId: githubRepo.full_name }] : []),
    ...(gitlab ? [{ type: ServiceSource.Gitlab, sourceId: gitlab.fullName }] : []),
    ...(defectDojoMapped
      ? [{ type: ServiceSource.Defectdojo, sourceId: defectDojo.sourceId }]
      : []),
  ]);

  return {
    name: pickMoreCompleteString(defectDojoMapped?.name ?? "", githubRepo?.name ?? service.name),
    description: pickMoreCompleteString(
      defectDojoMapped?.description ?? "",
      githubRepo?.description ?? gitlab?.description ?? service.description,
    ),
    repositoryUrl:
      githubRepo?.html_url ||
      gitlab?.webUrl ||
      service.repositoryUrl ||
      defectDojoMapped?.repositoryUrl ||
      "",
    technology: mergedTech,
    tags: mergedTags,
    sources: mergedSourceEntries,
    metadata: {
      github: githubRepo
        ? {
            repoId: githubRepo.id,
            fullName: githubRepo.full_name,
            topics: githubRepo.topics ?? [],
            language: githubRepo.language,
            updatedAt: githubRepo.updated_at,
          }
        : service.metadata?.github,
      gitlab: gitlab
        ? {
            projectId: gitlab.remoteId,
            fullName: gitlab.fullName,
            topics: gitlab.topics,
            language: gitlab.languages[0] ?? null,
            updatedAt: gitlab.updatedAt,
          }
        : service.metadata?.gitlab,
      defectdojo: defectDojoMapped?.metadata?.defectdojo ?? service.metadata?.defectdojo,
    },
  };
}

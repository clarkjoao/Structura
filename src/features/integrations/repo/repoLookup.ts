import { createGithubClient } from "../github/githubClient";
import type { GithubConfig, GithubRepo } from "../github/github.types";
import { createGitlabClient } from "../gitlab/gitlabClient";
import { DEFAULT_GITLAB_CONFIG } from "../gitlab/useGitlabConfig";
import type { GitlabConfig, GitlabProject } from "../gitlab/gitlab.types";
import type { RepoMetadata } from "./repo.types";
import { hostOf, type ParsedRepoUrl, type RepoKind } from "./parseRepoUrl";

const DEFAULT_GITHUB_CONFIG: GithubConfig = { baseUrl: "https://api.github.com", token: "" };

export interface RepoLookupConfigs {
  github: GithubConfig | null;
  gitlab: GitlabConfig | null;
}

/** Languages by share of the code, biggest first; the API returns bytes or percentages. */
export function languagesBySize(languages: Record<string, number>): string[] {
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

function githubRepoToMetadata(repo: GithubRepo, languages: string[]): RepoMetadata {
  return {
    kind: "github",
    name: repo.name,
    description: repo.description ?? "",
    webUrl: repo.html_url,
    fullName: repo.full_name,
    remoteId: repo.id,
    languages: languages.length > 0 ? languages : repo.language ? [repo.language] : [],
    topics: repo.topics ?? [],
    updatedAt: repo.updated_at,
  };
}

export function gitlabProjectToMetadata(project: GitlabProject, languages: string[]): RepoMetadata {
  return {
    kind: "gitlab",
    name: project.name,
    description: project.description ?? "",
    webUrl: project.web_url,
    fullName: project.path_with_namespace,
    remoteId: project.id,
    languages,
    topics: project.topics ?? [],
    updatedAt: project.last_activity_at,
  };
}

export class NoConfigForHostError extends Error {
  constructor(public readonly host: string) {
    super(`No ${host} connection configured`);
  }
}

/**
 * The connection to use for a host. A stored one is used only for its own host, so a token is
 * never sent to another instance; the public hosts work anonymously without one.
 */
function configForHost<T extends { baseUrl: string }>(
  stored: T | null,
  fallback: T,
  host: string,
): T {
  if (stored && hostOf(stored.baseUrl) === host) return stored;
  if (hostOf(fallback.baseUrl) === host) return fallback;
  throw new NoConfigForHostError(host);
}

/** Reads one repository. Without a stored connection the public API of github.com / gitlab.com is used. */
export async function fetchRepoMetadata(
  kind: RepoKind,
  parsed: ParsedRepoUrl,
  configs: RepoLookupConfigs,
): Promise<RepoMetadata> {
  if (kind === "github") {
    const client = createGithubClient(
      configForHost(configs.github, DEFAULT_GITHUB_CONFIG, parsed.host),
    );
    const repo = await client.getRepository(parsed.path);
    // Languages are a nicety: the repository is still usable if only that call fails.
    const languages = await client
      .getRepositoryLanguages(parsed.path)
      .then(languagesBySize)
      .catch(() => []);
    return githubRepoToMetadata(repo, languages);
  }
  const client = createGitlabClient(
    configForHost(configs.gitlab, DEFAULT_GITLAB_CONFIG, parsed.host),
  );
  const project = await client.getProject(parsed.path);
  const languages = await client
    .getProjectLanguages(project.id)
    .then(languagesBySize)
    .catch(() => []);
  return gitlabProjectToMetadata(project, languages);
}

import { proxyRequest } from "../proxy";
import type { GitlabConfig, GitlabProject } from "./gitlab.types";

export type GitlabClient = {
  getProject: (path: string) => Promise<GitlabProject>;
  getProjectLanguages: (projectId: number) => Promise<Record<string, number>>;
  listGroupProjects: (group: string, page: number, perPage: number) => Promise<GitlabProject[]>;
};

export function createGitlabClient(config: GitlabConfig): GitlabClient {
  const apiBase = `${config.baseUrl.replace(/\/+$/, "")}/api/v4`;
  // Sent as a bearer token: GitLab accepts it, and it is the header the proxy already forwards.
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  async function getJson<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${apiBase}${path}`);
    for (const [key, value] of Object.entries(params ?? {}))
      url.searchParams.set(key, String(value));

    if (config.useProxy) {
      const response = await proxyRequest<T>(
        { url: url.toString(), method: "GET", headers },
        config.proxyUrl,
      );
      return response.data;
    }

    const res = await fetch(url.toString(), { method: "GET", headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitLab ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  }

  return {
    // GitLab addresses a project by its URL-encoded full path, subgroups included.
    getProject: (path) => getJson<GitlabProject>(`/projects/${encodeURIComponent(path)}`),
    getProjectLanguages: (projectId) =>
      getJson<Record<string, number>>(`/projects/${projectId}/languages`),
    listGroupProjects: (group, page, perPage) =>
      getJson<GitlabProject[]>(`/groups/${encodeURIComponent(group)}/projects`, {
        include_subgroups: "true",
        per_page: perPage,
        page,
        simple: "false",
      }),
  };
}

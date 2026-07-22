import type { GithubRepo, GithubSearchResult, GithubOrg, GithubConfig } from "./github.types";
import { proxyRequest } from "../proxy";

export type GithubClient = {
  searchRepositories: (query: string, page: number, perPage: number) => Promise<GithubSearchResult>;
  getRepository: (fullName: string) => Promise<GithubRepo>;
  listUserOrgs: () => Promise<GithubOrg[]>;
  getAuthenticatedUser: () => Promise<{ login: string }>;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function createGithubClient(config: GithubConfig): GithubClient {
  const apiBase = normalizeBaseUrl(config.baseUrl);
  const useProxy = config.useProxy ?? false;
  const proxyUrl = config.proxyUrl;

  const baseHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.token) baseHeaders.Authorization = `Bearer ${config.token}`;

  async function getJson<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const url = new URL(`${apiBase}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }

    if (useProxy) {
      const response = await proxyRequest<T>(
        {
          url: url.toString(),
          method: "GET",
          headers: baseHeaders,
        },
        proxyUrl,
      );
      return response.data;
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: baseHeaders,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub ${res.status}: ${body}`);
    }

    return (await res.json()) as T;
  }

  return {
    async searchRepositories(query: string, page: number, perPage: number) {
      return getJson<GithubSearchResult>("/search/repositories", {
        q: query,
        per_page: perPage,
        page,
      });
    },

    async getRepository(fullName: string) {
      const [owner, repo] = fullName.split("/");
      return getJson<GithubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    },

    async listUserOrgs() {
      return getJson<GithubOrg[]>("/user/orgs", { per_page: 100 });
    },

    async getAuthenticatedUser() {
      return getJson<{ login: string }>("/user");
    },
  };
}

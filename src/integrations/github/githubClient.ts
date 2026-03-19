import type { GithubRepo, GithubSearchResult } from "./github.types";

type GithubClient = {
  searchRepositories: (
    query: string,
    page: number,
    perPage: number,
  ) => Promise<GithubSearchResult>;
  getRepository: (fullName: string) => Promise<GithubRepo>;
};

function normalizeBaseUrl(baseUrl: string): string {
  // Avoid double slashes when concatenating with endpoint paths.
  return baseUrl.replace(/\/+$/, "");
}

export function createGithubClient(
  baseUrl: string,
  token: string,
): GithubClient {
  const apiBase = normalizeBaseUrl(baseUrl);
  const baseHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) baseHeaders.Authorization = `Bearer ${token}`;

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
      // fullName is expected to be "owner/repo"
      return getJson<GithubRepo>(
        `/repos/${encodeURIComponent(fullName)}`,
      );
    },
  };
}


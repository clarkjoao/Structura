export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics: string[];
  archived: boolean;
  updated_at: string;
  stargazers_count: number;
}

export interface GithubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GithubRepo[];
}

export interface GithubOrg {
  login: string;
  id: number;
  description: string | null;
  avatar_url: string;
}

export interface GithubConfig {
  baseUrl: string;
  token: string;
}

/**
 * Campos de busca estruturados para a GitHub Search API.
 * Cada campo mapeia para qualificadores nativos da API.
 * @see https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
 */
/** Search field keys — labels come from `githubSearchField.*` in i18n */
export const GH_SEARCH_FIELDS = [
  { param: "name_contains" as const },
  { param: "name_starts" as const },
  { param: "description" as const },
  { param: "topic" as const },
  { param: "raw" as const },
] as const;

export type GHSearchField = (typeof GH_SEARCH_FIELDS)[number]["param"];

export interface GHSearchFilters {
  searchField: GHSearchField;
  org?: string;
  user?: string;
  language?: string;
  hideArchived?: boolean;
  hideForks?: boolean;
  minStars?: number;
  perPage?: number;
}

/**
 * Monta a query string para a GitHub Search API a partir do campo + valor + filtros.
 *
 * Os filtros `org`, `user` e `language` são qualificadores combinados com o campo
 * de busca principal. Quando `org` ou `user` estão preenchidos e o campo principal
 * está vazio, a busca retorna todos os repos daquela org/user.
 */
export function buildGithubQuery(
  query: string,
  filters: GHSearchFilters,
): string {
  const parts: string[] = [];
  const q = query.trim();

  switch (filters.searchField) {
    case "name_contains":
      if (q) parts.push(`${q} in:name`);
      break;
    case "name_starts":
      if (q) parts.push(`${q} in:name`);
      break;
    case "description":
      if (q) parts.push(`${q} in:description`);
      break;
    case "topic":
      if (q) parts.push(`topic:${q}`);
      break;
    case "raw":
      if (q) parts.push(q);
      break;
  }

  if (filters.org) {
    parts.push(`org:${filters.org.trim()}`);
  }

  if (filters.user) {
    parts.push(`user:${filters.user.trim()}`);
  }

  if (filters.language) {
    parts.push(`language:${filters.language.trim()}`);
  }

  if (filters.hideArchived) {
    parts.push("archived:false");
  }

  if (filters.hideForks) {
    parts.push("fork:false");
  }

  if (filters.minStars && filters.minStars > 0) {
    parts.push(`stars:>=${filters.minStars}`);
  }

  return parts.join(" ");
}


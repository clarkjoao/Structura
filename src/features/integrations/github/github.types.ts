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
  /** Use the dev proxy server instead of direct API calls (for corporate networks with CORS restrictions) */
  useProxy?: boolean;
  /** Custom proxy URL (defaults to http://localhost:3000/proxy) */
  proxyUrl?: string;
}

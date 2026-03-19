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

export interface GithubConfig {
  baseUrl: string;
  token: string;
}


export interface GitlabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  topics?: string[];
  archived: boolean;
  last_activity_at: string;
}

export interface GitlabConfig {
  /** Web root of the instance, e.g. `https://gitlab.com`; the client adds `/api/v4`. */
  baseUrl: string;
  /** Personal access token. Optional for public projects. */
  token: string;
  /** Route requests through the dev proxy (corporate networks with CORS restrictions). */
  useProxy?: boolean;
  proxyUrl?: string;
}

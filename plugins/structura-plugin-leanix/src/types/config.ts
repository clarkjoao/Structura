/**
 * Leanix configuration interface
 */
export interface LeanixConfig {
  baseUrl: string;
  authToken: string;
  userId: string;
  useProxy: boolean;
  proxyUrl: string;
  /** Optional workspace/space id; informational, not yet routed by the export. */
  workspaceId?: string;
}

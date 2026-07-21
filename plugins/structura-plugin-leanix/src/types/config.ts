/**
 * Leanix configuration stored via api.storage
 */
export interface LeanixConfig {
  baseUrl: string;    // e.g., "https://company.leanix.net"
  authToken: string; // Bearer token (user provides with "Bearer " prefix)
  userId: string;    // Leanix User ID for permissions
}

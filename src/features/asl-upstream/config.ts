/**
 * Feature flag and configuration for ASL Upstream.
 *
 * Enable with VITE_ENABLE_ASL_UPSTREAM="true"
 */

// API base URL for ASL upstream services
export const UPSTREAM_API_BASE = import.meta.env.VITE_ASL_UPSTREAM_API_URL ?? "";

export const ENABLE_ASL_UPSTREAM = import.meta.env.VITE_ENABLE_ASL_UPSTREAM === "true";

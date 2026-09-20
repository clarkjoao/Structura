/**
 * Runtime feature flag for the walkthrough module.
 *
 * With this off: no routes registered, no nav entries, and the module chunk
 * is never loaded (lazy import in App.tsx).
 *
 * Set VITE_ENABLE_WALKTHROUGHS=true in your .env.local to develop this feature.
 */
export const WALKTHROUGH_ENABLED = import.meta.env.VITE_ENABLE_WALKTHROUGHS === "true";

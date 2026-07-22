/// <reference types="vite/client" />

/**
 * Built-in plugins compiled into this build. Populated by the `structura-bundled-plugins`
 * Vite plugin (vite.config.ts) from the STRUCTURA_BUNDLED_PLUGINS env var — see
 * tools/build-with-plugins.mjs. Empty array for a plain `npm run build` / `npm run dev`.
 */
declare module "virtual:structura-bundled-plugins" {
  export const bundledPlugins: { dir: string; code: string }[];
}

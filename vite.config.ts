import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const BUNDLED_VIRTUAL_ID = "virtual:structura-bundled-plugins";
const BUNDLED_RESOLVED_ID = "\0" + BUNDLED_VIRTUAL_ID;

/** Keep in sync with `CLOUD_SERVICE_ID_WRITE_FLAG` in `src/features/diagram/model/cloud-service-id.ts`. */
const CLOUD_SERVICE_ID_WRITE_FLAG = "VITE_ENABLE_CLOUD_SERVICE_ID_WRITE";

/**
 * F6b release gate: refuse to produce a production bundle that has not been
 * deliberately cleared to persist `cloudServiceId`.
 *
 * Schema v13 writes `cloudServiceId` and `migrateUnifyCloudServiceId` deletes
 * the legacy `awsService` / `gcpService` / `azureService` fields on rehydrate.
 * A client doing that shares a collaboration room with clients that still write
 * the legacy fields, and their snapshot checksums diverge — there is no
 * component-schema version on the wire to negotiate it. So the cutover may only
 * ship once F6a tolerant reads have been live long enough for clients to
 * upgrade, and that is a human release decision.
 *
 * Failing the *build* is what makes the decision unskippable: a green branch
 * and a merge are no longer enough to deploy it. `npm run dev` and `npm test`
 * are untouched — the gate is only about producing a deployable artifact.
 *
 * See ADR-0010 (§Consequences, F6b) and docs/architecture/element-registry.md.
 */
function cloudServiceIdReleaseGate(mode: string): Plugin {
  return {
    name: "structura-cloud-service-id-release-gate",
    apply: "build",
    config() {
      const env = loadEnv(mode, process.cwd(), "");
      if (env[CLOUD_SERVICE_ID_WRITE_FLAG] === "true") return;
      throw new Error(
        `\n[F6b release gate] This build persists \`cloudServiceId\` (persist schema v13) ` +
          `and is blocked.\n\n` +
          `Mixed collaboration rooms diverge on snapshot checksums between clients that ` +
          `write the legacy\ncloud fields and clients that write \`cloudServiceId\`. Ship ` +
          `this only after F6a tolerant reads\nhave been live long enough for clients to ` +
          `upgrade.\n\n` +
          `When that release decision has actually been made, build with:\n` +
          `  ${CLOUD_SERVICE_ID_WRITE_FLAG}=true npm run build\n\n` +
          `See docs/adr/0010-element-registry.md (Consequences → F6b deploy gate).\n`,
      );
    },
  };
}

/**
 * Embeds selected plugins' built IIFE bundles into the app as a "built-in" layer, so a
 * distribution build can ship plugins pre-installed (no manual upload). The plugin list comes
 * from the STRUCTURA_BUNDLED_PLUGINS env var (comma-separated plugin folder names), set by
 * tools/build-with-plugins.mjs after it builds each plugin. Empty when the env var is unset,
 * so `npm run dev` and a plain `npm run build` are unaffected.
 */
function structuraBundledPlugins(): Plugin {
  return {
    name: "structura-bundled-plugins",
    resolveId(id) {
      if (id === BUNDLED_VIRTUAL_ID) return BUNDLED_RESOLVED_ID;
    },
    load(id) {
      if (id !== BUNDLED_RESOLVED_ID) return;
      const selected = (process.env.STRUCTURA_BUNDLED_PLUGINS ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

      const bundled = selected.map((dir) => {
        const distPath = path.resolve(import.meta.dirname, "plugins", dir, "dist", "plugin.js");
        if (!fs.existsSync(distPath)) {
          throw new Error(
            `[structura-bundled-plugins] "${dir}" has no dist/plugin.js at ${distPath}. ` +
              `Build it first, or use \`npm run build:plugins -- ${dir}\`.`,
          );
        }
        return { dir, code: fs.readFileSync(distPath, "utf8") };
      });

      // JSON.stringify safely escapes the IIFE source into a string literal in the app bundle.
      return `export const bundledPlugins = ${JSON.stringify(bundled)};`;
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), structuraBundledPlugins(), cloudServiceIdReleaseGate(mode)],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["aws-react-icons", "azure-react-icons"],
  },
}));

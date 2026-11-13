import type { DiagramStore } from "./store.types";

/** The parts of a workspace a fresh install starts with. */
export type FreshWorkspace = Pick<DiagramStore, "diagrams" | "folders" | "services">;

/**
 * The demo workspace, fetched only when there is no stored workspace to read
 * (audit R5). The seeds used to be the store slices' synchronous initial state,
 * so every visit downloaded them (~27 kB gzip on the boot path) even though a
 * returning user's stored workspace replaces them before anything renders.
 *
 * `VITE_DISABLE_SEEDS=true` builds keep the empty workspace and never request
 * the chunk.
 */
export const loadSeedWorkspace: (() => Promise<FreshWorkspace>) | undefined =
  import.meta.env.VITE_DISABLE_SEEDS === "true"
    ? undefined
    : async () => {
        const seeds = await import("@/fixtures/seeds");
        return {
          diagrams: seeds.SEED_DIAGRAMS,
          folders: seeds.SEED_FOLDERS,
          services: seeds.SEED_SERVICES,
        };
      };

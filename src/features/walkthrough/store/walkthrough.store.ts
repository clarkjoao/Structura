import { create } from "zustand";
import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";
import type { WalkthroughPresentation } from "../model/walkthrough.types";

const STORAGE_KEY = "walkthrough_presentations";

const storage = new LocalStorageAdapter();

interface WalkthroughStoreState {
  presentations: Record<string, WalkthroughPresentation>;
  hydrated: boolean;
}

interface WalkthroughStoreActions {
  /** Load all presentations from storage (call once on app boot). */
  hydrate(): Promise<void>;
  /** Persist a presentation (creates or updates). */
  save(presentation: WalkthroughPresentation): Promise<void>;
  /** Delete a presentation by id. */
  delete(id: string): Promise<void>;
  /** Get a single presentation by id. */
  get(id: string): WalkthroughPresentation | undefined;
  /**
   * Replace the whole set.
   *
   * Used by the workspace-folder reconciliation, which is the one caller that
   * legitimately both adds and removes in a single step — a per-id loop would
   * write local storage once per walkthrough and leave the library visibly
   * half-reconciled in between.
   */
  replaceAll(presentations: Record<string, WalkthroughPresentation>): Promise<void>;
}

export type WalkthroughStore = WalkthroughStoreState & WalkthroughStoreActions;

/**
 * Isolated store for walkthrough presentations.
 * Uses its own LocalStorageAdapter key — never touches the diagram store or
 * PERSIST_SCHEMA_VERSION.
 */
export const useWalkthroughStore = create<WalkthroughStore>((set, get) => ({
  presentations: {},
  hydrated: false,

  hydrate: async () => {
    const data = await storage.load<Record<string, WalkthroughPresentation>>(STORAGE_KEY);
    set({ presentations: data ?? {}, hydrated: true });
  },

  save: async (presentation: WalkthroughPresentation) => {
    const current = get().presentations;
    const updated: WalkthroughPresentation = {
      ...presentation,
      updatedAt: Date.now(),
    };
    const next = { ...current, [presentation.id]: updated };
    await storage.save(STORAGE_KEY, next);
    set({ presentations: next });
  },

  delete: async (id: string) => {
    const current = get().presentations;
    const next = { ...current };
    delete next[id];
    await storage.save(STORAGE_KEY, next);
    set({ presentations: next });
  },

  get: (id: string) => get().presentations[id],

  replaceAll: async (presentations: Record<string, WalkthroughPresentation>) => {
    await storage.save(STORAGE_KEY, presentations);
    set({ presentations, hydrated: true });
  },
}));

/** Create a new blank presentation with a generated id. */
export function createBlankPresentation(
  title = "Untitled Walkthrough",
  folderId: string | null = null,
): WalkthroughPresentation {
  return {
    id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    folderId,
    steps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

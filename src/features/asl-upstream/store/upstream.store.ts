/**
 * Zustand store for ASL Upstream.
 */

import { create } from "zustand";
import { fetchNamespaces, fetchDiagramUrls } from "../api/upstreamApi";
import type { UpstreamDiagram } from "../types";

interface UpstreamState {
  namespaces: string[];
  diagrams: Map<string, UpstreamDiagram>;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  fetchDiagramUrls: (namespace: string) => Promise<void>;
}

export const useUpstreamStore = create<UpstreamState>((set, get) => ({
  namespaces: [],
  diagrams: new Map(),
  loading: false,
  error: null,

  hydrate: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const namespaces = await fetchNamespaces();
      set({ namespaces, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load namespaces",
        loading: false,
      });
    }
  },

  fetchDiagramUrls: async (namespace: string) => {
    const { diagrams } = get();
    if (diagrams.has(namespace)) return;

    set({ loading: true, error: null });
    try {
      const urls = await fetchDiagramUrls(namespace);
      const files = Object.keys(urls);
      set((state) => ({
        diagrams: new Map(state.diagrams).set(namespace, {
          namespace,
          files,
          urls,
        }),
        loading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load diagram URLs",
        loading: false,
      });
    }
  },
}));

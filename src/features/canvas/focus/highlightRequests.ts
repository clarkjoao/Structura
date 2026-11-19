import { create } from "zustand";

/** Elements to light on the editor canvas, asked for from outside it (a plugin, API 1.11). */
export interface HighlightRequest {
  componentIds: readonly string[];
  connectionIds: readonly string[];
  /** A new request, even for the same elements. */
  token: number;
}

interface HighlightRequestState {
  request: HighlightRequest | null;
  requestHighlight(target: {
    componentIds?: readonly string[];
    connectionIds?: readonly string[];
  }): void;
}

/**
 * The canvas's highlight lives in its own component state; this is how something outside the
 * canvas asks for one. The canvas answers each new request (see `Canvas.tsx`).
 */
export const useHighlightRequests = create<HighlightRequestState>((set) => ({
  request: null,
  requestHighlight: ({ componentIds = [], connectionIds = [] }) =>
    set((state) => ({
      request: { componentIds, connectionIds, token: (state.request?.token ?? 0) + 1 },
    })),
}));

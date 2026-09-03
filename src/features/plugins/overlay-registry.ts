import type { ModalOptions } from "./plugin.types";
import { toast as sonnerToast } from "@/components/ui/sonner";

/**
 * Manages modal dialogs for plugins.
 * Toast notifications use Sonner (already integrated in the app).
 */

interface OverlayState {
  activeModal: ModalOptions | null;
}

const state: OverlayState = {
  activeModal: null,
};

// Stable snapshot for useSyncExternalStore - only update when state changes
let stateSnapshot: OverlayState = { activeModal: null };

const listeners = new Set<() => void>();

function notifyChanged(): void {
  // Update the snapshot only when state actually changes
  stateSnapshot = { activeModal: state.activeModal };
  for (const listener of listeners) {
    listener();
  }
}

export const overlayRegistry = {
  /**
   * Subscribe to overlay state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Get current overlay state (stable snapshot).
   * Returns the same object reference unless state has changed.
   */
  getState(): OverlayState {
    return stateSnapshot;
  },

  /**
   * Display a toast notification using Sonner.
   * @param options Toast options (type, title, description, action, duration)
   * @returns The Sonner toast ID
   */
  showToast(options: {
    type: "success" | "error" | "info" | "warning";
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    duration?: number;
  }): string | number {
    const { type, title, description, action, duration = 5000 } = options;

    const sonnerType = type === "warning" ? "warning" : type;

    if (action) {
      return sonnerToast(title, {
        description,
        [sonnerType]: true,
        duration: duration > 0 ? duration : undefined,
        action: {
          label: action.label,
          onClick: action.onClick,
        },
      } as Parameters<typeof sonnerToast>[1]);
    }

    return sonnerToast(title, {
      description,
      [sonnerType]: true,
      duration: duration > 0 ? duration : undefined,
    } as Parameters<typeof sonnerToast>[1]);
  },

  /**
   * Open a modal dialog.
   * If a modal is already open, it will be replaced.
   * @param options Modal options
   */
  openModal(options: ModalOptions): void {
    // Close existing modal first (invoke its onClose if any)
    if (state.activeModal?.onClose) {
      state.activeModal.onClose();
    }

    state.activeModal = {
      ...options,
      size: options.size ?? "md",
    };
    notifyChanged();
  },

  /**
   * Close the currently open modal.
   * Invokes the modal's onClose callback if provided.
   */
  closeModal(): void {
    if (state.activeModal?.onClose) {
      state.activeModal.onClose();
    }
    state.activeModal = null;
    notifyChanged();
  },

  /**
   * Check if a modal is currently open.
   */
  hasActiveModal(): boolean {
    return state.activeModal !== null;
  },
};

// Re-export types for convenience
export type { OverlayState, ModalOptions };

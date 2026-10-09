import type { ReactFlowInstance } from "@xyflow/react";
import type { ComponentType, Component } from "@/features/diagram";
import { getViewportCenter } from "../../viewport-utils";
import {
  claimShortcutEvent,
  isModKeyPressed,
  keyIs,
  keyMatchesLetter,
  keyMatchesLetterOrCode,
  KEY,
  type KeyHandler,
} from "./helpers";

export interface ToolShortcutCallbacks {
  onOpenSearch?: () => void;
  onOpenCommandPalette?: () => void;
  /** The element catalog (⌘K). */
  onOpenCatalog?: () => void;
  /** A toolbar insert by its plain-letter shortcut (N, P, L). */
  onInsertTool?: (key: string) => boolean;
  onToggleDiagramSidebar?: () => void;
  onOpenQuickInsert?: (params: {
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
  }) => void;
  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
  ) => Component;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeId: (id: string | null) => void;
}

interface CreateToolShortcutsParams extends ToolShortcutCallbacks {
  reactFlowInstance: ReactFlowInstance;
  isPanelOpen: boolean;
  c4ShortcutMap: Record<string, { type: ComponentType; name: string } | undefined>;
  lastPointerScreenRef: React.RefObject<{ x: number; y: number } | null>;
}

function openQuickInsert(params: CreateToolShortcutsParams, event: KeyboardEvent): void {
  claimShortcutEvent(event);
  const { reactFlowInstance, isPanelOpen, onOpenQuickInsert, lastPointerScreenRef } = params;
  const lastScreen = lastPointerScreenRef.current;
  if (lastScreen) {
    onOpenQuickInsert?.({
      screenPos: lastScreen,
      flowPos: reactFlowInstance.screenToFlowPosition(lastScreen),
    });
    return;
  }
  onOpenQuickInsert?.({
    screenPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    flowPos: getViewportCenter(reactFlowInstance, isPanelOpen),
  });
}

function createC4Element(params: CreateToolShortcutsParams, event: KeyboardEvent): boolean {
  if (!isModKeyPressed(event)) return false;
  const shortcut = params.c4ShortcutMap[event.key];
  if (!shortcut) return false;

  claimShortcutEvent(event);
  const pos = getViewportCenter(params.reactFlowInstance, params.isPanelOpen);
  const created = params.addComponent(shortcut.type, shortcut.name, null, pos);
  if (created?.id) {
    params.setSelectedNodeId(created.id);
    params.setSelectedNodeIds(new Set([created.id]));
    params.setSelectedEdgeId(null);
  }
  return true;
}

/**
 * Canvas tool chords: search, catalog, diagram palette, sidebar, C4
 * quick-create, Quick Insert, toolbar inserts.
 *
 * Quick Insert is Shift+E or `/` (no Cmd/Ctrl). Cmd+E and Cmd+Shift+E belong to
 * Chrome DevTools Performance; plain keys still yield to focused inputs as typing.
 * The catalog has Cmd+K; the diagram palette moved to Cmd+P (VS Code's "go to
 * file"), whose print default the claim cancels.
 */
export function createToolShortcuts(params: CreateToolShortcutsParams): KeyHandler {
  return (event: KeyboardEvent): boolean => {
    const mod = isModKeyPressed(event);

    // Before mod-only chords: Shift+E must not require Cmd (DevTools owns those).
    if (
      !mod &&
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      keyMatchesLetterOrCode(event, KEY.E, "KeyE")
    ) {
      openQuickInsert(params, event);
      return true;
    }

    if (mod && keyMatchesLetter(event, KEY.F)) {
      claimShortcutEvent(event);
      params.onOpenSearch?.();
      return true;
    }

    // Plain `/`, whatever modifier the layout needs to type it (Shift on some).
    if (!mod && !event.ctrlKey && !event.metaKey && keyIs(event, KEY.SLASH)) {
      openQuickInsert(params, event);
      return true;
    }

    if (
      !mod &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key.length === 1 &&
      params.onInsertTool?.(event.key.toLowerCase())
    ) {
      claimShortcutEvent(event);
      return true;
    }

    if (mod && !event.shiftKey && keyMatchesLetter(event, KEY.K)) {
      claimShortcutEvent(event);
      params.onOpenCatalog?.();
      return true;
    }

    if (mod && !event.shiftKey && keyMatchesLetter(event, KEY.P)) {
      claimShortcutEvent(event);
      params.onOpenCommandPalette?.();
      return true;
    }

    if (mod && keyMatchesLetter(event, KEY.B)) {
      claimShortcutEvent(event);
      params.onToggleDiagramSidebar?.();
      return true;
    }

    if (mod && keyIs(event, KEY.SLASH)) {
      claimShortcutEvent(event);
      params.onOpenSearch?.();
      return true;
    }

    if (createC4Element(params, event)) return true;

    return false;
  };
}

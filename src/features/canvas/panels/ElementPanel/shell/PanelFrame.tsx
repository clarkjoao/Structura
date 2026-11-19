import { useContext, useRef, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, PanelRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ELEMENT_PANEL_MAX_WIDTH,
  ELEMENT_PANEL_MIN_WIDTH,
  useCanvasPreferencesStore,
} from "@/features/canvas/preferences";
import { PanelRailButton } from "@/components/PanelRail";
import { PanelRailContext } from "@/components/panelRail.context";

import { PanelFrameContext, usePanelFrame } from "./panelFrame.context";

const KEYBOARD_STEP = 16;

/**
 * The inspector's outer frame: a docked column that resizes from its left edge and folds to a
 * rail. It sits beside the canvas in the same flex row, so the canvas — and its fit and scroll —
 * always measures what is left, never what is behind the panel.
 */
export function PanelFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const width = useCanvasPreferencesStore((s) => s.elementPanelWidth);
  const collapsed = useCanvasPreferencesStore((s) => s.elementPanelCollapsed);
  const setWidth = useCanvasPreferencesStore((s) => s.setElementPanelWidth);
  const setCollapsed = useCanvasPreferencesStore((s) => s.setElementPanelCollapsed);
  const hasRail = useContext(PanelRailContext);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  const clamp = (value: number) =>
    Math.min(ELEMENT_PANEL_MAX_WIDTH, Math.max(ELEMENT_PANEL_MIN_WIDTH, value));

  if (collapsed) {
    // The page's rail expands it again.
    if (hasRail) return null;
    return (
      <div className="flex h-full w-8 shrink-0 flex-col items-center border-l border-border bg-card pt-2">
        <button
          type="button"
          title={t("panelShell.expand")}
          aria-label={t("panelShell.expand")}
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <PanelFrameContext.Provider value={{ collapse: () => setCollapsed(true) }}>
      <div
        style={{ width: dragWidth ?? width }}
        className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-card"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("panelShell.resize")}
          aria-valuemin={ELEMENT_PANEL_MIN_WIDTH}
          aria-valuemax={ELEMENT_PANEL_MAX_WIDTH}
          aria-valuenow={dragWidth ?? width}
          tabIndex={0}
          className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startRef.current = { x: event.clientX, width };
          }}
          onPointerMove={(event) => {
            const start = startRef.current;
            if (!start) return;
            // The handle is on the left edge: dragging left widens the panel.
            setDragWidth(clamp(start.width + (start.x - event.clientX)));
          }}
          onPointerUp={(event) => {
            const start = startRef.current;
            startRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (start) setWidth(clamp(start.width + (start.x - event.clientX)));
            setDragWidth(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setWidth(width + KEYBOARD_STEP);
            else if (event.key === "ArrowRight") setWidth(width - KEYBOARD_STEP);
          }}
        />
        {children}
      </div>
    </PanelFrameContext.Provider>
  );
}

export function PanelCollapseButton() {
  const { t } = useTranslation();
  const frame = usePanelFrame();
  if (!frame) return null;
  return (
    <button
      type="button"
      title={t("panelShell.collapse")}
      aria-label={t("panelShell.collapse")}
      onClick={frame.collapse}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ChevronsRight className="h-4 w-4" />
    </button>
  );
}

/** The inspector's button on the panel rail: folds the panel away and brings it back. */
export function InspectorRailToggle({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const collapsed = useCanvasPreferencesStore((s) => s.elementPanelCollapsed);
  const setCollapsed = useCanvasPreferencesStore((s) => s.setElementPanelCollapsed);
  return (
    <PanelRailButton
      label={t("panelShell.inspector")}
      icon={<PanelRight className="h-4 w-4" />}
      active={!collapsed && !disabled}
      disabled={disabled}
      onClick={() => setCollapsed(!collapsed)}
    />
  );
}

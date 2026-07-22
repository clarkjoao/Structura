import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { PluginPanelProps } from "../types/plugin.types";
import { LABELS, t } from "../i18n/labels";
import { getApi, openModal, showToast } from "../hooks/usePluginApi";
import { ModalContent } from "./ModalContent";

const POSITION_STORAGE_KEY = "floating-panel-position";
const DEFAULT_POSITION: PanelPosition = { x: 150, y: 100 };

type PanelState = "hidden" | "expanded" | "minimized";
interface PanelPosition {
  x: number;
  y: number;
}

// Icons are ordinary module-level components — React is shared from the host, so there is no
// "define components only after getReact()" dance anymore.
function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function Maximize2Icon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}

/**
 * Canvas-toolbar panel: a button that opens a draggable floating panel demonstrating toasts,
 * a modal, and diagram reads. Plain React throughout — hooks imported from "react", JSX with
 * the automatic runtime, host theme tokens (so it follows light/dark), and api.storage for
 * persistence instead of touching localStorage directly.
 */
export function ToolbarButton({ context }: PluginPanelProps) {
  const locale = (context.locale || "en") as "en" | "pt-BR";
  const isEditMode = context.isEditMode !== false;
  const api = getApi();

  const [panelState, setPanelState] = useState<PanelState>("hidden");
  const [position, setPosition] = useState<PanelPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep a live ref to the latest position so the (stable) mouseup handler can persist it.
  const positionRef = useRef(position);
  positionRef.current = position;

  // Load the persisted position through the sanctioned plugin storage (async, per-plugin).
  useEffect(() => {
    let cancelled = false;
    api.storage
      .get<PanelPosition>(POSITION_STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setPosition(saved);
        }
      })
      .catch(() => {
        /* first run / storage unavailable — keep the default */
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const diagramId = api.getActiveDiagramId();
  const diagram = diagramId ? api.getDiagram(diagramId) : null;

  const persistPosition = useCallback(() => {
    void api.storage.set(POSITION_STORAGE_KEY, positionRef.current);
  }, [api]);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    },
    [dragOffset],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    persistPosition();
  }, [persistPosition]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toast = (
    type: "success" | "error" | "warning" | "info",
    titleKey: keyof typeof LABELS.toasts,
    descKey: keyof typeof LABELS.toasts,
  ) => {
    showToast({
      type,
      title: t(LABELS.toasts[titleKey], locale),
      description: t(LABELS.toasts[descKey], locale),
    });
  };

  const showActionToast = () => {
    showToast({
      type: "success",
      title: t(LABELS.toasts.actionAvailable, locale),
      description: t(LABELS.toasts.actionAvailableDesc, locale),
      action: {
        label: t(LABELS.toasts.doSomething, locale),
        onClick: () =>
          showToast({
            type: "info",
            title: t(LABELS.toasts.actionExecuted, locale),
            duration: 2000,
          }),
      },
      duration: 8000,
    });
  };

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.modal.title, locale),
      content: ({ onClose }) => <ModalContent onClose={onClose} locale={locale} />,
      size: "md",
    });
  };

  if (panelState === "hidden") {
    return (
      <button
        type="button"
        onClick={() => setPanelState("expanded")}
        disabled={!isEditMode}
        title={!isEditMode ? t(LABELS.toolbar.readOnly, locale) : t(LABELS.toolbar.button, locale)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SparklesIcon size={14} />
        <span>{t(LABELS.toolbar.button, locale)}</span>
      </button>
    );
  }

  if (panelState === "minimized") {
    return (
      <div
        className="fixed z-[9999] cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        style={{ left: position.x, top: position.y }}
      >
        <div
          onClick={() => setPanelState("expanded")}
          className="flex items-center gap-2 bg-muted/50 px-3 py-2"
        >
          <SparklesIcon size={16} />
          <span className="text-sm font-semibold text-foreground">
            {t(LABELS.toolbar.button, locale)}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">▼</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      onMouseDown={handleMouseDown}
      className="fixed z-[9999] w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      style={{
        left: position.x,
        top: position.y,
        userSelect: isDragging ? "none" : "auto",
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Header (drag handle) */}
      <div
        data-drag-handle
        className="flex cursor-grab items-center justify-between border-b border-border bg-muted/50 px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <SparklesIcon size={18} />
          <span className="text-sm font-semibold text-foreground">
            {t(LABELS.toolbar.button, locale)}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setPanelState("minimized")}
            title="Minimize"
            aria-label="Minimize"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            —
          </button>
          <button
            type="button"
            onClick={() => {
              persistPosition();
              setPanelState("hidden");
            }}
            title={t(LABELS.panel.closeAria, locale)}
            aria-label={t(LABELS.panel.closeAria, locale)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-3">
        <div className="rounded-md border border-border bg-muted/50 p-2.5">
          <div className="text-xs font-semibold text-foreground">
            {diagram ? diagram.name : t(LABELS.modal.noDiagram, locale)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {diagram
              ? `${diagram.components.length} components · ${diagram.connections.length} connections`
              : t(LABELS.modal.openDiagram, locale)}
          </div>
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Toast Notifications
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <ToastButton
            className="text-emerald-600 dark:text-emerald-400"
            onClick={() => toast("success", "success", "successDesc")}
          >
            ✓ Success
          </ToastButton>
          <ToastButton
            className="text-destructive"
            onClick={() => toast("error", "error", "errorDesc")}
          >
            ✕ Error
          </ToastButton>
          <ToastButton
            className="text-amber-600 dark:text-amber-400"
            onClick={() => toast("warning", "warning", "warningDesc")}
          >
            ⚠ Warning
          </ToastButton>
          <ToastButton
            className="text-blue-600 dark:text-blue-400"
            onClick={() => toast("info", "info", "infoDesc")}
          >
            ℹ Info
          </ToastButton>
        </div>

        <button
          type="button"
          onClick={showActionToast}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <SparklesIcon size={14} />
          Toast with Action
        </button>
        <button
          type="button"
          onClick={openConfigModal}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Maximize2Icon size={14} />
          {t(LABELS.toolbar.modal, locale)}
        </button>

        <div className="border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
          {t(LABELS.plugin.description, locale)}
        </div>
      </div>
    </div>
  );
}

function ToastButton({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { FC, MouseEvent, CSSProperties } from "react";
import type { DiagramSnapshot, PluginPanelProps } from "../types/plugin.types";
import { LABELS, t, type Locale } from "../i18n/labels";
import { showToast, openModal, getApi } from "../hooks/usePluginApi";
import { LeanixConfigModal } from "./LeanixConfigModal";
import { exportDiagram, getDiagramUrl, exportDrawio, classifyError } from "../services";
import { useLeanixConfig } from "../hooks/useLeanixConfig";

// Lucide-style SVG icons
const HardDriveUploadIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
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
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const SettingsIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
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
    className={className}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const POSITION_STORAGE_KEY = "leanix-floating-panel-position";

type SendStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; action: "created" | "updated"; bookmarkId: string; diagramName: string }
  | { kind: "error"; reason: string };

interface PanelPosition {
  x: number;
  y: number;
}

// Module-level cache so panel position is available immediately when the host re-renders
const DEFAULT_POSITION: PanelPosition = { x: 100, y: 100 };
let cachedPosition: PanelPosition = { ...DEFAULT_POSITION };
let positionInitialized = false;

function loadSavedPosition(): PanelPosition {
  // Return cached value synchronously; async hydration happens in useEffect
  if (positionInitialized) return cachedPosition;
  positionInitialized = true;
  return cachedPosition;
}

function savePosition(pos: PanelPosition): void {
  cachedPosition = pos;
  void getApi().storage.set(POSITION_STORAGE_KEY, JSON.stringify(pos));
}

function parsePosition(raw: string | null): PanelPosition | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch { /* ignore */ }
  return null;
}

/**
 * Format a past timestamp as a short relative string.
 */
function formatRelative(ms: number, locale: Locale): string {
  const diff = Date.now() - ms;
  if (diff < 45_000) return t(LABELS.panel.justNow, locale);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} ${t(LABELS.panel.minutesAgo, locale)}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t(LABELS.panel.hoursAgo, locale)}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t(LABELS.panel.daysAgo, locale)}`;
}

function approxKb(graphXml: string): string {
  const bytes = graphXml.length * 2;
  const kb = bytes / 1024;
  if (kb < 1) return "<1";
  if (kb < 10) return kb.toFixed(1);
  return Math.round(kb).toString();
}

/** Abstract preview — a small schematic suggesting the shape of an export. */
function AbstractPreview({ showLabels }: { showLabels: boolean }) {
  return (
    <div className="flex items-center justify-center p-2.5 rounded-md bg-muted min-h-[76px]">
      <svg width="180" height="56" viewBox="0 0 180 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect key="b1" x={6} y={16} width={44} height={24} rx={4} fill="#ffffff" stroke="#d1d5db" strokeWidth={1.5} />
        <rect key="b2" x={72} y={8} width={44} height={24} rx={4} fill="#ffffff" stroke="#d1d5db" strokeWidth={1.5} />
        <rect key="b3" x={72} y={36} width={44} height={24} rx={4} fill="#ffffff" stroke="#d1d5db" strokeWidth={1.5} />
        <rect key="b4" x={138} y={16} width={36} height={24} rx={4} fill="#ffffff" stroke="#d1d5db" strokeWidth={1.5} />
        <path key="e12" d="M50 24 L70 16" stroke="#6b7280" strokeWidth={1.2} fill="none" markerEnd="url(#arrowhead)" />
        <path key="e13" d="M50 32 L70 44" stroke="#6b7280" strokeWidth={1.2} fill="none" markerEnd="url(#arrowhead)" />
        <path key="e24" d="M116 20 L136 24" stroke="#6b7280" strokeWidth={1.2} fill="none" markerEnd="url(#arrowhead)" />
        <path key="e34" d="M116 44 L136 32" stroke="#6b7280" strokeWidth={1.2} fill="none" markerEnd="url(#arrowhead)" />
        <defs>
          <marker id="arrowhead" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="#6b7280" />
          </marker>
        </defs>
        {showLabels && (
          <g>
            <text x={28} y={50} textAnchor="middle" fontSize={6} fill="#6b7280">label</text>
            <text x={94} y={50} textAnchor="middle" fontSize={6} fill="#6b7280">label</text>
            <text x={156} y={50} textAnchor="middle" fontSize={6} fill="#6b7280">label</text>
          </g>
        )}
      </svg>
    </div>
  );
}

interface FloatingPanelProps extends PluginPanelProps {
  position: PanelPosition;
  onPositionChange: (pos: PanelPosition) => void;
  onMinimize: () => void;
  onClose: () => void;
}

function FloatingPanel({ context, position, onPositionChange, onMinimize, onClose }: FloatingPanelProps) {
  const locale = (context?.locale || "en") as Locale;
  const api = getApi();
  const diagram: DiagramSnapshot | null = api.getDiagram();
  const { config: currentConfig, isConfigured } = useLeanixConfig();

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Panel local state
  const [includeLabels, setIncludeLabels] = useState(true);
  const [autoArrange, setAutoArrange] = useState(true);
  const [status, setStatus] = useState<SendStatus>({ kind: "idle" });
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  // Tick to refresh "X ago" every 30s while the panel is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Progress bar driven by requestAnimationFrame while sending
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status.kind !== "sending") return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const el = progressRef.current;
      if (el) {
        const phase = ((now - start) % 1200) / 1200;
        const eased = phase < 0.5
          ? 2 * phase * phase
          : 1 - Math.pow(-2 * phase + 2, 2) / 2;
        const pct = Math.round((eased * 200 - 100) * 100) / 100;
        el.style.transform = `translateX(${pct}%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status.kind]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }
  }, [isDragging, dragOffset, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    savePosition(position);
  }, [position]);

  useEffect(() => {
    if (isDragging) {
      const onMove = (e: MouseEvent) => handleMouseMove(e);
      const onUp = () => handleMouseUp();
      window.addEventListener("mousemove", onMove as unknown as EventListener);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove as unknown as EventListener);
        window.removeEventListener("mouseup", onUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.config.title, locale),
      content: LeanixConfigModal,
      size: "md",
    });
  };

  const runSend = useCallback(async (): Promise<SendStatus> => {
    if (!diagram?.name) {
      showToast({ type: "warning", title: t(LABELS.toasts.noName, locale), duration: 5000 });
      return { kind: "error", reason: t(LABELS.toasts.noName, locale) };
    }
    if (!currentConfig) {
      showToast({ type: "warning", title: t(LABELS.toasts.notConfigured, locale), duration: 5000 });
      return { kind: "error", reason: t(LABELS.toasts.notConfigured, locale) };
    }

    setStatus({ kind: "sending" });
    try {
      const graphXml = exportDrawio(diagram);
      const result = await exportDiagram(currentConfig, diagram.name, graphXml, currentConfig.userId);
      const next: SendStatus = {
        kind: "success",
        action: result.action,
        bookmarkId: result.bookmark.id,
        diagramName: diagram.name,
      };
      setStatus(next);
      setLastSentAt(Date.now());
      return next;
    } catch (error) {
      console.error("[Leanix Plugin] Export failed:", error);
      const reason = classifyError(error);
      setStatus({ kind: "error", reason });
      return { kind: "error", reason };
    }
  }, [diagram, currentConfig, locale]);

  const handleSend = () => { void runSend(); };

  const sizeKb = useMemo(() => {
    if (!diagram) return "0";
    try {
      return approxKb(exportDrawio(diagram));
    } catch {
      return "—";
    }
  }, [diagram]);

  const componentCount = diagram?.components.length ?? 0;
  const connectionCount = diagram?.connections.length ?? 0;

  let sendDisabled = false;
  let sendTitle = "";
  if (!isConfigured || !currentConfig) {
    sendDisabled = true;
    sendTitle = t(LABELS.toolbar.tooltipNoConfig, locale);
  } else if (!diagram?.name) {
    sendDisabled = true;
    sendTitle = t(LABELS.toolbar.tooltipNoName, locale);
  } else if (status.kind === "sending") {
    sendDisabled = true;
    sendTitle = t(LABELS.status.sending, locale);
  }

  return (
    <div
      ref={panelRef}
      onMouseDown={handleMouseDown}
      className="fixed w-[280px] bg-card border border-border rounded-lg shadow-lg z-[9999] overflow-hidden select-none"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? "grabbing" : "default",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Header (draggable) */}
      <div
        data-drag-handle
        className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted cursor-grab"
      >
        <div className="flex items-center gap-1.5">
          <HardDriveUploadIcon size={16} />
          <span className="text-[13px] font-semibold text-foreground">
            {t(LABELS.panel.title, locale)}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onMinimize}
            title="Minimizar"
            aria-label="Minimizar"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            —
          </button>
          <button
            type="button"
            onClick={openConfigModal}
            title={t(LABELS.config.title, locale)}
            aria-label={t(LABELS.panel.settingsAria, locale)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <SettingsIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={t(LABELS.panel.closeAria, locale)}
            aria-label={t(LABELS.panel.closeAria, locale)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2.5">
        {/* Diagram info */}
        <div className="flex flex-col gap-0.5">
          <div
            className="text-[13px] font-medium text-foreground truncate"
            title={diagram?.name ?? ""}
          >
            {diagram?.name || "—"}
          </div>
          <div className="flex gap-2 text-[11px] text-muted-foreground">
            <span>{`${componentCount} ${t(LABELS.panel.components, locale)}`}</span>
            <span>·</span>
            <span>{`${connectionCount} ${t(LABELS.panel.connections, locale)}`}</span>
            <span>·</span>
            <span>{`${sizeKb} KB`}</span>
          </div>
        </div>

        {/* Abstract preview */}
        <AbstractPreview showLabels={includeLabels} />

        {/* Options */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[12px] cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={includeLabels}
              onChange={(e) => setIncludeLabels(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            {t(LABELS.panel.includeLabels, locale)}
          </label>
          <label className="flex items-center gap-1.5 text-[12px] cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={autoArrange}
              onChange={(e) => setAutoArrange(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            {t(LABELS.panel.autoArrange, locale)}
          </label>
        </div>

        {/* Status area */}
        {status.kind === "sending" && (
          <div className="p-2.5 bg-muted border border-border rounded-md flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-foreground">
              <span>⏳</span>
              {t(LABELS.status.sending, locale)}
            </div>
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <div
                ref={progressRef}
                className="h-full bg-primary rounded-full"
                style={{ width: "40%", transform: "translateX(-100%)", willChange: "transform" }}
              />
            </div>
          </div>
        )}

        {status.kind === "success" && (
          <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-foreground">
              <span className="text-primary">✓</span>
              {t(LABELS.status.success, locale)}
            </div>
            <div className="text-[11px] text-muted-foreground truncate" title={status.diagramName}>
              {`${status.action === "created" ? t(LABELS.status.successCreated, locale) : t(LABELS.status.successUpdated, locale)} · ${status.diagramName}`}
            </div>
            <div className="flex gap-1.5">
              {currentConfig && (
                <button
                  type="button"
                  onClick={() => window.open(getDiagramUrl(currentConfig, status.bookmarkId), "_blank")}
                  className="flex-1 px-2 py-1 text-[11px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t(LABELS.status.openInLeanix, locale)}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted"
              >
                {t(LABELS.status.dismiss, locale)}
              </button>
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div className="p-2.5 bg-destructive/5 border border-destructive/20 rounded-md flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-destructive">
              <span>⚠</span>
              {status.reason}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleSend}
                className="flex-1 px-2 py-1 text-[11px] font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t(LABELS.status.retry, locale)}
              </button>
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted"
              >
                {t(LABELS.status.dismiss, locale)}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5 mt-0.5">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0">
            {lastSentAt ? (
              <span
                title={new Date(lastSentAt).toLocaleString()}
                className="truncate"
              >
                {`${t(LABELS.panel.lastSent, locale)} ${formatRelative(lastSentAt, locale)}`}
              </span>
            ) : (
              <span>{t(LABELS.panel.lastSentNever, locale)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={sendDisabled ? undefined : handleSend}
            disabled={sendDisabled}
            title={sendTitle}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md border-none transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ background: sendDisabled ? "#e5e7eb" : "var(--primary)", color: sendDisabled ? "#9ca3af" : "var(--primary-foreground)" }}
          >
            {status.kind === "sending" ? (
              "..."
            ) : (
              <span className="flex items-center gap-1.5">
                <HardDriveUploadIcon size={14} />
                {t(LABELS.toolbar.button, locale)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MinimizedPanelProps extends PluginPanelProps {
  position: PanelPosition;
  onExpand: () => void;
}

function MinimizedPanel({ context, position, onExpand }: MinimizedPanelProps) {
  const locale = (context?.locale || "en") as Locale;
  const { isConfigured } = useLeanixConfig();

  return (
    <div
      onClick={onExpand}
      className="fixed bg-card border border-border rounded-lg shadow-lg z-[9999] overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted">
        <HardDriveUploadIcon size={16} />
        <span className="text-[13px] font-semibold text-foreground">
          {t(LABELS.panel.title, locale)}
        </span>
        {isConfigured && (
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />
        )}
        <span className="ml-1 text-[12px] text-muted-foreground">▼</span>
      </div>
    </div>
  );
}

function ToolbarWithPanel({ context }: PluginPanelProps) {
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const { isConfigured } = useLeanixConfig();

  const [panelState, setPanelState] = useState<'hidden' | 'expanded' | 'minimized'>('hidden');
  const [position, setPosition] = useState<PanelPosition>(loadSavedPosition);

  const handleClose = () => {
    savePosition(position);
    setPanelState("hidden");
  };

  // Hydrate position from storage asynchronously (storage.get is async)
  useEffect(() => {
    let cancelled = false;
    getApi().storage.get<string>(POSITION_STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      const pos = parsePosition(raw);
      if (pos) setPosition(pos);
    });
    return () => { cancelled = true; };
  }, []);

  if (panelState === "hidden") {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setPanelState("expanded")}
          disabled={!isEditMode}
          title={!isEditMode ? t(LABELS.toolbar.tooltipReadOnly, locale) : t(LABELS.toolbar.button, locale)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HardDriveUploadIcon size={14} />
          <span>{t(LABELS.toolbar.button, locale)}</span>
          {isConfigured && (
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />
          )}
        </button>
      </div>
    );
  }

  if (panelState === "minimized") {
    return (
      <MinimizedPanel
        context={context}
        position={position}
        onExpand={() => setPanelState("expanded")}
      />
    );
  }

  return (
    <FloatingPanel
      context={context}
      position={position}
      onPositionChange={setPosition}
      onMinimize={() => setPanelState("minimized")}
      onClose={handleClose}
    />
  );
}

/** Toolbar trigger + floating panel. */
export const LeanixToolbarButton: FC<PluginPanelProps> = (props) => {
  return <ToolbarWithPanel {...props} />;
};

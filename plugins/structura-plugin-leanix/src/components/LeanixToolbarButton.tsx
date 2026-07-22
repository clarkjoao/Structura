import type { FC } from "react";
import type { DiagramSnapshot, PluginPanelProps } from "../types/plugin";
import { LABELS, t, type Locale } from "../i18n/labels";
import { showToast, openModal, getApi, getReact } from "../hooks/usePluginApi";
import { createLeanixConfigModal } from "./LeanixConfigModal";
import { exportDiagram, getDiagramUrl, exportDrawio, classifyError } from "../services";
import { useLeanixConfig } from "../hooks/useLeanixConfig";

// Lucide-style SVG icons
const iconBaseStyle = {
  display: "inline",
  verticalAlign: "middle" as const,
};

const HardDriveUploadIcon = ({ size = 16, style }: { size?: number; style?: React.CSSProperties }) => (
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
    style={{ ...iconBaseStyle, ...style }}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const SettingsIcon = ({ size = 16 }: { size?: number }) => (
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

function loadSavedPosition(): PanelPosition {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return { x: 100, y: 100 };
}

function savePosition(position: PanelPosition): void {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Ignore errors
  }
}

/**
 * Format a past timestamp as a short relative string.
 * Returns the localized "just now" / "min ago" / "h ago" / "d ago".
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
  // Approximate by UTF-16 byte count, then round to KB.
  const bytes = graphXml.length * 2;
  const kb = bytes / 1024;
  if (kb < 1) return "<1";
  if (kb < 10) return kb.toFixed(1);
  return Math.round(kb).toString();
}

/**
 * Abstract preview — a small schematic suggesting the shape of an export.
 * Not a literal render of the diagram.
 */
function AbstractPreview({ showLabels }: { showLabels: boolean }) {
  const React = getReact();
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 8px",
        background: "#f5f5f5",
        borderRadius: "6px",
        minHeight: "76px",
      },
    },
    React.createElement(
      "svg",
      {
        width: "180",
        height: "56",
        viewBox: "0 0 180 56",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": true,
      },
      // Box 1
      React.createElement("rect", {
        key: "b1",
        x: 6, y: 16, width: 44, height: 24, rx: 4,
        fill: "#ffffff",
        stroke: "#d1d5db",
        strokeWidth: 1.5,
      }),
      // Box 2
      React.createElement("rect", {
        key: "b2",
        x: 72, y: 8, width: 44, height: 24, rx: 4,
        fill: "#ffffff",
        stroke: "#d1d5db",
        strokeWidth: 1.5,
      }),
      // Box 3
      React.createElement("rect", {
        key: "b3",
        x: 72, y: 36, width: 44, height: 24, rx: 4,
        fill: "#ffffff",
        stroke: "#d1d5db",
        strokeWidth: 1.5,
      }),
      // Box 4
      React.createElement("rect", {
        key: "b4",
        x: 138, y: 16, width: 36, height: 24, rx: 4,
        fill: "#ffffff",
        stroke: "#d1d5db",
        strokeWidth: 1.5,
      }),
      // Edge 1->2
      React.createElement("path", {
        key: "e12",
        d: "M50 24 L70 16",
        stroke: "#6b7280",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 1->3
      React.createElement("path", {
        key: "e13",
        d: "M50 32 L70 44",
        stroke: "#6b7280",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 2->4
      React.createElement("path", {
        key: "e24",
        d: "M116 20 L136 24",
        stroke: "#6b7280",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 3->4
      React.createElement("path", {
        key: "e34",
        d: "M116 44 L136 32",
        stroke: "#6b7280",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Arrow marker
      React.createElement("defs", { key: "defs" },
        React.createElement("marker", {
          id: "arrowhead",
          viewBox: "0 0 8 8",
          refX: 7, refY: 4,
          markerWidth: 6, markerHeight: 6,
          orient: "auto",
        },
          React.createElement("path", {
            d: "M0 0 L8 4 L0 8 z",
            fill: "#6b7280",
          })
        )
      ),
      // Labels under the boxes if enabled
      showLabels && React.createElement(
        "g",
        { key: "labels" },
        React.createElement("text", { x: 28, y: 50, textAnchor: "middle", fontSize: "6", fill: "#6b7280" }, "label"),
        React.createElement("text", { x: 94, y: 50, textAnchor: "middle", fontSize: "6", fill: "#6b7280" }, "label"),
        React.createElement("text", { x: 156, y: 50, textAnchor: "middle", fontSize: "6", fill: "#6b7280" }, "label")
      )
    )
  );
}

interface FloatingPanelProps extends PluginPanelProps {
  position: PanelPosition;
  onPositionChange: (pos: PanelPosition) => void;
  onMinimize: () => void;
  onClose: () => void;
}

function FloatingPanel({ context, position, onPositionChange, onMinimize, onClose }: FloatingPanelProps) {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const api = getApi();
  const diagram: DiagramSnapshot | null = api.getDiagram();
  const { config: currentConfig, isConfigured } = useLeanixConfig();

  // Drag state
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Panel local state
  const [includeLabels, setIncludeLabels] = React.useState(true);
  const [autoArrange, setAutoArrange] = React.useState(true);
  const [status, setStatus] = React.useState<SendStatus>({ kind: "idle" });
  const [lastSentAt, setLastSentAt] = React.useState<number | null>(null);

  // Tick to refresh "X ago" every 30s while the panel is open.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Progress bar driven by requestAnimationFrame while sending
  const progressRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
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

  // Drag handlers
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    // Only start dragging if clicking on the header area
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  }, []);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  }, [isDragging, dragOffset, onPositionChange]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    savePosition(position);
  }, [position]);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const openConfigModal = () => {
    openModal({
      title: t(LABELS.config.title, locale),
      content: createLeanixConfigModal,
      size: "md",
    });
  };

  const runSend = React.useCallback(async (): Promise<SendStatus> => {
    if (!diagram?.name) {
      showToast({
        type: "warning",
        title: t(LABELS.toasts.noName, locale),
        duration: 5000,
      });
      return { kind: "error", reason: t(LABELS.toasts.noName, locale) };
    }
    if (!currentConfig) {
      showToast({
        type: "warning",
        title: t(LABELS.toasts.notConfigured, locale),
        duration: 5000,
      });
      return { kind: "error", reason: t(LABELS.toasts.notConfigured, locale) };
    }

    setStatus({ kind: "sending" });
    try {
      const graphXml = exportDrawio(diagram);
      const result = await exportDiagram(
        currentConfig,
        diagram.name,
        graphXml,
        currentConfig.userId
      );
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

  const handleSend = () => {
    void runSend();
  };

  const componentCount = diagram?.components.length ?? 0;
  const connectionCount = diagram?.connections.length ?? 0;
  const sizeKb = React.useMemo(() => {
    if (!diagram) return "0";
    try {
      return approxKb(exportDrawio(diagram));
    } catch {
      return "—";
    }
  }, [diagram]);

  // Disabled state
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

  return React.createElement(
    "div",
    {
      ref: panelRef,
      onMouseDown: handleMouseDown,
      style: {
        position: "fixed",
        left: position.x,
        top: position.y,
        width: "280px",
        background: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 9999,
        overflow: "hidden",
        userSelect: isDragging ? "none" : "auto",
        cursor: isDragging ? "grabbing" : "default",
      },
    },
    // Header (draggable)
    React.createElement(
      "div",
      {
        "data-drag-handle": true,
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          cursor: "grab",
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "6px" } },
        React.createElement(HardDriveUploadIcon, { size: 16 }),
        React.createElement(
          "span",
          { style: { fontSize: "13px", fontWeight: 600, color: "#111827" } },
          t(LABELS.panel.title, locale)
        )
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "2px" } },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: onMinimize,
            title: "Minimizar",
            "aria-label": "Minimizar",
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              color: "#6b7280",
              fontSize: "13px",
            },
          },
          "—"
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: openConfigModal,
            title: t(LABELS.config.title, locale),
            "aria-label": t(LABELS.panel.settingsAria, locale),
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              color: "#6b7280",
              fontSize: "13px",
            },
          },
          React.createElement(SettingsIcon, { size: 16 }),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: onClose,
            title: t(LABELS.panel.closeAria, locale),
            "aria-label": t(LABELS.panel.closeAria, locale),
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              color: "#6b7280",
              fontSize: "13px",
            },
          },
          "✕"
        )
      )
    ),

    // Body
    React.createElement(
      "div",
      { style: { padding: "12px", display: "flex", flexDirection: "column", gap: "10px" } },

      // Diagram info
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        React.createElement(
          "div",
          {
            style: {
              fontSize: "13px",
              fontWeight: 500,
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            title: diagram?.name ?? "",
          },
          diagram?.name || "—"
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "8px", fontSize: "11px", color: "#6b7280" } },
          React.createElement("span", null, `${componentCount} ${t(LABELS.panel.components, locale)}`),
          React.createElement("span", null, "·"),
          React.createElement("span", null, `${connectionCount} ${t(LABELS.panel.connections, locale)}`),
          React.createElement("span", null, "·"),
          React.createElement("span", null, `${sizeKb} KB`)
        )
      ),

      // Abstract preview
      React.createElement(AbstractPreview, { showLabels: includeLabels }),

      // Options
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        React.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", color: "#111827" } },
          React.createElement("input", {
            type: "checkbox",
            checked: includeLabels,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIncludeLabels(e.target.checked),
            style: { width: "14px", height: "14px", accentColor: "#3b82f6" },
          }),
          t(LABELS.panel.includeLabels, locale)
        ),
        React.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", color: "#111827" } },
          React.createElement("input", {
            type: "checkbox",
            checked: autoArrange,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAutoArrange(e.target.checked),
            style: { width: "14px", height: "14px", accentColor: "#3b82f6" },
          }),
          t(LABELS.panel.autoArrange, locale)
        )
      ),

      // Status / feedback area
      status.kind === "sending" && React.createElement(
        "div",
        {
          style: {
            padding: "8px 10px",
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111827" } },
          React.createElement("span", { style: { fontSize: "12px" } }, "⏳"),
          t(LABELS.status.sending, locale)
        ),
        React.createElement("div", {
          style: {
            width: "100%", height: "4px", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden",
          },
        },
          React.createElement("div", {
            ref: progressRef,
            style: {
              width: "40%", height: "100%",
              background: "#3b82f6",
              borderRadius: "999px",
              transform: "translateX(-100%)",
              willChange: "transform",
            },
          })
        )
      ),

      status.kind === "success" && React.createElement(
        "div",
        {
          style: {
            padding: "8px 10px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111827" } },
          React.createElement("span", { style: { color: "#3b82f6", fontSize: "13px" } }, "✓"),
          t(LABELS.status.success, locale)
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "#6b7280",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            title: status.diagramName,
          },
          `${status.action === "created" ? t(LABELS.status.successCreated, locale) : t(LABELS.status.successUpdated, locale)} · ${status.diagramName}`
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          currentConfig && React.createElement(
            "button",
            {
              type: "button",
              onClick: () => window.open(getDiagramUrl(currentConfig, status.bookmarkId), "_blank"),
              style: {
                flex: 1,
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 500,
                borderRadius: "4px",
                border: "none",
                background: "#3b82f6",
                color: "#ffffff",
                cursor: "pointer",
              },
            },
            t(LABELS.status.openInLeanix, locale)
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: () => setStatus({ kind: "idle" }),
              style: {
                padding: "5px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "1px solid #e5e7eb",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
              },
            },
            t(LABELS.status.dismiss, locale)
          )
        )
      ),

      status.kind === "error" && React.createElement(
        "div",
        {
          style: {
            padding: "8px 10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#dc2626", fontWeight: 500 } },
          React.createElement("span", null, "⚠"),
          status.reason
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "6px" } },
          React.createElement(
            "button",
            {
              type: "button",
              onClick: handleSend,
              style: {
                flex: 1,
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 500,
                borderRadius: "4px",
                border: "none",
                background: "#dc2626",
                color: "#ffffff",
                cursor: "pointer",
              },
            },
            t(LABELS.status.retry, locale)
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: () => setStatus({ kind: "idle" }),
              style: {
                padding: "5px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "1px solid #e5e7eb",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
              },
            },
            t(LABELS.status.dismiss, locale)
          )
        )
      ),

      // Footer: last-sent + send button
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "10px",
            marginTop: "2px",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              minWidth: 0,
            },
          },
          lastSentAt
            ? React.createElement(
                "span",
                {
                  title: new Date(lastSentAt).toLocaleString(),
                  style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                },
                `${t(LABELS.panel.lastSent, locale)} ${formatRelative(lastSentAt, locale)}`
              )
            : React.createElement("span", null, t(LABELS.panel.lastSentNever, locale))
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: sendDisabled ? undefined : handleSend,
            disabled: sendDisabled,
            title: sendTitle,
            style: {
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "none",
              background: sendDisabled ? "#e5e7eb" : "#3b82f6",
              color: sendDisabled ? "#9ca3af" : "#ffffff",
              cursor: sendDisabled ? "not-allowed" : "pointer",
              opacity: sendDisabled ? 0.7 : 1,
              transition: "opacity 0.15s",
            },
          },
          status.kind === "sending"
            ? "..."
            : React.createElement("span", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" } },
                React.createElement(HardDriveUploadIcon, { size: 14 }),
                t(LABELS.toolbar.button, locale)
              )
        )
      )
    )
  );
}

interface MinimizedPanelProps extends PluginPanelProps {
  position: PanelPosition;
  onExpand: () => void;
}

function MinimizedPanel({ context, position, onExpand }: MinimizedPanelProps) {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const { isConfigured } = useLeanixConfig();

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        left: position.x,
        top: position.y,
        background: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 9999,
        overflow: "hidden",
        cursor: "pointer",
      },
    },
    React.createElement(
      "div",
      {
        onClick: onExpand,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          background: "#f9fafb",
        },
      },
      React.createElement(HardDriveUploadIcon, { size: 16 }),
      React.createElement(
        "span",
        { style: { fontSize: "13px", fontWeight: 600, color: "#111827" } },
        t(LABELS.panel.title, locale)
      ),
      isConfigured && React.createElement(
        "span",
        {
          "aria-hidden": true,
          style: {
            width: "6px", height: "6px", borderRadius: "999px",
            background: "#3b82f6",
          },
        }
      ),
      React.createElement(
        "span",
        {
          style: {
            marginLeft: "4px",
            color: "#9ca3af",
            fontSize: "12px",
          },
        },
        "▼"
      )
    )
  );
}

/**
 * Toolbar trigger + floating panel. The host renders a single component in the toolbar
 * slot; we keep the original "show a small button" trigger so the panel
 * doesn't appear on every page load, and expand into a floating draggable panel on click.
 */
function ToolbarWithPanel({ context }: PluginPanelProps) {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const { isConfigured } = useLeanixConfig();

  // Panel visibility state: 'hidden' | 'expanded' | 'minimized'
  const [panelState, setPanelState] = React.useState<'hidden' | 'expanded' | 'minimized'>('hidden');
  const [position, setPosition] = React.useState<PanelPosition>(loadSavedPosition);

  // Save position before closing
  const handleClose = () => {
    savePosition(position);
    setPanelState('hidden');
  };

  const handleMinimize = () => {
    setPanelState('minimized');
  };

  const handleExpand = () => {
    setPanelState('expanded');
  };

  if (panelState === 'hidden') {
    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "4px" } },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleExpand,
          disabled: !isEditMode,
          title: !isEditMode
            ? t(LABELS.toolbar.tooltipReadOnly, locale)
            : t(LABELS.toolbar.button, locale),
          className: "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
        },
        React.createElement(HardDriveUploadIcon, { size: 14 }),
        React.createElement("span", null, t(LABELS.toolbar.button, locale)),
        isConfigured && React.createElement(
          "span",
          {
            "aria-hidden": true,
            style: {
              width: "6px", height: "6px", borderRadius: "999px",
              background: "var(--primary)", marginLeft: "2px",
            },
          }
        )
      )
    );
  }

  if (panelState === 'minimized') {
    return React.createElement(MinimizedPanel, {
      context,
      position,
      onExpand: handleExpand,
    });
  }

  return React.createElement(FloatingPanel, {
    context,
    position,
    onPositionChange: setPosition,
    onMinimize: handleMinimize,
    onClose: handleClose,
  });
}

/**
 * Leanix Toolbar Button Component - wrapper that gets React from host
 */
export const LeanixToolbarButton: FC<PluginPanelProps> = (props) => {
  const React = getReact();
  return React.createElement(ToolbarWithPanel, props);
};

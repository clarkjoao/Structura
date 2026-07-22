import type { FC } from "react";
import type { DiagramSnapshot, PluginPanelProps } from "../types/plugin";
import { LABELS, t, type Locale } from "../i18n/labels";
import { showToast, openModal, getApi, getReact } from "../hooks/usePluginApi";
import { createLeanixConfigModal } from "./LeanixConfigModal";
import { exportDiagram, getDiagramUrl, exportDrawio, classifyError } from "../services";
import { useLeanixConfig } from "../hooks/useLeanixConfig";

type SendStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; action: "created" | "updated"; bookmarkId: string; diagramName: string }
  | { kind: "error"; reason: string };

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
        background: "var(--muted)",
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
        fill: "var(--card)",
        stroke: "var(--border)",
        strokeWidth: 1.5,
      }),
      // Box 2
      React.createElement("rect", {
        key: "b2",
        x: 72, y: 8, width: 44, height: 24, rx: 4,
        fill: "var(--card)",
        stroke: "var(--border)",
        strokeWidth: 1.5,
      }),
      // Box 3
      React.createElement("rect", {
        key: "b3",
        x: 72, y: 36, width: 44, height: 24, rx: 4,
        fill: "var(--card)",
        stroke: "var(--border)",
        strokeWidth: 1.5,
      }),
      // Box 4
      React.createElement("rect", {
        key: "b4",
        x: 138, y: 16, width: 36, height: 24, rx: 4,
        fill: "var(--card)",
        stroke: "var(--border)",
        strokeWidth: 1.5,
      }),
      // Edge 1->2
      React.createElement("path", {
        key: "e12",
        d: "M50 24 L70 16",
        stroke: "var(--muted-foreground)",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 1->3
      React.createElement("path", {
        key: "e13",
        d: "M50 32 L70 44",
        stroke: "var(--muted-foreground)",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 2->4
      React.createElement("path", {
        key: "e24",
        d: "M116 20 L136 24",
        stroke: "var(--muted-foreground)",
        strokeWidth: 1.2,
        fill: "none",
        markerEnd: "url(#arrowhead)",
      }),
      // Edge 3->4
      React.createElement("path", {
        key: "e34",
        d: "M116 44 L136 32",
        stroke: "var(--muted-foreground)",
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
            fill: "var(--muted-foreground)",
          })
        )
      ),
      // Labels under the boxes if enabled
      showLabels && React.createElement(
        "g",
        { key: "labels" },
        React.createElement("text", { x: 28, y: 50, textAnchor: "middle", fontSize: "6", fill: "var(--muted-foreground)" }, "label"),
        React.createElement("text", { x: 94, y: 50, textAnchor: "middle", fontSize: "6", fill: "var(--muted-foreground)" }, "label"),
        React.createElement("text", { x: 156, y: 50, textAnchor: "middle", fontSize: "6", fill: "var(--muted-foreground)" }, "label")
      )
    )
  );
}

interface PanelContentProps extends PluginPanelProps {
  onClose: () => void;
}

function PanelContent({ context, onClose }: PanelContentProps) {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const api = getApi();
  const diagram: DiagramSnapshot | null = api.getDiagram();
  const { config: currentConfig, isConfigured } = useLeanixConfig();

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

  // Progress bar driven by requestAnimationFrame while sending, so we don't
  // need a separate stylesheet (the host only loads plugin.js).
  const progressRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (status.kind !== "sending") return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const el = progressRef.current;
      if (el) {
        // 1200ms loop: ease-in-out from -100% to +100%.
        const phase = ((now - start) % 1200) / 1200;
        const eased = phase < 0.5
          ? 2 * phase * phase
          : 1 - Math.pow(-2 * phase + 2, 2) / 2;
        const pct = Math.round((eased * 200 - 100) * 100) / 100; // -100..+100
        el.style.transform = `translateX(${pct}%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status.kind]);

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

  // We intentionally do not auto-clear the success/error banner —
  // it stays until the user dismisses it or triggers another send.
  const handleSend = () => {
    void runSend();
  };

  // Compute stats from the diagram (cheap, in-memory). Memoize the size
  // estimate since it depends only on the diagram, not the local UI state
  // (checkboxes are currently advisory — the export pipeline doesn't yet
  // filter labels/auto-arrange, so the XML is stable across toggle changes).
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

  // Disabled state.
  let sendDisabled = false;
  let sendTitle = "";
  if (!isEditMode) {
    sendDisabled = true;
    sendTitle = t(LABELS.toolbar.tooltipReadOnly, locale);
  } else if (!isConfigured || !currentConfig) {
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
      className: "rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-sm",
      style: { width: "260px", padding: "0" },
    },
    // Header
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "6px", minWidth: 0 } },
        React.createElement("span", { style: { fontSize: "14px" } }, "📤"),
        React.createElement(
          "span",
          { style: { fontSize: "13px", fontWeight: 600, color: "var(--foreground)" } },
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
            onClick: openConfigModal,
            title: t(LABELS.config.title, locale),
            "aria-label": t(LABELS.panel.settingsAria, locale),
            style: {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              color: "var(--muted-foreground)",
              fontSize: "13px",
            },
          },
          "⚙"
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
              color: "var(--muted-foreground)",
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
      { style: { padding: "10px", display: "flex", flexDirection: "column", gap: "10px" } },

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
              color: "var(--foreground)",
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
          { style: { display: "flex", gap: "8px", fontSize: "11px", color: "var(--muted-foreground)" } },
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
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", color: "var(--foreground)" } },
          React.createElement("input", {
            type: "checkbox",
            checked: includeLabels,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setIncludeLabels(e.target.checked),
            style: { width: "14px", height: "14px", accentColor: "var(--primary)" },
          }),
          t(LABELS.panel.includeLabels, locale)
        ),
        React.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", color: "var(--foreground)" } },
          React.createElement("input", {
            type: "checkbox",
            checked: autoArrange,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAutoArrange(e.target.checked),
            style: { width: "14px", height: "14px", accentColor: "var(--primary)" },
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
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--foreground)" } },
          React.createElement("span", { style: { fontSize: "12px" } }, "⏳"),
          t(LABELS.status.sending, locale)
        ),
        React.createElement("div", {
          style: {
            width: "100%", height: "4px", background: "var(--border)", borderRadius: "999px", overflow: "hidden",
          },
        },
          React.createElement("div", {
            ref: progressRef,
            style: {
              width: "40%", height: "100%",
              background: "var(--primary)",
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
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--foreground)" } },
          React.createElement("span", { style: { color: "var(--primary)", fontSize: "13px" } }, "✓"),
          t(LABELS.status.success, locale)
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "var(--muted-foreground)",
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
                background: "var(--primary)",
                color: "var(--primary-foreground)",
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
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted-foreground)",
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
            background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--destructive) 35%, transparent)",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--destructive)", fontWeight: 500 } },
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
                background: "var(--destructive)",
                color: "var(--destructive-foreground, white)",
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
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted-foreground)",
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
            borderTop: "1px solid var(--border)",
            paddingTop: "8px",
            marginTop: "2px",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "var(--muted-foreground)",
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
              background: sendDisabled ? "var(--muted)" : "var(--primary)",
              color: sendDisabled ? "var(--muted-foreground)" : "var(--primary-foreground)",
              cursor: sendDisabled ? "not-allowed" : "pointer",
              opacity: sendDisabled ? 0.7 : 1,
              transition: "opacity 0.15s",
            },
          },
          status.kind === "sending" ? "..." : t(LABELS.toolbar.button, locale)
        )
      )
    )
  );
}

/**
 * Toolbar trigger + panel. The host renders a single component in the toolbar
 * slot; we keep the original "show a small button" trigger so the panel
 * doesn't appear on every page load, and expand into the full panel on click.
 */
function ToolbarWithPanel({ context }: PluginPanelProps) {
  const React = getReact();
  const locale = (context?.locale || "en") as Locale;
  const isEditMode = context?.isEditMode !== false;
  const { isConfigured } = useLeanixConfig();
  const [open, setOpen] = React.useState(false);

  if (!open) {
    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "4px" } },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => setOpen(true),
          disabled: !isEditMode,
          title: !isEditMode
            ? t(LABELS.toolbar.tooltipReadOnly, locale)
            : t(LABELS.toolbar.button, locale),
          className: "flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
        },
        React.createElement("span", null, "📤"),
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

  return React.createElement(PanelContent, { context, onClose: () => setOpen(false) });
}

/**
 * Leanix Toolbar Button Component - wrapper that gets React from host
 */
export const LeanixToolbarButton: FC<PluginPanelProps> = (props) => {
  const React = getReact();
  return React.createElement(ToolbarWithPanel, props);
};

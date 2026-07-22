import type { ReactElement } from "react";
import type { PanelContext } from "../types/plugin";
import { LABELS, t } from "../i18n/labels";
import { showToast, openModal, getApi, getReact } from "../hooks/usePluginApi";
import { createModalContent } from "./ModalContent";

const POSITION_STORAGE_KEY = "example-floating-panel-position";

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
  return { x: 150, y: 100 };
}

function savePosition(position: PanelPosition): void {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Factory function pattern - React is obtained BEFORE defining components
// ============================================================================

export function createToolbarButton({ context }: { context: PanelContext }): ReactElement {
  const React = getReact();
  const locale = (context?.locale || "en") as "en" | "pt-BR";
  const isEditMode = context?.isEditMode !== false;
  const api = getApi();

  // ============================================================================
  // Icons - defined inside so they have access to React via closure
  // ============================================================================

  const SparklesIcon = ({ size = 16 }: { size?: number }) => (
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

  const Maximize2Icon = ({ size = 16 }: { size?: number }) => (
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

  // ============================================================================
  // Internal React components (must start with uppercase to be valid components)
  // ============================================================================

  function FloatingPanelComponent() {
    const [panelState, setPanelState] = React.useState<'hidden' | 'expanded' | 'minimized'>('hidden');
    const [position, setPosition] = React.useState<PanelPosition>(loadSavedPosition);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
    const panelRef = React.useRef<HTMLDivElement>(null);

    const diagramId = api.getActiveDiagramId();
    const diagram = diagramId ? api.getDiagram(diagramId) : null;

    const showSuccessToast = () => {
      showToast({ type: "success", title: t(LABELS.toasts.success, locale), description: t(LABELS.toasts.successDesc, locale) });
    };
    const showErrorToast = () => {
      showToast({ type: "error", title: t(LABELS.toasts.error, locale), description: t(LABELS.toasts.errorDesc, locale) });
    };
    const showWarningToast = () => {
      showToast({ type: "warning", title: t(LABELS.toasts.warning, locale), description: t(LABELS.toasts.warningDesc, locale) });
    };
    const showInfoToast = () => {
      showToast({ type: "info", title: t(LABELS.toasts.info, locale), description: t(LABELS.toasts.infoDesc, locale) });
    };
    const showActionToast = () => {
      showToast({
        type: "success",
        title: t(LABELS.toasts.actionAvailable, locale),
        description: t(LABELS.toasts.actionAvailableDesc, locale),
        action: { label: t(LABELS.toasts.doSomething, locale), onClick: () => showToast({ type: "info", title: t(LABELS.toasts.actionExecuted, locale), duration: 2000 }) },
        duration: 8000,
      });
    };
    const openConfigModal = () => {
      openModal({ title: t(LABELS.modal.title, locale), content: createModalContent, size: "md" });
    };

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
        setIsDragging(true);
        const rect = panelRef.current?.getBoundingClientRect();
        if (rect) setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }, []);

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (isDragging) setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    }, [isDragging, dragOffset]);

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

    if (panelState === 'hidden') {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setPanelState('expanded')}
            disabled={!isEditMode}
            title={!isEditMode ? t(LABELS.toolbar.readOnly, locale) : t(LABELS.toolbar.button, locale)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <SparklesIcon size={14} />
            <span>{t(LABELS.toolbar.button, locale)}</span>
          </button>
        </div>
      );
    }

    const buttonBaseStyle: React.CSSProperties = {
      padding: "8px 12px", borderRadius: "6px", border: "1px solid #e5e7eb",
      background: "#f9fafb", cursor: "pointer", fontSize: "12px", fontWeight: 500,
      display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s ease",
    };

    if (panelState === 'minimized') {
      return (
        <div style={{ position: "fixed", left: position.x, top: position.y, background: "#ffffff", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)", zIndex: 9999, overflow: "hidden", cursor: "pointer" }}>
          <div onClick={() => setPanelState('expanded')} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#f9fafb" }}>
            <SparklesIcon size={16} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{t(LABELS.toolbar.button, locale)}</span>
            <span style={{ marginLeft: "4px", color: "#9ca3af", fontSize: "12px" }}>▼</span>
          </div>
        </div>
      );
    }

    return (
      <div ref={panelRef} onMouseDown={handleMouseDown} style={{ position: "fixed", left: position.x, top: position.y, width: "320px", background: "#ffffff", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)", zIndex: 9999, overflow: "hidden", userSelect: isDragging ? "none" : "auto", cursor: isDragging ? "grabbing" : "default" }}>
        {/* Header */}
        <div data-drag-handle style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", cursor: "grab" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SparklesIcon size={18} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{t(LABELS.toolbar.button, locale)}</span>
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <button type="button" onClick={() => setPanelState('minimized')} title="Minimizar" aria-label="Minimizar" style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "4px", color: "#6b7280", fontSize: "13px" }}>—</button>
            <button type="button" onClick={() => { savePosition(position); setPanelState('hidden'); }} title={t(LABELS.panel.closeAria, locale)} aria-label={t(LABELS.panel.closeAria, locale)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "4px", color: "#6b7280", fontSize: "13px" }}>✕</button>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ padding: "10px", background: "#f3f4f6", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", marginBottom: "4px" }}>{diagram ? diagram.name : t(LABELS.modal.noDiagram, locale)}</div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>{diagram ? `${diagram.components.length} components · ${diagram.connections.length} connections` : t(LABELS.modal.openDiagram, locale)}</div>
          </div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Toast Notifications</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button type="button" onClick={showSuccessToast} style={{ ...buttonBaseStyle, color: "#16a34a" }}>✓ Success</button>
            <button type="button" onClick={showErrorToast} style={{ ...buttonBaseStyle, color: "#dc2626" }}>✕ Error</button>
            <button type="button" onClick={showWarningToast} style={{ ...buttonBaseStyle, color: "#d97706" }}>⚠ Warning</button>
            <button type="button" onClick={showInfoToast} style={{ ...buttonBaseStyle, color: "#2563eb" }}>ℹ Info</button>
          </div>
          <button type="button" onClick={showActionToast} style={{ ...buttonBaseStyle, width: "100%", justifyContent: "center", background: "#3b82f6", color: "#ffffff", border: "none" }}>
            <SparklesIcon size={14} />Toast with Action
          </button>
          <button type="button" onClick={openConfigModal} style={{ ...buttonBaseStyle, width: "100%", justifyContent: "center", background: "#f3f4f6", color: "#111827" }}>
            <Maximize2Icon size={14} />{t(LABELS.toolbar.modal, locale)}
          </button>
          <div style={{ paddingTop: "8px", borderTop: "1px solid #e5e7eb", fontSize: "10px", color: "#9ca3af", textAlign: "center" }}>
            {t(LABELS.plugin.description, locale)}
          </div>
        </div>
      </div>
    );
  }

  return <FloatingPanelComponent />;
}

/**
 * Toolbar Button Component - main entry point
 */
export function ToolbarButton(props: { context: PanelContext }): ReactElement {
  return createToolbarButton(props);
}

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance } from "@xyflow/react";
import { X } from "lucide-react";
import {
  isC4Component,
  isFlowNodeComponent,
  isNoteComponent,
  isPanelComponent,
  isProcessNodeComponent,
  type Component,
  type ComponentPatch,
} from "@/features/diagram";
import { useTheme } from "@/hooks/useTheme";

const QUICK_ACTION_PALETTE: ReadonlyArray<{ color: string; nameKey: string }> = [
  { color: "hsl(220 70% 50%)", nameKey: "colors.blue" },
  { color: "hsl(250 70% 55%)", nameKey: "colors.indigo" },
  { color: "hsl(280 65% 50%)", nameKey: "colors.purple" },
  { color: "hsl(330 75% 55%)", nameKey: "colors.pink" },
  { color: "hsl(0 70% 50%)", nameKey: "colors.red" },
  { color: "hsl(38 92% 50%)", nameKey: "colors.amber" },
  { color: "hsl(160 60% 40%)", nameKey: "colors.emerald" },
  { color: "hsl(215 25% 25%)", nameKey: "colors.slate" },
];

const OFFSET_RIGHT = 12;
const OFFSET_TOP = 8;
const VIEWPORT_MARGIN = 8;

type ColorField = "panelColor" | "panelColorDark" | "nodeColor";

function resolveColorField(component: Component, isDark: boolean): ColorField | null {
  if (isFlowNodeComponent(component) || isProcessNodeComponent(component)) return "nodeColor";
  if (isC4Component(component) || isPanelComponent(component)) {
    return isDark ? "panelColor" : "panelColor";
  }
  if (isNoteComponent(component)) {
    return isDark ? "panelColorDark" : "panelColor";
  }
  return null;
}

function readColorField(component: Component, field: ColorField): string | undefined {
  if (field === "nodeColor") {
    return "nodeColor" in component ? component.nodeColor : undefined;
  }
  if (field === "panelColor") {
    if ("panelColor" in component) {
      return (component as { panelColor?: string }).panelColor;
    }
    return undefined;
  }
  if ("panelColorDark" in component) {
    return (component as { panelColorDark?: string }).panelColorDark;
  }
  return undefined;
}

interface NodeQuickActionsProps {
  selectedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  isDarkTheme: boolean;
  onDismiss: () => void;
}

export function NodeQuickActions({
  selectedNodeId,
  reactFlowInstance,
  updateComponent,
  isDarkTheme,
  onDismiss,
}: NodeQuickActionsProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Pull the live node from React Flow every frame so the popover follows drag.
  useEffect(() => {
    if (!selectedNodeId) {
      setPosition(null);
      return;
    }
    const tick = () => {
      const node = reactFlowInstance.getNode(selectedNodeId);
      if (!node) {
        setPosition(null);
        return;
      }
      const width = node.measured?.width ?? node.width ?? 100;
      const height = node.measured?.height ?? node.height ?? 40;
      const topLeft = reactFlowInstance.flowToScreenPosition({
        x: node.position.x + width,
        y: node.position.y,
      });
      const el = containerRef.current;
      const elW = el?.offsetWidth ?? 0;
      const elH = el?.offsetHeight ?? 0;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      let left = topLeft.x + OFFSET_RIGHT;
      let top = topLeft.y - OFFSET_TOP - elH;
      if (left + elW + VIEWPORT_MARGIN > viewportW) {
        left = topLeft.x - OFFSET_RIGHT - elW;
      }
      if (top < VIEWPORT_MARGIN) {
        top = topLeft.y + height + OFFSET_TOP;
      }
      if (top + elH + VIEWPORT_MARGIN > viewportH) {
        top = Math.max(VIEWPORT_MARGIN, viewportH - elH - VIEWPORT_MARGIN);
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + elW + VIEWPORT_MARGIN > viewportW) {
        left = Math.max(VIEWPORT_MARGIN, viewportW - elW - VIEWPORT_MARGIN);
      }
      setPosition({ top, left });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reactFlowInstance, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss, selectedNodeId]);

  if (!selectedNodeId) return null;

  const node = reactFlowInstance.getNode(selectedNodeId);
  if (!node) return null;
  const component = node.data as unknown as Component | undefined;
  if (!component) return null;

  const field = resolveColorField(component, isDarkTheme);
  if (!field) {
    return (
      <div
        ref={containerRef}
        style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
        className="fixed z-50 rounded-md border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md"
      >
        {t("nodeQuickActions.notApplicableForNode")}
      </div>
    );
  }

  const currentColor = readColorField(component, field);

  const applyColor = (color: string) => {
    updateComponent(selectedNodeId, { [field]: color } as ComponentPatch);
  };

  const resetColor = () => {
    updateComponent(selectedNodeId, { [field]: undefined } as ComponentPatch);
  };

  return (
    <div
      ref={containerRef}
      style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
      className="fixed z-50 flex items-center gap-1.5 rounded-md border border-border bg-popover p-1.5 shadow-md"
      role="toolbar"
      aria-label={t("nodeQuickActions.resetColor")}
    >
      {QUICK_ACTION_PALETTE.map(({ color, nameKey }) => {
        const isActive = currentColor === color;
        return (
          <button
            key={color}
            type="button"
            title={t(nameKey)}
            aria-label={t(nameKey)}
            onClick={() => applyColor(color)}
            className={`h-5 w-5 rounded-sm border transition-transform hover:scale-110 ${
              isActive ? "border-foreground ring-2 ring-foreground/30" : "border-border"
            }`}
            style={{ backgroundColor: color }}
          />
        );
      })}
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        title={t("nodeQuickActions.resetColor")}
        aria-label={t("nodeQuickActions.resetColor")}
        onClick={resetColor}
        disabled={!currentColor}
        className="flex h-5 w-5 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function NodeQuickActionsContainer(props: Omit<NodeQuickActionsProps, "isDarkTheme">) {
  const { theme } = useTheme();
  return <NodeQuickActions {...props} isDarkTheme={theme === "dark"} />;
}

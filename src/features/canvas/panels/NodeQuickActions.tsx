import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance } from "@xyflow/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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
import {
  NEUTRAL_PRESETS,
  VIBRANT_PRESETS,
  type ColorPreset,
} from "./ElementPanel/components/colorPresets";

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

function ColorRow({
  presets,
  currentColor,
  applyColor,
  labelKey,
}: {
  presets: ReadonlyArray<ColorPreset>;
  currentColor: string | undefined;
  applyColor: (color: string) => void;
  labelKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {t(labelKey)}
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map(({ color, nameKey }) => {
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
      </div>
    </div>
  );
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
  const [showNeutrals, setShowNeutrals] = useState(false);

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
      className="fixed z-50 flex flex-col gap-1.5 rounded-md border border-border bg-popover p-1.5 shadow-md"
      role="toolbar"
      aria-label={t("nodeQuickActions.resetColor")}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex-1" />
        <button
          type="button"
          title={t("nodeQuickActions.moreToggle")}
          aria-label={t("nodeQuickActions.moreToggle")}
          onClick={() => setShowNeutrals((v) => !v)}
          className="flex h-5 items-center gap-0.5 rounded-sm border border-border px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          {showNeutrals ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {t("nodeQuickActions.moreToggle")}
        </button>
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
      <ColorRow
        presets={VIBRANT_PRESETS}
        currentColor={currentColor}
        applyColor={applyColor}
        labelKey="nodeQuickActions.sectionVibrant"
      />
      {showNeutrals && (
        <ColorRow
          presets={NEUTRAL_PRESETS}
          currentColor={currentColor}
          applyColor={applyColor}
          labelKey="nodeQuickActions.sectionNeutral"
        />
      )}
    </div>
  );
}

export function NodeQuickActionsContainer(props: Omit<NodeQuickActionsProps, "isDarkTheme">) {
  const { theme } = useTheme();
  return <NodeQuickActions {...props} isDarkTheme={theme === "dark"} />;
}

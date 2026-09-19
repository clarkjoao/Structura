import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Box, GitBranch, Layers, X } from "lucide-react";
import { getAccessibilityData, type AccessibilityNode } from "@/features/diagram/utils/accessibility";
import { useActiveDiagram } from "@/features/diagram";

interface DiagramOutlineProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectElement: (elementId: string) => void;
  selectedElementId: string | null;
}

/**
 * Accessible diagram outline panel with ARIA tree semantics.
 *
 * Provides a screen-reader-friendly navigation alternative to the canvas,
 * allowing users to explore diagram elements without navigating through
 * potentially hundreds of tab stops on a large diagram.
 */
export function DiagramOutline({
  isOpen,
  onClose,
  onSelectElement,
  selectedElementId,
}: DiagramOutlineProps) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();

  const accessibilityData = useMemo(() => {
    if (!diagram) return null;
    return getAccessibilityData(diagram);
  }, [diagram]);

  const treeItems = useMemo(() => {
    if (!accessibilityData) return [];
    return accessibilityData.nodes.map((node) => ({
      ...node,
      depth: node.type === "group" || node.type === "diagram" ? 0 : 1,
    }));
  }, [accessibilityData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, item: AccessibilityNode & { depth: number }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectElement(item.id);
      }
    },
    [onSelectElement],
  );

  if (!isOpen || !accessibilityData) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "group":
        return Layers;
      case "connection":
        return GitBranch;
      default:
        return Box;
    }
  };

  return (
    <aside
      role="complementary"
      aria-label={t("diagramOutline.title")}
      className="w-64 h-full border-r border-border bg-card flex flex-col"
    >
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("diagramOutline.title")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("diagramOutline.close")}
          className="p-1 hover:bg-secondary rounded transition-colors"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        role="tree"
        aria-label={t("diagramOutline.treeLabel", { name: accessibilityData.diagramName })}
        className="flex-1 overflow-y-auto p-2"
      >
        {treeItems.map((item) => {
          const Icon = getRoleIcon(item.role);
          const isSelected = item.id === selectedElementId;

          return (
            <div
              key={item.id}
              role="treeitem"
              aria-selected={isSelected}
              aria-level={item.depth + 1}
              aria-expanded={item.type === "group" ? true : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectElement(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item)}
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                text-sm transition-colors select-none
                ${isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-secondary text-foreground"
                }
              `}
              style={{ paddingLeft: `${item.depth * 16 + 8}px` }}
            >
              {item.type === "group" ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <span className="w-3.5 shrink-0" aria-hidden />
              )}
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{item.label}</span>
              {item.childCount > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {item.childCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

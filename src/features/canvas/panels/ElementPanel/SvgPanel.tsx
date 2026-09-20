import { useEffect, useRef, useState, useMemo } from "react";
import { X, Trash2, Shapes } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useActiveDiagram,
  useDiagramActions,
  resolveVersionSnapshot,
  type ComponentPatch,
  type SvgComponent,
} from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PositionSection } from "./sections";

interface SvgPanelProps {
  component: SvgComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
}

export default function SvgPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
}: SvgPanelProps) {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(component.name);
  const showBorder = component.showBorder !== false;
  const activeDiagram = useActiveDiagram();
  const { updateNodeLayout } = useDiagramActions();
  const resolved = useMemo(
    () =>
      activeDiagram
        ? resolveVersionSnapshot(activeDiagram, activeDiagram.activeVersionId ?? null)
        : null,
    [activeDiagram],
  );

  useEffect(() => {
    setName(component.name);
  }, [component.id, component.name]);

  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [focusTitleTrigger]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Shapes
            className="h-4 w-4 shrink-0"
            style={{ color: component.customColor || "#f97316" }}
          />
          <span className="text-sm font-semibold truncate">
            {component.name || t("svgNode.defaultName")}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PositionSection
          componentId={component.id}
          nodeLayout={resolved?.nodeLayouts[component.id]}
          updateNodeLayout={updateNodeLayout}
          isPanel
          minWidth={120}
          minHeight={120}
        />

        <div className="space-y-1.5">
          <Label htmlFor="svg-name">{t("common.name")}</Label>
          <input
            id="svg-name"
            ref={titleInputRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              updateComponent(component.id, { name: event.target.value });
            }}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="svg-show-border" className="text-sm font-medium">
              {t("svgNode.showBorder")}
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("svgNode.showBorderHint")}
            </p>
          </div>
          <Switch
            id="svg-show-border"
            checked={showBorder}
            onCheckedChange={(checked) => {
              updateComponent(component.id, { showBorder: checked });
            }}
          />
        </div>
      </div>

      <div className="p-3 border-t border-border shrink-0">
        <button
          type="button"
          onClick={() => {
            removeComponent(component.id);
            onClose();
          }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import type { ComponentPatch, SvgComponent } from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ElementScaffold, PanelSection } from "./shell";

interface SvgPanelProps {
  component: SvgComponent;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
}

export default function SvgPanel({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
}: SvgPanelProps) {
  const { t } = useTranslation();
  const showBorder = component.showBorder !== false;

  return (
    <ElementScaffold
      component={component}
      onClose={onClose}
      updateComponent={updateComponent}
      removeComponent={removeComponent}
      onFocusElement={onFocusElement}
      focusTitleTrigger={focusTitleTrigger}
      namePlaceholder={t("svgNode.defaultName")}
      sizable
      minWidth={120}
      minHeight={120}
    >
      <PanelSection title={t("panelShell.sectionWhat")}>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="svg-show-border" className="text-sm font-medium">
              {t("svgNode.showBorder")}
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
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
      </PanelSection>
    </ElementScaffold>
  );
}

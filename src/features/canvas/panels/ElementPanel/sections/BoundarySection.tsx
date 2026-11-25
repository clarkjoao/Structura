import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import {
  BOUNDARY_TYPES,
  elementDomain,
  resolveBoundaryAppearance,
  useResolvedComponents,
} from "@/features/diagram";
import type { BoundaryType, ComponentPatch, PanelComponent } from "@/features/diagram";
import { DEFAULT_PANEL_OPACITY } from "@/features/canvas/constants/panel.constants";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PANEL_LABEL_CLASS, PanelSection } from "../shell";

interface BoundarySectionProps {
  component: PanelComponent;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  onTogglePanelCollapse?: (id: string) => void;
}

/**
 * What the boundary is — its type, the domain it sits in, the look both give it — and whether it is
 * collapsed. The look is derived, not picked: colour comes from the domain (the group the boundary is
 * in), the outline from the type. A colour the author had already chosen stays, and can be handed
 * back to the derivation. What it holds is on the canvas itself, so it is not listed here.
 */
export function BoundarySections({
  component,
  updateComponent,
  onTogglePanelCollapse,
}: BoundarySectionProps) {
  const { t } = useTranslation();
  const components = useResolvedComponents();
  const domain = useMemo(() => elementDomain(component, components), [component, components]);
  const appearance = useMemo(
    () => resolveBoundaryAppearance(component, components),
    [component, components],
  );

  const setType = (type: BoundaryType | undefined) =>
    updateComponent(component.id, { boundaryType: type });

  const sourceLabel =
    appearance?.colorSource === "custom"
      ? t("boundary.sourceCustom")
      : appearance?.colorSource === "domain"
        ? t("boundary.sourceDomain", { name: domain?.name })
        : t("boundary.sourceType");

  return (
    <>
      <PanelSection title={t("boundary.title")}>
        <div>
          <span className={PANEL_LABEL_CLASS}>{t("boundary.type")}</span>
          <div role="radiogroup" aria-label={t("boundary.type")} className="flex flex-wrap gap-1">
            {[undefined, ...BOUNDARY_TYPES].map((type) => (
              <button
                key={type ?? "none"}
                type="button"
                role="radio"
                aria-checked={component.boundaryType === type}
                onClick={() => setType(type)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  component.boundaryType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                )}
              >
                {t(`boundary.types.${type ?? "none"}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={PANEL_LABEL_CLASS}>{t("boundary.domain")}</span>
          <p className="text-sm text-foreground">{domain?.name ?? t("boundary.noDomain")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("boundary.domainHint")}</p>
        </div>
        {appearance && (
          <div className="rounded-md border border-border bg-secondary/40 p-2.5">
            <span className={PANEL_LABEL_CLASS}>{t("boundary.derivedAppearance")}</span>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                data-testid="boundary-swatch"
                className="h-9 w-14 shrink-0 rounded-md"
                style={{
                  backgroundColor: `color-mix(in srgb, ${appearance.color} ${component.panelOpacity ?? DEFAULT_PANEL_OPACITY}%, transparent)`,
                  border: `2px ${appearance.borderStyle} ${appearance.color}`,
                }}
              />
              <dl className="min-w-0 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">{t("boundary.background")}</dt>
                  <dd className="font-mono text-foreground">{appearance.color}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">{t("boundary.border")}</dt>
                  <dd className="text-foreground">
                    {t(
                      `common.stroke${appearance.borderStyle[0].toUpperCase()}${appearance.borderStyle.slice(1)}`,
                    )}
                  </dd>
                </div>
                <div className="text-[11px] text-muted-foreground">{sourceLabel}</div>
              </dl>
            </div>
            {(appearance.colorSource === "custom" || appearance.borderSource === "custom") && (
              <button
                type="button"
                onClick={() =>
                  updateComponent(component.id, { panelColor: undefined, borderStyle: undefined })
                }
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                {t("boundary.backToDerived")}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`collapse-${component.id}`} className="text-sm font-medium">
            {t("boundary.collapseOnCanvas")}
          </Label>
          <Switch
            id={`collapse-${component.id}`}
            checked={component.collapsed === true}
            disabled={!onTogglePanelCollapse}
            onCheckedChange={() => onTogglePanelCollapse?.(component.id)}
          />
        </div>
      </PanelSection>
    </>
  );
}

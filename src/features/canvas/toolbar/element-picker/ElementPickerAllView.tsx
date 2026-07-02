import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "@/features/diagram";
import { PanelKind } from "@/features/diagram";
import { isPanelType } from "@/features/diagram";
import type { AwsCategoryId } from "@/lib/catalogs/aws";
import AwsIcon from "../../nodes/AwsIcon";
import { PickerSectionHeader } from "./PickerSectionHeader";
import { PICKER_CARD_CLASS, REGISTRY_PREVIEW_LIMIT } from "./constants";
import { shortAwsName } from "./utils";
import type { CanvasPickerOption } from "./types";
import { ElementCategory } from "../../enums";
import type { C4PickerOption } from "./buildPickerOptions";
import { RegistryServiceRow } from "./RegistryServiceRow";

export function ElementPickerAllView({
  C4_OPTIONS,
  CANVAS_OPTIONS,
  FLOWCHART_OPTIONS,
  awsSpotlight,
  services,
  onCanvasServiceIds,
  onAddC4,
  onAddCanvas,
  onAddFlowNode,
  onAddAws,
  onAddRegistry,
  onClose,
  setCategory,
}: {
  C4_OPTIONS: C4PickerOption[];
  CANVAS_OPTIONS: CanvasPickerOption[];
  FLOWCHART_OPTIONS: CanvasPickerOption[];
  awsSpotlight: { svc: { id: string; name: string; iconName: string }; categoryId: string }[];
  services: import("@/features/diagram").ServiceDefinition[];
  onCanvasServiceIds: Set<string>;
  onAddC4: (type: ComponentType, label: string) => void;
  onAddCanvas: (opt: CanvasPickerOption) => void;
  onAddFlowNode: (opt: CanvasPickerOption) => void;
  onAddAws: (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => void;
  onAddRegistry: (serviceId: string, name: string) => void;
  onClose: () => void;
  setCategory: (c: ElementCategory) => void;
}) {
  const { t } = useTranslation();

  const c4GridCard = (opt: C4PickerOption) => (
    <button
      key={opt.type}
      type="button"
      onClick={() => onAddC4(opt.type, opt.label)}
      className={PICKER_CARD_CLASS}
    >
      <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
      <span className="mt-2 text-xs text-foreground">{opt.label}</span>
    </button>
  );

  const canvasGridCard = (opt: CanvasPickerOption) => (
    <button
      key={isPanelType(opt.type) ? `panel-${opt.panelKind ?? PanelKind.Default}` : opt.type}
      type="button"
      onClick={() => onAddCanvas(opt)}
      className={PICKER_CARD_CLASS}
    >
      {opt.awsIconName ? (
        <AwsIcon iconName={opt.awsIconName} size={40} className="text-muted-foreground" />
      ) : (
        <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
      )}
      <span className="mt-2 text-xs text-foreground">{opt.label}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      <section>
        <PickerSectionHeader sectionLabel={t("elementPicker.c4Model")} />
        <div className="grid grid-cols-4 gap-3">{C4_OPTIONS.map(c4GridCard)}</div>
      </section>
      <section>
        <PickerSectionHeader sectionLabel={t("elementPicker.canvasGroups")} />
        <div className="grid grid-cols-4 gap-3">{CANVAS_OPTIONS.map(canvasGridCard)}</div>
      </section>
      <section>
        <PickerSectionHeader
          sectionLabel={t("elementPicker.flowchart")}
          showViewAll
          viewAllLabel={t("elementPicker.viewAll")}
          onViewAll={() => setCategory(ElementCategory.Flowchart)}
        />
        <div className="grid grid-cols-3 gap-2">
          {FLOWCHART_OPTIONS.slice(0, 6).map((opt) => (
            <button
              key={opt.flowShape}
              type="button"
              onClick={() => onAddFlowNode(opt)}
              className={PICKER_CARD_CLASS}
            >
              <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
              <span className="mt-2 text-xs text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <PickerSectionHeader
          sectionLabel={t("canvasToolbar.awsServices")}
          showViewAll
          viewAllLabel={t("elementPicker.viewAll")}
          onViewAll={() => setCategory(ElementCategory.Aws)}
        />
        <div className="grid grid-cols-5 gap-2">
          {awsSpotlight.map(({ svc, categoryId }) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => onAddAws(categoryId as AwsCategoryId, svc.id, svc.name)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-muted/40 p-2 transition-colors hover:bg-muted"
            >
              <AwsIcon iconName={svc.iconName} size={40} />
              <span className="line-clamp-2 text-center text-[10px] leading-tight text-foreground">
                {shortAwsName(svc.name)}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section>
        {services.length === 0 ? (
          <>
            <PickerSectionHeader sectionLabel={t("elementPicker.registry")} />
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("elementPicker.registryEmpty")}</p>
              <Link
                to="/workspace"
                className="text-sm font-medium text-primary hover:underline"
                onClick={onClose}
              >
                {t("elementPicker.openRegistry")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <PickerSectionHeader
              sectionLabel={t("elementPicker.registry")}
              showViewAll={services.length > REGISTRY_PREVIEW_LIMIT}
              viewAllLabel={t("elementPicker.viewAllRegistry")}
              onViewAll={() => setCategory(ElementCategory.Registry)}
            />
            <div className="space-y-2">
              {services.slice(0, REGISTRY_PREVIEW_LIMIT).map((svc) => {
                const isOnCanvas = onCanvasServiceIds.has(svc.id);
                return (
                  <RegistryServiceRow
                    key={svc.id}
                    svc={svc}
                    isOnCanvas={isOnCanvas}
                    onAdd={() => onAddRegistry(svc.id, svc.name)}
                    variant="default"
                  />
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

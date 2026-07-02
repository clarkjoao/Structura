import { useTranslation } from "react-i18next";
import type { ComponentType } from "@/features/diagram";
import { PanelKind } from "@/features/diagram";
import { isPanelType } from "@/features/diagram";
import type { AwsCategoryId } from "@/lib/catalogs/aws";
import type { CloudService } from "@/features/cloud";
import AwsIcon from "../../nodes/AwsIcon";
import { CloudIcon } from "@/features/cloud";
import { PICKER_CARD_CLASS } from "./constants";
import { shortAwsName } from "./utils";
import type { CanvasPickerOption } from "./types";
import type { C4PickerOption } from "./buildPickerOptions";
import { RegistryServiceRow } from "./RegistryServiceRow";
import {
  useCustomComponentStore,
  NodeTemplatePreviewCard,
  type CustomComponentTemplate,
} from "@/features/custom-components";

export function ElementPickerSearchResults({
  searchTrimmed,
  showSearchEmpty,
  filteredC4,
  filteredCanvas,
  filteredFlowchart,
  filteredAwsFlat,
  filteredGcpFlat,
  filteredAzureFlat,
  filteredServices,
  filteredTemplates,
  onCanvasServiceIds,
  onAddC4,
  onAddCanvas,
  onAddFlowNode,
  onAddAws,
  onAddCloud,
  onAddRegistry,
  onAddTemplate,
}: {
  searchTrimmed: string;
  showSearchEmpty: boolean;
  filteredC4: C4PickerOption[];
  filteredCanvas: CanvasPickerOption[];
  filteredFlowchart: CanvasPickerOption[];
  filteredAwsFlat: {
    categoryId: string;
    id: string;
    name: string;
    iconName: string;
  }[];
  filteredGcpFlat: (CloudService & { categoryId: string })[];
  filteredAzureFlat: (CloudService & { categoryId: string })[];
  filteredServices: import("@/features/diagram").ServiceDefinition[];
  filteredTemplates: CustomComponentTemplate[];
  onCanvasServiceIds: Set<string>;
  onAddC4: (type: ComponentType, label: string) => void;
  onAddCanvas: (opt: CanvasPickerOption) => void;
  onAddFlowNode: (opt: CanvasPickerOption) => void;
  onAddAws: (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => void;
  onAddCloud: (categoryId: string, serviceId: string, serviceName: string) => void;
  onAddRegistry: (serviceId: string, name: string) => void;
  onAddTemplate: (templateId: string) => void;
}) {
  const { t } = useTranslation();
  const deleteTemplate = useCustomComponentStore((state) => state.deleteTemplate);

  if (showSearchEmpty) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("elementPicker.noResultsFor", { query: searchTrimmed })}
      </p>
    );
  }

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
      {filteredC4.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("elementPicker.c4Model")} · {filteredC4.length}
          </h3>
          <div className="grid grid-cols-4 gap-3">{filteredC4.map(c4GridCard)}</div>
        </section>
      )}
      {filteredCanvas.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("elementPicker.canvasGroups")} · {filteredCanvas.length}
          </h3>
          <div className="grid grid-cols-4 gap-3">{filteredCanvas.map(canvasGridCard)}</div>
        </section>
      )}
      {filteredFlowchart.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("elementPicker.flowchart")} · {filteredFlowchart.length}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {filteredFlowchart.map((opt) => (
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
      )}
      {filteredAwsFlat.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("canvasToolbar.awsServices")} · {filteredAwsFlat.length}
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {filteredAwsFlat.map((svc) => (
              <button
                key={`${svc.categoryId}-${svc.id}`}
                type="button"
                onClick={() => onAddAws(svc.categoryId as AwsCategoryId, svc.id, svc.name)}
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
      )}
      {filteredGcpFlat.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("canvasToolbar.gcpServices")} · {filteredGcpFlat.length}
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {filteredGcpFlat.map((svc) => (
              <button
                key={`${svc.categoryId}-${svc.id}`}
                type="button"
                onClick={() => onAddCloud(svc.categoryId, svc.id, svc.name)}
                className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-muted/40 p-2 transition-colors hover:bg-muted"
              >
                <CloudIcon
                  componentType={svc.categoryId}
                  serviceIconName={svc.iconName}
                  size={40}
                />
                <span className="line-clamp-2 text-center text-[10px] leading-tight text-foreground">
                  {svc.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {filteredAzureFlat.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("canvasToolbar.azureServices")} · {filteredAzureFlat.length}
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {filteredAzureFlat.map((svc) => (
              <button
                key={`${svc.categoryId}-${svc.id}`}
                type="button"
                onClick={() => onAddCloud(svc.categoryId, svc.id, svc.name)}
                className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-muted/40 p-2 transition-colors hover:bg-muted"
              >
                <CloudIcon
                  componentType={svc.categoryId}
                  serviceIconName={svc.iconName}
                  size={40}
                />
                <span className="line-clamp-2 text-center text-[10px] leading-tight text-foreground">
                  {svc.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {filteredTemplates.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("customComponents.customComponents")} · {filteredTemplates.length}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {filteredTemplates.map((template) => (
              <NodeTemplatePreviewCard
                key={template.id}
                template={template}
                onClick={() => onAddTemplate(template.id)}
                onDelete={() => deleteTemplate(template.id)}
              />
            ))}
          </div>
        </section>
      )}
      {filteredServices.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("elementPicker.registry")} · {filteredServices.length}
          </h3>
          <div className="space-y-2">
            {filteredServices.map((svc) => {
              const isOnCanvas = onCanvasServiceIds.has(svc.id);
              return (
                <RegistryServiceRow
                  key={svc.id}
                  svc={svc}
                  isOnCanvas={isOnCanvas}
                  onAdd={() => onAddRegistry(svc.id, svc.name)}
                  variant="search"
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

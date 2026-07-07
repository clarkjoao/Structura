import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramActions, useAllServices, useAllComponents, PanelKind } from "@/features/diagram";
import { ElementCategory } from "../enums";
import type { ComponentType } from "@/features/diagram";
import type { CanvasPickerOption, ElementPickerModalProps } from "./element-picker/types";
import { getUsageKeyForType, getDefaultNameForNewComponent } from "@/features/diagram";
import { AWS_CATEGORIES, type AwsCategory } from "@/lib/catalogs/aws";
import { getPanelKindForAwsService, getPanelKindDef } from "@/lib/catalogs/panels";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import type { AwsCategoryId } from "@/lib/catalogs/aws";
import { cloudRegistry } from "@/features/cloud";
import { trackUsage } from "./element-usage-tracker";
import { useTranslation } from "react-i18next";
import { AWS_PRIMARY_CATEGORY_IDS, PICKER_CARD_CLASS } from "./element-picker/constants";
import { persistCategory, readStoredCategory } from "./element-picker/storage";
import { resolveAwsSpotlight } from "./element-picker/utils";
import {
  buildC4PickerOptions,
  buildCanvasPickerOptions,
  buildFlowchartPickerOptions,
} from "./element-picker/buildPickerOptions";
import {
  filterC4ByQuery,
  filterCanvasByQuery,
  filterFlowchartByQuery,
  filterAwsCategoriesForQuery,
  flattenAwsServices,
  filterServicesByQuery,
  filterCloudServicesForQuery,
} from "./element-picker/pickerFilters";
import { FlowchartCategoryView } from "./element-picker/FlowchartCategoryView";
import { buildCategoryNavItems } from "./element-picker/buildCategoryNav";
import { CategorySidebar } from "./element-picker/CategorySidebar";
import { ElementPickerAllView } from "./element-picker/ElementPickerAllView";
import { ElementPickerSearchResults } from "./element-picker/ElementPickerSearchResults";
import { AwsBrowseView } from "./element-picker/AwsBrowseView";
import { CloudBrowseView } from "./element-picker/CloudBrowseView";
import { RegistryCategoryPanel } from "./element-picker/RegistryCategoryPanel";
import AwsIcon from "../nodes/AwsIcon";
import { isPanelType } from "@/features/diagram";
import {
  useCustomComponentLibrary,
  NodeTemplatePreviewCard,
  useCustomComponentStore,
} from "@/features/custom-components";

const ElementPickerModal = ({ onClose, onInsert }: ElementPickerModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ElementCategory>(() => readStoredCategory());
  const [expandedAwsSubcats, setExpandedAwsSubcats] = useState<Set<string>>(
    () => new Set(["aws-compute"]),
  );
  const [expandedGcpSubcats, setExpandedGcpSubcats] = useState<Set<string>>(
    () => new Set(["gcp-compute"]),
  );
  const [expandedAzureSubcats, setExpandedAzureSubcats] = useState<Set<string>>(
    () => new Set(["azure-compute"]),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useReactFlow();
  const { addComponent, linkComponentToService } = useDiagramActions();
  const services = useAllServices();
  const allComponents = useAllComponents();
  const { templates, instantiateTemplate } = useCustomComponentLibrary();
  const deleteTemplate = useCustomComponentStore((state) => state.deleteTemplate);

  const C4_OPTIONS = useMemo(() => buildC4PickerOptions(t), [t]);
  const CANVAS_OPTIONS = useMemo(() => buildCanvasPickerOptions(t), [t]);
  const FLOWCHART_OPTIONS = useMemo(() => buildFlowchartPickerOptions(t), [t]);

  const onCanvasServiceIds = useMemo(
    () => new Set(allComponents.map((c) => c.serviceId).filter((id): id is string => !!id)),
    [allComponents],
  );

  const awsServiceCount = useMemo(
    () => AWS_CATEGORIES.reduce((n, c) => n + c.services.length, 0),
    [],
  );

  const gcpProvider = useMemo(() => cloudRegistry.forId("gcp"), []);
  const azureProvider = useMemo(() => cloudRegistry.forId("azure"), []);
  const gcpServiceCount = useMemo(() => gcpProvider?.services.length ?? 0, [gcpProvider]);
  const azureServiceCount = useMemo(() => azureProvider?.services.length ?? 0, [azureProvider]);

  const awsSpotlight = useMemo(() => resolveAwsSpotlight(), []);

  const allCategoryTotalCount = useMemo(
    () =>
      C4_OPTIONS.length +
      CANVAS_OPTIONS.length +
      FLOWCHART_OPTIONS.length +
      awsServiceCount +
      gcpServiceCount +
      azureServiceCount +
      services.length +
      templates.length,
    [
      C4_OPTIONS.length,
      CANVAS_OPTIONS.length,
      FLOWCHART_OPTIONS.length,
      awsServiceCount,
      gcpServiceCount,
      azureServiceCount,
      services.length,
      templates.length,
    ],
  );

  const awsPrimaryCategories = useMemo(
    () =>
      AWS_PRIMARY_CATEGORY_IDS.map((id) => AWS_CATEGORIES.find((c) => c.id === id)).filter(
        (c): c is AwsCategory => !!c,
      ),
    [],
  );

  const awsOtherCategories = useMemo(
    () => AWS_CATEGORIES.filter((c) => !AWS_PRIMARY_CATEGORY_IDS.includes(c.id)),
    [],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    persistCategory(activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (keyIs(e, KEY.ESCAPE)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const q = search.trim().toLowerCase();

  const filteredC4 = useMemo(() => filterC4ByQuery(q, C4_OPTIONS), [q, C4_OPTIONS]);

  const filteredCanvas = useMemo(() => filterCanvasByQuery(q, CANVAS_OPTIONS), [q, CANVAS_OPTIONS]);

  const filteredFlowchart = useMemo(
    () => filterFlowchartByQuery(q, FLOWCHART_OPTIONS),
    [q, FLOWCHART_OPTIONS],
  );

  const filteredAwsCategories = useMemo(() => filterAwsCategoriesForQuery(q), [q]);

  const filteredAwsFlat = useMemo(
    () => flattenAwsServices(filteredAwsCategories),
    [filteredAwsCategories],
  );

  const filteredGcpFlat = useMemo(
    () => (gcpProvider ? filterCloudServicesForQuery(q, gcpProvider) : []),
    [q, gcpProvider],
  );

  const filteredAzureFlat = useMemo(
    () => (azureProvider ? filterCloudServicesForQuery(q, azureProvider) : []),
    [q, azureProvider],
  );

  const filteredServices = useMemo(() => filterServicesByQuery(q, services), [q, services]);
  const filteredTemplates = useMemo(() => {
    if (!q) return templates;
    return templates.filter((template) => {
      const normalizedBaseType = String(template.baseType).toLowerCase();
      return (
        template.name.toLowerCase().includes(q) ||
        (template.description?.toLowerCase().includes(q) ?? false) ||
        normalizedBaseType.includes(q)
      );
    });
  }, [q, templates]);

  const getInsertPos = useCallback(
    () => rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [rfInstance],
  );

  const handleAddElement = (type: ComponentType, label: string, panelKind?: PanelKind) => {
    trackUsage(getUsageKeyForType(type, panelKind));
    const panelDefaultName = panelKind ? getPanelKindDef(panelKind).defaultName : undefined;
    const name = getDefaultNameForNewComponent(type, label, panelDefaultName);
    const comp = addComponent(type, name, null, getInsertPos(), undefined, panelKind);
    onInsert?.(comp.id);
    onClose();
  };

  const handleAddAws = (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => {
    const panelKind = getPanelKindForAwsService(serviceId);
    if (panelKind) {
      trackUsage(`canvas:panel:${panelKind}`);
      const def = getPanelKindDef(panelKind);
      const name = def.defaultName;
      const comp = addComponent("panel", name, null, getInsertPos(), undefined, panelKind);
      onInsert?.(comp.id);
    } else {
      trackUsage(`aws:${serviceId}`);
      const comp = addComponent(categoryId, serviceName, null, getInsertPos(), serviceId);
      onInsert?.(comp.id);
    }
    onClose();
  };

  const handleAddService = (serviceId: string, name: string) => {
    trackUsage(`registry:${serviceId}`);
    const comp = addComponent("system", name, null, getInsertPos());
    linkComponentToService(comp.id, serviceId);
    onInsert?.(comp.id);
    onClose();
  };

  const toggleAwsSubcat = (catId: string) => {
    setExpandedAwsSubcats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleAddCloudService = (categoryId: string, serviceId: string, serviceName: string) => {
    const providerId = categoryId.split("-")[0];
    trackUsage(`${providerId}:${serviceId}`);
    const comp = addComponent(
      categoryId as ComponentType,
      serviceName,
      null,
      getInsertPos(),
      serviceId,
    );
    onInsert?.(comp.id);
    onClose();
  };

  const toggleGcpSubcat = (catId: string) => {
    setExpandedGcpSubcats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const toggleAzureSubcat = (catId: string) => {
    setExpandedAzureSubcats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const categoryItems = useMemo(
    () =>
      buildCategoryNavItems(t, {
        all: allCategoryTotalCount,
        c4: C4_OPTIONS.length,
        canvas: CANVAS_OPTIONS.length,
        flowchart: FLOWCHART_OPTIONS.length,
        aws: awsServiceCount,
        gcp: gcpServiceCount,
        azure: azureServiceCount,
        registry: services.length,
        nodeTemplates: templates.length,
      }),
    [
      t,
      allCategoryTotalCount,
      C4_OPTIONS.length,
      CANVAS_OPTIONS.length,
      FLOWCHART_OPTIONS.length,
      awsServiceCount,
      gcpServiceCount,
      azureServiceCount,
      services.length,
      templates.length,
    ],
  );

  const setCategory = (cat: ElementCategory) => {
    setActiveCategory(cat);
    setSearch("");
  };

  const showSearchEmpty =
    !!q &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredFlowchart.length === 0 &&
    filteredAwsFlat.length === 0 &&
    filteredGcpFlat.length === 0 &&
    filteredAzureFlat.length === 0 &&
    filteredServices.length === 0 &&
    filteredTemplates.length === 0;

  const onAddCanvas = (opt: CanvasPickerOption) => {
    handleAddElement(opt.type, opt.label, opt.panelKind);
  };

  const handleAddFlowNode = useCallback(
    (opt: CanvasPickerOption) => {
      if (!opt.flowShape) return;
      trackUsage(getUsageKeyForType("process-node"));
      const name = getDefaultNameForNewComponent("process-node", opt.label);
      const comp = addComponent(
        "process-node",
        name,
        null,
        getInsertPos(),
        undefined,
        undefined,
        opt.flowShape,
      );
      onInsert?.(comp.id);
      onClose();
    },
    [addComponent, getInsertPos, onClose, onInsert],
  );

  const renderCategoryBody = () => {
    switch (activeCategory) {
      case ElementCategory.All:
        return (
          <ElementPickerAllView
            C4_OPTIONS={C4_OPTIONS}
            CANVAS_OPTIONS={CANVAS_OPTIONS}
            FLOWCHART_OPTIONS={FLOWCHART_OPTIONS}
            awsSpotlight={awsSpotlight}
            services={services}
            onCanvasServiceIds={onCanvasServiceIds}
            onAddC4={(type, label) => handleAddElement(type, label)}
            onAddCanvas={onAddCanvas}
            onAddFlowNode={handleAddFlowNode}
            onAddAws={handleAddAws}
            onAddRegistry={handleAddService}
            onClose={onClose}
            setCategory={setCategory}
          />
        );
      case ElementCategory.C4:
        return (
          <div className="grid grid-cols-4 gap-3">
            {C4_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleAddElement(opt.type, opt.label)}
                className={PICKER_CARD_CLASS}
              >
                <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
                <span className="mt-2 text-xs text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        );
      case ElementCategory.Canvas:
        return (
          <div className="grid grid-cols-4 gap-3">
            {CANVAS_OPTIONS.map((opt) => (
              <button
                key={
                  isPanelType(opt.type) ? `panel-${opt.panelKind ?? PanelKind.Default}` : opt.type
                }
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
            ))}
          </div>
        );
      case ElementCategory.Aws:
        return (
          <AwsBrowseView
            awsPrimaryCategories={awsPrimaryCategories}
            awsOtherCategories={awsOtherCategories}
            expandedAwsSubcats={expandedAwsSubcats}
            q={q}
            toggleAwsSubcat={toggleAwsSubcat}
            onPickAws={handleAddAws}
          />
        );
      case ElementCategory.Gcp:
        return gcpProvider ? (
          <CloudBrowseView
            provider={gcpProvider}
            primaryCategoryIds={[
              "gcp-compute",
              "gcp-database",
              "gcp-storage",
              "gcp-networking",
              "gcp-ai",
            ]}
            expandedSubcats={expandedGcpSubcats}
            q={q}
            toggleSubcat={toggleGcpSubcat}
            onPick={handleAddCloudService}
          />
        ) : null;
      case ElementCategory.Azure:
        return azureProvider ? (
          <CloudBrowseView
            provider={azureProvider}
            primaryCategoryIds={[
              "azure-compute",
              "azure-database",
              "azure-storage",
              "azure-networking",
              "azure-security",
            ]}
            expandedSubcats={expandedAzureSubcats}
            q={q}
            toggleSubcat={toggleAzureSubcat}
            onPick={handleAddCloudService}
          />
        ) : null;
      case ElementCategory.Registry:
        return (
          <RegistryCategoryPanel
            services={services}
            filteredServices={filteredServices}
            onCanvasServiceIds={onCanvasServiceIds}
            onAddRegistry={handleAddService}
            onClose={onClose}
          />
        );
      case ElementCategory.Flowchart:
        return <FlowchartCategoryView options={FLOWCHART_OPTIONS} onAdd={handleAddFlowNode} />;
      case ElementCategory.NodeTemplate:
        return filteredTemplates.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("patterns.userTemplates.empty")}</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredTemplates.map((template) => (
              <NodeTemplatePreviewCard
                key={template.id}
                onClick={() => {
                  const insertedNodeId = instantiateTemplate({
                    templateId: template.id,
                    position: getInsertPos(),
                  });
                  if (insertedNodeId) {
                    onInsert?.(insertedNodeId);
                    onClose();
                  }
                }}
                onDelete={() => deleteTemplate(template.id)}
                template={template}
              />
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl w-[760px] max-w-full h-[520px] max-h-[90vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{t("elementPicker.modalTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <CategorySidebar
            items={categoryItems}
            activeCategory={activeCategory}
            q={q}
            setCategory={setCategory}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("elementPicker.searchPlaceholderUnified")}
                  className="w-full rounded-md border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {q ? (
                <ElementPickerSearchResults
                  searchTrimmed={search.trim()}
                  showSearchEmpty={showSearchEmpty}
                  filteredC4={filteredC4}
                  filteredCanvas={filteredCanvas}
                  filteredFlowchart={filteredFlowchart}
                  filteredAwsFlat={filteredAwsFlat}
                  filteredGcpFlat={filteredGcpFlat}
                  filteredAzureFlat={filteredAzureFlat}
                  filteredServices={filteredServices}
                  filteredTemplates={filteredTemplates}
                  onCanvasServiceIds={onCanvasServiceIds}
                  onAddC4={(type, label) => handleAddElement(type, label)}
                  onAddCanvas={onAddCanvas}
                  onAddFlowNode={handleAddFlowNode}
                  onAddAws={handleAddAws}
                  onAddCloud={handleAddCloudService}
                  onAddRegistry={handleAddService}
                  onAddTemplate={(templateId) => {
                    const insertedNodeId = instantiateTemplate({
                      templateId,
                      position: getInsertPos(),
                    });
                    if (insertedNodeId) {
                      onInsert?.(insertedNodeId);
                      onClose();
                    }
                  }}
                />
              ) : (
                renderCategoryBody()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElementPickerModal;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramActions, useAllServices, useAllComponents, PanelKind } from "@/features/diagram";
import { ElementCategory, type PickerCategoryId } from "../enums";
import type { ComponentType } from "@/features/diagram";
import type { CanvasPickerOption, ElementPickerModalProps } from "./element-picker/types";
import { getUsageKeyForType, getDefaultNameForNewComponent } from "@/features/diagram";
import { AWS_CATEGORIES, type AwsCategory } from "@/features/cloud/providers/aws/aws.catalog";
import { getPanelKindForAwsService, panelKindDefaultName } from "@/lib/catalogs/panels";
import { KEY, keyIs } from "@/lib/core/keyboard";
import type { AwsCategoryId } from "@/features/cloud/providers/aws/aws.catalog";
import { cloudRegistry } from "@/features/cloud";
import {
  allCloudFamilies,
  getCloudFamily,
  isRegisteredCloudFamily,
} from "@/features/elements/families/cloud-family.registry";
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
  paletteEntriesForCategory,
  type ElementPaletteEntry,
} from "@/features/elements/element.palette";
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
import CloudIcon from "../nodes/CloudIcon";
import { isPanelType } from "@/features/diagram";
import {
  useElementPresetLibrary,
  ElementPresetPreviewCard,
  useElementPresetStore,
} from "@/features/element-presets";

function defaultExpandedForFamily(familyId: string): Set<string> {
  const family = getCloudFamily(familyId);
  const first = family?.primaryCategoryIds?.[0] ?? family?.categories[0]?.id;
  return new Set(first ? [first] : []);
}

const ElementPickerModal = ({ onClose, onInsert }: ElementPickerModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<PickerCategoryId>(() =>
    readStoredCategory(),
  );
  const [expandedByFamily, setExpandedByFamily] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    for (const family of allCloudFamilies()) {
      initial[family.id] = defaultExpandedForFamily(family.id);
    }
    return initial;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useReactFlow();
  const { addComponent, linkComponentToService } = useDiagramActions();
  const services = useAllServices();
  const allComponents = useAllComponents();
  const { presets, instantiatePreset } = useElementPresetLibrary();
  const deletePreset = useElementPresetStore((state) => state.deletePreset);

  const C4_OPTIONS = useMemo(() => buildC4PickerOptions(t), [t]);
  // Registry-derived entries join the legacy list, which no longer holds the
  // types that have migrated -- each element is offered by exactly one path.
  const CANVAS_OPTIONS = useMemo(
    (): CanvasPickerOption[] => [
      ...buildCanvasPickerOptions(),
      ...paletteEntriesForCategory(ElementCategory.Canvas).map((entry) => ({
        type: entry.type,
        label: entry.label,
        icon: entry.icon,
        searchKeys: entry.searchKeys,
        panelKind: entry.createOptions.panelKind,
        awsIconName: entry.awsIconName,
      })),
    ],
    [t],
  );
  const FLOWCHART_OPTIONS = useMemo(() => buildFlowchartPickerOptions(t), [t]);

  const onCanvasServiceIds = useMemo(
    () => new Set(allComponents.map((c) => c.serviceId).filter((id): id is string => !!id)),
    [allComponents],
  );

  const cloudProviders = useMemo(() => cloudRegistry.allProviders(), []);

  const byFamilyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const provider of cloudProviders) {
      counts[provider.id] = provider.services.length;
    }
    return counts;
  }, [cloudProviders]);

  const cloudServiceTotal = useMemo(
    () => Object.values(byFamilyCounts).reduce((n, c) => n + c, 0),
    [byFamilyCounts],
  );

  const awsSpotlight = useMemo(() => resolveAwsSpotlight(), []);

  const allCategoryTotalCount = useMemo(
    () =>
      C4_OPTIONS.length +
      CANVAS_OPTIONS.length +
      FLOWCHART_OPTIONS.length +
      cloudServiceTotal +
      services.length +
      presets.length,
    [
      C4_OPTIONS.length,
      CANVAS_OPTIONS.length,
      FLOWCHART_OPTIONS.length,
      cloudServiceTotal,
      services.length,
      presets.length,
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

  const filteredCloudByFamily = useMemo(() => {
    const rows: {
      familyId: string;
      labelKey: string;
      services: ReturnType<typeof filterCloudServicesForQuery>;
    }[] = [];
    for (const family of allCloudFamilies()) {
      // AWS keeps its own search section (panel-kind remapping).
      if (family.id === "aws") continue;
      const provider = cloudRegistry.forId(family.id);
      if (!provider) continue;
      rows.push({
        familyId: family.id,
        labelKey: family.labelKey,
        services: filterCloudServicesForQuery(q, provider),
      });
    }
    return rows;
  }, [q]);

  const filteredCloudFlatCount = useMemo(
    () => filteredCloudByFamily.reduce((n, row) => n + row.services.length, 0),
    [filteredCloudByFamily],
  );

  const filteredServices = useMemo(() => filterServicesByQuery(q, services), [q, services]);
  const filteredTemplates = useMemo(() => {
    if (!q) return presets;
    return presets.filter((template) => {
      const normalizedBaseType = String(template.baseType).toLowerCase();
      return (
        template.name.toLowerCase().includes(q) ||
        (template.description?.toLowerCase().includes(q) ?? false) ||
        normalizedBaseType.includes(q)
      );
    });
  }, [q, presets]);

  const getInsertPos = useCallback(
    () => rfInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [rfInstance],
  );

  const handleAddElement = (type: ComponentType, label: string, panelKind?: PanelKind) => {
    trackUsage(getUsageKeyForType(type, panelKind));
    const panelDefaultName = panelKind ? panelKindDefaultName(panelKind) : undefined;
    const name = getDefaultNameForNewComponent(type, label, panelDefaultName);
    const comp = addComponent(type, name, null, getInsertPos(), undefined, panelKind);
    onInsert?.(comp.id);
    onClose();
  };

  /**
   * Insert a palette entry straight from the registry, honouring whatever
   * `createOptions` it declares. The fixed tabs each know which option their
   * elements use; a tab built from the registry cannot assume.
   */
  const handleAddPaletteEntry = (entry: ElementPaletteEntry) => {
    const { panelKind, serviceId } = entry.createOptions;
    trackUsage(
      serviceId ? `${entry.type}:${serviceId}` : getUsageKeyForType(entry.type, panelKind),
    );
    const panelDefaultName = panelKind ? panelKindDefaultName(panelKind) : undefined;
    const name = getDefaultNameForNewComponent(entry.type, entry.label, panelDefaultName);
    const comp = addComponent(entry.type, name, null, getInsertPos(), serviceId, panelKind);
    onInsert?.(comp.id);
    onClose();
  };

  const handleAddAws = (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => {
    const panelKind = getPanelKindForAwsService(serviceId);
    if (panelKind) {
      trackUsage(`canvas:panel:${panelKind}`);
      const name = panelKindDefaultName(panelKind);
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

  const toggleFamilySubcat = (familyId: string, catId: string) => {
    setExpandedByFamily((prev) => {
      const current = prev[familyId] ?? defaultExpandedForFamily(familyId);
      const next = new Set(current);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return { ...prev, [familyId]: next };
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

  const categoryItems = useMemo(
    () =>
      buildCategoryNavItems(t, {
        all: allCategoryTotalCount,
        c4: C4_OPTIONS.length,
        canvas: CANVAS_OPTIONS.length,
        flowchart: FLOWCHART_OPTIONS.length,
        byFamily: byFamilyCounts,
        registry: services.length,
        nodeTemplates: presets.length,
      }),
    [
      t,
      allCategoryTotalCount,
      C4_OPTIONS.length,
      CANVAS_OPTIONS.length,
      FLOWCHART_OPTIONS.length,
      byFamilyCounts,
      services.length,
      presets.length,
    ],
  );

  const setCategory = (cat: PickerCategoryId) => {
    setActiveCategory(cat);
    setSearch("");
  };

  const showSearchEmpty =
    !!q &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredFlowchart.length === 0 &&
    filteredAwsFlat.length === 0 &&
    filteredCloudFlatCount === 0 &&
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

  const renderCloudFamilyBody = (familyId: string) => {
    const family = getCloudFamily(familyId);
    const provider = cloudRegistry.forId(familyId);
    if (!family || !provider) return null;

    // AWS keeps AwsBrowseView for panel-kind remapping (VPC → swimlane, …).
    if (familyId === "aws") {
      return (
        <AwsBrowseView
          awsPrimaryCategories={awsPrimaryCategories}
          awsOtherCategories={awsOtherCategories}
          expandedAwsSubcats={expandedByFamily.aws ?? defaultExpandedForFamily("aws")}
          q={q}
          toggleAwsSubcat={(catId) => toggleFamilySubcat("aws", catId)}
          onPickAws={handleAddAws}
        />
      );
    }

    return (
      <CloudBrowseView
        provider={provider}
        primaryCategoryIds={[...(family.primaryCategoryIds ?? [])]}
        expandedSubcats={expandedByFamily[familyId] ?? defaultExpandedForFamily(familyId)}
        q={q}
        toggleSubcat={(catId) => toggleFamilySubcat(familyId, catId)}
        onPick={handleAddCloudService}
      />
    );
  };

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
                  <CloudIcon
                    providerId="aws"
                    iconName={opt.awsIconName}
                    size={40}
                    className="text-muted-foreground"
                  />
                ) : (
                  <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
                )}
                <span className="mt-2 text-xs text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        );
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
              <ElementPresetPreviewCard
                key={template.id}
                onClick={() => {
                  const insertedNodeId = instantiatePreset({
                    presetId: template.id,
                    position: getInsertPos(),
                  });
                  if (insertedNodeId) {
                    onInsert?.(insertedNodeId);
                    onClose();
                  }
                }}
                onDelete={() => deletePreset(template.id)}
                template={template}
              />
            ))}
          </div>
        );
      default: {
        if (isRegisteredCloudFamily(activeCategory)) {
          return renderCloudFamilyBody(activeCategory);
        }

        // Any other registered palette category — a vocabulary that is neither
        // C4, canvas, flowchart nor a catalog family. It gets the same grid the
        // fixed tabs use, built straight from the registry, so registering the
        // elements is all a new family has to do to become insertable.
        const entries = paletteEntriesForCategory(activeCategory);
        if (entries.length === 0) return null;

        return (
          <div className="grid grid-cols-4 gap-3">
            {entries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => handleAddPaletteEntry(entry)}
                className={PICKER_CARD_CLASS}
              >
                {entry.familyIcon ? (
                  <CloudIcon
                    providerId={entry.familyIcon.familyId}
                    iconName={entry.familyIcon.iconName}
                    size={40}
                    className="text-muted-foreground"
                  />
                ) : (
                  <entry.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
                )}
                <span className="mt-2 text-xs text-foreground">{entry.label}</span>
              </button>
            ))}
          </div>
        );
      }
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
                  filteredCloudByFamily={filteredCloudByFamily}
                  filteredServices={filteredServices}
                  filteredTemplates={filteredTemplates}
                  onCanvasServiceIds={onCanvasServiceIds}
                  onAddC4={(type, label) => handleAddElement(type, label)}
                  onAddCanvas={onAddCanvas}
                  onAddFlowNode={handleAddFlowNode}
                  onAddAws={handleAddAws}
                  onAddCloud={handleAddCloudService}
                  onAddRegistry={handleAddService}
                  onAddTemplate={(id) => {
                    const insertedNodeId = instantiatePreset({
                      presetId: id,
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

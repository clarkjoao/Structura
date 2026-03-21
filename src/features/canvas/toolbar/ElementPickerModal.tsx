import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import {
  useDiagramActions,
  useAllServices,
  useAllComponents,
  PanelKind,
} from "@/features/diagram";
import { ElementCategory } from "../enums";
import type { ComponentType } from "@/features/diagram";
import type { CanvasPickerOption } from "./element-picker/elementPickerModal.types";
import {
  getUsageKeyForType,
  getDefaultNameForNewComponent,
} from "@/features/diagram";
import { AWS_CATEGORIES, type AwsCategory } from "@/lib/catalogs/aws";
import { getPanelKindForAwsService, getPanelKindDef } from "@/lib/catalogs/panels";
import type { AwsCategoryId } from "@/lib/catalogs/aws";
import { trackUsage } from "./element-usage-tracker";
import { useTranslation } from "react-i18next";
import {
  AWS_PRIMARY_CATEGORY_IDS,
  PICKER_CARD_CLASS,
} from "./element-picker/elementPickerModal.constants";
import { persistCategory, readStoredCategory } from "./element-picker/elementPickerModal.storage";
import { resolveAwsSpotlight } from "./element-picker/elementPickerModal.utils";
import type { ElementPickerModalProps } from "./element-picker/elementPickerModal.types";
import {
  buildC4PickerOptions,
  buildCanvasPickerOptions,
} from "./element-picker/buildPickerOptions";
import {
  filterC4ByQuery,
  filterCanvasByQuery,
  filterAwsCategoriesForQuery,
  flattenAwsServices,
  filterServicesByQuery,
} from "./element-picker/pickerFilters";
import { buildCategoryNavItems } from "./element-picker/buildCategoryNav";
import { CategorySidebar } from "./element-picker/CategorySidebar";
import { ElementPickerAllView } from "./element-picker/ElementPickerAllView";
import { ElementPickerSearchResults } from "./element-picker/ElementPickerSearchResults";
import { AwsBrowseView } from "./element-picker/AwsBrowseView";
import { RegistryCategoryPanel } from "./element-picker/RegistryCategoryPanel";
import AwsIcon from "../nodes/AwsIcon";
import { isPanelType } from "@/features/diagram";

const ElementPickerModal = ({ onClose, onInsert }: ElementPickerModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ElementCategory>(() => readStoredCategory());
  const [expandedAwsSubcats, setExpandedAwsSubcats] = useState<Set<string>>(
    () => new Set(["aws-compute"]),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useReactFlow();
  const { addComponent, linkComponentToService } = useDiagramActions();
  const services = useAllServices();
  const allComponents = useAllComponents();

  const C4_OPTIONS = useMemo(() => buildC4PickerOptions(t), [t]);
  const CANVAS_OPTIONS = useMemo(() => buildCanvasPickerOptions(t), [t]);

  const onCanvasServiceIds = useMemo(
    () => new Set(allComponents.map((c) => c.serviceId).filter((id): id is string => !!id)),
    [allComponents],
  );

  const awsServiceCount = useMemo(
    () => AWS_CATEGORIES.reduce((n, c) => n + c.services.length, 0),
    [],
  );

  const awsSpotlight = useMemo(() => resolveAwsSpotlight(), []);

  const allCategoryTotalCount = useMemo(
    () => C4_OPTIONS.length + CANVAS_OPTIONS.length + awsServiceCount + services.length,
    [C4_OPTIONS.length, CANVAS_OPTIONS.length, awsServiceCount, services.length],
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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const q = search.trim().toLowerCase();

  const filteredC4 = useMemo(
    () => filterC4ByQuery(q, C4_OPTIONS),
    [q, C4_OPTIONS],
  );

  const filteredCanvas = useMemo(
    () => filterCanvasByQuery(q, CANVAS_OPTIONS),
    [q, CANVAS_OPTIONS],
  );

  const filteredAwsCategories = useMemo(
    () => filterAwsCategoriesForQuery(q),
    [q],
  );

  const filteredAwsFlat = useMemo(
    () => flattenAwsServices(filteredAwsCategories),
    [filteredAwsCategories],
  );

  const filteredServices = useMemo(
    () => filterServicesByQuery(q, services),
    [q, services],
  );

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

  const categoryItems = useMemo(
    () =>
      buildCategoryNavItems(t, {
        all: allCategoryTotalCount,
        c4: C4_OPTIONS.length,
        canvas: CANVAS_OPTIONS.length,
        aws: awsServiceCount,
        registry: services.length,
      }),
    [t, allCategoryTotalCount, C4_OPTIONS.length, CANVAS_OPTIONS.length, awsServiceCount, services.length],
  );

  const setCategory = (cat: ElementCategory) => {
    setActiveCategory(cat);
    setSearch("");
  };

  const showSearchEmpty =
    !!q &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredAwsFlat.length === 0 &&
    filteredServices.length === 0;

  const onAddCanvas = (opt: CanvasPickerOption) => {
    handleAddElement(opt.type, opt.label, opt.panelKind);
  };

  const renderCategoryBody = () => {
    switch (activeCategory) {
      case ElementCategory.All:
        return (
          <ElementPickerAllView
            C4_OPTIONS={C4_OPTIONS}
            CANVAS_OPTIONS={CANVAS_OPTIONS}
            awsSpotlight={awsSpotlight}
            services={services}
            onCanvasServiceIds={onCanvasServiceIds}
            onAddC4={(type, label) => handleAddElement(type, label)}
            onAddCanvas={onAddCanvas}
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
                  isPanelType(opt.type)
                    ? `panel-${opt.panelKind ?? PanelKind.Default}`
                    : opt.type
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
                  filteredAwsFlat={filteredAwsFlat}
                  filteredServices={filteredServices}
                  onCanvasServiceIds={onCanvasServiceIds}
                  onAddC4={(type, label) => handleAddElement(type, label)}
                  onAddCanvas={onAddCanvas}
                  onAddAws={handleAddAws}
                  onAddRegistry={handleAddService}
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

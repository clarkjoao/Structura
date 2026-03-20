import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  Globe,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Network,
  Search,
  Server,
  Square,
  StickyNote,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PanelKind } from "@/features/diagram";
import { PANEL_KINDS, getPanelKindForAwsService, getPanelKindDef } from "@/lib/catalogs/panels";
import { useReactFlow } from "@xyflow/react";
import { useDiagramActions, useAllServices, useAllComponents, ServiceSource } from "@/features/diagram";
import type { ComponentType } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { getUsageKeyForType, getDefaultNameForNewComponent, isPanelType } from "@/features/diagram";
import {
  AWS_CATEGORIES,
  type AwsCategoryId,
  type AwsCategory,
  type AwsService,
} from "@/lib/catalogs/aws";
import AwsIcon from "../nodes/AwsIcon";
import { trackUsage } from "./element-usage-tracker";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const LAST_CATEGORY_KEY = "structura:lastElementCategory";

type Category = "all" | "c4" | "canvas" | "aws" | "registry";

/** Popular AWS services shown on the "All" tab (order preserved). */
const AWS_SPOTLIGHT_IDS: string[] = [
  "ec2",
  "lambda",
  "s3",
  "rds",
  "elb",
  "ecs",
  "eks",
  "vpc",
  "cloudfront",
  "dynamodb",
  "sqs",
  "api-gateway",
];

const REGISTRY_PREVIEW_LIMIT = 5;

function resolveAwsSpotlight(): { svc: AwsService; categoryId: AwsCategoryId }[] {
  const out: { svc: AwsService; categoryId: AwsCategoryId }[] = [];
  for (const id of AWS_SPOTLIGHT_IDS) {
    for (const cat of AWS_CATEGORIES) {
      const svc = cat.services.find((s) => s.id === id);
      if (svc) {
        out.push({ svc, categoryId: cat.id as AwsCategoryId });
        break;
      }
    }
  }
  return out;
}

/** Primary AWS groups shown first; remaining catalog categories roll into "Other". */
const AWS_PRIMARY_CATEGORY_IDS: string[] = [
  "aws-compute",
  "aws-networking",
  "aws-storage",
  "aws-database",
  "aws-security",
  "aws-containers",
];

const OTHER_AWS_SECTION_KEY = "__aws_other__";

function readStoredCategory(): Category {
  try {
    const v = localStorage.getItem(LAST_CATEGORY_KEY);
    if (v === "all" || v === "c4" || v === "canvas" || v === "aws" || v === "registry") return v;
  } catch {
    /* ignore */
  }
  return "all";
}

function persistCategory(cat: Category) {
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, cat);
  } catch {
    /* ignore */
  }
}

type CanvasPickerOption = {
  type: ComponentType;
  label: string;
  icon: LucideIcon;
  panelKind?: PanelKind;
  awsIconName?: string;
};

interface ElementPickerModalProps {
  onClose: () => void;
  onInsert?: (nodeId: string) => void;
}

function servicePrimarySource(svc: ServiceDefinition): ServiceSource {
  const ref = svc.sources?.[0];
  if (ref?.type) return ref.type;
  if (svc.source) return svc.source;
  return ServiceSource.Manual;
}

function registrySourceDotClass(svc: ServiceDefinition): string {
  const src = servicePrimarySource(svc);
  if (src === ServiceSource.Github) return "bg-blue-500";
  if (src === ServiceSource.Defectdojo) return "bg-orange-500";
  return "bg-violet-500";
}

function shortAwsName(name: string): string {
  return name.replace(/^Amazon |^AWS /, "");
}

function PickerSectionHeader({
  sectionLabel,
  showViewAll,
  viewAllLabel,
  onViewAll,
}: {
  sectionLabel: string;
  showViewAll?: boolean;
  viewAllLabel?: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {sectionLabel}
      </span>
      <div className="h-px flex-1 bg-border" />
      {showViewAll && onViewAll && viewAllLabel ? (
        <button
          type="button"
          onClick={onViewAll}
          className="flex shrink-0 items-center gap-0.5 text-[11px] text-primary hover:underline"
        >
          {viewAllLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

const ElementPickerModal = ({ onClose, onInsert }: ElementPickerModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>(() => readStoredCategory());
  const [expandedAwsSubcats, setExpandedAwsSubcats] = useState<Set<string>>(
    () => new Set(["aws-compute"]),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useReactFlow();
  const { addComponent, linkComponentToService } = useDiagramActions();
  const services = useAllServices();
  const allComponents = useAllComponents();

  const C4_OPTIONS = useMemo(
    () =>
      [
        { type: "person" as const, label: t("quickInsert.typePerson"), icon: User },
        { type: "system" as const, label: t("quickInsert.typeSystem"), icon: Network },
        { type: "container" as const, label: t("quickInsert.typeContainer"), icon: Server },
        { type: "component" as const, label: t("quickInsert.typeComponent"), icon: Database },
      ],
    [t],
  );

  const CANVAS_OPTIONS = useMemo((): CanvasPickerOption[] => {
    const swim = PANEL_KINDS.find((p) => p.id === "swimlane");
    const restPanels = PANEL_KINDS.filter((p) => p.id !== "default" && p.id !== "swimlane");
    const core: CanvasPickerOption[] = [
      { type: "panel", label: t("canvasToolbar.panel"), icon: Square, panelKind: "default" },
    ];
    if (swim) {
      core.push({
        type: "panel",
        label: t("swimlane.title"),
        icon: swim.icon,
        panelKind: "swimlane",
        awsIconName: swim.awsIconName,
      });
    }
    core.push(
      { type: "note", label: t("canvasToolbar.note"), icon: StickyNote },
      { type: "api-group", label: t("quickInsert.typeApiGroup"), icon: Globe },
      { type: "endpoint", label: t("quickInsert.typeEndpoint"), icon: Globe },
    );
    for (const p of restPanels) {
      core.push({
        type: "panel",
        label: p.label,
        icon: p.icon,
        panelKind: p.id as PanelKind,
        awsIconName: p.awsIconName,
      });
    }
    return core;
  }, [t]);

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

  const canvasOptionMatchesQuery = useCallback(
    (opt: CanvasPickerOption, query: string): boolean => {
      const fields: string[] = [opt.label.toLowerCase()];
      if (opt.panelKind) {
        fields.push(getPanelKindDef(opt.panelKind).defaultName.toLowerCase());
        fields.push(String(opt.panelKind).toLowerCase());
      }
      return fields.some((f) => f.includes(query));
    },
    [],
  );

  const filteredC4 = useMemo(
    () => (q ? C4_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : C4_OPTIONS),
    [q, C4_OPTIONS],
  );

  const filteredCanvas = useMemo(
    () => (q ? CANVAS_OPTIONS.filter((o) => canvasOptionMatchesQuery(o, q)) : CANVAS_OPTIONS),
    [q, CANVAS_OPTIONS, canvasOptionMatchesQuery],
  );

  const filteredAwsCategories = useMemo(() => {
    if (!q) return AWS_CATEGORIES;
    return AWS_CATEGORIES.map((cat) => ({
      ...cat,
      services: cat.services.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)),
    })).filter((cat) => cat.services.length > 0);
  }, [q]);

  const filteredAwsFlat = useMemo(
    () => filteredAwsCategories.flatMap((cat) => cat.services.map((s) => ({ ...s, categoryId: cat.id }))),
    [filteredAwsCategories],
  );

  const filteredServices = useMemo(() => {
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((tech) => tech.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [q, services]);

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
    () => [
      {
        id: "all" as const,
        label: t("elementPicker.categoryAll"),
        icon: LayoutGrid,
        count: allCategoryTotalCount,
      },
      {
        id: "c4" as const,
        label: t("elementPicker.c4Model"),
        icon: Layers,
        count: C4_OPTIONS.length,
      },
      {
        id: "canvas" as const,
        label: t("elementPicker.canvasGroups"),
        icon: LayoutTemplate,
        count: CANVAS_OPTIONS.length,
      },
      {
        id: "aws" as const,
        label: t("canvasToolbar.awsServices"),
        icon: Cloud,
        count: awsServiceCount,
      },
      {
        id: "registry" as const,
        label: t("elementPicker.registry"),
        icon: Server,
        count: services.length,
      },
    ],
    [t, allCategoryTotalCount, C4_OPTIONS.length, CANVAS_OPTIONS.length, awsServiceCount, services.length],
  );

  const setCategory = (cat: Category) => {
    setActiveCategory(cat);
    setSearch("");
  };

  const cardClass =
    "flex flex-col items-center justify-center rounded-xl border border-border/40 bg-muted/50 p-3 transition-colors hover:bg-muted text-center min-h-[104px]";

  const c4GridCard = (opt: (typeof C4_OPTIONS)[number]) => (
    <button
      key={opt.type}
      type="button"
      onClick={() => handleAddElement(opt.type, opt.label)}
      className={cardClass}
    >
      <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
      <span className="mt-2 text-xs text-foreground">{opt.label}</span>
    </button>
  );

  const canvasGridCard = (opt: CanvasPickerOption) => (
    <button
      key={
        isPanelType(opt.type)
          ? `panel-${opt.panelKind ?? "default"}`
          : opt.type
      }
      type="button"
      onClick={() => handleAddElement(opt.type, opt.label, opt.panelKind)}
      className={cardClass}
    >
      {opt.awsIconName ? (
        <AwsIcon iconName={opt.awsIconName} size={40} className="text-muted-foreground" />
      ) : (
        <opt.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
      )}
      <span className="mt-2 text-xs text-foreground">{opt.label}</span>
    </button>
  );

  const renderAwsSubsection = (cat: AwsCategory) => {
    const filtered = q
      ? cat.services.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q))
      : cat.services;
    if (filtered.length === 0) return null;
    const expanded = expandedAwsSubcats.has(cat.id) || !!q;
    return (
      <div key={cat.id} className="border-b border-border/40 last:border-0 pb-2 last:pb-0">
        <button
          type="button"
          onClick={() => toggleAwsSubcat(cat.id)}
          className="flex w-full items-center gap-2 py-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {cat.name}
          </span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
            {filtered.length}
          </span>
        </button>
        {expanded && (
          <div className="grid grid-cols-5 gap-2 pl-5 pb-2">
            {filtered.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleAddAws(cat.id as AwsCategoryId, svc.id, svc.name)}
                className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-muted/40 p-2 transition-colors hover:bg-muted"
              >
                <AwsIcon iconName={svc.iconName} size={40} />
                <span className="line-clamp-2 text-center text-[10px] leading-tight text-foreground">
                  {shortAwsName(svc.name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAwsBrowse = () => (
    <div className="space-y-1">
      {awsPrimaryCategories.map((cat) => renderAwsSubsection(cat))}
      {awsOtherCategories.length > 0 && (
        <div className="border-b border-border/40 last:border-0 pb-2">
          <button
            type="button"
            onClick={() => toggleAwsSubcat(OTHER_AWS_SECTION_KEY)}
            className="flex w-full items-center gap-2 py-2 text-left"
          >
            {expandedAwsSubcats.has(OTHER_AWS_SECTION_KEY) || !!q ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("elementPicker.awsOther")}
            </span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
              {awsOtherCategories.reduce((n, c) => n + c.services.length, 0)}
            </span>
          </button>
          {(expandedAwsSubcats.has(OTHER_AWS_SECTION_KEY) || !!q) &&
            awsOtherCategories.map((cat) => renderAwsSubsection(cat))}
        </div>
      )}
    </div>
  );

  const renderRegistryList = () => {
    if (services.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("elementPicker.registryEmpty")}</p>
          <Link
            to="/registry"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onClose}
          >
            {t("elementPicker.openRegistry")}
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {filteredServices.map((svc) => {
          const isOnCanvas = onCanvasServiceIds.has(svc.id);
          const tech = svc.technology[0] ?? "";
          return (
            <div
              key={svc.id}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/40 px-3 py-2"
            >
              <div className={cn("h-2 w-2 shrink-0 rounded-full", registrySourceDotClass(svc))} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-sm">{svc.name}</p>
                {tech && (
                  <p className="truncate text-xs text-muted-foreground">{tech}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAddService(svc.id, svc.name)}
                className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                title={t("elementPicker.addAnotherInstance")}
              >
                {isOnCanvas ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  t("elementPicker.addButton")
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAllView = () => (
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
          sectionLabel={t("canvasToolbar.awsServices")}
          showViewAll
          viewAllLabel={t("elementPicker.viewAll")}
          onViewAll={() => setCategory("aws")}
        />
        <div className="grid grid-cols-5 gap-2">
          {awsSpotlight.map(({ svc, categoryId }) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => handleAddAws(categoryId, svc.id, svc.name)}
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
                to="/registry"
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
              onViewAll={() => setCategory("registry")}
            />
            <div className="space-y-2">
              {services.slice(0, REGISTRY_PREVIEW_LIMIT).map((svc) => {
                const isOnCanvas = onCanvasServiceIds.has(svc.id);
                const tech = svc.technology[0] ?? "";
                return (
                  <div
                    key={svc.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/40 px-3 py-2"
                  >
                    <div
                      className={cn("h-2 w-2 shrink-0 rounded-full", registrySourceDotClass(svc))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground text-sm">{svc.name}</p>
                      {tech && (
                        <p className="truncate text-xs text-muted-foreground">{tech}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddService(svc.id, svc.name)}
                      className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                      title={t("elementPicker.addAnotherInstance")}
                    >
                      {isOnCanvas ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        t("elementPicker.addButton")
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );

  const renderCategoryBody = () => {
    switch (activeCategory) {
      case "all":
        return renderAllView();
      case "c4":
        return <div className="grid grid-cols-4 gap-3">{C4_OPTIONS.map(c4GridCard)}</div>;
      case "canvas":
        return <div className="grid grid-cols-4 gap-3">{CANVAS_OPTIONS.map(canvasGridCard)}</div>;
      case "aws":
        return renderAwsBrowse();
      case "registry":
        return renderRegistryList();
      default:
        return null;
    }
  };

  const showSearchEmpty =
    !!q &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredAwsFlat.length === 0 &&
    filteredServices.length === 0;

  const renderSearchResults = () => {
    if (showSearchEmpty) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("elementPicker.noResultsFor", { query: search.trim() })}
        </p>
      );
    }
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
                  onClick={() =>
                    handleAddAws(svc.categoryId as AwsCategoryId, svc.id, svc.name)
                  }
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
        {filteredServices.length > 0 && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("elementPicker.registry")} · {filteredServices.length}
            </h3>
            <div className="space-y-2">
              {filteredServices.map((svc) => {
                const isOnCanvas = onCanvasServiceIds.has(svc.id);
                const tech = svc.technology[0] ?? "";
                return (
                  <div
                    key={svc.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/40 px-3 py-2"
                  >
                    <div
                      className={cn("h-2 w-2 shrink-0 rounded-full", registrySourceDotClass(svc))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground text-sm">{svc.name}</p>
                      {tech && (
                        <p className="truncate text-xs text-muted-foreground">{tech}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddService(svc.id, svc.name)}
                      className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-hover"
                      title={t("elementPicker.addAnotherInstance")}
                    >
                      {isOnCanvas ? (
                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        t("elementPicker.addButton")
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
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
          <aside className="flex w-[160px] shrink-0 flex-col border-r border-border bg-muted/40 py-2">
            {categoryItems.map((item) => {
              const Icon = item.icon;
              const active = !q && activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    "flex h-10 w-full items-center gap-2 px-3 text-left text-sm transition-colors",
                    active
                      ? "border-r-2 border-primary bg-primary/10 font-medium text-primary"
                      : "border-r-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </aside>

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
              {q ? renderSearchResults() : renderCategoryBody()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElementPickerModal;

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  User,
  Network,
  Server,
  Database,
  Square,
  StickyNote,
  Globe,
  Table,
  Braces,
} from "lucide-react";
import { useDiagramActions, useAllServices } from "@/features/diagram";
import {
  PanelKind,
  COMPONENT_TYPE_PANEL,
  COMPONENT_TYPE_NOTE,
  COMPONENT_TYPE_API_GROUP,
  COMPONENT_TYPE_ENDPOINT,
  COMPONENT_TYPE_DB_TABLE,
  COMPONENT_TYPE_JSON_VIEWER,
  isDbTableType,
  isJsonViewerType,
} from "@/features/diagram";
import type { ComponentType, FlowNodeShape } from "@/features/diagram";
import { getDefaultNameForNewComponent, getLastEdgeStyle } from "@/features/diagram";
import { buildFlowchartPickerOptions } from "./element-picker/buildPickerOptions";
import { PANEL_KINDS, getPanelKindForAwsService, getPanelKindDef } from "@/lib/catalogs/panels";
import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/catalogs/aws";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import AwsIcon from "../nodes/AwsIcon";
import { useTranslation } from "react-i18next";
import { useCustomComponentLibrary } from "@/features/custom-components";

type CanvasInsertOption = {
  type: ComponentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  panelKind?: PanelKind;
  awsIconName?: string;
  flowShape?: FlowNodeShape;
};

type FlatOption =
  | { kind: "c4"; type: ComponentType; label: string }
  | { kind: "canvas"; opt: CanvasInsertOption }
  | { kind: "aws"; categoryId: AwsCategoryId; serviceId: string; serviceName: string }
  | { kind: "service"; id: string; name: string }
  | { kind: "template"; id: string };

type SearchSynonyms = {
  panel: string[];
  swimlane: string[];
  note: string[];
  apiGroup: string[];
  endpoint: string[];
  dbTable: string[];
  jsonViewer: string[];
};

type AwsSearchRow = {
  categoryId: AwsCategoryId;
  serviceId: string;
  serviceName: string;
  iconName: string;
};

function splitSearchHelp(raw: string): string[] {
  return raw.split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function canvasOptionMatchesQuery(
  opt: CanvasInsertOption,
  q: string,
  synonyms: SearchSynonyms,
): boolean {
  const fields: string[] = [opt.label.toLowerCase()];
  if (opt.panelKind) {
    fields.push(getPanelKindDef(opt.panelKind).defaultName.toLowerCase());
  }
  if (opt.type === COMPONENT_TYPE_PANEL) {
    fields.push(...synonyms.panel);
    if (opt.panelKind === PanelKind.Swimlane) {
      fields.push(...synonyms.swimlane);
    }
  } else if (opt.type === COMPONENT_TYPE_NOTE) {
    fields.push(...synonyms.note);
  } else if (isDbTableType(opt.type)) {
    fields.push(...synonyms.dbTable);
  } else if (isJsonViewerType(opt.type)) {
    fields.push(...synonyms.jsonViewer);
  } else if (opt.type === COMPONENT_TYPE_API_GROUP) {
    fields.push(...synonyms.apiGroup);
  } else if (opt.type === COMPONENT_TYPE_ENDPOINT) {
    fields.push(...synonyms.endpoint);
  }
  return fields.some((f) => f.includes(q));
}

function toFlatOptions(
  filteredC4: { type: ComponentType; label: string }[],
  filteredCanvas: CanvasInsertOption[],
  filteredAws: AwsSearchRow[],
  filteredServices: { id: string; name: string }[],
  filteredTemplates: { id: string }[],
): FlatOption[] {
  const result: FlatOption[] = [];
  for (const option of filteredC4) {
    result.push({ kind: "c4", type: option.type, label: option.label });
  }
  for (const option of filteredCanvas) {
    result.push({ kind: "canvas", opt: option });
  }
  for (const option of filteredAws) {
    result.push({
      kind: "aws",
      categoryId: option.categoryId,
      serviceId: option.serviceId,
      serviceName: option.serviceName,
    });
  }
  for (const option of filteredServices) {
    result.push({ kind: "service", id: option.id, name: option.name });
  }
  for (const option of filteredTemplates) {
    result.push({ kind: "template", id: option.id });
  }
  return result;
}

const POPOVER_W = 240;
const POPOVER_H_MAX = 320;

interface QuickInsertPopoverProps {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  sourceNodeId?: string | null;
  onInsert: (newNodeId: string) => void;
  onClose: () => void;
}

const QuickInsertPopover = ({
  screenPos,
  flowPos,
  sourceNodeId,
  onInsert,
  onClose,
}: QuickInsertPopoverProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { addComponent, addConnection, linkComponentToService } =
    useDiagramActions();
  const services = useAllServices();
  const { templates, instantiateTemplate } = useCustomComponentLibrary();

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

  const FLOWCHART_QUICK_OPTIONS = useMemo(() => {
    const shapes = new Set<FlowNodeShape>(["rectangle", "rounded", "diamond"]);
    return buildFlowchartPickerOptions(t).filter(
      (opt) => opt.flowShape && shapes.has(opt.flowShape),
    );
  }, [t]);

  const CANVAS_OPTIONS = useMemo(
    (): CanvasInsertOption[] => [
      { type: COMPONENT_TYPE_PANEL, label: t("canvasToolbar.panel"), icon: Square, panelKind: PanelKind.Default },
      ...PANEL_KINDS.filter((p) => p.id !== PanelKind.Default).map((p) => ({
        type: COMPONENT_TYPE_PANEL as ComponentType,
        label: p.id === PanelKind.Swimlane ? t("swimlane.title") : p.label,
        icon: p.icon,
        panelKind: p.id,
        awsIconName: p.awsIconName,
      })),
      { type: COMPONENT_TYPE_NOTE as ComponentType, label: t("canvasToolbar.note"), icon: StickyNote },
      {
        type: COMPONENT_TYPE_DB_TABLE as ComponentType,
        label: t("nodeTypes.db-table"),
        icon: Table,
      },
      {
        type: COMPONENT_TYPE_JSON_VIEWER as ComponentType,
        label: t("nodeTypes.json-viewer"),
        icon: Braces,
      },
      { type: COMPONENT_TYPE_API_GROUP as ComponentType, label: t("quickInsert.typeApiGroup"), icon: Globe },
      { type: COMPONENT_TYPE_ENDPOINT as ComponentType, label: t("quickInsert.typeEndpoint"), icon: Globe },
    ],
    [t],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (keyIs(e, KEY.ESCAPE)) onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const q = search.trim().toLowerCase();

  const searchSynonyms = useMemo(
    (): SearchSynonyms => ({
      panel: splitSearchHelp(t("quickInsert.searchHelpPanel")),
      swimlane: splitSearchHelp(t("quickInsert.searchHelpSwimlane")),
      note: splitSearchHelp(t("quickInsert.searchHelpNote")),
      dbTable: splitSearchHelp(t("quickInsert.searchHelpDbTable")),
      jsonViewer: splitSearchHelp(t("quickInsert.searchHelpJsonViewer")),
      apiGroup: splitSearchHelp(t("quickInsert.searchHelpApiGroup")),
      endpoint: splitSearchHelp(t("quickInsert.searchHelpEndpoint")),
    }),
    [t],
  );

  const filteredC4 = useMemo(() => {
    if (!q) return C4_OPTIONS;
    return C4_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [q, C4_OPTIONS]);

  const filteredCanvas = useMemo(() => {
    if (!q) return [];
    return CANVAS_OPTIONS.filter((o) => canvasOptionMatchesQuery(o, q, searchSynonyms));
  }, [q, CANVAS_OPTIONS, searchSynonyms]);

  const filteredFlowchart = useMemo(() => {
    if (!q) return [];
    return FLOWCHART_QUICK_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [q, FLOWCHART_QUICK_OPTIONS]);

  const filteredAws = useMemo(() => {
    if (!q) return [];
    const rows: AwsSearchRow[] = [];
    for (const cat of AWS_CATEGORIES) {
      const catMatch = cat.name.toLowerCase().includes(q);
      for (const s of cat.services) {
        if (
          s.name.toLowerCase().includes(q) ||
          s.id.includes(q) ||
          catMatch
        ) {
          rows.push({
            categoryId: cat.id as AwsCategoryId,
            serviceId: s.id,
            serviceName: s.name,
            iconName: s.iconName,
          });
        }
      }
    }
    rows.sort((a, b) => a.serviceName.localeCompare(b.serviceName, "pt-BR"));
    return rows;
  }, [q]);

  const filteredServices = useMemo(() => {
    if (!q) return [];
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [q, services]);
  
  const filteredTemplates = useMemo(() => {
    if (!q) return [];
    return templates.filter((template) => {
      const normalizedBaseType = String(template.baseType).toLowerCase();
      return (
        template.name.toLowerCase().includes(q) ||
        (template.description?.toLowerCase().includes(q) ?? false) ||
        normalizedBaseType.includes(q)
      );
    });
  }, [q, templates]);

  const flatOptions = useMemo((): FlatOption[] => {
    const flowchartAsCanvas: CanvasInsertOption[] = filteredFlowchart.map((opt) => ({
      type: opt.type,
      label: opt.label,
      icon: opt.icon,
      flowShape: opt.flowShape,
    }));
    return toFlatOptions(
      filteredC4,
      [...filteredCanvas, ...flowchartAsCanvas],
      filteredAws,
      filteredServices,
      filteredTemplates,
    );
  }, [
    filteredC4,
    filteredCanvas,
    filteredFlowchart,
    filteredAws,
    filteredServices,
    filteredTemplates,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatOptions.length]);

  const insertPos = useMemo(
    () => ({ x: flowPos.x + 20, y: flowPos.y + 20 }),
    [flowPos.x, flowPos.y],
  );

  const connectFromSource = useCallback(
    (targetNodeId: string) => {
      if (!sourceNodeId) return;
      addConnection(sourceNodeId, targetNodeId, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
    },
    [addConnection, sourceNodeId, t],
  );

  const finalizeInsertion = useCallback(
    (newNodeId: string) => {
      connectFromSource(newNodeId);
      onInsert(newNodeId);
    },
    [connectFromSource, onInsert],
  );

  const handleSelectC4 = useCallback((type: ComponentType, label: string) => {
    const comp = addComponent(type, t("quickInsert.newNamed", { name: label }), null, insertPos);
    finalizeInsertion(comp.id);
  }, [addComponent, t, insertPos, finalizeInsertion]);

  const handleSelectCanvas = useCallback(
    (type: ComponentType, label: string, panelKind?: PanelKind, flowShape?: FlowNodeShape) => {
      const panelDefaultName = panelKind ? getPanelKindDef(panelKind).defaultName : undefined;
      const name = getDefaultNameForNewComponent(type, label, panelDefaultName);
      const comp = addComponent(type, name, null, insertPos, undefined, panelKind, flowShape);
      finalizeInsertion(comp.id);
    },
    [addComponent, insertPos, finalizeInsertion],
  );

  const handleSelectAws = useCallback((categoryId: AwsCategoryId, serviceId: string, serviceName: string) => {
    const panelKind = getPanelKindForAwsService(serviceId);
    const comp = panelKind
      ? addComponent(COMPONENT_TYPE_PANEL, getPanelKindDef(panelKind).defaultName, null, insertPos, undefined, panelKind)
      : addComponent(categoryId, serviceName, null, insertPos, serviceId);
    finalizeInsertion(comp.id);
  }, [addComponent, insertPos, finalizeInsertion]);

  const handleSelectService = useCallback((serviceId: string, name: string) => {
    const comp = addComponent("system", name, null, insertPos);
    linkComponentToService(comp.id, serviceId);
    finalizeInsertion(comp.id);
  }, [addComponent, insertPos, linkComponentToService, finalizeInsertion]);

  const handleSelectTemplate = useCallback((templateId: string) => {
    const insertedNodeId = instantiateTemplate({
      templateId,
      position: insertPos,
    });
    if (!insertedNodeId) return;
    finalizeInsertion(insertedNodeId);
  }, [instantiateTemplate, insertPos, finalizeInsertion]);

  const selectOption = useCallback(
    (option: FlatOption) => {
      switch (option.kind) {
        case "c4":
          handleSelectC4(option.type, option.label);
          break;
        case "canvas":
          handleSelectCanvas(
            option.opt.type,
            option.opt.label,
            option.opt.panelKind,
            option.opt.flowShape,
          );
          break;
        case "aws":
          handleSelectAws(option.categoryId, option.serviceId, option.serviceName);
          break;
        case "service":
          handleSelectService(option.id, option.name);
          break;
        case "template":
          handleSelectTemplate(option.id);
          break;
      }
    },
    [handleSelectC4, handleSelectCanvas, handleSelectAws, handleSelectService, handleSelectTemplate],
  );

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const selectedItem = container.querySelector('[data-selected="true"]');
    selectedItem?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const left = Math.min(screenPos.x + 8, window.innerWidth - POPOVER_W - 8);
  const top = Math.min(screenPos.y + 8, window.innerHeight - POPOVER_H_MAX - 8);

  const showEmpty =
    !!search.trim() &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredFlowchart.length === 0 &&
    filteredAws.length === 0 &&
    filteredServices.length === 0 &&
    filteredTemplates.length === 0;

  const c4Offset = 0;
  const canvasOffset = filteredC4.length;
  const awsOffset = canvasOffset + filteredCanvas.length;
  const servicesOffset = awsOffset + filteredAws.length;
  const templatesOffset = servicesOffset + filteredServices.length;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 rounded-lg border border-border bg-card shadow-xl"
      style={{ left, top, width: POPOVER_W }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (keyIs(e, KEY.ESCAPE)) {
              onClose();
              return;
            }
            if (keyIs(e, KEY.ARROW_DOWN)) {
              e.preventDefault();
              setSelectedIndex((index) => Math.min(index + 1, flatOptions.length - 1));
              return;
            }
            if (keyIs(e, KEY.ARROW_UP)) {
              e.preventDefault();
              setSelectedIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (keyIs(e, KEY.ENTER)) {
              e.preventDefault();
              const option = flatOptions[selectedIndex];
              if (option) selectOption(option);
            }
          }}
          placeholder={t("quickInsert.searchPlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto pb-1">
        {filteredC4.length > 0 && (
          <>
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("elementPicker.c4Model")}
              </span>
            </div>
            {filteredC4.map((opt, index) => (
              <button
                key={opt.type}
                data-selected={selectedIndex === c4Offset + index}
                onClick={() => handleSelectC4(opt.type, opt.label)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left ${
                  selectedIndex === c4Offset + index
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {opt.label}
              </button>
            ))}
          </>
        )}
        {filteredCanvas.length > 0 && (
          <>
            {filteredC4.length > 0 && <div className="border-t border-border my-1" />}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("quickInsert.sectionCanvasGroups")}
              </span>
            </div>
            {filteredCanvas.map((opt, index) => (
              <button
                key={
                  opt.type === COMPONENT_TYPE_PANEL
                    ? `panel-${opt.panelKind ?? PanelKind.Default}`
                    : opt.type
                }
                data-selected={selectedIndex === canvasOffset + index}
                onClick={() => handleSelectCanvas(opt.type, opt.label, opt.panelKind)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left ${
                  selectedIndex === canvasOffset + index
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                {opt.awsIconName ? (
                  <AwsIcon iconName={opt.awsIconName} size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                  <opt.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </>
        )}
        {filteredAws.length > 0 && (
          <>
            {(filteredC4.length > 0 || filteredCanvas.length > 0) && (
              <div className="border-t border-border my-1" />
            )}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("canvasToolbar.awsServices")}
              </span>
            </div>
            {filteredAws.map((row, index) => (
              <button
                key={row.serviceId}
                data-selected={selectedIndex === awsOffset + index}
                onClick={() => handleSelectAws(row.categoryId, row.serviceId, row.serviceName)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left ${
                  selectedIndex === awsOffset + index
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                <AwsIcon iconName={row.iconName} size={14} className="shrink-0" />
                <span className="truncate text-foreground">{row.serviceName}</span>
              </button>
            ))}
          </>
        )}
        {filteredServices.length > 0 && (
          <>
            {(filteredC4.length > 0 || filteredCanvas.length > 0 || filteredAws.length > 0) && (
              <div className="border-t border-border my-1" />
            )}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("elementPicker.registry")}
              </span>
            </div>
            {filteredServices.map((svc, index) => (
              <button
                key={svc.id}
                data-selected={selectedIndex === servicesOffset + index}
                onClick={() => handleSelectService(svc.id, svc.name)}
                className={`flex flex-col w-full px-3 py-2 text-xs transition-colors text-left ${
                  selectedIndex === servicesOffset + index
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                <span className="font-medium text-foreground">{svc.name}</span>
                {svc.technology.length > 0 && (
                  <span className="text-muted-foreground">
                    {svc.technology.slice(0, 2).join(", ")}
                  </span>
                )}
              </button>
            ))}
          </>
        )}
        {filteredTemplates.length > 0 && (
          <>
            {(filteredC4.length > 0 ||
              filteredCanvas.length > 0 ||
              filteredAws.length > 0 ||
              filteredServices.length > 0) && (
              <div className="border-t border-border my-1" />
            )}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("customComponents.customComponents")}
              </span>
            </div>
            {filteredTemplates.map((template, index) => (
              <button
                key={template.id}
                data-selected={selectedIndex === templatesOffset + index}
                onClick={() => handleSelectTemplate(template.id)}
                className={`flex flex-col w-full px-3 py-2 text-xs transition-colors text-left ${
                  selectedIndex === templatesOffset + index
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover"
                }`}
              >
                <span className="font-medium text-foreground">{template.name}</span>
                {template.description ? (
                  <span className="text-muted-foreground line-clamp-1">
                    {template.description}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{template.baseType}</span>
                )}
              </button>
            ))}
          </>
        )}
        {showEmpty && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("quickInsert.noResults")}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickInsertPopover;

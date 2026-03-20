import { useEffect, useRef, useState, useMemo } from "react";
import { User, Network, Server, Database, Square, StickyNote, Globe } from "lucide-react";
import { useDiagramActions, useAllServices } from "@/features/diagram";
import type { ComponentType, PanelKind } from "@/features/diagram";
import { getDefaultNameForNewComponent } from "@/features/diagram";
import { getLastEdgeStyle } from "@/features/diagram/hooks/useLastEdgeStyle";
import { PANEL_KINDS, getPanelKindForAwsService, getPanelKindDef } from "@/lib/catalogs/panels";
import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/catalogs/aws";
import AwsIcon from "../nodes/AwsIcon";
import { useTranslation } from "react-i18next";

type CanvasInsertOption = {
  type: ComponentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  panelKind?: PanelKind;
  awsIconName?: string;
};

function splitSearchHelp(raw: string): string[] {
  return raw.split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function canvasOptionMatchesQuery(
  opt: CanvasInsertOption,
  q: string,
  synonyms: { panel: string[]; note: string[]; apiGroup: string[]; endpoint: string[] },
): boolean {
  const fields: string[] = [opt.label.toLowerCase()];
  if (opt.panelKind) {
    fields.push(getPanelKindDef(opt.panelKind).defaultName.toLowerCase());
  }
  if (opt.type === "panel") {
    fields.push(...synonyms.panel);
  } else if (opt.type === "note") {
    fields.push(...synonyms.note);
  } else if (opt.type === "api-group") {
    fields.push(...synonyms.apiGroup);
  } else if (opt.type === "endpoint") {
    fields.push(...synonyms.endpoint);
  }
  return fields.some((f) => f.includes(q));
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addComponent, addConnection, linkComponentToService } =
    useDiagramActions();
  const services = useAllServices();

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

  const CANVAS_OPTIONS = useMemo(
    (): CanvasInsertOption[] => [
      { type: "panel", label: t("canvasToolbar.panel"), icon: Square, panelKind: "default" },
      ...PANEL_KINDS.filter((p) => p.id !== "default").map((p) => ({
        type: "panel" as const,
        label: p.label,
        icon: p.icon,
        panelKind: p.id as PanelKind,
        awsIconName: p.awsIconName,
      })),
      { type: "note", label: t("canvasToolbar.note"), icon: StickyNote },
      { type: "api-group", label: t("quickInsert.typeApiGroup"), icon: Globe },
      { type: "endpoint", label: t("quickInsert.typeEndpoint"), icon: Globe },
    ],
    [t],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
    () => ({
      panel: splitSearchHelp(t("quickInsert.searchHelpPanel")),
      note: splitSearchHelp(t("quickInsert.searchHelpNote")),
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

  const filteredAws = useMemo(() => {
    if (!q) return [];
    const rows: { categoryId: AwsCategoryId; serviceId: string; serviceName: string; iconName: string }[] = [];
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

  const insertPos = { x: flowPos.x + 20, y: flowPos.y + 20 };

  const handleSelectC4 = (type: ComponentType, label: string) => {
    const comp = addComponent(type, t("quickInsert.newNamed", { name: label }), null, insertPos);
    if (sourceNodeId) {
      addConnection(sourceNodeId, comp.id, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
    }
    onInsert(comp.id);
  };

  const handleSelectCanvas = (type: ComponentType, label: string, panelKind?: PanelKind) => {
    const panelDefaultName = panelKind ? getPanelKindDef(panelKind).defaultName : undefined;
    const name = getDefaultNameForNewComponent(type, label, panelDefaultName);
    const comp = addComponent(type, name, null, insertPos, undefined, panelKind);
    if (sourceNodeId) {
      addConnection(sourceNodeId, comp.id, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
    }
    onInsert(comp.id);
  };

  const handleSelectAws = (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => {
    const panelKind = getPanelKindForAwsService(serviceId);
    const comp = panelKind
      ? addComponent("panel", getPanelKindDef(panelKind).defaultName, null, insertPos, undefined, panelKind)
      : addComponent(categoryId, serviceName, null, insertPos, serviceId);
    if (sourceNodeId) {
      addConnection(sourceNodeId, comp.id, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
    }
    onInsert(comp.id);
  };

  const handleSelectService = (serviceId: string, name: string) => {
    const comp = addComponent("system", name, null, insertPos);
    linkComponentToService(comp.id, serviceId);
    if (sourceNodeId) {
      addConnection(sourceNodeId, comp.id, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
    }
    onInsert(comp.id);
  };

  const left = Math.min(screenPos.x + 8, window.innerWidth - POPOVER_W - 8);
  const top = Math.min(screenPos.y + 8, window.innerHeight - POPOVER_H_MAX - 8);

  const showEmpty =
    !!search.trim() &&
    filteredC4.length === 0 &&
    filteredCanvas.length === 0 &&
    filteredAws.length === 0 &&
    filteredServices.length === 0;

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
          placeholder={t("quickInsert.searchPlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="max-h-64 overflow-y-auto pb-1">
        {filteredC4.length > 0 && (
          <>
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("elementPicker.c4Model")}
              </span>
            </div>
            {filteredC4.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleSelectC4(opt.type, opt.label)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
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
            {filteredCanvas.map((opt) => (
              <button
                key={
                  opt.type === "panel"
                    ? `panel-${opt.panelKind ?? "default"}`
                    : opt.type
                }
                onClick={() => handleSelectCanvas(opt.type, opt.label, opt.panelKind)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
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
            {filteredAws.map((row) => (
              <button
                key={row.serviceId}
                onClick={() => handleSelectAws(row.categoryId, row.serviceId, row.serviceName)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
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
            {filteredServices.map((svc) => (
              <button
                key={svc.id}
                onClick={() => handleSelectService(svc.id, svc.name)}
                className="flex flex-col w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
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

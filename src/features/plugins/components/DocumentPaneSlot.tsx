import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { FileCode2, X } from "lucide-react";
import { PanelRailButton } from "@/components/PanelRail";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { PluginComponentPatch, PluginPanelContext, PluginServicePatch } from "../plugin.types";
import { resolveLocalizedText } from "../localized-text";
import { sanitizeComponentPatch, sanitizeServicePatch } from "../snapshots";
import { usePluginPanels } from "../use-plugin-contributions";
import { PluginErrorBoundary } from "./PluginErrorBoundary";
import { getOpenPaneId, setOpenPaneId, subscribe } from "./document-pane-state";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 480;

/** Panel-rail toggles, one per `document-pane` panel (plugin API 1.4). */
export function DocumentPaneToggles() {
  const { i18n } = useTranslation();
  const panels = usePluginPanels("document-pane");
  const open = useSyncExternalStore(subscribe, getOpenPaneId);
  if (panels.length === 0) return null;
  return (
    <>
      {panels.map((panel) => {
        const active = open === panel.id;
        return (
          <PanelRailButton
            key={panel.id}
            label={resolveLocalizedText(panel.title, i18n.language)}
            icon={<FileCode2 className="h-4 w-4" />}
            active={active}
            onClick={() => setOpenPaneId(active ? null : panel.id)}
          />
        );
      })}
    </>
  );
}

/** The open `document-pane` panel, docked right of the canvas and resizable. */
export function DocumentPaneSlot({ isEditMode }: { isEditMode: boolean }) {
  const { t, i18n } = useTranslation();
  const panels = usePluginPanels("document-pane");
  const open = useSyncExternalStore(subscribe, getOpenPaneId);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const updateComponentAction = useDiagramStore((state) => state.updateComponent);
  const updateServiceAction = useDiagramStore((state) => state.updateService);

  const context: PluginPanelContext = useMemo(
    () => ({
      selection: [],
      service: null,
      updateComponent: (id: string, patch: PluginComponentPatch) =>
        updateComponentAction(id, sanitizeComponentPatch(patch)),
      updateService: (id: string, patch: PluginServicePatch) =>
        updateServiceAction(id, sanitizeServicePatch(patch)),
      locale: i18n.language,
      isEditMode,
    }),
    [i18n.language, isEditMode, updateComponentAction, updateServiceAction],
  );

  const panel = panels.find((candidate) => candidate.id === open);
  if (!panel) return null;
  const PanelComponent = panel.component;

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = width;
    const move = (e: PointerEvent) =>
      setWidth(
        Math.max(MIN_WIDTH, Math.min(window.innerWidth * 0.7, startWidth + startX - e.clientX)),
      );
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col border-l border-border bg-card"
      style={{ width }}
      aria-label={resolveLocalizedText(panel.title, i18n.language)}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("plugins.documentPane.resize")}
        onPointerDown={startResize}
        className="absolute left-0 top-0 z-10 h-full w-1 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
      />
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{resolveLocalizedText(panel.title, i18n.language)}</span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpenPaneId(null)}
          title={t("plugins.documentPane.close")}
          aria-label={t("plugins.documentPane.close")}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <PluginErrorBoundary
          key={panel.id}
          label="document pane"
          fallback={
            <div role="alert" className="p-3 text-xs text-destructive">
              {t("plugins.panel.crashed")}
            </div>
          }
        >
          <PanelComponent context={context} />
        </PluginErrorBoundary>
      </div>
    </aside>
  );
}

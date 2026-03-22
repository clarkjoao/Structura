import { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";
import { X, Trash2, Link2, LayoutDashboard, RefreshCw } from "lucide-react";
import {
  useAllDiagrams,
  useActiveDiagram,
  useAllServices,
  useDiagramActions,
  resolveSceneSnapshot,
} from "@/features/diagram";
import type {
  Component,
  ComponentPatch,
  ComponentType,
  ServiceDefinition,
  SwimlaneStyle,
} from "@/features/diagram";
import { isPanelComponent, isNoteComponent, isC4Component, isSystemType, isContainerType } from "@/features/diagram";
import { isAwsType, AWS_CATEGORIES, AWS_CATEGORY_MAP, AWS_SERVICE_MAP } from "@/lib/catalogs/aws";
import { PANEL_KINDS, getPanelKindDef } from "@/lib/catalogs/panels";
import { PanelKind } from "@/features/diagram";
import { SwimlaneOrientation } from "@/features/canvas/enums";
import AwsIcon from "../../nodes/AwsIcon";
import Field from "./components/Field";
import TabBar, { type Tab } from "./components/TabBar";
import ColorSwatches from "./components/ColorSwatches";
import PanelColorPicker from "./components/PanelColorPicker";
import { C4_DEFAULT_COLORS } from "./components/colorPresets";
import { LANE_COLORS } from "./swimlaneLaneColors";
import { SWIMLANE_DEFAULT_H, SWIMLANE_DEFAULT_W } from "@/features/canvas/constants";
import ConnectionsTab from "./components/ConnectionsTab";
import { ComponentIconTab } from "./components/ComponentIconTab";
import ServiceRegistryCombobox from "./components/ServiceRegistryCombobox";
import { useTranslation } from "react-i18next";
import i18n from "@/infrastructure/i18n";

function mergeSwimlane(
  current: SwimlaneStyle | undefined,
  partial: Partial<SwimlaneStyle>,
): SwimlaneStyle {
  return {
    orientation: partial.orientation ?? current?.orientation ?? SwimlaneOrientation.Horizontal,
    laneColor: partial.laneColor ?? current?.laneColor ?? "#6366f1",
    ...(partial.laneLabel !== undefined
      ? { laneLabel: partial.laneLabel }
      : current?.laneLabel !== undefined
        ? { laneLabel: current.laneLabel }
        : {}),
  };
}

const DEFAULT_PANEL_COLOR = "hsl(220 20% 20%)";
const DEFAULT_PANEL_OPACITY = 10;
const DEFAULT_NOTE_COLOR = "hsl(45 25% 97%)";

function buildComponentSyncPatch(
  service: ServiceDefinition,
  component: Component,
): Partial<Omit<Component, "id">> {
  const patch: Partial<Omit<Component, "id">> = {
    name: service.name,
    description: service.description,
    tags: service.tags?.length ? service.tags : undefined,
  };

  if ("technology" in component) {
    (
      patch as Partial<
        Omit<Component, "id"> & { technology?: string | undefined }
      >
    ).technology = service.technology.length
      ? service.technology.join(", ")
      : undefined;
  }

  return patch;
}

function shouldPreserveContent(name: string, description: string) {
  return name.trim().length > 0 && description.trim().length > 0;
}

interface ComponentPanelProps {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
  removeComponent: (id: string) => void;
  onUngroup?: () => void;
  focusTitleTrigger?: number;
}

const ComponentPanel = ({ component, onClose, updateComponent, removeComponent, onUngroup, focusTitleTrigger = 0 }: ComponentPanelProps) => {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        const el = titleInputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  }, [focusTitleTrigger]);
  const allDiagrams = useAllDiagrams();
  const allServices = useAllServices();
  const activeDiagram = useActiveDiagram();
  const resolved = useMemo(
    () =>
      activeDiagram
        ? resolveSceneSnapshot(activeDiagram, activeDiagram.activeSceneId ?? null)
        : null,
    [activeDiagram],
  );
  const { linkComponentToService, linkComponentToDiagram, addDiagram, setParent, updateNodeLayout } = useDiagramActions();
  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState(component.name);
  const [desc, setDesc] = useState(component.description);
  const [tech, setTech] = useState((component as { technology?: string }).technology ?? "");
  const [tags, setTags] = useState<string[]>(component.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [type, setType] = useState<ComponentType>(component.type);
  const [awsService, setAwsService] = useState((component as { awsService?: string }).awsService ?? "");
  const [createdDiagramName, setCreatedDiagramName] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPanel = isPanelComponent(component);
  const isNote = isNoteComponent(component);
  const isSimple = isPanel || isNote;
  const isAws = isAwsType(type);
  const svcInfo = awsService ? AWS_SERVICE_MAP.get(awsService) : null;
  const canCreateLinked = isSystemType(component.type) || isContainerType(component.type);
  const linkedService = useMemo(
    () => allServices.find((service) => service.id === component.serviceId) ?? null,
    [allServices, component.serviceId],
  );
  const parentComp = component.parentId ? resolved?.components[component.parentId] : undefined;
  const isChildOfPanel = !!component.parentId && parentComp && isPanelComponent(parentComp);
  const handleRemoveFromGroup = () => {
    if (!component.parentId || !setParent || !updateNodeLayout || !activeDiagram || !resolved) return;
    const childLayout = resolved.nodeLayouts[component.id];
    const parentLayout = resolved.nodeLayouts[component.parentId];
    setParent(component.id, null);
    if (childLayout && parentLayout) {
      updateNodeLayout(component.id, {
        x: childLayout.x + parentLayout.x,
        y: childLayout.y + parentLayout.y,
      });
    }
  };

  const debouncedUpdate = useMemo(() => debounce((patch: Partial<Omit<Component, "id">>) => { updateComponent(component.id, patch); }, 300), [component.id, updateComponent]);
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);
  useEffect(() => {
    setTab("details");
  }, [component.id]);

  const handleCreateLinked = () => {
    const level = isSystemType(component.type) ? "container" : "component";
    const newDiagram = addDiagram(component.name, level, activeDiagram?.domain);
    linkComponentToDiagram(component.id, newDiagram.id);
    setCreatedDiagramName(newDiagram.name);
    confirmTimerRef.current = setTimeout(() => setCreatedDiagramName(null), 3000);
  };

  const syncFromService = (
    service: ServiceDefinition,
    options?: { persist?: boolean },
  ) => {
    const patch = buildComponentSyncPatch(service, component);
    debouncedUpdate.cancel();
    setName(service.name);
    setDesc(service.description);
    setTags(service.tags ?? []);
    setTagInput("");
    if ("technology" in component) {
      setTech(service.technology.join(", "));
    }
    if (options?.persist !== false) {
      updateComponent(component.id, patch);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isPanel ? t("elementPanel.panelHeaderPanel") : isNote ? t("elementPanel.panelHeaderNote") : component.name}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      {isPanel && onUngroup && (
        <div className="px-3 py-2 border-b border-border">
          <button type="button" onClick={onUngroup} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50">{t("endpointPanel.ungroup")}</button>
        </div>
      )}
      {isChildOfPanel && (
        <div className="px-3 py-2 border-b border-border">
          <button type="button" onClick={handleRemoveFromGroup} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50" title={t("elementPanel.removeFromGroupTitle")}>
            {t("endpointPanel.removeFromGroup")}
          </button>
        </div>
      )}
      <TabBar active={tab} onChange={setTab} showConnections={!isSimple} />
      {tab === "connections" && !isSimple ? (
        <ConnectionsTab componentId={component.id} />
      ) : tab === "icon" ? (
        <ComponentIconTab
          component={component}
          diagramId={activeDiagram?.id ?? ""}
          updateComponent={updateComponent}
        />
      ) : (
        <div className="p-4 space-y-4 overflow-auto flex-1">
          {!isSimple && isAws && svcInfo && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
              <AwsIcon iconName={svcInfo.iconName} size={32} />
              <div>
                <p className="text-xs font-semibold text-foreground">{svcInfo.name}</p>
                <p className="text-[10px] text-muted-foreground">{AWS_CATEGORY_MAP.get(type)?.name}</p>
              </div>
            </div>
          )}
          <Field label={t("common.name")} value={name} onChange={(v) => { setName(v); debouncedUpdate({ name: v }); }} inputRef={titleInputRef} />
          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">{t("endpointPanel.type")}</label>
              <select value={type} onChange={(e) => { const nextType = e.target.value as ComponentType; setType(nextType); if (!nextType.startsWith("aws-")) setAwsService(""); updateComponent(component.id, { type: nextType, awsService: nextType.startsWith("aws-") && awsService ? awsService : undefined } as Partial<Omit<Component, "id">>); }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <optgroup label={t("elementPanel.c4ModelGroup")}><option value="person">{t("colors.c4Person")}</option><option value="system">{t("colors.c4System")}</option><option value="container">{t("colors.c4Container")}</option><option value="component">{t("colors.c4Component")}</option></optgroup>
                {AWS_CATEGORIES.map((cat) => (<optgroup key={cat.id} label={t("endpointPanel.awsCategory", { name: cat.name })}><option value={cat.id}>{cat.name}</option></optgroup>))}
              </select>
            </div>
          )}
          {!isSimple && isAws && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">{t("elementPanel.awsServiceLabel")}</label>
              <select value={awsService} onChange={(e) => { const s = e.target.value; setAwsService(s); const svc = AWS_SERVICE_MAP.get(s); const preserveContent = shouldPreserveContent(name, desc); const shouldRename = !!svc && !preserveContent && (name.trim() === "" || name.startsWith(i18n.t("common.defaultNamePrefix")) || name === component.name); updateComponent(component.id, { awsService: s || undefined, ...(shouldRename ? { name: svc.name } : {}) } as Partial<Omit<Component, "id">>); if (shouldRename) setName(svc!.name); }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">{t("endpointPanel.selectAwsService")}</option>
                {AWS_CATEGORY_MAP.get(type)?.services.map((svc) => (<option key={svc.id} value={svc.id}>{svc.name}</option>))}
              </select>
            </div>
          )}
          <Field
            label={isNote ? t("endpointPanel.content") : t("common.description")}
            value={desc}
            onChange={(v) => { setDesc(v); debouncedUpdate({ description: v }); }}
            multiline
            placeholder={isNote ? t("elementPanel.notePlaceholder") : undefined}
            hint={isNote ? t("endpointPanel.markdownHint") : undefined}
          />
          {isPanelComponent(component) && (
            <>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                  {t("endpointPanel.groupingType")}
                </label>
                <select
                  value={component.panelKind ?? "default"}
                  onChange={(e) => {
                    const kind = e.target.value as PanelKind;
                    const def = getPanelKindDef(kind);
                    const layout = resolved?.nodeLayouts[component.id];
                    if (kind === PanelKind.Swimlane) {
                      updateComponent(component.id, {
                        panelKind: kind,
                        panelColor: def.defaultColor,
                        swimlane: {
                          orientation: SwimlaneOrientation.Horizontal,
                          laneColor: "#6366f1",
                          laneLabel: t("swimlane.defaultLaneLabel"),
                        },
                      } as ComponentPatch);
                      if (layout) {
                        updateNodeLayout(
                          component.id,
                          { x: layout.x, y: layout.y },
                          { width: SWIMLANE_DEFAULT_W, height: SWIMLANE_DEFAULT_H },
                        );
                      }
                    } else {
                      updateComponent(component.id, {
                        panelKind: kind,
                        panelColor: def.defaultColor,
                        swimlane: undefined,
                      } as ComponentPatch);
                    }
                  }}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PANEL_KINDS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === PanelKind.Swimlane ? t("swimlane.title") : p.label}
                    </option>
                  ))}
                </select>
              </div>
              {component.panelKind === PanelKind.Swimlane ? (
                <>
                  <Field
                    label={t("swimlane.laneLabel")}
                    value={component.swimlane?.laneLabel ?? ""}
                    onChange={(v) => {
                      updateComponent(component.id, {
                        swimlane: mergeSwimlane(component.swimlane, { laneLabel: v }),
                      } as ComponentPatch);
                    }}
                  />
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                      {t("swimlane.orientation")}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateComponent(component.id, {
                            swimlane: mergeSwimlane(component.swimlane, {
                              orientation: SwimlaneOrientation.Horizontal,
                            }),
                          } as ComponentPatch);
                        }}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                          (component.swimlane?.orientation ?? SwimlaneOrientation.Horizontal) === SwimlaneOrientation.Horizontal
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("swimlane.horizontal")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateComponent(component.id, {
                            swimlane: mergeSwimlane(component.swimlane, {
                              orientation: SwimlaneOrientation.Vertical,
                            }),
                          } as ComponentPatch);
                        }}
                        className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                          component.swimlane?.orientation === SwimlaneOrientation.Vertical
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("swimlane.vertical")}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                      {t("swimlane.laneColor")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LANE_COLORS.map((c) => {
                        const current = component.swimlane?.laneColor ?? "#6366f1";
                        const active = current === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            title={c.label}
                            aria-label={c.label}
                            onClick={() => {
                              updateComponent(component.id, {
                                swimlane: mergeSwimlane(component.swimlane, {
                                  laneColor: c.value,
                                }),
                                panelColor: c.value,
                              } as ComponentPatch);
                            }}
                            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 ${
                              active ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "border-border"
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <PanelColorPicker componentId={component.id} currentColor={component.panelColor ?? getPanelKindDef(component.panelKind).defaultColor} currentOpacity={component.panelOpacity ?? DEFAULT_PANEL_OPACITY} updateComponent={updateComponent} />
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
                      {t("elementPanel.border")}
                    </label>
                    <select
                      value={component.borderStyle ?? "solid"}
                      onChange={(e) => updateComponent(component.id, { borderStyle: e.target.value as "solid" | "dashed" | "dotted" } as ComponentPatch)}
                      className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="solid">{t("common.strokeSolid")}</option>
                      <option value="dashed">{t("common.strokeDashed")}</option>
                      <option value="dotted">{t("common.strokeDotted")}</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}
          {isNoteComponent(component) && <ColorSwatches componentId={component.id} currentColor={component.panelColor ?? DEFAULT_NOTE_COLOR} label={t("elementPanel.noteColorLabel")} presetGroup="note" updateComponent={updateComponent} />}
          {!isSimple && <Field label={t("common.technology")} value={tech} onChange={(v) => { setTech(v); debouncedUpdate({ technology: v || undefined } as Partial<Omit<Component, "id">>); }} />}
          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">{t("common.tags")}</label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {tag}
                      <button type="button" onClick={() => { const updated = tags.filter((t) => t !== tag); setTags(updated); debouncedUpdate({ tags: updated }); }} className="hover:text-foreground leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim();
                    if (!tags.includes(newTag)) {
                      const updated = [...tags, newTag];
                      setTags(updated);
                      debouncedUpdate({ tags: updated });
                    }
                    setTagInput("");
                  }
                }}
                placeholder={t("elementPanel.tagsPlaceholder")}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          {!isSimple && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                  <Link2 className="h-3 w-3 inline mr-1" />
                  {t("elementPanel.linkService")}
                </label>
                <button
                  type="button"
                  onClick={() => linkedService && syncFromService(linkedService)}
                  disabled={!linkedService}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t("elementPanel.syncFromServiceTitle")}
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("elementPanel.syncButton")}
                </button>
              </div>
              <ServiceRegistryCombobox
                value={component.serviceId ?? null}
                onChange={(id) => {
                  linkComponentToService(component.id, id ?? undefined);
                  const service = allServices.find((item) => item.id === id);
                  if (service) syncFromService(service, { persist: false });
                }}
              />
            </div>
          )}
          {!isSimple && canCreateLinked && !component.linkedDiagramId && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block"><LayoutDashboard className="h-3 w-3 inline mr-1" />{t("elementPanel.linkedDiagram")}</label>
              {createdDiagramName ? (
                <p className="text-xs text-primary bg-primary/10 rounded-md px-3 py-2">{t("elementPanel.linkedDiagramCreated", { name: createdDiagramName })}</p>
              ) : (
                <button onClick={handleCreateLinked} className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  <LayoutDashboard className="h-3.5 w-3.5" />{t("elementPanel.createLinkedDiagram")}
                </button>
              )}
            </div>
          )}
          {!isSimple && isC4Component(component) && (
            <ColorSwatches
              componentId={component.id}
              currentColor={(component as { panelColor?: string }).panelColor ?? C4_DEFAULT_COLORS[component.type] ?? C4_DEFAULT_COLORS.system}
              label={t("elementPanel.borderColorLabel")}
              presetGroup="c4"
              allowClear
              updateComponent={updateComponent}
            />
          )}
          {!isSimple && (!canCreateLinked || component.linkedDiagramId) && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block"><LayoutDashboard className="h-3 w-3 inline mr-1" />{t("elementPanel.linkToDiagram")}</label>
              <select value={component.linkedDiagramId ?? ""} onChange={(e) => linkComponentToDiagram(component.id, e.target.value || undefined)} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">{t("elementPanel.noneOption")}</option>
                {allDiagrams.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
          )}
          <div><label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">{t("elementPanel.idLabel")}</label><p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">{component.id}</p></div>
          <div className="pt-2">
            <button onClick={() => { debouncedUpdate.cancel(); removeComponent(component.id); onClose(); }} className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full">
              <Trash2 className="h-3.5 w-3.5" /> {t("elementPanel.remove")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentPanel;

import { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";
import { X, Trash2, Lock, Unlock } from "lucide-react";
import {
  useAllDiagrams,
  useActiveDiagram,
  useAllServices,
  useDiagramActions,
  resolveSceneSnapshot,
} from "@/features/diagram";
import type { Component, ComponentPatch, ComponentType, ServiceDefinition } from "@/features/diagram";
import {
  isPanelComponent,
  isNoteComponent,
  isC4Component,
  isDbTableComponent,
  isJsonViewerComponent,
  isSystemType,
  isContainerType,
  isSvgComponentType,
} from "@/features/diagram";
import { isAwsType, AWS_CATEGORIES, AWS_CATEGORY_MAP, AWS_SERVICE_MAP } from "@/lib/catalogs/aws";
import AwsIcon from "../../nodes/AwsIcon";
import TabBar, { type Tab } from "./components/TabBar";
import { C4_DEFAULT_COLORS } from "./components/colorPresets";
import ConnectionsTab from "./components/ConnectionsTab";
import { ComponentIconTab } from "./components/ComponentIconTab";
import { useTranslation } from "react-i18next";
import i18n from "@/infrastructure/i18n";
import { FIELD_DEBOUNCE_MS } from "@/features/canvas/canvas.constants";
import {
  BasicFieldsSection,
  ServiceLinkSection,
  LinkedDiagramSection,
  PanelStyleSection,
  ColorAccentSection,
  ExternalLinksSection,
} from "./sections";
import { isComponentType } from "@/features/diagram";

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

const ComponentPanel = ({
  component,
  onClose,
  updateComponent,
  removeComponent,
  onUngroup,
  focusTitleTrigger = 0,
}: ComponentPanelProps) => {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        const element = titleInputRef.current;
        if (element) {
          element.focus();
          element.select();
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
  const {
    linkComponentToService,
    linkComponentToDiagram,
    addDiagram,
    setParent,
    updateNodeLayout,
    addExternalLink,
    updateExternalLink,
    removeExternalLink,
  } = useDiagramActions();
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
  const isDbTable = isDbTableComponent(component);
  const isSimple = isPanel || isNote;
  const showIconTab = !isSvgComponentType(component.type);
  const isAws = isAwsType(type);
  const serviceInfo = awsService ? AWS_SERVICE_MAP.get(awsService) : null;
  const canCreateLinked = isSystemType(component.type) || isContainerType(component.type)|| isComponentType(component.type) || isAwsType(component.type);
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

  const debouncedUpdate = useMemo(
    () =>
      debounce((patch: ComponentPatch) => updateComponent(component.id, patch), FIELD_DEBOUNCE_MS),
    [component.id, updateComponent],
  );
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    setTab("details");
  }, [component.id]);

  useEffect(() => {
    if (!showIconTab && tab === "icon") {
      setTab("details");
    }
  }, [showIconTab, tab]);

  const handleCreateLinked = () => {
    const level = isSystemType(component.type) ? "container" : "component";
    const newDiagram = addDiagram(component.name, level, activeDiagram?.domain);
    linkComponentToDiagram(component.id, newDiagram.id);
    setCreatedDiagramName(newDiagram.name);
    confirmTimerRef.current = setTimeout(() => setCreatedDiagramName(null), 3000);
  };

  const syncFromService = (service: ServiceDefinition, options?: { persist?: boolean }) => {
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

  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter((item) => item !== tag);
    setTags(updated);
    debouncedUpdate({ tags: updated });
  };

  const handleCommitTagInput = () => {
    const newTag = tagInput.trim();
    if (!newTag) return;
    if (!tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      debouncedUpdate({ tags: updated });
    }
    setTagInput("");
  };

  const diagramOptions = useMemo(
    () => allDiagrams.map((diagram) => ({ id: diagram.id, name: diagram.name })),
    [allDiagrams],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isPanel
            ? t("elementPanel.panelHeaderPanel")
            : isNote
              ? t("elementPanel.panelHeaderNote")
              : isDbTableComponent(component)
                ? component.tableName
                : isJsonViewerComponent(component)
                  ? component.name || t("jsonViewer.unnamed")
                  : component.name}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateComponent(component.id, { locked: !component.locked })}
            title={component.locked ? t("elementPanel.unlock") : t("elementPanel.lock")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {component.locked ? (
              <Lock className="h-4 w-4 text-amber-500" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isPanel && onUngroup && (
        <div className="px-3 py-2 border-b border-border">
          <button
            type="button"
            onClick={onUngroup}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            {t("endpointPanel.ungroup")}
          </button>
        </div>
      )}
      {isChildOfPanel && (
        <div className="px-3 py-2 border-b border-border">
          <button
            type="button"
            onClick={handleRemoveFromGroup}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
            title={t("elementPanel.removeFromGroupTitle")}
          >
            {t("endpointPanel.removeFromGroup")}
          </button>
        </div>
      )}
      <TabBar
        active={tab}
        onChange={setTab}
        showConnections={!isSimple}
        showIconTab={showIconTab}
      />
      {tab === "connections" && !isSimple ? (
        <ConnectionsTab componentId={component.id} />
      ) : tab === "icon" && showIconTab ? (
        <ComponentIconTab
          component={component}
          diagramId={activeDiagram?.id ?? ""}
          updateComponent={updateComponent}
        />
      ) : (
        <div className="p-4 space-y-4 overflow-auto flex-1">
          {!isSimple && isAws && serviceInfo && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
              <AwsIcon iconName={serviceInfo.iconName} size={32} />
              <div>
                <p className="text-xs font-semibold text-foreground">{serviceInfo.name}</p>
                <p className="text-[10px] text-muted-foreground">{AWS_CATEGORY_MAP.get(type)?.name}</p>
              </div>
            </div>
          )}
          {isSimple ? (
            <BasicFieldsSection
              name={name}
              desc={desc}
              tech={tech}
              tags={tags}
              tagInput={tagInput}
              isNote={isNote}
              isPanel={isPanel}
              isAws={isAws}
              showTechnology={false}
              showTags={false}
              titleInputRef={titleInputRef}
              onChangeName={(value) => {
                setName(value);
                debouncedUpdate(
                  isDbTable ? { name: value, tableName: value } : { name: value },
                );
              }}
              onChangeDesc={(value) => {
                setDesc(value);
                debouncedUpdate({ description: value });
              }}
              onChangeTech={(value) => {
                setTech(value);
                debouncedUpdate({ technology: value || undefined } as ComponentPatch);
              }}
              onChangeTagInput={setTagInput}
              onRemoveTag={handleRemoveTag}
              onCommitTagInput={handleCommitTagInput}
            />
          ) : (
            <>
              <BasicFieldsSection
                name={name}
                desc={desc}
                tech={tech}
                tags={tags}
                tagInput={tagInput}
                isNote={isNote}
                isPanel={isPanel}
                isAws={isAws}
                showDescription={false}
                showTechnology={false}
                showTags={false}
                titleInputRef={titleInputRef}
                onChangeName={(value) => {
                  setName(value);
                  debouncedUpdate(
                    isDbTable ? { name: value, tableName: value } : { name: value },
                  );
                }}
                onChangeDesc={(value) => {
                  setDesc(value);
                  debouncedUpdate({ description: value });
                }}
                onChangeTech={(value) => {
                  setTech(value);
                  debouncedUpdate({ technology: value || undefined } as ComponentPatch);
                }}
                onChangeTagInput={setTagInput}
                onRemoveTag={handleRemoveTag}
                onCommitTagInput={handleCommitTagInput}
              />
              {!isDbTable && (
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    {t("endpointPanel.type")}
                  </label>
                  <select
                    value={type}
                    onChange={(event) => {
                      const nextType = event.target.value as ComponentType;
                      setType(nextType);
                      if (!nextType.startsWith("aws-")) setAwsService("");
                      updateComponent(component.id, {
                        type: nextType,
                        awsService: nextType.startsWith("aws-") && awsService ? awsService : undefined,
                      } as Partial<Omit<Component, "id">>);
                    }}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <optgroup label={t("elementPanel.c4ModelGroup")}>
                      <option value="person">{t("colors.c4Person")}</option>
                      <option value="system">{t("colors.c4System")}</option>
                      <option value="container">{t("colors.c4Container")}</option>
                      <option value="component">{t("colors.c4Component")}</option>
                    </optgroup>
                    {AWS_CATEGORIES.map((category) => (
                      <optgroup key={category.id} label={t("endpointPanel.awsCategory", { name: category.name })}>
                        <option value={category.id}>{category.name}</option>
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
              {isAws && (
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    {t("elementPanel.awsServiceLabel")}
                  </label>
                  <select
                    value={awsService}
                    onChange={(event) => {
                      const nextService = event.target.value;
                      setAwsService(nextService);
                      const serviceEntry = AWS_SERVICE_MAP.get(nextService);
                      const preserveContent = shouldPreserveContent(name, desc);
                      const shouldRename =
                        !!serviceEntry &&
                        !preserveContent &&
                        (name.trim() === "" ||
                          name.startsWith(i18n.t("common.defaultNamePrefix")) ||
                          name === component.name);
                      updateComponent(component.id, {
                        awsService: nextService || undefined,
                        ...(shouldRename ? { name: serviceEntry.name } : {}),
                      } as Partial<Omit<Component, "id">>);
                      if (shouldRename) setName(serviceEntry.name);
                    }}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">{t("endpointPanel.selectAwsService")}</option>
                    {AWS_CATEGORY_MAP.get(type)?.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <BasicFieldsSection
                name={name}
                desc={desc}
                tech={tech}
                tags={tags}
                tagInput={tagInput}
                isNote={isNote}
                isPanel={isPanel}
                isAws={isAws}
                showName={false}
                showTechnology
                showTags
                onChangeName={(value) => {
                  setName(value);
                  debouncedUpdate(
                    isDbTable ? { name: value, tableName: value } : { name: value },
                  );
                }}
                onChangeDesc={(value) => {
                  setDesc(value);
                  debouncedUpdate({ description: value });
                }}
                onChangeTech={(value) => {
                  setTech(value);
                  debouncedUpdate({ technology: value || undefined } as ComponentPatch);
                }}
                onChangeTagInput={setTagInput}
                onRemoveTag={handleRemoveTag}
                onCommitTagInput={handleCommitTagInput}
              />
            </>
          )}
          {isPanelComponent(component) && (
            <PanelStyleSection
              component={component}
              updateComponent={updateComponent}
              updateNodeLayout={updateNodeLayout}
              componentNodeLayout={resolved?.nodeLayouts[component.id]}
            />
          )}
          {isNoteComponent(component) && (
            <ColorAccentSection
              componentId={component.id}
              type="note"
              currentColor={component.panelColor ?? DEFAULT_NOTE_COLOR}
              updateComponent={updateComponent}
            />
          )}
          {!isSimple && isC4Component(component) && (
            <ColorAccentSection
              componentId={component.id}
              type="c4"
              currentColor={
                (component as { panelColor?: string }).panelColor ??
                C4_DEFAULT_COLORS[component.type] ??
                C4_DEFAULT_COLORS.system
              }
              allowClear
              updateComponent={updateComponent}
            />
          )}
          {!isSimple && (
            <ServiceLinkSection
              componentId={component.id}
              serviceId={component.serviceId}
              linkedService={linkedService}
              onSync={() => linkedService && syncFromService(linkedService)}
              onServiceChange={(serviceId) => {
                linkComponentToService(component.id, serviceId ?? undefined);
                const service = allServices.find((item) => item.id === serviceId);
                if (service) syncFromService(service, { persist: false });
              }}
            />
          )}
          {!isSimple && (
            <LinkedDiagramSection
            componentId={component.id}
            linkedDiagramId={component.linkedDiagramId}
            canCreateLinked={canCreateLinked}
            createdDiagramName={createdDiagramName}
            diagrams={allDiagrams}
            suggestedDiagram={allDiagrams.find(d => d.id === component.id || d.name.toLowerCase().includes(component.name.toLowerCase())) ?? null}
            onCreateLinked={handleCreateLinked}
            onChangeLinked={(diagramId) => linkComponentToDiagram(component.id, diagramId)}
            />
          )}
          {!isSimple && (
            <ExternalLinksSection
              componentId={component.id}
              links={component.externalLinks ?? []}
              onAdd={(link) => addExternalLink(component.id, link)}
              onUpdate={(linkId, patch) => updateExternalLink(component.id, linkId, patch)}
              onRemove={(linkId) => removeExternalLink(component.id, linkId)}
            />
          )}

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.idLabel")}
            </label>
            <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">{component.id}</p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                debouncedUpdate.cancel();
                removeComponent(component.id);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("elementPanel.remove")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentPanel;

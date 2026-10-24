import { useState, useMemo, useEffect, useRef } from "react";
import {
  useActiveDiagramModel,
  useAllServices,
  useDiagramActions,
  resolveVersionSnapshot,
} from "@/features/diagram";
import type {
  Component,
  ComponentPatch,
  ComponentType,
  FlowNodeShape,
  ServiceDefinition,
} from "@/features/diagram";
import {
  cloudServiceIdClearingPatch,
  resolveCloudServiceId,
} from "@/features/diagram/model/cloud-service-id";
import {
  isPanelComponent,
  isNoteComponent,
  isDbTableComponent,
  isProcessNodeComponent,
  isSystemType,
  isContainerType,
} from "@/features/diagram";
import { cloudRegistry } from "@/features/cloud/registry/cloud.registry";
import CloudIcon from "../../nodes/CloudIcon";
import TabBar, { type Tab } from "./components/TabBar";
import ConnectionsTab from "./components/ConnectionsTab";
import { ServicesTab } from "./components/ServicesTab";
import { useTranslation } from "react-i18next";
import i18n from "@/infrastructure/i18n";
import {
  PanelStyleSection,
  ExternalLinksSection,
  FlowchartFieldsSection,
  PositionSection,
} from "./sections";
import { ElementTypeSelect } from "./sections/ElementTypeSelect";
import { BoundarySections } from "./sections/BoundarySection";
import { DiagramLinkField } from "@/features/canvas/palette/DiagramLinkField";
import { toast } from "sonner";
import { isComponentType } from "@/features/diagram";
import { shouldRenameForCloudIcon } from "./shouldRenameForCloudIcon";
import { useElementTextLock } from "@/features/collaboration/hooks/useElementLocks";
import { useCanvasPreferencesStore } from "@/features/canvas/preferences";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { PanelKind } from "@/features/diagram/enums";
import {
  AdvancedFooter,
  CommitField,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
  PanelHeader,
  PanelSection,
  useElementIdentity,
  useElementMenu,
  useElementTrail,
} from "./shell";

const TAB_IDS: readonly Tab[] = ["details", "connections", "services"];

function buildComponentSyncPatch(service: ServiceDefinition, component: Component): ComponentPatch {
  const patch: ComponentPatch = {
    name: service.name,
    description: service.description,
    tags: service.tags?.length ? service.tags : undefined,
  };

  if ("technology" in component) {
    patch.technology = service.technology.length ? service.technology.join(", ") : undefined;
  }

  return patch;
}

interface ComponentPanelProps {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
  onFocusElement?: (componentId: string) => void;
  /** Collapses or expands a panel the way its canvas button does. */
  onTogglePanelCollapse?: (componentId: string) => void;
}

const ComponentPanel = ({
  component,
  onClose,
  updateComponent,
  removeComponent,
  focusTitleTrigger = 0,
  onFocusElement,
  onTogglePanelCollapse,
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
  const allServices = useAllServices();
  const activeDiagram = useActiveDiagramModel();
  const resolved = useMemo(
    () =>
      activeDiagram
        ? resolveVersionSnapshot(activeDiagram, activeDiagram.activeVersionId ?? null)
        : null,
    [activeDiagram],
  );
  const {
    linkComponentToService,
    linkComponentToDiagram,
    addDiagram,
    updateNodeLayout,
    setNodeZIndex,
    addExternalLink,
    updateExternalLink,
    removeExternalLink,
  } = useDiagramActions();
  const isPanel = isPanelComponent(component);
  const isNote = isNoteComponent(component);
  const isDbTable = isDbTableComponent(component);
  const isFlowchart = isProcessNodeComponent(component);
  const isSimple = isPanel || isNote;

  // The tab last used for this type survives switching to another element of it.
  const storedTab = useCanvasPreferencesStore((s) => s.elementPanelTabByType[component.type]);
  const setStoredTab = useCanvasPreferencesStore((s) => s.setElementPanelTab);
  const showConnections = !isSimple;
  const showServices = !isSimple && !isFlowchart;
  const tab: Tab = (() => {
    const wanted = TAB_IDS.find((id) => id === storedTab) ?? "details";
    if (wanted === "connections" && !showConnections) return "details";
    if (wanted === "services" && !showServices) return "details";
    return wanted;
  })();
  const setTab = (next: Tab) => setStoredTab(component.type, next);

  const [tagInput, setTagInput] = useState("");
  const type: ComponentType = component.type;
  const cloudService = resolveCloudServiceId(component) ?? "";
  const flowShape: FlowNodeShape = isFlowchart ? component.flowShape : "rectangle";
  const tags = component.tags ?? [];
  const technology = (component as { technology?: string }).technology ?? "";
  const cloudProvider = cloudRegistry.forType(type);
  const cloudServiceInfo =
    cloudProvider && cloudService ? cloudProvider.getService(cloudService) : null;
  const canCreateLinked =
    isSystemType(component.type) ||
    isContainerType(component.type) ||
    isComponentType(component.type) ||
    cloudRegistry.isCloudType(component.type);
  const linkedService = useMemo(
    () => allServices.find((service) => service.id === component.serviceId) ?? null,
    [allServices, component.serviceId],
  );

  const textLock = useElementTextLock(component.id);

  const identity = useElementIdentity(component);
  const trail = useElementTrail(component);
  const menu = useElementMenu(
    component,
    () => {
      removeComponent(component.id);
      onClose();
    },
    updateComponent,
  );

  const handleCreateLinked = () => {
    const level = isSystemType(component.type) ? "container" : "component";
    const newDiagram = addDiagram(component.name, level, activeDiagram?.domain);
    linkComponentToDiagram(component.id, newDiagram.id);
    toast.success(t("diagramLink.created", { name: newDiagram.name }));
  };

  const syncFromService = (service: ServiceDefinition) => {
    updateComponent(component.id, buildComponentSyncPatch(service, component));
  };

  const commitTags = (updated: string[]) => updateComponent(component.id, { tags: updated });

  const handleRemoveTag = (tag: string) => commitTags(tags.filter((item) => item !== tag));

  const handleCommitTagInput = () => {
    const newTag = tagInput.trim();
    if (!newTag) return;
    if (!tags.includes(newTag)) commitTags([...tags, newTag]);
    setTagInput("");
  };

  const nodeLayout = resolved?.nodeLayouts[component.id];
  const headerName = isDbTable ? component.tableName : component.name;
  const namePlaceholder = isPanel
    ? t("elementPanel.panelHeaderPanel")
    : isNote
      ? t("elementPanel.panelHeaderNote")
      : t("common.unnamedElement");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        icon={identity.icon}
        typeLabel={identity.typeLabel}
        name={headerName}
        namePlaceholder={namePlaceholder}
        onCommitName={(value) =>
          updateComponent(
            component.id,
            isDbTable ? { name: value, tableName: value } : { name: value },
          )
        }
        nameInputRef={titleInputRef}
        textLock={textLock}
        trail={trail}
        onSelectElement={onFocusElement}
        menu={menu}
        onClose={onClose}
      />
      {(showConnections || showServices) && (
        <TabBar
          active={tab}
          onChange={setTab}
          showConnections={showConnections}
          showServices={showServices}
        />
      )}
      {tab === "connections" ? (
        <ConnectionsTab componentId={component.id} />
      ) : tab === "services" ? (
        <ServicesTab
          componentId={component.id}
          serviceId={component.serviceId}
          linkedService={linkedService}
          onSync={() => linkedService && syncFromService(linkedService)}
          onServiceChange={(serviceId) => {
            linkComponentToService(component.id, serviceId ?? undefined);
          }}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PanelSection title={t("panelShell.sectionWhat")}>
              {!isSimple && cloudProvider && cloudServiceInfo && (
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <CloudIcon
                    providerId={cloudProvider.id}
                    iconName={cloudServiceInfo.iconName}
                    size={32}
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{cloudServiceInfo.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cloudProvider.getCategoryForType(type)?.name}
                    </p>
                  </div>
                </div>
              )}
              {!isSimple && !isDbTable && !isFlowchart && (
                <ElementTypeSelect
                  value={type}
                  onChange={(nextType) => {
                    const nextProvider = cloudRegistry.forType(nextType);
                    updateComponent(component.id, {
                      type: nextType,
                      ...cloudServiceIdClearingPatch(nextProvider ? cloudService : undefined),
                    } as unknown as ComponentPatch);
                  }}
                />
              )}
              {!isSimple && cloudProvider && (
                <div>
                  <label htmlFor="panel-cloud-service" className={PANEL_LABEL_CLASS}>
                    {t("elementPanel.awsServiceLabel")}
                  </label>
                  <select
                    id="panel-cloud-service"
                    value={cloudService}
                    onChange={(event) => {
                      const nextService = event.target.value;
                      const serviceEntry = cloudProvider.getService(nextService);
                      const shouldRename = shouldRenameForCloudIcon({
                        hasCloudCatalogEntry: !!serviceEntry,
                        businessServiceId: component.serviceId,
                        currentName: component.name,
                        defaultNamePrefix: i18n.t("common.defaultNamePrefix"),
                      });
                      updateComponent(component.id, {
                        ...cloudServiceIdClearingPatch(nextService),
                        ...(shouldRename && serviceEntry ? { name: serviceEntry.name } : {}),
                      } as unknown as ComponentPatch);
                    }}
                    className={PANEL_INPUT_CLASS}
                  >
                    <option value="">{t("endpointPanel.selectAwsService")}</option>
                    {cloudProvider.services
                      .filter((s) => s.categoryId === type)
                      .map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {!isSimple && (
                <CommitField
                  label={t("common.technology")}
                  value={technology}
                  addLabel={t("panelShell.addTechnology")}
                  onCommit={(value) =>
                    updateComponent(component.id, {
                      technology: value || undefined,
                    } as ComponentPatch)
                  }
                />
              )}
              <CommitField
                label={isNote ? t("endpointPanel.content") : t("common.description")}
                value={component.description}
                multiline
                addLabel={isNote ? undefined : t("panelShell.addDescription")}
                placeholder={isNote ? t("elementPanel.notePlaceholder") : undefined}
                hint={isNote ? t("endpointPanel.markdownHint") : undefined}
                onFocus={textLock.onFocus}
                onBlur={textLock.onBlur}
                onCommit={(value) => updateComponent(component.id, { description: value })}
              />
              {isFlowchart && (
                <FlowchartFieldsSection
                  flowShape={flowShape}
                  onFlowShapeChange={(shape) =>
                    updateComponent(component.id, { flowShape: shape } as ComponentPatch)
                  }
                />
              )}
              {isPanel && !isFlowchart && (
                <PanelStyleSection
                  component={component as Parameters<typeof PanelStyleSection>[0]["component"]}
                  updateComponent={updateComponent}
                  updateNodeLayout={updateNodeLayout}
                  componentNodeLayout={nodeLayout}
                />
              )}
            </PanelSection>
            {isPanel && !isFlowchart && component.panelKind !== PanelKind.Swimlane && (
              <BoundarySections
                component={component}
                updateComponent={updateComponent}
                onSelectElement={onFocusElement}
                onTogglePanelCollapse={onTogglePanelCollapse}
              />
            )}
            {!isSimple && !isFlowchart && (
              <PanelSection title={t("panelShell.sectionRelates")}>
                <DiagramLinkField
                  componentId={component.id}
                  label={t("diagramLink.linked")}
                  elementName={component.name}
                  linkedDiagramId={component.linkedDiagramId}
                  canCreate={canCreateLinked}
                  onLink={(diagramId) => linkComponentToDiagram(component.id, diagramId)}
                  onCreateAndLink={handleCreateLinked}
                />
              </PanelSection>
            )}
            {!isSimple && (
              <PanelSection
                title={t("panelShell.sectionMeta")}
                summary={tags.length > 0 ? tags.join(", ") : undefined}
              >
                <div>
                  <span className={PANEL_LABEL_CLASS}>{t("common.tags")}</span>
                  {tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {tag}
                          <button
                            type="button"
                            aria-label={t("panelShell.removeTag")}
                            onClick={() => handleRemoveTag(tag)}
                            className="leading-none hover:text-foreground"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onBlur={handleCommitTagInput}
                    onKeyDown={(event) => {
                      if (keyIs(event, KEY.ENTER) && tagInput.trim()) {
                        event.preventDefault();
                        handleCommitTagInput();
                      }
                    }}
                    placeholder={`+ ${t("panelShell.addTag")}`}
                    className={PANEL_INPUT_CLASS}
                  />
                </div>
                <ExternalLinksSection
                  componentId={component.id}
                  links={component.externalLinks ?? []}
                  onAdd={(link) => addExternalLink(component.id, link)}
                  onUpdate={(linkId, patch) => updateExternalLink(component.id, linkId, patch)}
                  onRemove={(linkId) => removeExternalLink(component.id, linkId)}
                />
              </PanelSection>
            )}
          </div>
          <AdvancedFooter
            id={component.id}
            zIndex={nodeLayout?.zIndex}
            onCommitZIndex={nodeLayout ? (z) => setNodeZIndex(component.id, z) : undefined}
          >
            <PositionSection
              componentId={component.id}
              nodeLayout={nodeLayout}
              updateNodeLayout={updateNodeLayout}
              isPanel={isPanel || isNote}
            />
          </AdvancedFooter>
        </>
      )}
    </div>
  );
};

export default ComponentPanel;

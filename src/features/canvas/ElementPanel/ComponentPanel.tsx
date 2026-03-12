import { useState, useMemo, useEffect, useRef } from "react";
import debounce from "lodash.debounce";
import { X, Trash2, Link2, LayoutDashboard, RefreshCw } from "lucide-react";
import { useAllDiagrams, useActiveDiagram, useAllServices, useDiagramActions } from "@/features/diagram";
import type { Component, ComponentType } from "@/features/diagram";
import { isPanelComponent, isNoteComponent } from "@/features/diagram";
import { isAwsType, AWS_CATEGORIES, AWS_CATEGORY_MAP, AWS_SERVICE_MAP } from "@/lib/aws-catalog";
import type { ServiceDefinition } from "@/features/registry";
import AwsIcon from "../nodes/AwsIcon";
import Field from "./components/Field";
import TabBar, { type Tab } from "./components/TabBar";
import ColorSwatches from "./components/ColorSwatches";
import PanelColorPicker from "./components/PanelColorPicker";
import ConnectionsTab from "./components/ConnectionsTab";
import ServiceRegistryCombobox from "./components/ServiceRegistryCombobox";

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
}

const ComponentPanel = ({ component, onClose, updateComponent, removeComponent, onUngroup }: ComponentPanelProps) => {
  const allDiagrams = useAllDiagrams();
  const allServices = useAllServices();
  const activeDiagram = useActiveDiagram();
  const { linkComponentToService, linkComponentToDiagram, addDiagram } = useDiagramActions();
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
  const canCreateLinked = component.type === "system" || component.type === "container";
  const linkedService = useMemo(
    () => allServices.find((service) => service.id === component.serviceId) ?? null,
    [allServices, component.serviceId],
  );

  const debouncedUpdate = useMemo(() => debounce((patch: Partial<Omit<Component, "id">>) => { updateComponent(component.id, patch); }, 300), [component.id, updateComponent]);
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

  const handleCreateLinked = () => {
    const level = component.type === "system" ? "container" : "component";
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
          {isPanel ? "Painel" : isNote ? "Nota" : component.name}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      {isPanel && onUngroup && (
        <div className="px-3 py-2 border-b border-border">
          <button type="button" onClick={onUngroup} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50">Desagrupar</button>
        </div>
      )}
      {!isSimple && <TabBar active={tab} onChange={setTab} />}
      {!isSimple && tab === "connections" ? (
        <ConnectionsTab componentId={component.id} />
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
          <Field label="Nome" value={name} onChange={(v) => { setName(v); debouncedUpdate({ name: v }); }} />
          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">Tipo</label>
              <select value={type} onChange={(e) => { const t = e.target.value as ComponentType; setType(t); if (!t.startsWith("aws-")) setAwsService(""); updateComponent(component.id, { type: t, awsService: t.startsWith("aws-") && awsService ? awsService : undefined } as Partial<Omit<Component, "id">>); }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <optgroup label="C4 Model"><option value="person">Person</option><option value="system">System</option><option value="container">Container</option><option value="component">Component</option></optgroup>
                {AWS_CATEGORIES.map((cat) => (<optgroup key={cat.id} label={`AWS: ${cat.name}`}><option value={cat.id}>{cat.name}</option></optgroup>))}
              </select>
            </div>
          )}
          {!isSimple && isAws && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">Serviço AWS</label>
              <select value={awsService} onChange={(e) => { const s = e.target.value; setAwsService(s); const svc = AWS_SERVICE_MAP.get(s); const preserveContent = shouldPreserveContent(name, desc); const shouldRename = !!svc && !preserveContent && (name.trim() === "" || name.startsWith("Novo") || name === component.name); updateComponent(component.id, { awsService: s || undefined, ...(shouldRename ? { name: svc.name } : {}) } as Partial<Omit<Component, "id">>); if (shouldRename) setName(svc!.name); }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Selecionar serviço...</option>
                {AWS_CATEGORY_MAP.get(type)?.services.map((svc) => (<option key={svc.id} value={svc.id}>{svc.name}</option>))}
              </select>
            </div>
          )}
          <Field
            label={isNote ? "Conteúdo" : "Descrição"}
            value={desc}
            onChange={(v) => { setDesc(v); debouncedUpdate({ description: v }); }}
            multiline
            placeholder={isNote ? "**Negrito**, *itálico*, listas, `código`..." : undefined}
            hint={isNote ? "Suporta Markdown" : undefined}
          />
          {isPanelComponent(component) && <PanelColorPicker componentId={component.id} currentColor={component.panelColor ?? DEFAULT_PANEL_COLOR} currentOpacity={component.panelOpacity ?? DEFAULT_PANEL_OPACITY} updateComponent={updateComponent} />}
          {isNoteComponent(component) && <ColorSwatches componentId={component.id} currentColor={component.panelColor ?? DEFAULT_NOTE_COLOR} label="Cor da Nota" updateComponent={updateComponent} />}
          {!isSimple && <Field label="Tecnologia" value={tech} onChange={(v) => { setTech(v); debouncedUpdate({ technology: v || undefined } as Partial<Omit<Component, "id">>); }} />}
          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">Tags</label>
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
                placeholder="Adicionar tag e pressionar Enter"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          {!isSimple && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                  <Link2 className="h-3 w-3 inline mr-1" />
                  Vincular ao Serviço
                </label>
                <button
                  type="button"
                  onClick={() => linkedService && syncFromService(linkedService)}
                  disabled={!linkedService}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Sincronizar nome, descrição, tecnologia e tags com o serviço vinculado"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sincronizar
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
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block"><LayoutDashboard className="h-3 w-3 inline mr-1" />Diagrama vinculado</label>
              {createdDiagramName ? (
                <p className="text-xs text-primary bg-primary/10 rounded-md px-3 py-2">✓ Diagrama &ldquo;{createdDiagramName}&rdquo; criado e vinculado.</p>
              ) : (
                <button onClick={handleCreateLinked} className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  <LayoutDashboard className="h-3.5 w-3.5" />Criar diagrama vinculado
                </button>
              )}
            </div>
          )}
          {!isSimple && (!canCreateLinked || component.linkedDiagramId) && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block"><LayoutDashboard className="h-3 w-3 inline mr-1" />Vincular ao Diagrama</label>
              <select value={component.linkedDiagramId ?? ""} onChange={(e) => linkComponentToDiagram(component.id, e.target.value || undefined)} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Nenhum</option>
                {allDiagrams.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
          )}
          <div><label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">ID</label><p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">{component.id}</p></div>
          <div className="pt-2">
            <button onClick={() => { debouncedUpdate.cancel(); removeComponent(component.id); onClose(); }} className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentPanel;

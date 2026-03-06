import { useState, useMemo } from "react";
import {
  X,
  Trash2,
  Save,
  Link2,
  LayoutDashboard,
  Search,
  ArrowRight,
  Network,
  Server,
  Database,
  User,
  Palette,
} from "lucide-react";
import {
  useComponent,
  useConnections,
  useComponents,
  useAllServices,
  useAllDiagrams,
  useDiagramActions,
} from "@/lib/model-store";
import type { Component, Connection, ComponentType } from "@/lib/model-types";
import {
  isAwsType,
  AWS_CATEGORIES,
  AWS_CATEGORY_MAP,
  AWS_SERVICE_MAP,
} from "@/lib/aws-catalog";
import AwsIcon from "./AwsIcon";

// ── Panel color presets ─────────────────────────────────────────────────────

const PANEL_COLOR_PRESETS = [
  { name: "Blue", color: "hsl(220 70% 50%)" },
  { name: "Purple", color: "hsl(270 70% 50%)" },
  { name: "Green", color: "hsl(150 70% 40%)" },
  { name: "Orange", color: "hsl(30 90% 50%)" },
  { name: "Red", color: "hsl(0 70% 50%)" },
  { name: "Cyan", color: "hsl(190 80% 45%)" },
  { name: "Yellow", color: "hsl(45 90% 50%)" },
  { name: "Gray", color: "hsl(220 20% 40%)" },
];

const DEFAULT_PANEL_COLOR = "hsl(220 20% 20%)";
const DEFAULT_PANEL_OPACITY = 10;
const DEFAULT_NOTE_COLOR = "hsl(48 96% 53%)";

interface Props {
  selectedElementId: string | null;
  selectedEdgeId: string | null;
  onClose: () => void;
}

const ElementPanel = ({
  selectedElementId,
  selectedEdgeId,
  onClose,
}: Props) => {
  const component = useComponent(selectedElementId ?? "");
  const connections = useConnections();
  const {
    updateComponent,
    removeComponent,
    updateConnection,
    removeConnection,
  } = useDiagramActions();

  if (selectedEdgeId) {
    const conn = connections[selectedEdgeId];
    if (!conn) return null;
    return (
      <ConnectionDetail
        conn={conn}
        onClose={onClose}
        updateConnection={updateConnection}
        removeConnection={removeConnection}
      />
    );
  }

  if (selectedElementId && component) {
    return (
      <ComponentDetail
        component={component}
        onClose={onClose}
        updateComponent={updateComponent}
        removeComponent={removeComponent}
      />
    );
  }

  return null;
};

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "details" | "connections";

const TabBar = ({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) => (
  <div className="flex border-b border-border">
    {(["details", "connections"] as const).map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`flex-1 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
          active === t
            ? "text-primary border-b-2 border-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t === "details" ? "Details" : "Connections"}
      </button>
    ))}
  </div>
);

// ── Component type icons (small helper) ─────────────────────────────────────

const typeIcons: Record<string, typeof Network> = {
  person: User,
  system: Network,
  container: Server,
  component: Database,
};

function NodeIcon({ type }: { type: ComponentType }) {
  const Icon = typeIcons[type] ?? Network;
  return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
}

// ── Connections tab content ─────────────────────────────────────────────────

const ConnectionsTab = ({ componentId }: { componentId: string }) => {
  const connections = useConnections();
  const components = useComponents();
  const [search, setSearch] = useState("");

  const { incoming, outgoing } = useMemo(() => {
    const allConns = Object.values(connections);
    return {
      incoming: allConns.filter((c) => c.targetId === componentId),
      outgoing: allConns.filter((c) => c.sourceId === componentId),
    };
  }, [connections, componentId]);

  const allEntries = useMemo(() => {
    const entries: {
      conn: Connection;
      direction: "in" | "out";
      peerId: string;
    }[] = [];
    for (const c of incoming)
      entries.push({ conn: c, direction: "in", peerId: c.sourceId });
    for (const c of outgoing)
      entries.push({ conn: c, direction: "out", peerId: c.targetId });
    return entries;
  }, [incoming, outgoing]);

  const filtered = useMemo(() => {
    if (!search) return allEntries;
    const q = search.toLowerCase();
    return allEntries.filter((e) => {
      const peer = components[e.peerId];
      return (
        peer?.name.toLowerCase().includes(q) ||
        e.conn.label.toLowerCase().includes(q)
      );
    });
  }, [allEntries, search, components]);

  if (allEntries.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground italic text-center">
        Nenhuma conexão encontrada.
      </div>
    );
  }

  const self = components[componentId];

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por nome ou label..."
          className="w-full rounded-md border border-border bg-secondary pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="text-[10px] text-muted-foreground">
        {incoming.length} entrada{incoming.length !== 1 ? "s" : ""} ·{" "}
        {outgoing.length} saída{outgoing.length !== 1 ? "s" : ""}
      </div>

      <div className="space-y-1">
        {filtered.map((entry) => {
          const peer = components[entry.peerId];
          if (!peer) return null;

          const source = entry.direction === "in" ? peer : self;
          const target = entry.direction === "in" ? self : peer;

          return (
            <div
              key={entry.conn.id}
              className="flex items-center gap-1.5 rounded-md bg-secondary/50 border border-border px-2.5 py-2 text-xs"
            >
              {source && <NodeIcon type={source.type} />}
              <span className="text-foreground font-medium truncate max-w-[60px]">
                {source?.name ?? "?"}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              {target && <NodeIcon type={target.type} />}
              <span className="text-foreground font-medium truncate max-w-[60px]">
                {target?.name ?? "?"}
              </span>
              <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[70px]">
                {entry.conn.label}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && search && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            Nenhum resultado para "{search}"
          </p>
        )}
      </div>
    </div>
  );
};

// ── Color swatches (shared by panel and note) ───────────────────────────────

const ColorSwatches = ({
  componentId,
  currentColor,
  label,
  updateComponent,
}: {
  componentId: string;
  currentColor: string;
  label: string;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
}) => (
  <div>
    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
      <Palette className="h-3 w-3 inline mr-1" />
      {label}
    </label>
    <div className="grid grid-cols-4 gap-2">
      {PANEL_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.name}
          onClick={() =>
            updateComponent(componentId, { panelColor: preset.color })
          }
          className={`group relative h-8 rounded-md border-2 transition-all ${
            currentColor === preset.color
              ? "border-foreground scale-105 shadow-md"
              : "border-transparent hover:border-muted-foreground/40 hover:scale-105"
          }`}
          style={{ backgroundColor: preset.color }}
          title={preset.name}
        >
          {currentColor === preset.color && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
            </div>
          )}
        </button>
      ))}
    </div>
  </div>
);

// ── Panel color picker ──────────────────────────────────────────────────────

const PanelColorPicker = ({
  componentId,
  currentColor,
  currentOpacity,
  updateComponent,
}: {
  componentId: string;
  currentColor: string;
  currentOpacity: number;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
}) => (
  <div className="space-y-3">
    <ColorSwatches
      componentId={componentId}
      currentColor={currentColor}
      label="Cor do Painel"
      updateComponent={updateComponent}
    />
    <div>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        Opacidade — {currentOpacity}%
      </label>
      <input
        type="range"
        min={5}
        max={40}
        step={1}
        value={currentOpacity}
        onChange={(e) =>
          updateComponent(componentId, {
            panelOpacity: Number(e.target.value),
          })
        }
        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>5%</span>
        <span>40%</span>
      </div>
    </div>
  </div>
);

// ── Component detail (with tabs) ────────────────────────────────────────────

const ComponentDetail = ({
  component,
  onClose,
  updateComponent,
  removeComponent,
}: {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => void;
  removeComponent: (id: string) => void;
}) => {
  const allServices = useAllServices();
  const allDiagrams = useAllDiagrams();
  const { linkComponentToService, linkComponentToDiagram } =
    useDiagramActions();
  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState(component.name);
  const [desc, setDesc] = useState(component.description);
  const [tech, setTech] = useState(component.technology ?? "");
  const [type, setType] = useState<ComponentType>(component.type);
  const [awsService, setAwsService] = useState(component.awsService ?? "");

  const isPanel = component.type === "panel";
  const isNote = component.type === "note";
  const isSimple = isPanel || isNote;
  const isAws = isAwsType(type);
  const svcInfo = awsService ? AWS_SERVICE_MAP.get(awsService) : null;

  const save = () => {
    if (isSimple) {
      updateComponent(component.id, { name, description: desc });
    } else {
      updateComponent(component.id, {
        name,
        description: desc,
        technology: tech || undefined,
        type,
        awsService: isAws && awsService ? awsService : undefined,
      });
    }
  };

  const handleRemove = () => {
    removeComponent(component.id);
    onClose();
  };

  return (
    <div className="w-80 border-l border-border bg-card overflow-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isPanel ? "Painel" : isNote ? "Nota" : component.name}
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isSimple && <TabBar active={tab} onChange={setTab} />}

      {!isSimple && tab === "connections" ? (
        <ConnectionsTab componentId={component.id} />
      ) : (
        <div className="p-4 space-y-4">
          {!isSimple && isAws && svcInfo && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
              <AwsIcon iconName={svcInfo.iconName} size={32} />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {svcInfo.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {AWS_CATEGORY_MAP.get(type)?.name}
                </p>
              </div>
            </div>
          )}

          <Field label="Nome" value={name} onChange={setName} />

          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ComponentType);
                  if (!e.target.value.startsWith("aws-")) setAwsService("");
                }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <optgroup label="C4 Model">
                  <option value="person">Person</option>
                  <option value="system">System</option>
                  <option value="container">Container</option>
                  <option value="component">Component</option>
                </optgroup>
                {AWS_CATEGORIES.map((cat) => (
                  <optgroup key={cat.id} label={`AWS: ${cat.name}`}>
                    <option value={cat.id}>{cat.name}</option>
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {!isSimple && isAws && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                Serviço AWS
              </label>
              <select
                value={awsService}
                onChange={(e) => {
                  setAwsService(e.target.value);
                  const svc = AWS_SERVICE_MAP.get(e.target.value);
                  if (
                    svc &&
                    (name.startsWith("Novo") || name === component.name)
                  ) {
                    setName(svc.name);
                  }
                }}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecionar serviço...</option>
                {AWS_CATEGORY_MAP.get(type)?.services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field label="Descrição" value={desc} onChange={setDesc} multiline />

          {isPanel && (
            <PanelColorPicker
              componentId={component.id}
              currentColor={component.panelColor ?? DEFAULT_PANEL_COLOR}
              currentOpacity={component.panelOpacity ?? DEFAULT_PANEL_OPACITY}
              updateComponent={updateComponent}
            />
          )}

          {isNote && (
            <ColorSwatches
              componentId={component.id}
              currentColor={component.panelColor ?? DEFAULT_NOTE_COLOR}
              label="Cor da Nota"
              updateComponent={updateComponent}
            />
          )}

          {!isSimple && (
            <Field label="Tecnologia" value={tech} onChange={setTech} />
          )}

          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                <Link2 className="h-3 w-3 inline mr-1" />
                Vincular ao Serviço
              </label>
              <select
                value={component.serviceId ?? ""}
                onChange={(e) =>
                  linkComponentToService(
                    component.id,
                    e.target.value || undefined,
                  )
                }
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Nenhum</option>
                {allServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isSimple && (
            <div>
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                <LayoutDashboard className="h-3 w-3 inline mr-1" />
                Vincular ao Diagrama
              </label>
              <select
                value={component.linkedDiagramId ?? ""}
                onChange={(e) =>
                  linkComponentToDiagram(
                    component.id,
                    e.target.value || undefined,
                  )
                }
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Nenhum</option>
                {allDiagrams.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              ID
            </label>
            <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">
              {component.id}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Connection detail (unchanged) ───────────────────────────────────────────

const ConnectionDetail = ({
  conn,
  onClose,
  updateConnection,
  removeConnection,
}: {
  conn: Connection;
  onClose: () => void;
  updateConnection: (
    id: string,
    patch: Partial<Omit<Connection, "id">>,
  ) => void;
  removeConnection: (id: string) => void;
}) => {
  const [label, setLabel] = useState(conn.label);
  const [tech, setTech] = useState(conn.technology ?? "");
  const [desc, setDesc] = useState(conn.description ?? "");

  const save = () => {
    updateConnection(conn.id, {
      label,
      technology: tech || undefined,
      description: desc || undefined,
    });
  };

  return (
    <div className="w-80 border-l border-border bg-card overflow-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Conexão
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <Field label="Label" value={label} onChange={setLabel} />
        <Field label="Tecnologia" value={tech} onChange={setTech} />
        <Field label="Descrição" value={desc} onChange={setDesc} multiline />

        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            ID
          </label>
          <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">
            {conn.id}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Salvar
          </button>
          <button
            onClick={() => {
              removeConnection(conn.id);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Shared field ────────────────────────────────────────────────────────────

const Field = ({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) => (
  <div>
    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    )}
  </div>
);

export default ElementPanel;

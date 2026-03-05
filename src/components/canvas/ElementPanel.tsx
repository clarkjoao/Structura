import { useState } from "react";
import { X, Trash2, Save, Link2, LayoutDashboard } from "lucide-react";
import {
  useComponent,
  useConnections,
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
  const { linkComponentToService, linkComponentToDiagram } = useDiagramActions();
  const [name, setName] = useState(component.name);
  const [desc, setDesc] = useState(component.description);
  const [tech, setTech] = useState(component.technology ?? "");
  const [type, setType] = useState<ComponentType>(component.type);
  const [awsService, setAwsService] = useState(component.awsService ?? "");

  const isAws = isAwsType(type);
  const svcInfo = awsService ? AWS_SERVICE_MAP.get(awsService) : null;

  const save = () => {
    updateComponent(component.id, {
      name,
      description: desc,
      technology: tech || undefined,
      type,
      awsService: isAws && awsService ? awsService : undefined,
    });
  };

  const handleRemove = () => {
    removeComponent(component.id);
    onClose();
  };

  return (
    <div className="w-80 border-l border-border bg-card overflow-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Propriedades
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {isAws && svcInfo && (
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

        {isAws && (
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
        <Field label="Tecnologia" value={tech} onChange={setTech} />

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
    </div>
  );
};

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

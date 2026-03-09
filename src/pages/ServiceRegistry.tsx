import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ExternalLink,
  Search,
  X,
  Trash2,
  Save,
  GitBranch,
  AlertTriangle,
  Link2,
  Download,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import {
  useAllServices,
  useAllComponents,
  useAllConnections,
  useRegistryActions,
} from "@/features/registry";
import type { ServiceDefinition } from "@/features/registry";
import { computeServiceImpact } from "@/features/diagram";
import { importFromGitHub } from "@/lib/github-import";

const ServiceRegistry = () => {
  const services = useAllServices();
  const components = useAllComponents();
  const { addService } = useRegistryActions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of components) {
      if (c.serviceId) {
        map[c.serviceId] = (map[c.serviceId] ?? 0) + 1;
      }
    }
    return map;
  }, [components]);

  const filtered = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [services, searchQuery]);

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Service Registry</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Catálogo global de microserviços
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Serviço
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, tecnologia ou tag..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Serviço
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tecnologias
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Repositório
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Usado em
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((svc) => (
                    <tr
                      key={svc.id}
                      onClick={() => setSelectedId(svc.id)}
                      className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                        selectedId === svc.id
                          ? "bg-primary/5"
                          : "hover:bg-surface-hover"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {svc.name}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {svc.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {svc.technology.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {svc.repositoryUrl && (
                          <a
                            href={svc.repositoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <GitBranch className="h-3 w-3" />
                            Repo
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-secondary text-xs font-semibold text-foreground">
                          {usageMap[svc.id] ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum serviço encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {selectedId && (
              <ServiceDetail
                serviceId={selectedId}
                onClose={() => setSelectedId(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {showAdd && (
        <AddServiceDialog
          onClose={() => setShowAdd(false)}
          onAdd={(svc) => {
            const created = addService(svc);
            setSelectedId(created.id);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
};

const ServiceDetail = ({
  serviceId,
  onClose,
}: {
  serviceId: string;
  onClose: () => void;
}) => {
  const allServices = useAllServices();
  const service = allServices.find((s) => s.id === serviceId);
  const components = useAllComponents();
  const connections = useAllConnections();
  const { updateService, removeService } = useRegistryActions();

  const impact = useMemo(
    () => computeServiceImpact(serviceId, components, connections),
    [serviceId, components, connections],
  );

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service?.name ?? "");
  const [desc, setDesc] = useState(service?.description ?? "");
  const [owner, setOwner] = useState(service?.owner ?? "");

  if (!service) return null;

  const handleSave = () => {
    updateService(serviceId, { name, description: desc, owner: owner || undefined });
    setEditing(false);
  };

  const handleDelete = () => {
    removeService(serviceId);
    onClose();
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border border-border bg-card rounded-xl overflow-hidden shrink-0"
    >
      <div className="w-[380px]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Detalhes do Serviço</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-auto max-h-[70vh]">
          {editing ? (
            <>
              <Field label="Nome" value={name} onChange={setName} />
              <Field
                label="Descrição"
                value={desc}
                onChange={setDesc}
                multiline
              />
              <Field label="Owner" value={owner} onChange={setOwner} />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="text-base font-bold text-foreground">
                  {service.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {service.description}
                </p>
              </div>

              {service.owner && (
                <div className="text-xs text-muted-foreground">
                  Owner: <span className="text-foreground">{service.owner}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {service.technology.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono rounded bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {service.repositoryUrl && (
                <a
                  href={service.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  {service.repositoryUrl.replace("https://github.com/", "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {service.tags && service.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {service.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-2 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              </div>
            </>
          )}

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Análise de Impacto
              </h4>
            </div>

            {impact.components.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum componente vinculado a este serviço.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                    Componentes ({impact.components.length})
                  </p>
                  {impact.components.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 text-xs py-1"
                    >
                      <Link2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {c.type}
                      </span>
                    </div>
                  ))}
                </div>

                {impact.systems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                      Sistemas afetados ({impact.systems.length})
                    </p>
                    {impact.systems.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-xs py-1"
                      >
                        <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                        <span className="text-foreground">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {impact.connections.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                      Conexões afetadas ({impact.connections.length})
                    </p>
                    {impact.connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="text-[11px] text-muted-foreground py-0.5"
                      >
                        {conn.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AddServiceDialog = ({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [techStr, setTechStr] = useState("");
  const [owner, setOwner] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const handleImport = async () => {
    if (!repoUrl) return;
    setImporting(true);
    setImportError("");
    try {
      const result = await importFromGitHub(
        repoUrl,
        ghToken || undefined,
      );
      setName(result.name);
      setDesc(result.description);
      setTechStr(result.technology.join(", "));
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Erro ao importar",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      description: desc.trim(),
      repositoryUrl: repoUrl.trim(),
      technology: techStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      owner: owner.trim() || undefined,
      tags: tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Novo Serviço</h3>

        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Importar do GitHub
            </p>
            <div className="flex gap-2">
              <input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleImport}
                disabled={importing || !repoUrl}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Importar
              </button>
            </div>
            <input
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="Token GitHub (opcional, para repos privados)"
              type="password"
              className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {importError && (
              <p className="text-xs text-destructive">{importError}</p>
            )}
          </div>

          <Field label="Nome" value={name} onChange={setName} />
          <Field
            label="Descrição"
            value={desc}
            onChange={setDesc}
            multiline
          />
          <Field
            label="Tecnologias (separadas por vírgula)"
            value={techStr}
            onChange={setTechStr}
          />
          <Field label="Owner" value={owner} onChange={setOwner} />
          <Field
            label="Tags (separadas por vírgula)"
            value={tagsStr}
            onChange={setTagsStr}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Criar Serviço
          </button>
        </div>
      </motion.div>
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
        rows={2}
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

export default ServiceRegistry;

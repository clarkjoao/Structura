import {
  useState,
  useMemo,
  lazy,
  Suspense,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Save,
  Loader2,
  User,
  RefreshCw,
  Download,
  ExternalLink,
  Layers,
  Link2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  useAllServices,
  useDiagrams,
  useRegistryActions,
  useDiagramActions,
} from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";

const DefectDojoPanel = lazy(() =>
  import("@/integrations/defectdojo").then((m) => ({
    default: m.DefectDojoPanel,
  })),
);

// ── Source metadata ───────────────────────────────────────────────────────

type Source = "manual" | "github" | "defectdojo";

const SOURCE_DOT: Record<Source, string> = {
  manual: "bg-violet-500",
  github: "bg-blue-500",
  defectdojo: "bg-orange-500",
};

const SOURCE_BADGE: Record<Source, string> = {
  manual: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  github: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  defectdojo: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};

const SOURCE_LABEL: Record<Source, string> = {
  manual: "Manual",
  github: "GitHub",
  defectdojo: "DefectDojo",
};

// ── Chip input ────────────────────────────────────────────────────────────

const ChipInput = ({
  label,
  items,
  onChange,
  placeholder = "Adicionar...",
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) => {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput("");
  };
  return (
    <div>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="hover:text-foreground leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          + add
        </button>
      </div>
    </div>
  );
};

// ── Manual create inline form ─────────────────────────────────────────────

const ManualCreateForm = ({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState("");
  const [tech, setTech] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: desc.trim(),
      repositoryUrl: "",
      technology: tech,
      owner: owner.trim() || undefined,
      tags,
      source: "manual",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Novo Serviço
      </p>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          Nome
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          Descrição
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          Owner
        </label>
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <ChipInput
        label="Tecnologia"
        items={tech}
        onChange={setTech}
        placeholder="java, spring..."
      />
      <ChipInput
        label="Tags"
        items={tags}
        onChange={setTags}
        placeholder="backend, auth..."
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Criar Serviço
        </button>
      </div>
    </motion.div>
  );
};

// ── GitHub import inline form ─────────────────────────────────────────────

const GitHubImportForm = ({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const [repoUrl, setRepoUrl] = useState("");
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const match = repoUrl.match(
        /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
      );
      if (!match)
        throw new Error("URL inválida. Use: https://github.com/owner/repo");
      const [, repoOwner, repoName] = match;
      const res = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}`,
      );
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Repositório não encontrado"
            : `GitHub API erro ${res.status}`,
        );
      }
      const repo = (await res.json()) as {
        name: string;
        description: string | null;
        html_url: string;
        language: string | null;
        full_name: string;
      };
      onCreate({
        name: repo.name,
        description: repo.description ?? "",
        repositoryUrl: repo.html_url,
        technology: repo.language ? [repo.language] : [],
        owner: owner.trim() || undefined,
        source: "github",
        sourceId: repo.full_name,
        metadata: {
          github: {
            language: repo.language,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4"
    >
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
          Importar do GitHub
        </p>
        <p className="text-[10px] text-muted-foreground">
          Limite: 60 req/h para repositórios públicos sem autenticação.
        </p>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          Repository URL
        </label>
        <input
          autoFocus
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          placeholder="https://github.com/org/repo"
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          Owner (opcional)
        </label>
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
        >
          Cancelar
        </button>
        <button
          onClick={handleImport}
          disabled={loading || !repoUrl.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          Import &amp; Sync
        </button>
      </div>
    </motion.div>
  );
};

// ── Service usage ─────────────────────────────────────────────────────────

function getServiceUsage(
  serviceId: string,
  diagrams: Record<string, Diagram>,
): { diagramId: string; diagramName: string; nodeCount: number }[] {
  return Object.values(diagrams)
    .map((diagram) => {
      const nodes = Object.values(diagram.snapshot.components).filter(
        (c) => c.serviceId === serviceId,
      );
      return nodes.length > 0
        ? {
            diagramId: diagram.id,
            diagramName: diagram.name,
            nodeCount: nodes.length,
          }
        : null;
    })
    .filter(
      (x): x is { diagramId: string; diagramName: string; nodeCount: number } =>
        x !== null,
    );
}

// ── Compact ServiceCard for grid ──────────────────────────────────────────

interface ServiceCardProps {
  svc: ServiceDefinition;
  isSelected: boolean;
  onClick: () => void;
  usage: { diagramId: string; diagramName: string; nodeCount: number }[];
}

const ServiceCard = ({ svc, isSelected, onClick, usage }: ServiceCardProps) => {
  const source = (svc.source ?? "manual") as Source;
  const MAX_PILLS = 3;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-150 hover:border-primary/40 hover:bg-accent/30 ${
        isSelected
          ? "border-primary/60 bg-accent/40 ring-1 ring-primary/20"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${SOURCE_DOT[source]}`}
        />
        <span className="font-semibold text-foreground text-sm truncate flex-1">
          {svc.name}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source]}`}
        >
          {SOURCE_LABEL[source]}
        </span>
      </div>

      {/* Description */}
      {svc.description && (
        <p className="text-xs text-muted-foreground truncate mb-2">
          {svc.description}
        </p>
      )}

      {/* Tech pills */}
      {svc.technology.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {svc.technology.slice(0, MAX_PILLS).map((t) => (
            <span
              key={t}
              className="text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
            >
              {t}
            </span>
          ))}
          {svc.technology.length > MAX_PILLS && (
            <span className="text-[10px] text-muted-foreground">
              +{svc.technology.length - MAX_PILLS}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {svc.owner && (
          <span className="flex items-center gap-0.5">
            <User className="h-3 w-3" />
            {svc.owner}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Layers className="h-3 w-3" />
          {usage.length} diagrama{usage.length !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────

interface DetailPanelProps {
  svc: ServiceDefinition;
  diagrams: Record<string, Diagram>;
  onNavigateToDiagram: (id: string) => void;
  updateService: (
    id: string,
    patch: Partial<Omit<ServiceDefinition, "id">>,
  ) => void;
  removeService: (id: string) => void;
  onClose: () => void;
}

const DetailPanel = ({
  svc,
  diagrams,
  onNavigateToDiagram,
  updateService,
  removeService,
  onClose,
}: DetailPanelProps) => {
  const source = (svc.source ?? "manual") as Source;
  const usage = useMemo(
    () => getServiceUsage(svc.id, diagrams),
    [svc.id, diagrams],
  );

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(svc.name);
  const [editDesc, setEditDesc] = useState(svc.description);
  const [editOwner, setEditOwner] = useState(svc.owner ?? "");
  const [editRepo, setEditRepo] = useState(svc.repositoryUrl);
  const [editTech, setEditTech] = useState<string[]>(svc.technology);
  const [editTags, setEditTags] = useState<string[]>(svc.tags ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  // Sync edit state when svc changes
  useEffect(() => {
    if (!editing) {
      setEditName(svc.name);
      setEditDesc(svc.description);
      setEditOwner(svc.owner ?? "");
      setEditRepo(svc.repositoryUrl);
      setEditTech(svc.technology);
      setEditTags(svc.tags ?? []);
    }
  }, [svc, editing]);

  const handleSave = () => {
    updateService(svc.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      repositoryUrl: editRepo.trim(),
      owner: editOwner.trim() || undefined,
      technology: editTech,
      tags: editTags,
    });
    setEditing(false);
  };

  const handleSync = useCallback(async () => {
    setSyncError("");
    setSyncing(true);
    try {
      if (source === "github" && svc.sourceId) {
        const res = await fetch(`https://api.github.com/repos/${svc.sourceId}`);
        if (!res.ok) throw new Error(`GitHub API erro ${res.status}`);
        const repo = (await res.json()) as {
          name: string;
          description: string | null;
          html_url: string;
          language: string | null;
        };
        updateService(svc.id, {
          name: repo.name,
          description: repo.description ?? svc.description,
          repositoryUrl: repo.html_url,
          technology: repo.language ? [repo.language] : svc.technology,
          metadata: {
            ...((svc.metadata ?? {}) as Record<string, unknown>),
            github: {
              language: repo.language,
            },
          },
        });
      } else if (source === "defectdojo" && svc.sourceId) {
        const { DefectDojoClient } = await import(
          "@/integrations/defectdojo/defectdojo.client"
        );
        const { mapToServiceDefinition } = await import(
          "@/integrations/defectdojo/defectdojo.service"
        );
        const rawConfig = localStorage.getItem("structura:defectdojo:config");
        if (!rawConfig) throw new Error("DefectDojo não configurado");
        const cfg = JSON.parse(rawConfig) as {
          baseUrl: string;
          apiToken: string;
        };
        const client = new DefectDojoClient(cfg);
        const resp = await client.get<{ results: Record<string, unknown>[] }>(
          "/api/v2/products/",
          { id: String(svc.sourceId) },
        );
        const product = resp.results[0];
        if (!product) throw new Error("Produto não encontrado no DefectDojo");
        const mapped = mapToServiceDefinition(
          product as unknown as Parameters<typeof mapToServiceDefinition>[0],
        );
        updateService(svc.id, mapped);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [source, svc, updateService]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${SOURCE_DOT[source]}`}
          />
          <h2 className="text-base font-bold text-foreground truncate">
            {svc.name}
          </h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(source === "github" || source === "defectdojo") && svc.sourceId && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Sincronizar"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-5 py-4">
        <div className="space-y-5">
          {syncError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {syncError}
            </p>
          )}

          {/* ─── Fields (view/edit) ─── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                Detalhes
              </span>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Editar
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Save className="h-3 w-3" />
                    Salvar
                  </button>
                </div>
              )}
            </div>

            {(source === "github" || source === "defectdojo") && editing && (
              <p className="text-[10px] text-muted-foreground italic border border-border rounded-md px-3 py-1.5">
                Alguns campos são sincronizados de {SOURCE_LABEL[source]} e
                podem ser sobrescritos no próximo sync.
              </p>
            )}

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    Nome
                  </label>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    Descrição
                  </label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    Owner
                  </label>
                  <input
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    Repositório
                  </label>
                  <input
                    value={editRepo}
                    onChange={(e) => setEditRepo(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <ChipInput
                  label="Tecnologia"
                  items={editTech}
                  onChange={setEditTech}
                />
                <ChipInput
                  label="Tags"
                  items={editTags}
                  onChange={setEditTags}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Source badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">
                    Fonte
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source]}`}
                  >
                    {SOURCE_LABEL[source]}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-0.5">
                    Descrição
                  </span>
                  <p className="text-sm text-foreground">
                    {svc.description || (
                      <span className="text-muted-foreground italic">
                        Sem descrição
                      </span>
                    )}
                  </p>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">
                    Owner
                  </span>
                  {svc.owner ? (
                    <span className="text-sm text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {svc.owner}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      —
                    </span>
                  )}
                </div>

                {/* Repo */}
                {svc.repositoryUrl && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
                      Repo
                    </span>
                    <a
                      href={svc.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{svc.repositoryUrl}</span>
                    </a>
                  </div>
                )}

                {/* Technology */}
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    Tecnologia
                  </span>
                  {svc.technology.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {svc.technology.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      —
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    Tags
                  </span>
                  {(svc.tags ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(svc.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] rounded bg-secondary/60 px-2 py-0.5 text-muted-foreground"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      —
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── Usage in diagrams ─── */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
              Uso em diagramas
            </span>
            {usage.length === 0 ? (
              <p className="text-xs text-muted-foreground italic rounded-lg border border-border bg-secondary/30 p-3">
                Não vinculado a nenhum diagrama
              </p>
            ) : (
              <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border">
                {usage.map((u) => (
                  <button
                    key={u.diagramId}
                    type="button"
                    onClick={() => onNavigateToDiagram(u.diagramId)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors group"
                  >
                    <span className="flex items-center gap-2 text-foreground truncate">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      {u.diagramName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {u.nodeCount} nó{u.nodeCount !== 1 ? "s" : ""}
                      <ChevronRight className="h-3 w-3 inline ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Danger zone ─── */}
          <div className="pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive flex-1">
                  Tem certeza? Esta ação é irreversível.
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    removeService(svc.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar remoção
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-destructive hover:underline"
              >
                Deletar serviço
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Add Service dropdown ──────────────────────────────────────────────────

type InlineForm = "manual" | "github" | "defectdojo" | null;

const AddServiceDropdown = ({
  onSelect,
}: {
  onSelect: (form: InlineForm) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showDefectDojo = import.meta.env.VITE_ENABLE_DEFECTDOJO === "true";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (form: InlineForm) => {
    setOpen(false);
    onSelect(form);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Service
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-52 rounded-lg border border-border bg-card shadow-xl py-1">
          <button
            onClick={() => select("manual")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 text-foreground text-left"
          >
            <span className="text-violet-400">✦</span> Criar manualmente
          </button>
          <button
            onClick={() => select("github")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 text-foreground text-left"
          >
            <span className="text-blue-400">⌥</span> Importar do GitHub
          </button>
          {showDefectDojo && (
            <button
              onClick={() => select("defectdojo")}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 text-foreground text-left"
            >
              <span className="text-orange-400">🛡</span> Importar do
              DefectDojo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────

type SourceFilter = "all" | Source;

const ServiceRegistry = () => {
  const services = useAllServices();
  const diagrams = useDiagrams();
  const { addService, updateService, removeService } = useRegistryActions();
  const { openDiagram } = useDiagramActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [inlineForm, setInlineForm] = useState<InlineForm>(null);
  const [showDefectDojo, setShowDefectDojo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFromQuery = searchParams.get("serviceId");

  const filtered = useMemo(() => {
    let result = services;
    if (sourceFilter !== "all") {
      result = result.filter((s) => (s.source ?? "manual") === sourceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.owner ?? "").toLowerCase().includes(q) ||
          s.technology.some((t) => t.toLowerCase().includes(q)) ||
          (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [services, search, sourceFilter]);

  const selectedSvc = useMemo(
    () => (selectedId ? services.find((s) => s.id === selectedId) : undefined),
    [selectedId, services],
  );

  // If selected service was deleted, clear selection
  useEffect(() => {
    if (selectedId && !services.find((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, services]);

  useEffect(() => {
    if (selectedId && !filtered.find((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedFromQuery) return;

    const target = services.find((service) => service.id === selectedFromQuery);
    if (!target) return;

    setSearch("");
    setSourceFilter("all");
    setSelectedId(target.id);

    requestAnimationFrame(() => {
      document
        .getElementById(`registry-service-${target.id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [selectedFromQuery, services]);

  const usageMap = useMemo(() => {
    const map: Record<
      string,
      { diagramId: string; diagramName: string; nodeCount: number }[]
    > = {};
    for (const svc of services) {
      map[svc.id] = getServiceUsage(svc.id, diagrams);
    }
    return map;
  }, [services, diagrams]);

  const handleNavigateToDiagram = useCallback(
    (id: string) => {
      openDiagram(id);
      navigate(`/model/${id}`);
    },
    [openDiagram, navigate],
  );

  const handleInlineFormSelect = (form: InlineForm) => {
    if (form === "defectdojo") {
      setShowDefectDojo(true);
      setInlineForm(null);
    } else {
      setInlineForm(form);
      setShowDefectDojo(false);
    }
  };

  const handleCreate = (svc: Omit<ServiceDefinition, "id">) => {
    const created = addService(svc);
    setInlineForm(null);
    setSelectedId(created.id);
  };

  const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "manual", label: "Manual" },
    { value: "github", label: "GitHub" },
    { value: "defectdojo", label: "DefectDojo" },
  ];

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1600px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Registry</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Catálogo central de serviços e infraestrutura
              </p>
            </div>
            <AddServiceDropdown onSelect={handleInlineFormSelect} />
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, tag, owner..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Source filter pills + count */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSourceFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sourceFilter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              · {filtered.length} {filtered.length === 1 ? "service" : "services"}
            </span>
          </div>

          {/* Inline forms */}
          <AnimatePresence mode="wait">
            {inlineForm === "manual" && (
              <ManualCreateForm
                key="manual"
                onCancel={() => setInlineForm(null)}
                onCreate={handleCreate}
              />
            )}
            {inlineForm === "github" && (
              <GitHubImportForm
                key="github"
                onCancel={() => setInlineForm(null)}
                onCreate={handleCreate}
              />
            )}
          </AnimatePresence>

          {/* DefectDojo panel */}
          {showDefectDojo && (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DefectDojo
                </span>
                <button
                  onClick={() => setShowDefectDojo(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
                }
              >
                <DefectDojoPanel />
              </Suspense>
            </div>
          )}

          {/* Service cards grid */}
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {services.length === 0
                      ? 'Nenhum serviço cadastrado. Clique em "Add Service" para começar.'
                      : "Nenhum serviço encontrado para os filtros aplicados."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filtered.map((svc) => (
                    <div id={`registry-service-${svc.id}`} key={svc.id}>
                      <ServiceCard
                        svc={svc}
                        isSelected={selectedId === svc.id}
                        onClick={() =>
                          setSelectedId(selectedId === svc.id ? null : svc.id)
                        }
                        usage={usageMap[svc.id] ?? []}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="xl:sticky xl:top-24">
              {selectedSvc ? (
                <DetailPanel
                  key={selectedSvc.id}
                  svc={selectedSvc}
                  diagrams={diagrams}
                  onNavigateToDiagram={handleNavigateToDiagram}
                  updateService={updateService}
                  removeService={removeService}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-8 text-sm text-muted-foreground">
                  Selecione um serviço para ver os detalhes.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceRegistry;

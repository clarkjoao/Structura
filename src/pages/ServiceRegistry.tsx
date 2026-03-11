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
  MoreHorizontal,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  useAllServices,
  useDiagrams,
  useActiveDiagramId,
  useDiagramActions,
} from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/registry";
import { useRegistryActions } from "@/features/registry";

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
        pushed_at: string;
        stargazers_count: number;
        default_branch: string;
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
            updatedAt: repo.pushed_at,
            stars: repo.stargazers_count,
            defaultBranch: repo.default_branch,
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

// ── ServiceCard ───────────────────────────────────────────────────────────

interface ServiceCardProps {
  svc: ServiceDefinition;
  diagrams: Record<string, Diagram>;
  onNavigateToDiagram: (id: string) => void;
  updateService: (
    id: string,
    patch: Partial<Omit<ServiceDefinition, "id">>,
  ) => void;
  removeService: (id: string) => void;
}

const ServiceCard = ({
  svc,
  diagrams,
  onNavigateToDiagram,
  updateService,
  removeService,
}: ServiceCardProps) => {
  const source = (svc.source ?? "manual") as Source;
  const usage = useMemo(
    () => getServiceUsage(svc.id, diagrams),
    [svc.id, diagrams],
  );

  const [showUsage, setShowUsage] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFlash, setSyncFlash] = useState(false);
  const [syncError, setSyncError] = useState("");

  const [editName, setEditName] = useState(svc.name);
  const [editDesc, setEditDesc] = useState(svc.description);
  const [editOwner, setEditOwner] = useState(svc.owner ?? "");
  const [editTech, setEditTech] = useState<string[]>(svc.technology);
  const [editTags, setEditTags] = useState<string[]>(svc.tags ?? []);

  const actionsRef = useRef<HTMLDivElement>(null);
  const MAX_PILLS = 3;

  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(e.target as Node)
      ) {
        setShowActions(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions]);

  // Keep edit state in sync when svc changes (e.g. after sync)
  useEffect(() => {
    if (!editing) {
      setEditName(svc.name);
      setEditDesc(svc.description);
      setEditOwner(svc.owner ?? "");
      setEditTech(svc.technology);
      setEditTags(svc.tags ?? []);
    }
  }, [svc, editing]);

  const handleSave = () => {
    updateService(svc.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      owner: editOwner.trim() || undefined,
      technology: editTech,
      tags: editTags,
    });
    setEditing(false);
  };

  const handleSync = useCallback(async () => {
    setSyncError("");
    setSyncing(true);
    setShowActions(false);
    try {
      if (source === "github" && svc.sourceId) {
        const res = await fetch(`https://api.github.com/repos/${svc.sourceId}`);
        if (!res.ok) throw new Error(`GitHub API erro ${res.status}`);
        const repo = (await res.json()) as {
          name: string;
          description: string | null;
          html_url: string;
          language: string | null;
          pushed_at: string;
          stargazers_count: number;
          default_branch: string;
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
              updatedAt: repo.pushed_at,
              stars: repo.stargazers_count,
              defaultBranch: repo.default_branch,
            },
          },
        });
        setSyncFlash(true);
        setTimeout(() => setSyncFlash(false), 1200);
      } else if (source === "defectdojo" && svc.sourceId) {
        const { DefectDojoClient } =
          await import("@/integrations/defectdojo/defectdojo.client");
        const { mapToServiceDefinition } =
          await import("@/integrations/defectdojo/defectdojo.service");
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
        setSyncFlash(true);
        setTimeout(() => setSyncFlash(false), 1200);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [source, svc, updateService]);

  if (editing) {
    return (
      <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-3">
        {(source === "github" || source === "defectdojo") && (
          <p className="text-[10px] text-muted-foreground italic border border-border rounded-md px-3 py-1.5">
            Alguns campos são sincronizados de {SOURCE_LABEL[source]} e podem
            ser sobrescritos no próximo sync.
          </p>
        )}
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
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
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            Descrição
          </label>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            Owner
          </label>
          <input
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <ChipInput label="Tecnologia" items={editTech} onChange={setEditTech} />
        <ChipInput label="Tags" items={editTags} onChange={setEditTags} />
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-3 w-3" /> Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-colors duration-700 ${
        syncFlash ? "border-green-500/50 bg-green-500/5" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${SOURCE_DOT[source]}`}
          />
          <span className="font-semibold text-foreground text-sm truncate">
            {svc.name}
          </span>
          {syncing ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source]}`}
            >
              {SOURCE_LABEL[source]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div ref={actionsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowActions((v) => !v);
                setConfirmDelete(false);
                setSyncError("");
              }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-lg border border-border bg-card shadow-lg py-1 text-sm">
                <button
                  onClick={() => {
                    setEditing(true);
                    setShowActions(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground"
                >
                  Editar
                </button>
                {(source === "github" || source === "defectdojo") &&
                  svc.sourceId && (
                    <button
                      onClick={handleSync}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" /> Sync
                    </button>
                  )}
                {confirmDelete ? (
                  <button
                    onClick={() => removeService(svc.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 font-semibold"
                  >
                    Confirmar remoção
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Deletar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {svc.description && (
        <p className="text-xs text-muted-foreground truncate mb-1.5">
          {svc.description}
        </p>
      )}
      {svc.owner && (
        <div className="flex items-center gap-1 mb-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span>{svc.owner}</span>
        </div>
      )}
      {svc.technology.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
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
      {svc.tags && svc.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {svc.tags.slice(0, MAX_PILLS).map((t) => (
            <span
              key={t}
              className="text-[10px] rounded bg-secondary/60 px-1.5 py-0.5 text-muted-foreground"
            >
              #{t}
            </span>
          ))}
          {svc.tags.length > MAX_PILLS && (
            <span className="text-[10px] text-muted-foreground">
              +{svc.tags.length - MAX_PILLS}
            </span>
          )}
        </div>
      )}

      {syncError && (
        <p className="text-[10px] text-destructive mb-1.5">{syncError}</p>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-2 mt-1">
        {usage.length === 0 ? (
          <span className="text-[10px] text-muted-foreground">
            Não usado em nenhum diagrama
          </span>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setShowUsage((v) => !v)}
              className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
            >
              Usado em {usage.length} diagrama{usage.length !== 1 ? "s" : ""}
              <ChevronRight
                className={`h-3 w-3 transition-transform ${showUsage ? "rotate-90" : ""}`}
              />
            </button>
            {showUsage && (
              <div className="mt-1 space-y-0.5 pl-1">
                {usage.map((u) => (
                  <button
                    key={u.diagramId}
                    type="button"
                    onClick={() => onNavigateToDiagram(u.diagramId)}
                    className="w-full text-left text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    ↳ {u.diagramName} · {u.nodeCount} nó
                    {u.nodeCount !== 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
              <span className="text-orange-400">🛡</span> Importar do DefectDojo
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

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [inlineForm, setInlineForm] = useState<InlineForm>(null);
  const [showDefectDojo, setShowDefectDojo] = useState(false);

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
    addService(svc);
    setInlineForm(null);
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
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Registry</h1>
            <p className="text-sm text-muted-foreground mt-1">
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
        <div className="flex items-center gap-2 mb-6 flex-wrap">
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
          <span className="text-xs text-muted-foreground ml-auto">
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
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {services.length === 0
                ? 'Nenhum serviço cadastrado. Clique em "Add Service" para começar.'
                : "Nenhum serviço encontrado para os filtros aplicados."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((svc) => (
              <ServiceCard
                key={svc.id}
                svc={svc}
                diagrams={diagrams}
                onNavigateToDiagram={handleNavigateToDiagram}
                updateService={updateService}
                removeService={removeService}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceRegistry;

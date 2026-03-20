import {
  useState,
  useMemo,
  lazy,
  Suspense,
  useEffect,
  useCallback,
} from "react";
import { motion } from "framer-motion";
import {
  Plus,
  ChevronRight,
  Search,
  X,
  Save,
  Loader2,
  User,
  RefreshCw,
  ExternalLink,
  Layers,
  Link2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { GithubImportPanel } from "@/integrations/github/components/GithubImportPanel";
import { useGithubConfig } from "@/integrations/github/hooks/useGithubConfig";
import { createGithubClient } from "@/integrations/github/githubClient";
import type { GithubRepo } from "@/integrations/github/github.types";
import {
  dedupeStringsPreserveOrder,
  mergeSources,
  normalizeSources,
  pickMoreCompleteString,
} from "@/integrations/merge-utils";
import {
  useAllServices,
  useDiagrams,
  useRegistryActions,
  useDiagramActions,
} from "@/features/diagram";
import type { Diagram } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { i18n } from "@/infrastructure/i18n";

const DefectDojoPanel = lazy(() =>
  import("@/integrations/defectdojo").then((m) => ({
    default: m.DefectDojoPanel,
  })),
);

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

function sourceTypeLabel(t: (key: string) => string, type: Source): string {
  switch (type) {
    case "manual":
      return t("registry.sourceManual");
    case "github":
      return t("registry.sourceGithub");
    case "defectdojo":
      return t("registry.sourceDefectdojo");
    default:
      return type;
  }
}

const ChipInput = ({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("registry.chipAddPlaceholder");
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
          placeholder={resolvedPlaceholder}
          className="flex-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          {t("registry.chipAddButton")}
        </button>
      </div>
    </div>
  );
};

const ManualCreateForm = ({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}) => {
  const { t } = useTranslation();
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
      sources: [{ type: "manual" }],
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
        {t("registry.newService")}
      </p>
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
          {t("common.name")}
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
          {t("common.description")}
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
          {t("common.owner")}
        </label>
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <ChipInput
        label={t("common.technology")}
        items={tech}
        onChange={setTech}
        placeholder={t("registry.techPlaceholder")}
      />
      <ChipInput
        label={t("common.tags")}
        items={tags}
        onChange={setTags}
        placeholder={t("registry.tagsPlaceholder")}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("registry.createService")}
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

interface ServiceCardProps {
  svc: ServiceDefinition;
  isSelected: boolean;
  onClick: () => void;
  usage: { diagramId: string; diagramName: string; nodeCount: number }[];
}

const ServiceCard = ({ svc, isSelected, onClick, usage }: ServiceCardProps) => {
  const { t } = useTranslation();
  const sources = normalizeSources(svc);
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
        <div className="flex items-center gap-1 shrink-0">
          {sources.map((source) => (
            <span
              key={source.type}
              className={`h-2 w-2 rounded-full ${SOURCE_DOT[source.type]}`}
            />
          ))}
        </div>
        <span className="font-semibold text-foreground text-sm truncate flex-1">
          {svc.name}
        </span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {sources.map((source) => (
            <span
              key={source.type}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source.type]}`}
            >
              {sourceTypeLabel(t, source.type)}
            </span>
          ))}
        </div>
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
          {svc.technology.slice(0, MAX_PILLS).map((techStr) => (
            <span
              key={techStr}
              className="text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
            >
              {techStr}
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
          {t("registry.diagramUsage", { count: usage.length })}
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
  const { t } = useTranslation();
  const { config: githubConfig } = useGithubConfig();
  const normalizedSources = normalizeSources(svc);
  const hasGithubSource = normalizedSources.some((s) => s.type === "github");
  const hasDefectDojoSource = normalizedSources.some(
    (s) => s.type === "defectdojo",
  );
  const hasSyncSource = hasGithubSource || hasDefectDojoSource;
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
      const hasGithubData = Boolean(svc.metadata?.github) || hasGithubSource;
      const hasDefectDojoData =
        Boolean(svc.metadata?.defectdojo) || hasDefectDojoSource;

      let githubRepo: GithubRepo | null = null;
      let defectDojoMapped:
        | Omit<ServiceDefinition, "id">
        | null = null;
      let syncedDefectDojoSourceId: string | undefined;

      if (hasGithubData) {
        const githubSourceId = normalizedSources.find(
          (sourceEntry) => sourceEntry.type === "github",
        )?.sourceId;
        const githubIdentifier =
          githubSourceId ??
          (svc.metadata?.github as { fullName?: string } | undefined)
                ?.fullName;

        if (githubIdentifier) {
        const apiBase = githubConfig?.baseUrl ?? "https://api.github.com";
        const token = githubConfig?.token ?? "";
        const client = createGithubClient(apiBase, token);
          githubRepo = await client.getRepository(githubIdentifier);
        }
      }

      if (hasDefectDojoData) {
        const { DefectDojoClient } = await import(
          "@/integrations/defectdojo/defectdojo.client"
        );
        const { mapToServiceDefinition } = await import(
          "@/integrations/defectdojo/defectdojo.service"
        );

        const ddMeta = svc.metadata?.defectdojo as
          | { productId?: string | number; productLink?: string }
          | undefined;
        const productIdFromLink = ddMeta?.productLink?.match(/\/product\/(\d+)(?:\/|$)/)?.[1];
        const defectDojoSourceId = normalizedSources.find(
          (sourceEntry) => sourceEntry.type === "defectdojo",
        )?.sourceId;
        const defectDojoProductId =
          defectDojoSourceId ??
          (ddMeta?.productId
              ? String(ddMeta.productId)
              : productIdFromLink);
        syncedDefectDojoSourceId = defectDojoProductId;

        const rawConfig = localStorage.getItem("structura_defectdojo:config") ?? localStorage.getItem("structura:defectdojo:config");
        if (!rawConfig) throw new Error(i18n.t("registry.errorDefectDojoNotConfigured"));
        const cfg = JSON.parse(rawConfig) as {
          baseUrl: string;
          apiToken: string;
        };
        const client = new DefectDojoClient(cfg);
        if (defectDojoProductId) {
          const resp = await client.get<{ results: Record<string, unknown>[] }>(
            "/api/v2/products/",
            { id: String(defectDojoProductId) },
          );
          const product = resp.results[0];
          if (product) {
            defectDojoMapped = mapToServiceDefinition(
              product as unknown as Parameters<typeof mapToServiceDefinition>[0],
            );
          }
        }
      }

      if (!githubRepo && !defectDojoMapped) {
        throw new Error(i18n.t("registry.errorSyncNoSource"));
      }

      const githubTech = githubRepo?.language ? [githubRepo.language] : [];
      const githubTags = githubRepo?.topics ?? [];
      const ddTags = defectDojoMapped?.tags ?? [];

      const mergedTech = dedupeStringsPreserveOrder([
        ...svc.technology,
        ...githubTech,
        ...(defectDojoMapped?.technology ?? []),
      ]);
      const mergedTags = dedupeStringsPreserveOrder([
        ...(svc.tags ?? []),
        ...githubTags,
        ...ddTags,
      ]);
      const mergedSourceEntries = mergeSources(normalizeSources(svc), [
        ...(githubRepo
          ? [{ type: "github" as const, sourceId: githubRepo.full_name }]
          : []),
        ...(defectDojoMapped
          ? [
              {
                type: "defectdojo" as const,
                sourceId: syncedDefectDojoSourceId,
              },
            ]
          : []),
      ]);

      updateService(svc.id, {
        name: pickMoreCompleteString(
          defectDojoMapped?.name ?? "",
          githubRepo?.name ?? svc.name,
        ),
        description: pickMoreCompleteString(
          defectDojoMapped?.description ?? "",
          githubRepo?.description ?? svc.description,
        ),
        repositoryUrl:
          githubRepo?.html_url ||
          svc.repositoryUrl ||
          defectDojoMapped?.repositoryUrl ||
          "",
        technology: mergedTech,
        tags: mergedTags,
        sources: mergedSourceEntries,
        metadata: {
          github: githubRepo
            ? {
                repoId: githubRepo.id,
                fullName: githubRepo.full_name,
                topics: githubRepo.topics ?? [],
                language: githubRepo.language,
                updatedAt: githubRepo.updated_at,
              }
            : svc.metadata?.github,
          defectdojo:
            defectDojoMapped?.metadata?.defectdojo ?? svc.metadata?.defectdojo,
        },
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : i18n.t("registry.errorSyncGeneric"));
    } finally {
      setSyncing(false);
    }
  }, [
    hasDefectDojoSource,
    hasGithubSource,
    normalizedSources,
    svc,
    updateService,
    githubConfig?.baseUrl,
    githubConfig?.token,
  ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${SOURCE_DOT[normalizedSources[0]?.type ?? "manual"]}`}
          />
          <h2 className="text-base font-bold text-foreground truncate">
            {svc.name}
          </h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasSyncSource && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={t("registry.syncTitle")}
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

      <div className="px-5 py-4">
        <div className="space-y-5">
          {syncError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {syncError}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                {t("common.details")}
              </span>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {t("common.edit")}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <Save className="h-3 w-3" />
                    {t("common.save")}
                  </button>
                </div>
              )}
            </div>

            {hasSyncSource && editing && (
              <p className="text-[10px] text-muted-foreground italic border border-border rounded-md px-3 py-1.5">
                {t("registry.syncFieldsHint")}
              </p>
            )}

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    {t("common.name")}
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
                    {t("common.description")}
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
                    {t("common.owner")}
                  </label>
                  <input
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
                    {t("registry.repoUrlLabel")}
                  </label>
                  <input
                    value={editRepo}
                    onChange={(e) => setEditRepo(e.target.value)}
                    placeholder={t("registry.repoPlaceholder")}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <ChipInput
                  label={t("common.technology")}
                  items={editTech}
                  onChange={setEditTech}
                />
                <ChipInput
                  label={t("common.tags")}
                  items={editTags}
                  onChange={setEditTags}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">
                    {t("common.source")}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {normalizedSources.map((source) => (
                      <span
                        key={source.type}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source.type]}`}
                      >
                        {sourceTypeLabel(t, source.type)}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-0.5">
                    {t("common.description")}
                  </span>
                  <p className="text-sm text-foreground">
                    {svc.description || (
                      <span className="text-muted-foreground italic">
                        {t("common.noDescription")}
                      </span>
                    )}
                  </p>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-20 shrink-0">
                    {t("common.owner")}
                  </span>
                  {svc.owner ? (
                    <span className="text-sm text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {svc.owner}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      {t("common.emDash")}
                    </span>
                  )}
                </div>

                {svc.repositoryUrl && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
                      {t("common.repo")}
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

                {(
                  (svc.metadata?.defectdojo as { productLink?: string } | undefined)
                    ?.productLink
                ) && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
                      {t("registry.productLabel")}
                    </span>
                    <a
                      href={
                        (
                          svc.metadata?.defectdojo as
                            | { productLink?: string }
                            | undefined
                        )?.productLink
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {
                          (
                            svc.metadata?.defectdojo as
                              | { productLink?: string }
                              | undefined
                          )?.productLink
                        }
                      </span>
                    </a>
                  </div>
                )}

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    {t("common.technology")}
                  </span>
                  {svc.technology.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {svc.technology.map((techStr) => (
                        <span
                          key={techStr}
                          className="text-[11px] font-mono rounded bg-secondary px-2 py-0.5 text-secondary-foreground"
                        >
                          {techStr}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      {t("common.emDash")}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    {t("common.tags")}
                  </span>
                  {(svc.tags ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(svc.tags ?? []).map((tagStr) => (
                        <span
                          key={tagStr}
                          className="text-[10px] rounded bg-secondary/60 px-2 py-0.5 text-muted-foreground"
                        >
                          #{tagStr}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      {t("common.emDash")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
              {t("registry.usageInDiagrams")}
            </span>
            {usage.length === 0 ? (
              <p className="text-xs text-muted-foreground italic rounded-lg border border-border bg-secondary/30 p-3">
                {t("registry.notLinked")}
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
                      {t("registry.nodeCount", { count: u.nodeCount })}
                      <ChevronRight className="h-3 w-3 inline ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive flex-1">
                  {t("registry.confirmDelete")}
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => {
                    removeService(svc.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("registry.confirmRemoval")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-destructive hover:underline"
              >
                {t("registry.deleteService")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


type SourceFilter = "all" | Source;

const ServiceRegistry = () => {
  const { t } = useTranslation();
  const services = useAllServices();
  const diagrams = useDiagrams();
  const { addService, updateService, removeService } = useRegistryActions();
  const { openDiagram } = useDiagramActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [importPanel, setImportPanel] = useState<
    "manual" | "github" | "defectdojo" | null
  >(null);
  const showEnableGithub = import.meta.env.VITE_ENABLE_GITHUB_IMPORT === "true";
  const showEnableDefectDojo = import.meta.env.VITE_ENABLE_DEFECTDOJO === "true";
  const { config: githubConfig } = useGithubConfig();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFromQuery = searchParams.get("serviceId");

  const filtered = useMemo(() => {
    let result = services;
    if (sourceFilter !== "all") {
      result = result.filter((service) =>
        normalizeSources(service).some((source) => source.type === sourceFilter),
      );
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

  const handleCreate = (svc: Omit<ServiceDefinition, "id">) => {
    const created = addService(svc);
    setImportPanel(null);
    setSelectedId(created.id);
  };

  const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
    { value: "all", label: t("registry.filterAll") },
    { value: "manual", label: t("registry.filterManual") },
    { value: "github", label: t("registry.filterGithub") },
    { value: "defectdojo", label: t("registry.filterDefectdojo") },
  ];

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="px-6 py-8">
        <div className="mx-auto max-w-[1600px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("registry.title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("registry.subtitle")}
              </p>
            </div>
            <button
              onClick={() =>
                setImportPanel((current) => (current ? null : "manual"))
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("registry.addService")}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("registry.searchPlaceholder")}
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
              · {filtered.length} {t("common.service", { count: filtered.length })}
            </span>
          </div>

          {importPanel && (
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  <button
                    onClick={() => setImportPanel("manual")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      importPanel === "manual"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("registry.importManual")}
                  </button>
                  {showEnableGithub && (
                  <button
                    onClick={() => setImportPanel("github")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      importPanel === "github"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("registry.importGithub")}
                  </button>
                  )}
                  {showEnableDefectDojo && (
                    <button
                      onClick={() => setImportPanel("defectdojo")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        importPanel === "defectdojo"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t("registry.importDefectDojo")}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setImportPanel(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="h-32 animate-pulse rounded-xl bg-secondary" />
                }
              >
                {importPanel === "manual" && (
                  <ManualCreateForm
                    onCancel={() => setImportPanel(null)}
                    onCreate={handleCreate}
                  />
                )}
                {importPanel === "defectdojo" && <DefectDojoPanel />}
                {importPanel === "github" && <GithubImportPanel />}
              </Suspense>
            </div>
          )}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {services.length === 0
                      ? t("registry.emptyNoServices")
                      : t("registry.emptyFiltered")}
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
                  {t("registry.selectForDetails")}
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

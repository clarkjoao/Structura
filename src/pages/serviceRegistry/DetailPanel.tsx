import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  ExternalLink as ExternalLinkIcon,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  User,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { i18n } from "@/infrastructure/i18n";
import { useGithubConfig } from "@/features/integrations/github/hooks/useGithubConfig";
import { normalizeSources } from "@/features/integrations/merge-utils";
import type { ExternalLink as DiagramExternalLink } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { ExternalLinksSection } from "@/features/canvas/panels/ElementPanel/sections";
import { ChipInput } from "./ChipInput";
import { SOURCE_BADGE, SOURCE_DOT } from "./registry.constants";
import { sourceTypeLabel } from "./registryLabels";
import { getServiceUsage } from "./serviceUsage";
import type { DetailPanelProps } from "./types";
import { syncServiceFromSources } from "./application/syncServiceFromSources";

export function DetailPanel({
  svc,
  diagrams,
  onNavigateToDiagram,
  updateService,
  removeService,
  onClose,
}: DetailPanelProps) {
  const { t } = useTranslation();
  const { config: githubConfig } = useGithubConfig();
  const normalizedSources = normalizeSources(svc);
  const hasGithubSource = normalizedSources.some((s) => s.type === ServiceSource.Github);
  const hasDefectDojoSource = normalizedSources.some((s) => s.type === ServiceSource.Defectdojo);
  const hasSyncSource = hasGithubSource || hasDefectDojoSource;
  const usage = useMemo(() => getServiceUsage(svc.id, diagrams), [svc.id, diagrams]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(svc.name);
  const [editDesc, setEditDesc] = useState(svc.description);
  const [editOwner, setEditOwner] = useState(svc.owner ?? "");
  const [editRepo, setEditRepo] = useState(svc.repositoryUrl);
  const [editTech, setEditTech] = useState<string[]>(svc.technology);
  const [editTags, setEditTags] = useState<string[]>(svc.tags ?? []);
  const [editLinks, setEditLinks] = useState<DiagramExternalLink[]>(svc.externalLinks ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!editing) {
      setEditName(svc.name);
      setEditDesc(svc.description);
      setEditOwner(svc.owner ?? "");
      setEditRepo(svc.repositoryUrl);
      setEditTech(svc.technology);
      setEditTags(svc.tags ?? []);
      setEditLinks(svc.externalLinks ?? []);
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
      externalLinks: editLinks,
    });
    setEditing(false);
  };

  const handleSync = useCallback(async () => {
    setSyncError("");
    setSyncing(true);
    try {
      const patch = await syncServiceFromSources({
        service: svc,
        githubConfig,
      });
      updateService(svc.id, patch);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : i18n.t("registry.errorSyncGeneric"));
    } finally {
      setSyncing(false);
    }
  }, [svc, updateService, githubConfig]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${SOURCE_DOT[normalizedSources[0]?.type ?? ServiceSource.Manual]}`}
          />
          <h2 className="text-base font-bold text-foreground truncate">{svc.name}</h2>
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
                <ChipInput label={t("common.technology")} items={editTech} onChange={setEditTech} />
                <ChipInput label={t("common.tags")} items={editTags} onChange={setEditTags} />
                <ExternalLinksSection
                  componentId={svc.id}
                  links={editLinks}
                  onAdd={(link) =>
                    setEditLinks((previous) => [
                      ...previous,
                      {
                        ...link,
                        id: `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                      },
                    ])
                  }
                  onUpdate={(linkId, patch) =>
                    setEditLinks((previous) =>
                      previous.map((item) => (item.id === linkId ? { ...item, ...patch } : item)),
                    )
                  }
                  onRemove={(linkId) =>
                    setEditLinks((previous) => previous.filter((item) => item.id !== linkId))
                  }
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

                {}
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

                {(svc.metadata?.defectdojo as { productLink?: string } | undefined)
                  ?.productLink && (
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] text-muted-foreground w-20 shrink-0 pt-0.5">
                      {t("registry.productLabel")}
                    </span>
                    <a
                      href={
                        (svc.metadata?.defectdojo as { productLink?: string } | undefined)
                          ?.productLink
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {
                          (svc.metadata?.defectdojo as { productLink?: string } | undefined)
                            ?.productLink
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

                {(svc.externalLinks ?? []).length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">
                      {t("externalLinks.sectionTitle")}
                    </span>
                    <div className="flex flex-col gap-1">
                      {(svc.externalLinks ?? []).map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1.5 truncate"
                        >
                          <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{link.label || link.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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
                    onClick={() => onNavigateToDiagram(u.diagramId, svc.id)}
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
}

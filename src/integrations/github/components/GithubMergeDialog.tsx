
import { useEffect, useMemo, useState } from "react";
import type { MergeConflict } from "../detectMergeConflicts";
import type { ServiceDefinition } from "@/features/diagram";
import { ServiceSource } from "@/features/diagram";
import { githubRepoToService } from "../githubMapper";
import { normalizeSources } from "../../merge-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export interface MergeResolution {
  existingServiceId: string;
  fields: {
    name: "github" | "existing";
    description: "github" | "existing";
    technology: "github" | "existing" | "merge";
    tags: "github" | "existing" | "merge";
  };
}

function pickStringCompleter(a: string, b: string): "github" | "existing" {
  const la = a?.trim().length ?? 0;
  const lb = b?.trim().length ?? 0;
  if (la === lb) return "github";
  return la > lb ? "github" : "existing";
}

function pickArrayCompleter(
  github: string[],
  existing: string[],
): "github" | "existing" | "merge" {
  const lg = github.length;
  const le = existing.length;
  if (lg === le) {
    if (lg === 0) return "existing";
    return "merge";
  }
  return lg > le ? "github" : "existing";
}

function resolveCompletenessTemplate(
  conflict: MergeConflict,
): MergeResolution {
  const githubService = githubRepoToService(conflict.repo);
  const existing = conflict.existingService;

  const name = pickStringCompleter(githubService.name, existing.name);
  const description = pickStringCompleter(
    githubService.description,
    existing.description,
  );

  const technology = pickArrayCompleter(
    githubService.technology,
    existing.technology,
  );
  const tags = pickArrayCompleter(githubService.tags ?? [], existing.tags ?? []);

  return {
    existingServiceId: existing.id,
    fields: {
      name,
      description,
      technology,
      tags,
    },
  };
}

export function GithubMergeDialog({
  conflicts,
  onResolve,
  onCancel,
}: {
  conflicts: MergeConflict[];
  onResolve: (resolutions: MergeResolution[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const existingColumnLabel = (existingService: ServiceDefinition) =>
    normalizeSources(existingService).some((source) => source.type === ServiceSource.Defectdojo)
      ? t("github.mergeExistingDefectDojo")
      : t("github.mergeExistingManual");

  const initial = useMemo(() => conflicts.map((c) => resolveCompletenessTemplate(c)), [conflicts]);
  const [draft, setDraft] = useState<MergeResolution[]>(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const globalTemplate = draft[0]?.fields;

  const applyAllSame = () => {
    if (!globalTemplate) return;
    setDraft((prev) =>
      prev.map((r) => ({
        ...r,
        fields: { ...globalTemplate },
      })),
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[980px] p-0 overflow-hidden rounded-2xl">
        <div className="px-6 py-5 border-b border-border bg-card">
          <DialogHeader className="p-0">
            <DialogTitle>{t("github.mergeConflictsTitle")}</DialogTitle>
            <DialogDescription>
              {t("github.mergeIntro")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applyAllSame}
              disabled={draft.length === 0}
            >
              {t("github.mergeResolveAllSame")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("github.mergeConflictCount", { count: conflicts.length })}
            </span>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto px-6 py-4 space-y-6">
          {conflicts.map((conflict, idx) => {
            const githubService = githubRepoToService(conflict.repo);
            const existing = conflict.existingService;
            const res = draft[idx];

            return (
              <div
                key={existing.id}
                className="rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {conflict.repo.full_name}
                    </p>
                    <p className="text-sm text-foreground/90 truncate">
                      {conflict.repo.description ?? t("github.noDescription")}
                    </p>
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {normalizeSources(existing).some(
                      (source) => source.type === ServiceSource.Defectdojo,
                    )
                      ? t("registry.sourceDefectdojo")
                      : t("github.sourceBadgeManual")}
                  </div>
                </div>

                <div className="grid grid-cols-[180px_1fr_1fr_1fr] gap-x-3 gap-y-2 items-start text-sm">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {t("github.mergeFieldColumn")}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {t("github.mergeGithubColumn")}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {existingColumnLabel(existing)}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground text-center">
                    {t("github.mergeMergeColumn")}
                  </div>

                  {/* name */}
                  <div className="text-xs text-muted-foreground mt-1">{t("common.name")}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.name === "github"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: { ...r.fields, name: "github" },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{githubService.name}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.name === "existing"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: { ...r.fields, name: "existing" },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{existing.name}</span>
                  </label>
                  <div />

                  {/* description */}
                  <div className="text-xs text-muted-foreground mt-1">{t("common.description")}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.description === "github"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: {
                                    ...r.fields,
                                    description: "github",
                                  },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{githubService.description || t("common.emDash")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.description === "existing"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: {
                                    ...r.fields,
                                    description: "existing",
                                  },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{existing.description || t("common.emDash")}</span>
                  </label>
                  <div />

                  {/* technology */}
                  <div className="text-xs text-muted-foreground mt-1">{t("common.technology")}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.technology === "github"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: {
                                    ...r.fields,
                                    technology: "github",
                                  },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">
                      {githubService.technology.join(", ") || t("common.emDash")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.technology === "existing"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: {
                                    ...r.fields,
                                    technology: "existing",
                                  },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">
                      {existing.technology.join(", ") || t("common.emDash")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer justify-center">
                    <input
                      type="radio"
                      checked={res.fields.technology === "merge"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: {
                                    ...r.fields,
                                    technology: "merge",
                                  },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">{t("github.mergeMergeColumn")}</span>
                  </label>

                  {/* tags */}
                  <div className="text-xs text-muted-foreground mt-1">{t("common.tags")}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.tags === "github"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: { ...r.fields, tags: "github" },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{githubService.tags?.join(", ") || t("common.emDash")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={res.fields.tags === "existing"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: { ...r.fields, tags: "existing" },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="truncate">{existing.tags?.join(", ") || t("common.emDash")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer justify-center">
                    <input
                      type="radio"
                      checked={res.fields.tags === "merge"}
                      onChange={() =>
                        setDraft((prev) =>
                          prev.map((r, i) =>
                            i !== idx
                              ? r
                              : {
                                  ...r,
                                  fields: { ...r.fields, tags: "merge" },
                                },
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">{t("github.mergeMergeColumn")}</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between">
          <Button
            type="button"
            onClick={() => onResolve(draft)}
            disabled={draft.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("github.conflictsConfirm", { count: conflicts.length })}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("github.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


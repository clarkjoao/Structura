import { useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { suggestServiceRole } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import {
  findInCatalog,
  loadDefectdojoProducts,
  loadGithubOrg,
  loadGitlabGroup,
} from "@/features/integrations/batch/batchSources";
import type { BatchCandidate, BatchKind } from "@/features/integrations/batch/batchSources";
import { DefectDojoConfigForm } from "@/features/integrations/defectdojo/components/DefectDojoConfigForm";
import { useDefectDojoConfig } from "@/features/integrations/defectdojo/hooks/useDefectDojoConfig";
import { GithubConfigForm } from "@/features/integrations/github/components/GithubConfigForm";
import { useGithubConfig } from "@/features/integrations/github/hooks/useGithubConfig";
import { GitlabConfigForm } from "@/features/integrations/gitlab/GitlabConfigForm";
import { useGitlabConfig } from "@/features/integrations/gitlab/useGitlabConfig";

interface AddBatchViewProps {
  kind: BatchKind;
  services: ServiceDefinition[];
  onBack: () => void;
  onCancel: () => void;
  onImport: (services: Omit<ServiceDefinition, "id">[]) => void;
}

const FIELD =
  "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function AddBatchView({ kind, services, onBack, onCancel, onImport }: AddBatchViewProps) {
  const { t } = useTranslation();
  const github = useGithubConfig();
  const gitlab = useGitlabConfig();
  const defectdojo = useDefectDojoConfig();
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<BatchCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const configured =
    kind === "github"
      ? github.isConfigured
      : kind === "gitlab"
        ? Boolean(gitlab.config)
        : defectdojo.isConfigured;

  const load = async () => {
    if (!configured || loading) return;
    setLoading(true);
    setError("");
    setRows(null);
    setSelected(new Set());
    try {
      const q = input.trim();
      const loaded =
        kind === "github" && github.config
          ? await loadGithubOrg(q, github.config)
          : kind === "gitlab" && gitlab.config
            ? await loadGitlabGroup(q, gitlab.config)
            : defectdojo.config
              ? await loadDefectdojoProducts(q, defectdojo.config)
              : [];
      setRows(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("services.batchErrorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const view = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        row,
        existing: findInCatalog(row, services),
        role: suggestServiceRole(row.service),
      })),
    [rows, services],
  );
  const visible = view.filter(({ row }) =>
    row.service.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const selectable = visible.filter(({ existing }) => !existing);
  const allSelected = selectable.length > 0 && selectable.every(({ row }) => selected.has(row.key));

  const toggle = (key: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const confirm = () =>
    onImport(
      view
        .filter(({ row, existing }) => selected.has(row.key) && !existing)
        .map(({ row, role }) => ({
          ...row.service,
          ...(role && !row.service.role ? { role, roleSource: "suggested" as const } : {}),
        })),
    );

  const inputLabel = t(`services.batchInput.${kind}`);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("services.batchBack")}
      </button>

      {!configured ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-foreground">{t(`services.batchNoConfig.${kind}`)}</p>
          {kind === "github" && (
            <GithubConfigForm
              config={github.config}
              onSave={github.saveConfig}
              onClear={github.clearConfig}
            />
          )}
          {kind === "gitlab" && (
            <GitlabConfigForm
              config={gitlab.config}
              onSave={gitlab.saveConfig}
              onClear={gitlab.clearConfig}
            />
          )}
          {kind === "defectdojo" && (
            <DefectDojoConfigForm
              config={defectdojo.config}
              onSave={defectdojo.saveConfig}
              onClear={defectdojo.clearConfig}
            />
          )}
        </div>
      ) : (
        <>
          <div>
            <label
              htmlFor="batch-input"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {inputLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="batch-input"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                className={FIELD}
              />
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || (kind !== "defectdojo" && !input.trim())}
                className="shrink-0 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("services.batchList")}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          {rows && (
            <div className="rounded-xl border border-border">
              <div className="flex items-center gap-3 border-b border-border px-3 py-2">
                <Checkbox
                  aria-label={t("services.batchSelectAll")}
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onCheckedChange={(checked) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      for (const { row } of selectable) {
                        if (checked) next.add(row.key);
                        else next.delete(row.key);
                      }
                      return next;
                    })
                  }
                />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("services.batchFilter")}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  {t("services.batchSelectAll")}
                </span>
              </div>
              <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                {visible.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("services.batchEmpty")}
                  </li>
                )}
                {visible.map(({ row, existing, role }) => (
                  <li
                    key={row.key}
                    className={`flex items-center gap-3 px-3 py-2 ${existing ? "opacity-60" : ""}`}
                  >
                    <Checkbox
                      aria-label={row.service.name}
                      checked={selected.has(row.key)}
                      disabled={Boolean(existing)}
                      onCheckedChange={() => toggle(row.key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-foreground">
                        {row.service.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.service.technology.join(" · ") || " "}
                      </span>
                    </span>
                    {existing ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {t("services.alreadyInCatalog")}
                      </span>
                    ) : (
                      role && (
                        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {t(`services.role.${role}`)}
                        </span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <DialogFooter className="gap-2 sm:space-x-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={selected.size === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t("services.batchImport", { count: selected.size })}
        </button>
      </DialogFooter>
    </div>
  );
}

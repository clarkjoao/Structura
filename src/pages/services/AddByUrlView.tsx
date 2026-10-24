import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { suggestServiceRole } from "@/features/diagram";
import type { ServiceDefinition, ServiceRole } from "@/features/diagram";
import { useGithubConfig } from "@/features/integrations/github/hooks/useGithubConfig";
import { useGitlabConfig } from "@/features/integrations/gitlab/useGitlabConfig";
import { repoUrlsMatch } from "@/features/integrations/merge-utils";
import { hostOf, parseRepoUrl } from "@/features/integrations/repo/parseRepoUrl";
import type { RepoKind } from "@/features/integrations/repo/parseRepoUrl";
import type { RepoMetadata } from "@/features/integrations/repo/repo.types";
import { repoToService } from "@/features/integrations/repo/repoToService";
import { useRepoLookup } from "@/features/integrations/repo/useRepoLookup";
import type { BatchKind } from "@/features/integrations/batch/batchSources";
import { ChipInput } from "./ChipInput";
import { RoleSelect } from "./RoleSelect";

interface AddByUrlViewProps {
  services: ServiceDefinition[];
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
  onCancel: () => void;
  onManual: () => void;
  onOpenExisting: (serviceId: string) => void;
  onBatch: (kind: BatchKind) => void;
}

const FIELD =
  "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";
const LABEL = "text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block";

/** When the lookup fails the form still works: the URL alone makes a manual service. */
function fallbackMetadata(kind: RepoKind, path: string, webUrl: string): RepoMetadata {
  return {
    kind,
    name: path.split("/").pop() ?? path,
    description: "",
    webUrl,
    fullName: path,
    remoteId: 0,
    languages: [],
    topics: [],
    updatedAt: "",
  };
}

export function AddByUrlView({
  services,
  onCreate,
  onCancel,
  onManual,
  onOpenExisting,
  onBatch,
}: AddByUrlViewProps) {
  const { t } = useTranslation();
  const { config: github } = useGithubConfig();
  const { config: gitlab } = useGitlabConfig();
  const [url, setUrl] = useState("");
  const [pickedKind, setPickedKind] = useState<RepoKind | "">("");

  const parsed = useMemo(
    () =>
      parseRepoUrl(url, {
        github: [hostOf(github?.baseUrl)].filter((h): h is string => Boolean(h)),
        gitlab: [hostOf(gitlab?.baseUrl)].filter((h): h is string => Boolean(h)),
      }),
    [url, github?.baseUrl, gitlab?.baseUrl],
  );
  // A host we do not recognise is never guessed: the user says what it is.
  const kind = parsed?.kind ?? (pickedKind || undefined);
  const lookup = useRepoLookup(parsed, kind);
  const metadata = lookup.status === "ready" ? lookup.metadata : undefined;

  const duplicate = parsed
    ? services.find((svc) => repoUrlsMatch(svc.repositoryUrl, parsed.webUrl))
    : undefined;

  // Fields are edited per repository; the form key resets them when the repository changes.
  const formKey =
    parsed && kind ? `${kind}:${parsed.host}/${parsed.path}:${metadata?.remoteId ?? ""}` : "none";

  return (
    <>
      <div className="space-y-4">
        <div>
          <label htmlFor="add-service-url" className={LABEL}>
            {t("services.repoUrlTitle")}
          </label>
          <div className="relative">
            <input
              id="add-service-url"
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPickedKind("");
              }}
              placeholder="https://github.com/org/repo"
              className={`${FIELD} pr-28 font-mono`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {parsed?.kind ? (
                <span className="rounded bg-secondary-foreground/10 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                  {t(parsed.kind === "github" ? "services.sourceGithub" : "services.sourceGitlab")}
                </span>
              ) : parsed ? (
                <select
                  aria-label={t("services.repoSourcePick")}
                  value={pickedKind}
                  onChange={(e) => setPickedKind(e.target.value as RepoKind | "")}
                  className="rounded border border-border bg-card px-1 py-0.5 text-[10px] text-foreground"
                >
                  <option value="">{t("services.repoSourcePick")}</option>
                  <option value="github">{t("services.sourceGithub")}</option>
                  <option value="gitlab">{t("services.sourceGitlab")}</option>
                </select>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {url.trim() && !parsed ? t("services.repoUrlInvalid") : t("services.repoUrlHint")}
          </p>
          {duplicate && (
            <p className="mt-1 text-xs text-amber-500">
              {t("services.alreadyInCatalog")} ·{" "}
              <button
                type="button"
                onClick={() => onOpenExisting(duplicate.id)}
                className="underline hover:no-underline"
              >
                {duplicate.name}
              </button>
            </p>
          )}
          {lookup.status === "error" && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {lookup.reason === "not-found"
                ? t("services.repoErrorNotFound")
                : lookup.reason === "no-config"
                  ? t("services.repoErrorNoConfig", { host: lookup.message })
                  : t("services.repoErrorGeneric", { message: lookup.message })}
            </p>
          )}
        </div>

        <RepoFields
          key={formKey}
          disabled={!parsed || !kind}
          loading={lookup.status === "loading"}
          metadata={metadata}
          fallback={parsed && kind ? fallbackMetadata(kind, parsed.path, parsed.webUrl) : undefined}
          blocked={Boolean(duplicate)}
          onCancel={onCancel}
          onManual={onManual}
          onCreate={onCreate}
        >
          <BatchCards onBatch={onBatch} />
        </RepoFields>
      </div>
    </>
  );
}

interface RepoFieldsProps {
  disabled: boolean;
  loading: boolean;
  metadata: RepoMetadata | undefined;
  fallback: RepoMetadata | undefined;
  blocked: boolean;
  onCancel: () => void;
  onManual: () => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
  children?: React.ReactNode;
}

function RepoFields({
  disabled,
  loading,
  metadata,
  fallback,
  blocked,
  onCancel,
  onManual,
  onCreate,
  children,
}: RepoFieldsProps) {
  const { t } = useTranslation();
  const source = metadata ?? fallback;
  const [name, setName] = useState(source?.name ?? "");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState(source?.description ?? "");
  const [role, setRole] = useState<ServiceRole | "">("");
  const [technology, setTechnology] = useState<string[]>(source?.languages ?? []);
  const [sync, setSync] = useState(true);

  const suggested = source
    ? suggestServiceRole({
        name,
        repositoryUrl: source.webUrl,
        topics: source.topics,
      })
    : undefined;
  // Without metadata there is no remote id to track, so the link to the source is not made.
  const syncAvailable = Boolean(metadata);
  const fieldsOff = disabled || loading;

  const submit = () => {
    if (!source || !name.trim() || blocked) return;
    onCreate(
      repoToService(
        source,
        { name, description, owner, role, technology, sync: sync && syncAvailable },
        suggested,
      ),
    );
  };

  return (
    <>
      <fieldset className="space-y-3 rounded-xl border border-border p-4" disabled={fieldsOff}>
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("services.repoReadFrom")}
          {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-service-name" className={LABEL}>
              {t("common.name")}
            </label>
            <input
              id="add-service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="add-service-owner" className={LABEL}>
              {t("common.owner")} · {t("services.optional")}
            </label>
            <input
              id="add-service-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <div>
          <label htmlFor="add-service-description" className={LABEL}>
            {t("common.description")}
          </label>
          <textarea
            id="add-service-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${FIELD} resize-none`}
          />
        </div>
        <RoleSelect value={role} suggested={suggested} onChange={setRole} />
        <ChipInput
          label={t("common.technology")}
          items={technology}
          onChange={setTechnology}
          placeholder={t("services.techPlaceholder")}
          disabled={fieldsOff}
        />
        <label className="flex items-center justify-between gap-3 pt-1 text-sm text-foreground">
          <span>
            {t("services.syncSwitch")}
            {!syncAvailable && !fieldsOff && (
              <span className="block text-xs text-muted-foreground">
                {t("services.syncSwitchUnavailable")}
              </span>
            )}
          </span>
          <Switch
            checked={sync && syncAvailable}
            disabled={!syncAvailable || fieldsOff}
            onCheckedChange={setSync}
          />
        </label>
      </fieldset>

      {children}

      <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
        <button
          type="button"
          onClick={onManual}
          className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("services.registerWithoutRepo")}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={fieldsOff || !name.trim() || blocked}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t("services.addService")}
          </button>
        </div>
      </DialogFooter>
    </>
  );
}

const BATCH_KINDS: BatchKind[] = ["github", "gitlab", "defectdojo"];

function BatchCards({ onBatch }: { onBatch: (kind: BatchKind) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("services.batchOr")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BATCH_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onBatch(kind)}
            className="rounded-xl border border-border px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <span className="block text-sm font-semibold text-foreground">
              {t(`services.batchCard.${kind}`)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(`services.batchCardHint.${kind}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

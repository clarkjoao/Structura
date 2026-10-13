import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  MCP_URL_ERROR_KEYS,
  isBlockedMode,
  validateServerUrl,
  type McpServerConfig,
  type McpToolMode,
} from "../../mcp/mcp-connections";
import { useMcpStore, type McpTestResult } from "../../mcp/mcp-store";
import {
  MCP_ERROR_KEYS,
  isConnectedStatus,
  isConnectingStatus,
  isErrorStatus,
  isTokenProblem,
  type McpConnectionError,
  type McpServerStatus,
  type McpToolEntry,
} from "../../mcp/mcp-types";

interface ServerDraft {
  name: string;
  url: string;
  token: string;
  rememberToken: boolean;
}

type Form =
  | { mode: "closed" }
  /** `id` null for a new server. `focusToken`: opened from "Enter token". */
  | { mode: "open"; id: string | null; draft: ServerDraft; focusToken: boolean };

const EMPTY_DRAFT: ServerDraft = { name: "", url: "", token: "", rememberToken: false };

function appOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** The classified error as the user reads it; CORS names the origin to allow. */
function useErrorText() {
  const { t } = useTranslation();
  return (error: McpConnectionError) =>
    t(MCP_ERROR_KEYS[error.kind], { origin: appOrigin(), status: error.status ?? "" });
}

/** Green connected, red error, amber token problems, grey otherwise. */
function StatusDot({ status }: { status: McpServerStatus | undefined }) {
  const { t } = useTranslation();
  const tone = isConnectedStatus(status)
    ? "bg-emerald-500"
    : isErrorStatus(status)
      ? isTokenProblem(status.error)
        ? "bg-amber-500"
        : "bg-destructive"
      : isConnectingStatus(status)
        ? "animate-pulse bg-muted-foreground"
        : "bg-muted-foreground/40";
  const label = isConnectedStatus(status)
    ? t("llmChat.mcp.status.connected")
    : isErrorStatus(status)
      ? t("llmChat.mcp.status.error")
      : isConnectingStatus(status)
        ? t("llmChat.mcp.status.connecting")
        : t("llmChat.mcp.status.disconnected");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("h-2 w-2 shrink-0 rounded-full", tone)}
    />
  );
}

/** Settings → MCP servers: list, status, tools and their modes, and the server form. */
export function McpSettings() {
  const { t } = useTranslation();
  const servers = useMcpStore((state) => state.servers);
  const runtime = useMcpStore((state) => state.runtime);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ mode: "closed" });
  const [deleting, setDeleting] = useState<McpServerConfig | null>(null);
  const errorText = useErrorText();

  useEffect(() => {
    if (!useMcpStore.getState().loaded) void useMcpStore.getState().load();
  }, []);

  const openForm = (server: McpServerConfig | null, focusToken = false) =>
    setForm({
      mode: "open",
      id: server?.id ?? null,
      draft: server
        ? { name: server.name, url: server.url, token: "", rememberToken: server.rememberToken }
        : EMPTY_DRAFT,
      focusToken,
    });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-foreground">
              {t("llmChat.mcp.title")}
            </h4>
            <p className="text-[11px] text-muted-foreground">{t("llmChat.mcp.hint")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => openForm(null)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("llmChat.mcp.add")}
          </Button>
        </div>

        {servers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t("llmChat.mcp.empty")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {servers.map((server) => {
              const entry = runtime[server.id];
              const status = entry?.status;
              const isOpen = expanded === server.id;
              return (
                <li key={server.id} className="rounded-lg border border-border text-xs">
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={t("llmChat.mcp.showTools", { name: server.name })}
                      onClick={() => setExpanded(isOpen ? null : server.id)}
                      className="flex rounded p-0.5 text-muted-foreground hover:bg-muted"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                      />
                    </button>
                    <StatusDot status={server.enabled ? status : undefined} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{server.name}</span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {server.url}
                      </span>
                    </div>
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(enabled) =>
                        void useMcpStore.getState().setEnabled(server.id, enabled)
                      }
                      aria-label={t("llmChat.mcp.enable", { name: server.name })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={t("llmChat.mcp.edit")}
                      title={t("llmChat.mcp.edit")}
                      onClick={() => openForm(server)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={t("llmChat.mcp.delete")}
                      title={t("llmChat.mcp.delete")}
                      onClick={() => setDeleting(server)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {server.enabled && isErrorStatus(status) ? (
                    <div
                      className={cn(
                        "flex items-start justify-between gap-2 border-t px-2.5 py-2",
                        isTokenProblem(status.error)
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                          : "border-destructive/30 bg-destructive/5 text-destructive",
                      )}
                    >
                      <p role="alert">{errorText(status.error)}</p>
                      {isTokenProblem(status.error) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0"
                          onClick={() => openForm(server, true)}
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          {t("llmChat.mcp.enterToken")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {isOpen ? (
                    <ServerTools
                      server={server}
                      tools={entry?.tools ?? []}
                      connected={isConnectedStatus(status)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {form.mode === "open" ? (
        <ServerForm
          key={form.id ?? "new"}
          serverId={form.id}
          initial={form.draft}
          hasToken={servers.find((server) => server.id === form.id)?.hasToken ?? false}
          focusToken={form.focusToken}
          onDone={() => setForm({ mode: "closed" })}
        />
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("llmChat.mcp.deleteTitle", { name: deleting?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("llmChat.mcp.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (target) void useMcpStore.getState().deleteServer(target.id);
              }}
            >
              {t("llmChat.mcp.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ANNOTATION_KEYS = {
  readOnlyHint: "llmChat.mcp.annotation.readOnly",
  destructiveHint: "llmChat.mcp.annotation.destructive",
  openWorldHint: "llmChat.mcp.annotation.openWorld",
} as const;

const ANNOTATION_ORDER = ["readOnlyHint", "destructiveHint", "openWorldHint"] as const;

function ServerTools({
  server,
  tools,
  connected,
}: {
  server: McpServerConfig;
  tools: McpToolEntry[];
  connected: boolean;
}) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await useMcpStore.getState().refresh(server.id);
    setRefreshing(false);
  };

  return (
    <div className="space-y-2 border-t border-border px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("llmChat.mcp.toolsTitle", { count: tools.length })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          disabled={refreshing || !server.enabled}
          onClick={() => void refresh()}
        >
          <RefreshCw className={cn("mr-1 h-3 w-3", refreshing && "animate-spin")} />
          {t("llmChat.mcp.refresh")}
        </Button>
      </div>
      {tools.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {connected ? t("llmChat.mcp.noTools") : t("llmChat.mcp.toolsWhenConnected")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tools.map((tool) => (
            <li key={tool.name} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="truncate font-mono text-[11px]">{tool.name}</span>
                  {ANNOTATION_ORDER.filter((key) => tool.annotations[key] === true).map((key) => (
                    <span
                      key={key}
                      className="rounded border border-border px-1 text-[10px] text-muted-foreground"
                    >
                      {t(ANNOTATION_KEYS[key])}
                    </span>
                  ))}
                  {!tool.supported ? (
                    <span className="rounded border border-amber-500/40 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                      {t("llmChat.mcp.unsupportedSchema")}
                    </span>
                  ) : null}
                </div>
                {tool.description ? (
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">
                    {tool.description}
                  </p>
                ) : null}
              </div>
              <select
                aria-label={t("llmChat.mcp.toolMode", { name: tool.name })}
                value={isBlockedMode(server.toolModes[tool.name]) ? "blocked" : "auto"}
                disabled={!tool.supported}
                onChange={(event) =>
                  void useMcpStore
                    .getState()
                    .setToolMode(server.id, tool.name, toToolMode(event.target.value))
                }
                className="h-7 shrink-0 rounded-md border border-input bg-background px-1.5 text-[11px]"
              >
                <option value="auto">{t("llmChat.mcp.mode.auto")}</option>
                <option value="blocked">{t("llmChat.mcp.mode.blocked")}</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TOOL_MODES: readonly McpToolMode[] = ["auto", "blocked"];

function toToolMode(value: string): McpToolMode {
  return TOOL_MODES.find((mode) => mode === value) ?? "auto";
}

function ServerForm({
  serverId,
  initial,
  hasToken,
  focusToken,
  onDone,
}: {
  serverId: string | null;
  initial: ServerDraft;
  hasToken: boolean;
  focusToken: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [draft, setDraft] = useState(initial);
  const [urlTouched, setUrlTouched] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<McpTestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const urlError = draft.url.trim() ? validateServerUrl(draft.url) : null;
  const canSave = draft.name.trim().length > 0 && draft.url.trim().length > 0 && !urlError;
  const isNew = serverId === null;

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const store = useMcpStore.getState();
    // Editing without retyping the token tests with the stored one.
    const token = draft.token || (serverId ? await storedToken(serverId) : null);
    setTest(await store.testConnection(draft.url, token));
    setTesting(false);
  };

  const save = async () => {
    setSaveError(null);
    const store = useMcpStore.getState();
    const base = { name: draft.name, url: draft.url, rememberToken: draft.rememberToken };
    const result = isNew
      ? await store.addServer(base, draft.token || null)
      : await store.updateServer(serverId, base, draft.token ? draft.token : undefined);
    if (!result.ok) {
      setSaveError(
        result.urlError
          ? t(MCP_URL_ERROR_KEYS[result.urlError])
          : t("llmChat.mcp.form.saveFailed", { message: result.message ?? "" }),
      );
      return;
    }
    onDone();
  };

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h4 className="text-xs font-semibold tracking-wide text-foreground">
        {isNew ? t("llmChat.mcp.add") : t("llmChat.mcp.editTitle")}
      </h4>

      <div className="space-y-1">
        <label htmlFor="mcp-name" className="text-xs text-muted-foreground">
          {t("llmChat.mcp.form.name")}
        </label>
        <Input
          id="mcp-name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="mcp-url" className="text-xs text-muted-foreground">
          {t("llmChat.mcp.form.url")}
        </label>
        <Input
          id="mcp-url"
          className="font-mono text-xs"
          placeholder="https://"
          value={draft.url}
          onBlur={() => setUrlTouched(true)}
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
        />
        {urlError && urlTouched ? (
          <p className="text-xs text-destructive">{t(MCP_URL_ERROR_KEYS[urlError])}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="mcp-token" className="text-xs text-muted-foreground">
          {t("llmChat.mcp.form.token")}
        </label>
        <Input
          id="mcp-token"
          type="password"
          autoComplete="off"
          autoFocus={focusToken}
          placeholder={hasToken ? t("llmChat.mcp.form.tokenKeep") : ""}
          value={draft.token}
          onChange={(event) => setDraft({ ...draft, token: event.target.value })}
        />
        <label className="flex items-center gap-2 pt-1 text-xs">
          <Checkbox
            checked={draft.rememberToken}
            onCheckedChange={(checked) => setDraft({ ...draft, rememberToken: checked === true })}
          />
          {t("llmChat.mcp.form.remember")}
        </label>
        <p className="text-[11px] text-muted-foreground">{t("llmChat.mcp.form.rememberNote")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={testing || !draft.url.trim() || Boolean(urlError)}
          onClick={() => void runTest()}
        >
          {testing ? t("llmChat.mcp.form.testing") : t("llmChat.mcp.form.test")}
        </Button>
        {test ? (
          <p
            role="status"
            className={cn("text-xs", test.ok ? "text-muted-foreground" : "text-destructive")}
          >
            {test.ok
              ? t("llmChat.mcp.form.testOk", { count: test.toolCount, latency: test.latencyMs })
              : errorText(test.error)}
          </p>
        ) : null}
      </div>

      {saveError ? (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" disabled={!canSave} onClick={() => void save()}>
          {t("common.save")}
        </Button>
      </div>
    </section>
  );
}

/** The saved token of a server, for testing an edit without retyping it. */
async function storedToken(serverId: string): Promise<string | null> {
  return useMcpStore.getState().getToken(serverId);
}

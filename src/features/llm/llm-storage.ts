import type {
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  LLMConfig,
  LLMConnection,
  LLMProvider,
  CustomProtocol,
} from "./types";
import i18n from "@/infrastructure/i18n";
import { defaultStorage, type IStoragePort } from "@/infrastructure/persistence";
import { legacyLocalStore } from "./legacy-local-store";
import { getVisibleText, migrateStoredMessages } from "./message-parts";
import {
  THREAD_FORMAT_VERSION,
  loadAllThreadsFromIdb,
  migrateThreadsFromLocalStorageToIdb,
  saveThreadsToIdb,
} from "./llm-threads-idb";

const LLM_CONFIG_STORAGE_KEY = "structura:llm:config";
const PROVIDER_KEY_STORAGE = "structura:llm:keys";
const LLM_CONNECTIONS_STORAGE_KEY = "structura:llm:connections";
const CHAT_HISTORY_KEY = "structura:llm:history";
/** Message format of the `CHAT_HISTORY_KEY` snapshot; see `THREAD_FORMAT_VERSION`. */
const CHAT_HISTORY_FORMAT_KEY = "structura:llm:history:formatVersion";
const MAX_THREADS = 20;
const MAX_MESSAGES_PER_THREAD = 50;

/**
 * Where a proxy connection points when it has no base URL of its own. A proxy
 * is any OpenAI-compatible endpoint (the SDK posts to `<base>/chat/completions`);
 * `VITE_LLM_PROXY_URL` is only the default for new and migrated connections.
 */
export const DEFAULT_PROXY_BASE_URL: string =
  import.meta.env.VITE_LLM_PROXY_URL ?? "http://localhost:3001";

/** Removes a trailing "/chat/completions" (and slashes): the SDK appends it. */
export function toOpenAICompatibleBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
}

/**
 * Brings a stored base URL to what the AI SDK transport expects. Proxy
 * connections saved before it had no URL (the proxy endpoint was build-time);
 * custom endpoints stored the full completions URL.
 */
function migrateBaseUrl(mode: LLMConnection["mode"], provider: LLMProvider, raw: unknown) {
  const stored = isString(raw) && raw.trim().length > 0 ? raw : undefined;
  if (mode === "proxy") {
    return toOpenAICompatibleBaseUrl(stored ?? DEFAULT_PROXY_BASE_URL);
  }
  if (provider === "custom" && stored) {
    return toOpenAICompatibleBaseUrl(stored);
  }
  return stored;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: "proxy",
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

const DEFAULT_LLM_CONNECTION_ID = "default";

/**
 * The connection a fresh install starts with: direct mode and no API key, so
 * the chat asks for settings instead of firing a request at a proxy that most
 * installs do not run. Stored connections are never rewritten to this.
 */
export function defaultLLMConnection(): LLMConnection {
  return {
    id: DEFAULT_LLM_CONNECTION_ID,
    name: i18n.t("llmChat.settings.defaultConnectionName"),
    mode: "direct",
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  };
}

export interface ConnectionsPayload {
  connections: LLMConnection[];
  activeConnectionId: string;
}

interface LegacyConfigPayload {
  mode?: unknown;
  provider?: unknown;
  apiKey?: unknown;
  model?: unknown;
}

interface LegacyProviderKeysPayload {
  openai?: unknown;
  anthropic?: unknown;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCustomProtocol(value: unknown): value is CustomProtocol {
  return value === "openai" || value === "anthropic";
}

function normalizeConnection(raw: Partial<LLMConnection>): LLMConnection {
  const provider: LLMProvider = (
    raw.provider === "anthropic" || raw.provider === "custom" ? raw.provider : "openai"
  ) as LLMConnection["provider"];
  const mode: LLMConnection["mode"] = raw.mode === "direct" ? "direct" : "proxy";
  return {
    id: isString(raw.id) && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    name:
      isString(raw.name) && raw.name.length > 0
        ? raw.name
        : i18n.t("llmChat.settings.fallbackConnectionName"),
    mode,
    provider,
    apiKey: isString(raw.apiKey) ? raw.apiKey : "",
    model: isString(raw.model) && raw.model.length > 0 ? raw.model : DEFAULT_LLM_CONFIG.model,
    baseUrl: migrateBaseUrl(mode, provider, raw.baseUrl),
    models: Array.isArray(raw.models)
      ? raw.models.filter((model): model is string => isString(model))
      : undefined,
    authHeader: isString(raw.authHeader) && raw.authHeader.length > 0 ? raw.authHeader : undefined,
    customProtocol: isCustomProtocol(raw.customProtocol) ? raw.customProtocol : undefined,
    extraHeaders: isObject(raw.extraHeaders)
      ? (raw.extraHeaders as Record<string, string>)
      : undefined,
    extraParams: isObject(raw.extraParams)
      ? (raw.extraParams as Record<string, unknown>)
      : undefined,
  };
}

export function migrateLegacyConfig(
  rawConfig: string | null,
  rawKeys: string | null,
): ConnectionsPayload {
  let legacyConfig: LegacyConfigPayload = {};
  let legacyKeys: LegacyProviderKeysPayload = {};

  if (rawConfig) {
    try {
      const parsed: unknown = JSON.parse(rawConfig);
      if (isObject(parsed)) {
        legacyConfig = parsed as LegacyConfigPayload;
      }
    } catch (err) {
      console.warn("[llm-storage] Failed to parse legacy config:", err);
    }
  }

  if (rawKeys) {
    try {
      const parsed: unknown = JSON.parse(rawKeys);
      if (isObject(parsed)) {
        legacyKeys = parsed as LegacyProviderKeysPayload;
      }
    } catch (err) {
      console.warn("[llm-storage] Failed to parse legacy keys:", err);
    }
  }

  const mode: LLMConnection["mode"] = legacyConfig.mode === "direct" ? "direct" : "proxy";
  const provider: LLMConnection["provider"] =
    legacyConfig.provider === "anthropic" || legacyConfig.provider === "custom"
      ? legacyConfig.provider
      : "openai";

  const inlineKey = isString(legacyConfig.apiKey) ? legacyConfig.apiKey : "";
  const fallbackKeyByProvider: Record<LLMConnection["provider"], string> = {
    openai: isString(legacyKeys.openai) ? legacyKeys.openai : "",
    anthropic: isString(legacyKeys.anthropic) ? legacyKeys.anthropic : "",
    custom: "",
  };
  const apiKey = inlineKey || fallbackKeyByProvider[provider];
  const model =
    isString(legacyConfig.model) && legacyConfig.model.length > 0
      ? legacyConfig.model
      : DEFAULT_LLM_CONFIG.model;

  const id = crypto.randomUUID();
  const connection: LLMConnection = {
    id,
    name: provider === "anthropic" ? "Anthropic" : provider === "custom" ? "Custom" : "OpenAI",
    mode,
    provider,
    apiKey,
    model,
  };

  return {
    connections: [connection],
    activeConnectionId: id,
  };
}

function migrateLegacyThreadsValue(value: unknown): ConversationThread[] {
  if (!isObject(value)) {
    return [];
  }
  const diagramId = isString(value.diagramId) ? value.diagramId : "";
  const legacyMessages: unknown = value.messages;
  if (!Array.isArray(legacyMessages)) {
    return [];
  }
  const { messages } = migrateStoredMessages(legacyMessages);
  if (messages.length === 0 && diagramId === "") {
    return [];
  }
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now();

  return [
    {
      id: crypto.randomUUID(),
      diagramId,
      title: deriveThreadTitle(messages),
      messages,
      createdAt: updatedAt,
      updatedAt,
    },
  ];
}

export function migrateLegacyThreads(
  rawThreads: string | null,
): Record<string, DiagramThreadState> {
  if (!rawThreads) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawThreads);
  } catch {
    return {};
  }
  if (!isObject(parsed)) {
    return {};
  }

  const result: Record<string, DiagramThreadState> = {};
  let pendingMigrations = 0;

  for (const [diagramId, entry] of Object.entries(parsed)) {
    if (!isObject(entry)) {
      continue;
    }
    const hasThreadShape =
      Array.isArray((entry as { threads?: unknown }).threads) ||
      isString((entry as { activeThreadId?: unknown }).activeThreadId);
    if (hasThreadShape) {
      const threadsValue = (entry as { threads?: unknown }).threads;
      const activeThreadIdValue = (entry as { activeThreadId?: unknown }).activeThreadId;
      const threads: ConversationThread[] = Array.isArray(threadsValue)
        ? threadsValue
            .filter(
              (thread): thread is ConversationThread =>
                isObject(thread) &&
                isString((thread as { id?: unknown }).id) &&
                isString((thread as { diagramId?: unknown }).diagramId) &&
                Array.isArray((thread as { messages?: unknown }).messages),
            )
            .map((thread) => ({
              id: (thread as { id: string }).id,
              diagramId: (thread as { diagramId: string }).diagramId,
              title:
                (thread as { title?: string }).title ??
                deriveThreadTitle(migrateStoredMessages(thread.messages).messages),
              messages: migrateStoredMessages(thread.messages).messages.slice(
                -MAX_MESSAGES_PER_THREAD,
              ),
              createdAt:
                typeof (thread as { createdAt?: number }).createdAt === "number"
                  ? (thread as { createdAt: number }).createdAt
                  : Date.now(),
              updatedAt:
                typeof (thread as { updatedAt?: number }).updatedAt === "number"
                  ? (thread as { updatedAt: number }).updatedAt
                  : Date.now(),
            }))
        : [];
      const activeThreadId =
        isString(activeThreadIdValue) && threads.some((thread) => thread.id === activeThreadIdValue)
          ? activeThreadIdValue
          : (threads[0]?.id ?? "");
      result[diagramId] = { threads, activeThreadId };
      continue;
    }

    pendingMigrations += 1;
    const threads = migrateLegacyThreadsValue(entry);
    if (threads.length === 0) {
      continue;
    }
    result[diagramId] = {
      threads,
      activeThreadId: threads[0]?.id ?? "",
    };
  }

  if (pendingMigrations === 0) {
    return result;
  }
  return result;
}

export function deriveThreadTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) {
    return "";
  }
  const trimmed = getVisibleText(firstUser).trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return "";
  }
  const MAX = 60;
  return trimmed.length <= MAX ? trimmed : `${trimmed.slice(0, MAX - 1)}…`;
}

/**
 * Whether a request on this connection can be attempted at all. A proxy holds
 * its own credentials; a direct OpenAI/Anthropic call needs a key; a custom
 * endpoint needs a base URL and a model (its key is optional).
 */
export function isUsableConnection(config: LLMConfig): boolean {
  if (config.mode === "proxy") {
    return true;
  }
  switch (config.provider) {
    case "custom":
      return Boolean(config.baseUrl?.trim()) && config.model.trim().length > 0;
    case "openai":
    case "anthropic":
      return config.apiKey.trim().length > 0;
  }
}

/** Where connections (and their API keys) live on the storage port. */
export const CONNECTIONS_PORT_KEY = "llm-connections";

const LEGACY_CONNECTION_KEYS = [
  LLM_CONNECTIONS_STORAGE_KEY,
  LLM_CONFIG_STORAGE_KEY,
  PROVIDER_KEY_STORAGE,
] as const;

function parseConnectionsPayload(value: unknown): ConnectionsPayload | null {
  if (!isObject(value) || !Array.isArray(value.connections)) return null;
  const connections = value.connections
    .filter((entry): entry is Partial<LLMConnection> => isObject(entry))
    .map((entry) => normalizeConnection(entry));
  if (connections.length === 0) return null;
  const activeConnectionId =
    isString(value.activeConnectionId) &&
    connections.some((connection) => connection.id === value.activeConnectionId)
      ? value.activeConnectionId
      : (connections[0]?.id ?? DEFAULT_LLM_CONNECTION_ID);
  return { connections, activeConnectionId };
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Connections under the old keys: the connections list, else the oldest config shape. */
async function readLegacyConnections(legacy: IStoragePort): Promise<ConnectionsPayload | null> {
  const stored = parseConnectionsPayload(
    parseJson(await legacy.getItem(LLM_CONNECTIONS_STORAGE_KEY)),
  );
  if (stored) return stored;
  const legacyConfig = await legacy.getItem(LLM_CONFIG_STORAGE_KEY);
  const legacyKeys = await legacy.getItem(PROVIDER_KEY_STORAGE);
  if (!legacyConfig && !legacyKeys) return null;
  const migrated = migrateLegacyConfig(legacyConfig, legacyKeys);
  return migrated.connections.length > 0
    ? { ...migrated, connections: migrated.connections.map(normalizeConnection) }
    : null;
}

async function deleteLegacyConnectionKeys(legacy: IStoragePort): Promise<void> {
  for (const key of LEGACY_CONNECTION_KEYS) {
    if ((await legacy.getItem(key)) !== null) await legacy.removeItem(key);
  }
}

export function defaultConnectionsPayload(): ConnectionsPayload {
  const id = crypto.randomUUID();
  return { connections: [{ ...defaultLLMConnection(), id }], activeConnectionId: id };
}

let migrationFailureLogged = false;

/**
 * Loads the connections from the port. On the first run after the move to
 * the port, the old keys are read, written through the port, and deleted only
 * once the write is confirmed; a failed write keeps the old data (and logs
 * once) so the next load tries again. Idempotent.
 */
export async function loadConnections(
  port: IStoragePort = defaultStorage,
  legacy: IStoragePort = legacyLocalStore,
): Promise<ConnectionsPayload> {
  try {
    const stored = parseConnectionsPayload(await port.load<unknown>(CONNECTIONS_PORT_KEY));
    if (stored) {
      // A previous migration wrote the new key but could not delete the old ones.
      await deleteLegacyConnectionKeys(legacy);
      return stored;
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to load connections:", err);
  }

  const fromLegacy = await readLegacyConnections(legacy).catch(() => null);
  if (!fromLegacy) return defaultConnectionsPayload();

  try {
    await port.save(CONNECTIONS_PORT_KEY, fromLegacy);
    if (!parseConnectionsPayload(await port.load<unknown>(CONNECTIONS_PORT_KEY))) {
      throw new Error("the migrated connections did not read back");
    }
    await deleteLegacyConnectionKeys(legacy);
  } catch (err) {
    if (!migrationFailureLogged) {
      migrationFailureLogged = true;
      console.warn("[llm-storage] Connection migration failed; keeping the old data:", err);
    }
  }
  return fromLegacy;
}

export async function saveConnections(
  payload: ConnectionsPayload,
  port: IStoragePort = defaultStorage,
): Promise<void> {
  const normalized: ConnectionsPayload = {
    connections: payload.connections.map((connection) => normalizeConnection(connection)),
    activeConnectionId: payload.connections.some(
      (connection) => connection.id === payload.activeConnectionId,
    )
      ? payload.activeConnectionId
      : (payload.connections[0]?.id ?? DEFAULT_LLM_CONNECTION_ID),
  };
  await port.save(CONNECTIONS_PORT_KEY, normalized);
}

// ---------------------------------------------------------------------------
// Chat threads: in-memory cache + IndexedDB
// ---------------------------------------------------------------------------
//
// The chat thread state used to live in `localStorage` under
// `structura:llm:history`. That single-key blob grew unbounded and forced the
// panel to JSON.parse the entire history every time it opened. This module
// keeps a synchronous in-memory cache (`chatThreadsCache`) populated at app
// boot by `useLLMStore.initChatThreads()`. The cache is the source of truth
// during the session; `IndexedDB` (via `llm-threads-idb`) is the durable
// surface; a snapshot under the old key, written through the storage port, is
// a best-effort fallback for runtimes without IDB.

let chatThreadsCache: Record<string, DiagramThreadState> = {};
let chatThreadsHydrated = false;

export function getChatThreadsCache(): Record<string, DiagramThreadState> {
  return chatThreadsCache;
}

export function setChatThreadsCacheEntry(diagramId: string, state: DiagramThreadState): void {
  chatThreadsCache = { ...chatThreadsCache, [diagramId]: state };
}

export function replaceChatThreadsCache(next: Record<string, DiagramThreadState>): void {
  chatThreadsCache = { ...next };
}

export function isChatThreadsHydrated(): boolean {
  return chatThreadsHydrated;
}

export function setChatThreadsHydrated(value: boolean): void {
  chatThreadsHydrated = value;
}

/**
 * Test-only helper. Clears the in-memory cache, the hydration flag, and the
 * IDB-backed store. Used by `llm-storage.test.ts` and `store.test.ts`.
 */
export function resetLLMStorageForTests(): void {
  chatThreadsCache = {};
  chatThreadsHydrated = false;
}

function emptyThreadState(_diagramId: string): DiagramThreadState {
  return { threads: [], activeThreadId: "" };
}

/**
 * Read the persisted thread state for `diagramId` from the in-memory cache.
 * Before the boot hydration completes it is empty; the store reloads the
 * active diagram's history once hydration lands (`initChatThreads`).
 */
export function loadThreadsForDiagram(diagramId: string): DiagramThreadState {
  if (chatThreadsHydrated && diagramId in chatThreadsCache) {
    return chatThreadsCache[diagramId];
  }
  return emptyThreadState(diagramId);
}

/**
 * Write a `DiagramThreadState` for `diagramId`. Updates the in-memory cache
 * synchronously, then enqueues an async IDB write (best-effort) and rewrites
 * the localStorage snapshot so a runtime without IDB still has data.
 */
export function saveThreadsForDiagram(diagramId: string, state: DiagramThreadState): void {
  // Block save during hydration to prevent overwriting threads from other diagrams
  // with partial data from the cache.
  if (!isChatThreadsHydrated()) return;

  // 1. Cache (sync, source of truth during the session).
  setChatThreadsCacheEntry(diagramId, state);

  // 2. IDB write (best-effort; the in-memory cache still works on failure).
  void saveThreadsToIdb(diagramId, state);

  // 3. localStorage snapshot — rebuilt from the cache so the fallback path
  //    always reflects the full diagram set.
  writeThreadsSnapshot();
}

function writeThreadsSnapshot(): void {
  try {
    const snapshot: Record<string, DiagramThreadState> = {};
    for (const [key, value] of Object.entries(chatThreadsCache)) {
      const limitedThreads = value.threads.slice(-MAX_THREADS).map((thread) => ({
        ...thread,
        messages: thread.messages.slice(-MAX_MESSAGES_PER_THREAD),
      }));
      snapshot[key] = {
        threads: limitedThreads,
        activeThreadId:
          limitedThreads.find((thread) => thread.id === value.activeThreadId)?.id ??
          limitedThreads[0]?.id ??
          "",
      };
    }
    void Promise.all([
      legacyLocalStore.setItem(CHAT_HISTORY_KEY, JSON.stringify(snapshot)),
      legacyLocalStore.setItem(CHAT_HISTORY_FORMAT_KEY, String(THREAD_FORMAT_VERSION)),
    ]).catch((err: unknown) => {
      console.warn("[llm-storage] Failed to save threads snapshot:", err);
    });
  } catch (err) {
    console.warn("[llm-storage] Failed to save threads snapshot:", err);
  }
}

/**
 * Boot-time hydration: reads every diagram's state from IDB once, populates
 * the cache, and sets the hydration flag. Called by `useLLMStore.initChatThreads`.
 */
export async function hydrateChatThreadsCacheFromIdb(): Promise<void> {
  if (chatThreadsHydrated) {
    return;
  }
  const idbPayload = await loadAllThreadsFromIdb();
  // Merge with any legacy localStorage payload that wasn't migrated yet
  // (covers the case where IDB is empty but the legacy blob is present).
  const merged: Record<string, DiagramThreadState> = { ...idbPayload };
  let snapshotNeedsRewrite = false;
  const rawLegacy = await legacyLocalStore.getItem(CHAT_HISTORY_KEY).catch(() => null);
  try {
    if (rawLegacy) {
      // `migrateLegacyThreads` brings messages to the current format.
      const legacy = migrateLegacyThreads(rawLegacy);
      for (const [diagramId, state] of Object.entries(legacy)) {
        if (!(diagramId in merged)) {
          merged[diagramId] = state;
        }
      }
      snapshotNeedsRewrite =
        (await legacyLocalStore.getItem(CHAT_HISTORY_FORMAT_KEY)) !== String(THREAD_FORMAT_VERSION);
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to migrate legacy threads:", err);
  }
  replaceChatThreadsCache(merged);
  setChatThreadsHydrated(true);
  // Rewritten only now that the migration above succeeded.
  if (snapshotNeedsRewrite) {
    writeThreadsSnapshot();
  }

  // Run the one-shot migration in the background. The flag inside the IDB
  // helper makes this a no-op after the first run.
  void migrateThreadsFromLocalStorageToIdb(rawLegacy, legacyLocalStore);
}

// Compatibility shims for callers still relying on the old shape. These are
// pure functions over the migrated payload and stay until the panel migrates
// off of them in Fase 6.
export function loadThreadFromStorage(diagramId: string): ChatMessage[] {
  return loadThreadsForDiagram(diagramId).threads[0]?.messages ?? [];
}

export function saveThreadToStorage(diagramId: string, messages: ChatMessage[]): void {
  // Block save during hydration to prevent data loss
  if (!isChatThreadsHydrated()) return;

  const existing = loadThreadsForDiagram(diagramId);
  const threads: ConversationThread[] =
    existing.threads.length > 0
      ? existing.threads.map((thread, index) =>
          index === 0
            ? {
                ...thread,
                messages,
                updatedAt: Date.now(),
              }
            : thread,
        )
      : [
          {
            id: crypto.randomUUID(),
            diagramId,
            title: deriveThreadTitle(messages),
            messages,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];
  saveThreadsForDiagram(diagramId, {
    threads,
    activeThreadId: threads[0]?.id ?? "",
  });
}

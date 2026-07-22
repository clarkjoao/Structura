import type {
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  LLMConfig,
  LLMConnection,
  LLMProvider,
} from "./types";
import {
  loadAllThreadsFromIdb,
  migrateThreadsFromLocalStorageToIdb,
  saveThreadsToIdb,
} from "./llm-threads-idb";

const LLM_CONFIG_STORAGE_KEY = "structura:llm:config";
const PROVIDER_KEY_STORAGE = "structura:llm:keys";
const LLM_CONNECTIONS_STORAGE_KEY = "structura:llm:connections";
const CHAT_HISTORY_KEY = "structura:llm:history";
const MAX_THREADS = 20;
const MAX_MESSAGES_PER_THREAD = 50;

const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: "proxy",
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

const DEFAULT_LLM_CONNECTION: LLMConnection = {
  id: "default",
  name: "Default",
  mode: "proxy",
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

interface ConnectionsPayload {
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

function normalizeConnection(raw: Partial<LLMConnection>): LLMConnection {
  const provider: LLMProvider = (
    raw.provider === "anthropic" || raw.provider === "custom" ? raw.provider : "openai"
  ) as LLMConnection["provider"];
  const mode: LLMConnection["mode"] = raw.mode === "direct" ? "direct" : "proxy";
  return {
    id: isString(raw.id) && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    name: isString(raw.name) && raw.name.length > 0 ? raw.name : "Connection",
    mode,
    provider,
    apiKey: isString(raw.apiKey) ? raw.apiKey : "",
    model: isString(raw.model) && raw.model.length > 0 ? raw.model : DEFAULT_LLM_CONFIG.model,
    baseUrl: isString(raw.baseUrl) && raw.baseUrl.length > 0 ? raw.baseUrl : undefined,
    authHeader: isString(raw.authHeader) && raw.authHeader.length > 0 ? raw.authHeader : undefined,
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
  const messages: ChatMessage[] = legacyMessages.filter(
    (message): message is ChatMessage =>
      isObject(message) &&
      isString((message as { id?: unknown }).id) &&
      ((message as { role?: unknown }).role === "user" ||
        (message as { role?: unknown }).role === "assistant") &&
      isString((message as { content?: unknown }).content),
  );
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
                deriveThreadTitle((thread as { messages: ChatMessage[] }).messages),
              messages: (thread as { messages: ChatMessage[] }).messages.slice(
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
  const trimmed = firstUser.content.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return "";
  }
  const MAX = 60;
  return trimmed.length <= MAX ? trimmed : `${trimmed.slice(0, MAX - 1)}…`;
}

export function loadConnections(): ConnectionsPayload {
  try {
    const rawValue = localStorage.getItem(LLM_CONNECTIONS_STORAGE_KEY);
    if (rawValue) {
      const parsed: unknown = JSON.parse(rawValue);
      if (isObject(parsed)) {
        const connectionsValue = (parsed as { connections?: unknown }).connections;
        const activeConnectionIdValue = (parsed as { activeConnectionId?: unknown })
          .activeConnectionId;
        if (Array.isArray(connectionsValue)) {
          const connections = connectionsValue
            .filter((entry): entry is Partial<LLMConnection> => isObject(entry))
            .map((entry) => normalizeConnection(entry));
          const activeConnectionId =
            isString(activeConnectionIdValue) &&
            connections.some((connection) => connection.id === activeConnectionIdValue)
              ? activeConnectionIdValue
              : (connections[0]?.id ?? DEFAULT_LLM_CONNECTION.id);
          if (connections.length > 0) {
            return { connections, activeConnectionId };
          }
        }
      }
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to load connections:", err);
  }

  // Legacy fallback: migrate from old key shape.
  let migrated: ConnectionsPayload | null = null;
  try {
    const legacyConfig = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    const legacyKeys = localStorage.getItem(PROVIDER_KEY_STORAGE);
    if (legacyConfig || legacyKeys) {
      migrated = migrateLegacyConfig(legacyConfig, legacyKeys);
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to migrate legacy config:", err);
  }

  if (migrated && migrated.connections.length > 0) {
    return migrated;
  }

  const id = crypto.randomUUID();
  return {
    connections: [{ ...DEFAULT_LLM_CONNECTION, id }],
    activeConnectionId: id,
  };
}

export function saveConnections(payload: ConnectionsPayload): void {
  const normalized: ConnectionsPayload = {
    connections: payload.connections.map((connection) => normalizeConnection(connection)),
    activeConnectionId: payload.connections.some(
      (connection) => connection.id === payload.activeConnectionId,
    )
      ? payload.activeConnectionId
      : (payload.connections[0]?.id ?? DEFAULT_LLM_CONNECTION.id),
  };
  localStorage.setItem(LLM_CONNECTIONS_STORAGE_KEY, JSON.stringify(normalized));
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
// surface; `localStorage` is a best-effort fallback for runtimes without IDB.

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
 * Read the persisted thread state for `diagramId`. Returns the in-memory
 * cache when the boot hydration has completed; falls back to the legacy
 * `localStorage` payload otherwise (or to an empty state when neither has
 * data for this diagram).
 */
export function loadThreadsForDiagram(diagramId: string): DiagramThreadState {
  if (chatThreadsHydrated && diagramId in chatThreadsCache) {
    return chatThreadsCache[diagramId];
  }
  try {
    const rawValue = localStorage.getItem(CHAT_HISTORY_KEY);
    const migrated = migrateLegacyThreads(rawValue);
    if (isObject(migrated) && diagramId in migrated) {
      return migrated[diagramId];
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to load threads for diagram:", err);
  }
  return emptyThreadState(diagramId);
}

/**
 * Write a `DiagramThreadState` for `diagramId`. Updates the in-memory cache
 * synchronously, then enqueues an async IDB write (best-effort) and rewrites
 * the localStorage snapshot so a runtime without IDB still has data.
 */
export function saveThreadsForDiagram(diagramId: string, state: DiagramThreadState): void {
  // 1. Cache (sync, source of truth during the session).
  setChatThreadsCacheEntry(diagramId, state);

  // 2. IDB write (best-effort; the in-memory cache still works on failure).
  void saveThreadsToIdb(diagramId, state);

  // 3. localStorage snapshot — rebuilt from the cache so the fallback path
  //    always reflects the full diagram set.
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
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(snapshot));
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
  try {
    const rawLegacy = localStorage.getItem(CHAT_HISTORY_KEY);
    if (rawLegacy) {
      const legacy = migrateLegacyThreads(rawLegacy);
      for (const [diagramId, state] of Object.entries(legacy)) {
        if (!(diagramId in merged)) {
          merged[diagramId] = state;
        }
      }
    }
  } catch (err) {
    console.warn("[llm-storage] Failed to migrate legacy threads:", err);
  }
  replaceChatThreadsCache(merged);
  setChatThreadsHydrated(true);

  // Run the one-shot migration in the background. The flag inside the IDB
  // helper makes this a no-op after the first run.
  void migrateThreadsFromLocalStorageToIdb(localStorage.getItem(CHAT_HISTORY_KEY));
}

// Compatibility shims for callers still relying on the old shape. These are
// pure functions over the migrated payload and stay until the panel migrates
// off of them in Fase 6.
export function loadThreadFromStorage(diagramId: string): ChatMessage[] {
  return loadThreadsForDiagram(diagramId).threads[0]?.messages ?? [];
}

export function saveThreadToStorage(diagramId: string, messages: ChatMessage[]): void {
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

export function loadConfigFromLocalStorage(): LLMConfig {
  const { connections, activeConnectionId } = loadConnections();
  const active = connections.find((connection) => connection.id === activeConnectionId);
  const fallback = active ?? connections[0] ?? { ...DEFAULT_LLM_CONNECTION };
  return {
    mode: fallback.mode,
    provider:
      fallback.provider === "anthropic" || fallback.provider === "custom"
        ? fallback.provider
        : "openai",
    apiKey: fallback.apiKey,
    model: fallback.model,
    ...(fallback.baseUrl ? { baseUrl: fallback.baseUrl } : {}),
    ...(fallback.authHeader ? { authHeader: fallback.authHeader } : {}),
    ...(fallback.extraHeaders ? { extraHeaders: fallback.extraHeaders } : {}),
    ...(fallback.extraParams ? { extraParams: fallback.extraParams } : {}),
  };
}

export function saveConfigToLocalStorage(config: LLMConfig): void {
  const { connections, activeConnectionId } = loadConnections();
  const active = connections.find((connection) => connection.id === activeConnectionId);
  const id = active?.id ?? crypto.randomUUID();
  const updated: LLMConnection[] = active
    ? connections.map((connection) =>
        connection.id === id ? normalizeConnection({ ...connection, ...config, id }) : connection,
      )
    : [...connections, normalizeConnection({ ...config, id })];
  saveConnections({ connections: updated, activeConnectionId: id });
}

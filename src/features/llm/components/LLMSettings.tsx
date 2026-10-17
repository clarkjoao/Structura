import { useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPresetsForProvider,
  useLLMStore,
  type CustomProtocol,
  type LLMConnection,
  type LLMMode,
  type LLMProvider,
} from "@/features/llm";
import { DEFAULT_PROXY_BASE_URL } from "@/features/llm/llm-storage";
import { getLLMErrorI18nKey } from "@/features/llm/errors";
import type { ConnectionTestResult } from "@/features/llm/transport/connection-test";
import { SkillsSettings } from "./skills/SkillsSettings";
import { McpSettings } from "./mcp/McpSettings";

const CUSTOM_MODEL_OPTION_VALUE = "__custom__";
const URL_PATTERN = /^https?:\/\/\S+$/i;

interface ValidationResult {
  baseUrl?: string;
  extraHeaders?: string;
  extraBodyParams?: string;
}

interface LLMSettingsProps {
  onClose: () => void;
}

interface DraftState {
  id?: string;
  name: string;
  mode: LLMMode;
  provider: LLMProvider;
  customProtocol: CustomProtocol;
  baseUrl: string;
  authHeader: string;
  apiKey: string;
  model: string;
  modelCustom: string;
  extraHeadersText: string;
  extraBodyParamsText: string;
  /** Models the last "Test connection" listed; saved with the connection. */
  models: string[];
}

type TestState =
  { status: "idle" } | { status: "testing" } | { status: "done"; result: ConnectionTestResult };

function emptyDraft(): DraftState {
  return {
    id: undefined,
    name: "",
    mode: "direct",
    provider: "openai",
    customProtocol: "openai",
    baseUrl: "",
    authHeader: "",
    apiKey: "",
    model: "",
    modelCustom: "",
    extraHeadersText: "",
    extraBodyParamsText: "",
    models: [],
  };
}

function draftFromConnection(connection: LLMConnection): DraftState {
  const presetModels = getPresetsForProvider(connection.provider).map((p) => p.model);
  const isPresetModel = presetModels.includes(connection.model);
  return {
    id: connection.id,
    name: connection.name,
    mode: connection.mode,
    provider: connection.provider,
    customProtocol: connection.customProtocol ?? "openai",
    baseUrl: connection.baseUrl ?? "",
    authHeader: connection.authHeader ?? "",
    apiKey: connection.apiKey,
    model: isPresetModel
      ? connection.model
      : connection.provider === "custom"
        ? connection.model
        : "",
    modelCustom: isPresetModel ? "" : connection.model,
    extraHeadersText: connection.extraHeaders
      ? JSON.stringify(connection.extraHeaders, null, 2)
      : "",
    extraBodyParamsText: connection.extraParams
      ? JSON.stringify(connection.extraParams, null, 2)
      : "",
    models: connection.models ?? [],
  };
}

function tryParseJson(text: string): { value: unknown } | { error: true } {
  if (text.trim() === "") {
    return { value: undefined };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: true };
  }
}

export const LLMSettings = memo(function LLMSettings({ onClose }: LLMSettingsProps) {
  const { t } = useTranslation();
  const connections = useLLMStore((state) => state.connections);
  const activeConnectionId = useLLMStore((state) => state.activeConnectionId);
  const createConnection = useLLMStore((state) => state.createConnection);
  const updateConnection = useLLMStore((state) => state.updateConnection);
  const duplicateConnection = useLLMStore((state) => state.duplicateConnection);
  const removeConnection = useLLMStore((state) => state.removeConnection);
  const setActiveConnection = useLLMStore((state) => state.setActiveConnection);

  // The settings overlay always opens in "create" mode: an empty form the user
  // fills in to make a new connection. To edit an existing one, the user
  // explicitly picks it from the list (handleSelectConnection).
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [validation, setValidation] = useState<ValidationResult>({});
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  const presetModels = getPresetsForProvider(draft.provider);
  const isCustomSelectable = draft.provider !== "custom" && presetModels.length > 0;
  const modelSelectValue = (() => {
    if (draft.provider === "custom") {
      return draft.model || CUSTOM_MODEL_OPTION_VALUE;
    }
    if (presetModels.some((p) => p.model === draft.model)) {
      return draft.model;
    }
    return CUSTOM_MODEL_OPTION_VALUE;
  })();

  const resolveModel = (): string => {
    if (draft.provider === "custom") {
      return draft.model.trim();
    }
    if (modelSelectValue === CUSTOM_MODEL_OPTION_VALUE) {
      return draft.modelCustom.trim();
    }
    return modelSelectValue;
  };

  const validate = (current: DraftState): ValidationResult => {
    const result: ValidationResult = {};
    if (
      current.mode === "direct" &&
      current.provider === "custom" &&
      current.baseUrl.trim() === ""
    ) {
      result.baseUrl = t("llmChat.settings.customProvider.baseUrlRequired");
    } else if (
      current.mode === "direct" &&
      current.provider === "custom" &&
      current.baseUrl.trim() !== "" &&
      !URL_PATTERN.test(current.baseUrl.trim())
    ) {
      result.baseUrl = t("llmChat.settings.customProvider.baseUrlInvalid");
    }
    if (current.extraHeadersText.trim() !== "") {
      const parsed = tryParseJson(current.extraHeadersText);
      if ("error" in parsed) {
        result.extraHeaders = t("llmChat.settings.customProvider.extraJsonInvalid");
      }
    }
    if (current.extraBodyParamsText.trim() !== "") {
      const parsed = tryParseJson(current.extraBodyParamsText);
      if ("error" in parsed) {
        result.extraBodyParams = t("llmChat.settings.customProvider.extraJsonInvalid");
      }
    }
    return result;
  };

  const handleSave = () => {
    const result = validate(draft);
    setValidation(result);
    if (Object.keys(result).length > 0) {
      return;
    }
    if (draft.mode === "proxy") {
      createConnectionOrUpdate(proxyConnectionFromDraft());
      onClose();
      return;
    }

    createConnectionOrUpdate(directConnectionFromDraft());
    onClose();
  };

  function proxyConnectionFromDraft(): Omit<LLMConnection, "id"> & { id?: string } {
    return {
      id: draft.id,
      name: draft.name.trim() || t("llmChat.settings.connectionName"),
      mode: "proxy",
      provider: draft.provider === "custom" ? "openai" : draft.provider,
      apiKey: draft.apiKey,
      model: draft.model.trim() || "gpt-4o-mini",
      baseUrl: draft.baseUrl.trim() || DEFAULT_PROXY_BASE_URL,
      ...(draft.models.length > 0 ? { models: draft.models } : {}),
    };
  }

  function directConnectionFromDraft(): Omit<LLMConnection, "id"> & { id?: string } {
    const headers = tryParseJson(draft.extraHeadersText);
    const bodyParams = tryParseJson(draft.extraBodyParamsText);
    return {
      id: draft.id,
      name: draft.name.trim() || t("llmChat.settings.connectionName"),
      mode: "direct",
      provider: draft.provider,
      apiKey: draft.apiKey,
      model: resolveModel(),
      ...(draft.provider === "custom"
        ? {
            baseUrl: draft.baseUrl.trim(),
            authHeader: draft.authHeader.trim() || undefined,
            customProtocol: draft.customProtocol,
          }
        : {}),
      ...(draft.provider === "custom" && !("error" in headers) && headers.value !== undefined
        ? { extraHeaders: headers.value as Record<string, string> }
        : {}),
      ...(!("error" in bodyParams) && bodyParams.value !== undefined
        ? { extraParams: bodyParams.value as Record<string, unknown> }
        : {}),
      ...(draft.models.length > 0 ? { models: draft.models } : {}),
    };
  }

  const handleTestConnection = async () => {
    const connection =
      draft.mode === "proxy" ? proxyConnectionFromDraft() : directConnectionFromDraft();
    setTestState({ status: "testing" });
    const { testConnection } = await import("@/features/llm/transport/connection-test");
    const result = await testConnection({ ...connection });
    setTestState({ status: "done", result });
    if (result.ok) {
      setDraft((current) => ({ ...current, models: result.models }));
    }
  };

  function createConnectionOrUpdate(payload: Omit<LLMConnection, "id"> & { id?: string }): void {
    if (payload.id) {
      updateConnection(payload.id, payload);
      setActiveConnection(payload.id);
      return;
    }
    createConnection(payload);
  }

  const handleSelectConnection = (id: string) => {
    const connection = connections.find((entry) => entry.id === id);
    if (!connection) {
      return;
    }
    setValidation({});
    setDraft(draftFromConnection(connection));
  };

  const handleNew = () => {
    setValidation({});
    setDraft(emptyDraft());
  };

  const handleDuplicate = (id: string) => {
    const copy = duplicateConnection(id);
    if (copy) {
      setValidation({});
      setDraft(draftFromConnection(copy));
    }
  };

  const handleRemove = (id: string) => {
    const confirmed = window.confirm(t("llmChat.settings.connectionDeleteConfirm"));
    if (!confirmed) {
      return;
    }
    const removed = removeConnection(id);
    if (!removed && id === activeConnectionId) {
      window.alert(t("llmChat.settings.cannotDeleteActive"));
    } else if (draft.id === id) {
      // Removed the entry the editor was showing — drop back to a fresh
      // create form so we don't strand the user with stale edits of a
      // now-deleted connection.
      setValidation({});
      setDraft(emptyDraft());
    }
  };

  const isCreateMode = !draft.id;
  const disableSave =
    draft.mode === "direct" &&
    !draft.apiKey.trim() &&
    !(draft.provider === "custom" && draft.baseUrl.trim() !== "" && draft.model.trim() !== "") &&
    !(
      draft.provider !== "custom" &&
      (modelSelectValue !== CUSTOM_MODEL_OPTION_VALUE || draft.modelCustom.trim() !== "")
    );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{t("llmChat.settings.title")}</h3>
            <p className="text-[11px] text-muted-foreground">{t("llmChat.settings.subtitle")}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>

      <Tabs defaultValue="connections" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-card px-4 pb-2">
          <TabsList className="h-8">
            <TabsTrigger value="connections" className="h-6 text-xs">
              {t("llmChat.settings.tabConnections")}
            </TabsTrigger>
            <TabsTrigger value="skills" className="h-6 text-xs">
              {t("llmChat.settings.tabSkills")}
            </TabsTrigger>
            <TabsTrigger value="mcp" className="h-6 text-xs">
              {t("llmChat.settings.tabMcp")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="skills" className="mt-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-xl">
            <SkillsSettings />
          </div>
        </TabsContent>

        <TabsContent value="mcp" className="mt-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-xl">
            <McpSettings />
          </div>
        </TabsContent>

        {/* Content */}
        <TabsContent value="connections" className="mt-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-xl space-y-5">
            {/* Connections section */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold tracking-wide text-foreground">
                    {t("llmChat.settings.connectionsTitle")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t("llmChat.settings.connectionsHint")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleNew}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("llmChat.settings.connectionNew")}
                </Button>
              </div>
              <ul className="space-y-1.5">
                {connections.map((connection) => {
                  const isActive = connection.id === activeConnectionId;
                  const isEditing = draft.id === connection.id;
                  return (
                    <li
                      key={connection.id}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                        isEditing
                          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectConnection(connection.id)}
                        className="flex min-w-0 flex-1 flex-col items-start text-left"
                      >
                        <span className="truncate font-medium">{connection.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {t("llmChat.settings.connectionProviderBadge", {
                            provider: connection.provider,
                            model: connection.model,
                          })}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <span
                            className="flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                            aria-label={t("llmChat.settings.editingBadge")}
                          >
                            <Pencil className="mr-0.5 h-3 w-3" />
                            {t("llmChat.settings.editingBadge")}
                          </span>
                        ) : null}
                        {!isEditing && isActive ? (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                            {t("llmChat.settings.activeBadge")}
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDuplicate(connection.id)}
                          aria-label={t("llmChat.settings.connectionDuplicate")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemove(connection.id)}
                          disabled={connections.length <= 1}
                          aria-label={t("llmChat.settings.connectionDelete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Form section */}
            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold tracking-wide text-foreground">
                  {isCreateMode
                    ? t("llmChat.settings.connectionNew")
                    : draft.name || t("llmChat.settings.connectionName")}
                </h4>
                {isCreateMode ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                    {t("llmChat.settings.connectionNewBadge")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                    <Pencil className="h-3 w-3" />
                    {t("llmChat.settings.editingBadge")}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="llm-conn-name" className="text-xs text-muted-foreground">
                  {t("llmChat.settings.connectionName")}
                </label>
                <Input
                  id="llm-conn-name"
                  value={draft.name}
                  placeholder={t("llmChat.settings.connectionNamePlaceholder")}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="llm-mode" className="text-xs text-muted-foreground">
                  {t("llmChat.settings.mode")}
                </label>
                <select
                  id="llm-mode"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={draft.mode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "direct" || value === "proxy") {
                      setDraft({ ...draft, mode: value });
                    }
                  }}
                >
                  <option value="direct">{t("llmChat.settings.modeDirect")}</option>
                  <option value="proxy">{t("llmChat.settings.modeProxy")}</option>
                </select>
              </div>

              {draft.mode === "direct" ? (
                <>
                  <div className="space-y-1">
                    <label htmlFor="llm-provider" className="text-xs text-muted-foreground">
                      {t("llmChat.settings.provider")}
                    </label>
                    <select
                      id="llm-provider"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={draft.provider}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value !== "openai" && value !== "anthropic" && value !== "custom") {
                          return;
                        }
                        setDraft({
                          ...draft,
                          provider: value,
                          model: "",
                          modelCustom: "",
                          baseUrl: value === "custom" ? draft.baseUrl : "",
                        });
                      }}
                    >
                      <option value="openai">{t("llmChat.settings.providerOpenAI")}</option>
                      <option value="anthropic">{t("llmChat.settings.providerAnthropic")}</option>
                      <option value="custom">{t("llmChat.settings.providerCustom")}</option>
                    </select>
                  </div>

                  {draft.provider === "custom" ? (
                    <>
                      <div className="space-y-1">
                        <label
                          htmlFor="llm-custom-protocol"
                          className="text-xs text-muted-foreground"
                        >
                          {t("llmChat.settings.customProvider.protocolLabel")}
                        </label>
                        <select
                          id="llm-custom-protocol"
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          value={draft.customProtocol}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value !== "openai" && value !== "anthropic") return;
                            setDraft({ ...draft, customProtocol: value });
                          }}
                        >
                          <option value="openai">
                            {t("llmChat.settings.customProvider.protocolOpenAI")}
                          </option>
                          <option value="anthropic">
                            {t("llmChat.settings.customProvider.protocolAnthropic")}
                          </option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          {t("llmChat.settings.customProvider.protocolNote")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="llm-base-url" className="text-xs text-muted-foreground">
                          {t("llmChat.settings.customProvider.baseUrl")}
                        </label>
                        <Input
                          id="llm-base-url"
                          value={draft.baseUrl}
                          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                        />
                        {validation.baseUrl ? (
                          <p className="text-xs text-amber-600">{validation.baseUrl}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="llm-auth-header" className="text-xs text-muted-foreground">
                          {t("llmChat.settings.customProvider.authHeader")}
                        </label>
                        <Input
                          id="llm-auth-header"
                          placeholder={
                            draft.customProtocol === "anthropic" ? "x-api-key" : "Authorization"
                          }
                          value={draft.authHeader}
                          onChange={(event) =>
                            setDraft({ ...draft, authHeader: event.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {draft.customProtocol === "anthropic"
                            ? t("llmChat.settings.customProvider.authHeaderAnthropicHint")
                            : t("llmChat.settings.customProvider.authHeaderHint")}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <label htmlFor="llm-api-key" className="text-xs text-muted-foreground">
                        {t("llmChat.settings.apiKey")}
                      </label>
                      <Input
                        id="llm-api-key"
                        type="password"
                        value={draft.apiKey}
                        onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                      />
                      {draft.apiKey === "" ? (
                        <p className="text-xs text-amber-600">
                          {t("llmChat.settings.apiKeyRequired", {
                            provider: draft.provider === "openai" ? "OpenAI" : "Anthropic",
                          })}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {draft.provider === "custom" ? (
                    <div className="space-y-1">
                      <label htmlFor="llm-api-key-custom" className="text-xs text-muted-foreground">
                        {t("llmChat.settings.customProvider.apiKeyLabel")}
                      </label>
                      <Input
                        id="llm-api-key-custom"
                        type="password"
                        value={draft.apiKey}
                        onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label htmlFor="llm-model" className="text-xs text-muted-foreground">
                      {t("llmChat.settings.model")}
                    </label>
                    {isCustomSelectable ? (
                      <>
                        <select
                          id="llm-model"
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          value={modelSelectValue}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === CUSTOM_MODEL_OPTION_VALUE) {
                              setDraft({ ...draft, model: "" });
                              return;
                            }
                            setDraft({ ...draft, model: value, modelCustom: "" });
                          }}
                        >
                          {presetModels.map((preset) => (
                            <option key={preset.id} value={preset.model}>
                              {preset.label}
                            </option>
                          ))}
                          <option value={CUSTOM_MODEL_OPTION_VALUE}>
                            {t("llmChat.settings.modelCustom")}
                          </option>
                        </select>
                        {modelSelectValue === CUSTOM_MODEL_OPTION_VALUE ? (
                          <Input
                            className="mt-1"
                            placeholder={t("llmChat.settings.modelCustomPlaceholder")}
                            value={draft.modelCustom}
                            onChange={(event) =>
                              setDraft({ ...draft, modelCustom: event.target.value })
                            }
                          />
                        ) : null}
                      </>
                    ) : (
                      <Input
                        id="llm-model"
                        list="llm-tested-models"
                        placeholder={t("llmChat.settings.modelCustomPlaceholder")}
                        value={draft.provider === "custom" ? draft.model : draft.modelCustom}
                        onChange={(event) =>
                          draft.provider === "custom"
                            ? setDraft({ ...draft, model: event.target.value })
                            : setDraft({ ...draft, modelCustom: event.target.value })
                        }
                      />
                    )}
                  </div>

                  {draft.provider === "custom" ? (
                    <details className="space-y-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {t("llmChat.settings.customProvider.advanced")}
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="space-y-1">
                          <label
                            htmlFor="llm-extra-headers"
                            className="text-xs text-muted-foreground"
                          >
                            {t("llmChat.settings.customProvider.extraHeaders")}
                          </label>
                          <textarea
                            id="llm-extra-headers"
                            rows={3}
                            spellCheck={false}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs"
                            value={draft.extraHeadersText}
                            onChange={(event) =>
                              setDraft({ ...draft, extraHeadersText: event.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("llmChat.settings.customProvider.extraHeadersHint")}
                          </p>
                          {validation.extraHeaders ? (
                            <p className="text-xs text-amber-600">{validation.extraHeaders}</p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="llm-extra-body-params"
                            className="text-xs text-muted-foreground"
                          >
                            {t("llmChat.settings.customProvider.extraBodyParams")}
                          </label>
                          <textarea
                            id="llm-extra-body-params"
                            rows={3}
                            spellCheck={false}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs"
                            value={draft.extraBodyParamsText}
                            onChange={(event) =>
                              setDraft({ ...draft, extraBodyParamsText: event.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("llmChat.settings.customProvider.extraBodyParamsHint")}
                          </p>
                          {validation.extraBodyParams ? (
                            <p className="text-xs text-amber-600">{validation.extraBodyParams}</p>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label htmlFor="llm-proxy-url" className="text-xs text-muted-foreground">
                      {t("llmChat.settings.proxyUrl")}
                    </label>
                    <Input
                      id="llm-proxy-url"
                      value={draft.baseUrl}
                      placeholder={DEFAULT_PROXY_BASE_URL}
                      onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("llmChat.settings.proxyUrlHint")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="llm-proxy-key" className="text-xs text-muted-foreground">
                      {t("llmChat.settings.customProvider.apiKeyLabel")}
                    </label>
                    <Input
                      id="llm-proxy-key"
                      type="password"
                      value={draft.apiKey}
                      onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="llm-proxy-model" className="text-xs text-muted-foreground">
                      {t("llmChat.settings.model")}
                    </label>
                    <Input
                      id="llm-proxy-model"
                      list="llm-tested-models"
                      placeholder={t("llmChat.settings.modelCustomPlaceholder")}
                      value={draft.model}
                      onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                    />
                  </div>
                </>
              )}

              <datalist id="llm-tested-models">
                {draft.models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTestConnection()}
                  disabled={testState.status === "testing"}
                >
                  {testState.status === "testing"
                    ? t("llmChat.settings.testing")
                    : t("llmChat.settings.testConnection")}
                </Button>
                {testState.status === "done" ? (
                  <ConnectionTestStatus result={testState.result} />
                ) : null}
              </div>
            </section>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={Boolean(disableSave)}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

function ConnectionTestStatus({ result }: { result: ConnectionTestResult }) {
  const { t } = useTranslation();
  if (!result.ok) {
    return (
      <p role="status" className="text-xs text-destructive">
        {t(getLLMErrorI18nKey(result.error), { status: result.error.status })}
      </p>
    );
  }
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {result.source === "presets"
        ? t("llmChat.settings.testPresets", { count: result.models.length })
        : t("llmChat.settings.testConnected", {
            count: result.models.length,
            latency: result.latencyMs,
          })}
    </p>
  );
}

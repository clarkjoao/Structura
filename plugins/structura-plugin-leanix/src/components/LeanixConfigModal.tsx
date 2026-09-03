import { useState, useEffect } from "react";
import type { FC } from "react";
import type { LeanixConfig } from "../types/config";
import { LABELS, t, type Locale } from "../i18n/labels";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { extractUserIdFromToken, extractWorkspaceFromToken, testConnection } from "../services";

const DEFAULT_PROXY_URL = "http://localhost:3000/proxy";

type TestStatus = "idle" | "testing" | "connected" | "failed";

interface LeanixConfigModalProps {
  onClose: () => void;
  /** Locale from the host's PluginPanelContext, so labels respect user preference. */
  locale: Locale;
}

export const LeanixConfigModal: FC<LeanixConfigModalProps> = ({ onClose, locale }) => {
  const { config, saveConfig, clearConfig } = useLeanixConfig();

  const [formData, setFormData] = useState<LeanixConfig>({
    baseUrl: "",
    authToken: "",
    userId: "",
    useProxy: true,
    proxyUrl: DEFAULT_PROXY_URL,
    workspaceId: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [errors, setErrors] = useState<Partial<LeanixConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Test-connection state
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testReason, setTestReason] = useState<string>("");

  // Sync with global config - clear errors when config loads
  useEffect(() => {
    if (config) {
      setFormData({ workspaceId: "", ...config });
      setErrors({}); // Clear any previous errors
    }
  }, [config]);

  // Auto-fill userId and workspace when token changes
  useEffect(() => {
    if (formData.authToken) {
      const extractedUserId = extractUserIdFromToken(formData.authToken);
      const workspaceInfo = extractWorkspaceFromToken(formData.authToken);

      const updates: Partial<LeanixConfig> = {};

      // Auto-fill userId if not set
      if (extractedUserId && !formData.userId) {
        updates.userId = extractedUserId;
        // Clear userId error when auto-filled
        setErrors((prev) => {
          const { userId: _, ...rest } = prev;
          return rest;
        });
      }

      // Auto-fill workspaceId if found in token
      if (workspaceInfo.workspaceId && !formData.workspaceId) {
        updates.workspaceId = workspaceInfo.workspaceId;
      }

      if (Object.keys(updates).length > 0) {
        setFormData((prev) => ({ ...prev, ...updates }));
      }
    }
  }, [formData.authToken, formData.userId, formData.workspaceId]);

  // Reset test status when the inputs the test depends on change.
  useEffect(() => {
    setTestStatus("idle");
    setTestReason("");
  }, [formData.baseUrl, formData.authToken, formData.useProxy, formData.proxyUrl]);

  const handleTest = async () => {
    if (!formData.baseUrl.trim() || !formData.authToken.trim()) {
      setTestStatus("failed");
      setTestReason(t(LABELS.validation.urlRequired, locale));
      return;
    }
    setTestStatus("testing");
    setTestReason("");
    const result = await testConnection(formData);
    if (result.ok) {
      setTestStatus("connected");
      setTestReason("");
    } else {
      setTestStatus("failed");
      setTestReason(result.reason);
    }
  };

  const handleSave = async () => {
    // Normalize token: ensure Bearer prefix (but keep display as-is for UX)
    let normalizedToken = formData.authToken.trim();
    if (normalizedToken && !normalizedToken.toLowerCase().startsWith("bearer ")) {
      normalizedToken = `Bearer ${normalizedToken}`;
    }

    // Extract userId and workspace from token if not set
    let dataToSave: LeanixConfig = { ...formData, authToken: normalizedToken };
    if (!dataToSave.userId) {
      const extractedUserId = extractUserIdFromToken(formData.authToken);
      if (extractedUserId) {
        dataToSave = { ...dataToSave, userId: extractedUserId };
      }
    }
    if (!dataToSave.workspaceId) {
      const workspaceInfo = extractWorkspaceFromToken(formData.authToken);
      if (workspaceInfo.workspaceId) {
        dataToSave = { ...dataToSave, workspaceId: workspaceInfo.workspaceId };
      }
    }

    // Validar campos obrigatórios
    const newErrors: Partial<LeanixConfig> = {};
    if (!dataToSave.baseUrl.trim()) {
      newErrors.baseUrl = t(LABELS.validation.urlRequired, locale);
    }
    if (!dataToSave.authToken.trim()) {
      newErrors.authToken = t(LABELS.validation.tokenRequired, locale);
    }
    if (!dataToSave.userId?.trim()) {
      newErrors.userId = t(LABELS.validation.userIdRequired, locale);
    }
    if (dataToSave.useProxy && !dataToSave.proxyUrl.trim()) {
      newErrors.proxyUrl = t(LABELS.validation.proxyRequired, locale);
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    setErrors({});

    const success = await saveConfig(dataToSave);
    setIsSaving(false);

    if (success) {
      onClose();
    }
  };

  const handleClear = async () => {
    await clearConfig();
    setFormData({
      baseUrl: "",
      authToken: "",
      userId: "",
      useProxy: true,
      proxyUrl: DEFAULT_PROXY_URL,
      workspaceId: "",
    });
    setErrors({});
    setTestStatus("idle");
    setTestReason("");
    onClose();
  };

  const getTestPillClass = (status: TestStatus) => {
    const base =
      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap";
    if (status === "connected") {
      return `${base} border-primary/50 bg-primary/12 text-primary`;
    }
    if (status === "failed") {
      return `${base} border-destructive/50 bg-destructive/12 text-destructive`;
    }
    return `${base} border-border bg-muted text-muted-foreground`;
  };

  const TestDot = ({ status }: { status: TestStatus }) => {
    const color =
      status === "connected"
        ? "var(--primary)"
        : status === "failed"
          ? "var(--destructive)"
          : "var(--muted-foreground)";
    return (
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "999px",
          background: color,
          display: "inline-block",
        }}
      />
    );
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${hasError ? "border-destructive" : "border-border"}`;

  const labelClass = "block mb-1 text-[13px] font-medium text-foreground";

  return (
    <form
      className="p-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {/* Use Proxy toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useProxy"
          checked={formData.useProxy}
          onChange={(e) => setFormData({ ...formData, useProxy: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="useProxy" className="text-sm cursor-pointer text-foreground">
          {t(LABELS.config.useProxy, locale)}
        </label>
      </div>

      {/* Proxy URL */}
      {formData.useProxy && (
        <div>
          <label className={labelClass}>{t(LABELS.config.proxyUrl, locale)}</label>
          <input
            type="url"
            value={formData.proxyUrl}
            onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
            placeholder={DEFAULT_PROXY_URL}
            className={inputClass(!!errors.proxyUrl)}
          />
          {errors.proxyUrl && <p className="mt-1 text-xs text-destructive">{errors.proxyUrl}</p>}
        </div>
      )}

      {/* Base URL */}
      <div>
        <label className={labelClass}>{t(LABELS.config.baseUrl, locale)}</label>
        <input
          type="url"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder={t(LABELS.config.baseUrlPlaceholder, locale)}
          className={inputClass(!!errors.baseUrl)}
        />
        {errors.baseUrl && <p className="mt-1 text-xs text-destructive">{errors.baseUrl}</p>}
      </div>

      {/* Auth Token + Test Connection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>{t(LABELS.config.authToken, locale)}</label>
          <span className={getTestPillClass(testStatus)}>
            <TestDot status={testStatus} />
            {testStatus === "connected"
              ? t(LABELS.config.testConnected, locale)
              : testStatus === "failed"
                ? t(LABELS.config.testFailed, locale)
                : testStatus === "testing"
                  ? t(LABELS.config.testing, locale)
                  : t(LABELS.config.testNotTested, locale)}
          </span>
        </div>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={formData.authToken}
            onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
            placeholder={t(LABELS.config.authTokenPlaceholder, locale)}
            className={`${inputClass(!!errors.authToken)} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showToken ? t(LABELS.config.hideToken, locale) : t(LABELS.config.showToken, locale)}
          </button>
        </div>
        {errors.authToken && <p className="mt-1 text-xs text-destructive">{errors.authToken}</p>}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={
              testStatus === "testing" || !formData.baseUrl.trim() || !formData.authToken.trim()
            }
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-secondary text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary/80"
          >
            {testStatus === "testing"
              ? t(LABELS.config.testing, locale)
              : t(LABELS.config.testConnection, locale)}
          </button>
          {testStatus === "failed" && testReason && (
            <span className="text-xs text-destructive">{testReason}</span>
          )}
        </div>
      </div>

      {/* User ID */}
      <div>
        <label className={labelClass}>{t(LABELS.config.userId, locale)}</label>
        <input
          type="text"
          value={formData.userId}
          onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
          placeholder={t(LABELS.config.userIdPlaceholder, locale)}
          className={inputClass(!!errors.userId)}
        />
        {errors.userId && <p className="mt-1 text-xs text-destructive">{errors.userId}</p>}
      </div>

      {/* Workspace / Space selector */}
      <div>
        <label className={labelClass}>{t(LABELS.config.workspace, locale)}</label>
        <select
          value={formData.workspaceId ?? ""}
          onChange={(e) => setFormData({ ...formData, workspaceId: e.target.value })}
          className={inputClass(false)}
        >
          <option value="">{t(LABELS.config.workspaceEmpty, locale)}</option>
          {formData.workspaceId && (
            <option value={formData.workspaceId}>{formData.workspaceId}</option>
          )}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 text-sm rounded-md border border-border text-destructive hover:bg-destructive/5"
        >
          {t(LABELS.config.clear, locale)}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted"
          >
            {t(LABELS.config.cancel, locale)}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-70 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            {isSaving ? "..." : t(LABELS.config.save, locale)}
          </button>
        </div>
      </div>
    </form>
  );
};

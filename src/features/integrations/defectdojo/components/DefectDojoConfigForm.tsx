import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle, Trash2 } from "lucide-react";
import { DefectDojoClient } from "../defectdojo.client";
import { getCurrentUser } from "../defectdojo.service";
import type { DefectDojoConfig } from "../types";
import { useDiagramStore, ServiceSource } from "@/features/diagram";
import { normalizeSources } from "@/features/integrations/merge-utils";
import { useTranslation } from "react-i18next";

interface Props {
  config: DefectDojoConfig | null;
  onSave: (cfg: DefectDojoConfig) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}

export function DefectDojoConfigForm({ config, onSave, onClear }: Props) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "");
  const [apiToken, setApiToken] = useState(config?.apiToken ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; username: string } | { ok: false; message: string } | null
  >(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new DefectDojoClient({ baseUrl, apiToken });
      const user = await getCurrentUser(client);
      const username = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
      setTestResult({ ok: true, username });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : t("defectdojo.connectionFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave({ baseUrl: baseUrl.replace(/\/$/, ""), apiToken });
  };

  const handleClearKeepServices = () => {
    onClear();
    setConfirmClear(false);
  };

  const handleClearRemoveSourceId = () => {
    const store = useDiagramStore.getState();
    Object.values(store.serviceRegistry).forEach((svc) => {
      const nextSources = normalizeSources(svc).filter((source) => source.type !== "defectdojo");
      if (nextSources.length !== normalizeSources(svc).length) {
        store.updateService(svc.id, {
          sources: nextSources.length > 0 ? nextSources : [{ type: ServiceSource.Manual }],
        });
      }
    });
    onClear();
    setConfirmClear(false);
  };

  if (config && !confirmClear) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          <span>
            {t("defectdojo.connectedTo")} <span className="font-semibold">{config.baseUrl}</span>
          </span>
        </div>
        <button
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("defectdojo.removeIntegration")}
        </button>
      </div>
    );
  }

  if (confirmClear) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-foreground font-medium">{t("defectdojo.keepRecordsQuestion")}</p>
        <p className="text-xs text-muted-foreground">{t("defectdojo.keepRecordsDetail")}</p>
        <div className="flex gap-2">
          <button
            onClick={handleClearKeepServices}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t("defectdojo.yesKeep")}
          </button>
          <button
            onClick={handleClearRemoveSourceId}
            className="flex-1 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("defectdojo.unlinkOnly")}
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("defectdojo.configuration")}
      </p>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("defectdojo.baseUrlLabel")}
        </label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t("defectdojo.baseUrlPlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("defectdojo.apiTokenLabel")}
        </label>
        <div className="relative">
          <input
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            type={showToken ? "text" : "password"}
            placeholder={t("defectdojo.tokenPlaceholder")}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {testResult && (
        <p className={`text-xs ${testResult.ok ? "text-green-600" : "text-destructive"}`}>
          {testResult.ok
            ? t("defectdojo.connectedAsOk", { username: testResult.username })
            : t("defectdojo.testFailed", {
                message: "message" in testResult ? testResult.message : "",
              })}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !baseUrl || !apiToken}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("defectdojo.testConnection")}
        </button>
        <button
          onClick={handleSave}
          disabled={!baseUrl || !apiToken}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

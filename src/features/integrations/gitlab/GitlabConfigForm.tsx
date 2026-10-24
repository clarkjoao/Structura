import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GitlabConfig } from "./gitlab.types";

interface Props {
  config: GitlabConfig | null;
  onSave: (cfg: GitlabConfig) => void | Promise<void>;
  onClear: () => void | Promise<void>;
}

const FIELD =
  "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function GitlabConfigForm({ config, onSave, onClear }: Props) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "https://gitlab.com");
  const [token, setToken] = useState("");
  const [useProxy, setUseProxy] = useState(config?.useProxy ?? false);
  const [proxyUrl, setProxyUrl] = useState(config?.proxyUrl ?? "http://localhost:3000/proxy");

  if (config) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
        <span>
          {t("gitlab.connectedTo")} <span className="font-semibold">{config.baseUrl}</span>
        </span>
        <button
          type="button"
          onClick={() => void onClear()}
          className="text-xs text-destructive hover:underline"
        >
          {t("gitlab.disconnect")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("gitlab.baseUrl")}
        </label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("gitlab.token")}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className={FIELD}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
        {t("gitlab.useProxy")}
      </label>
      {useProxy && (
        <input value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} className={FIELD} />
      )}
      <button
        type="button"
        disabled={!baseUrl.trim()}
        onClick={() =>
          void onSave({
            baseUrl: baseUrl.trim().replace(/\/+$/, ""),
            token,
            useProxy,
            proxyUrl: useProxy ? proxyUrl : undefined,
          })
        }
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {t("common.save")}
      </button>
    </div>
  );
}

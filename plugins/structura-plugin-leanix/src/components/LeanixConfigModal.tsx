import { useState, useEffect, type FC } from "react";
import type { LeanixConfig } from "../types/config";
import { LABELS, t, type Locale } from "../i18n/labels";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { extractUserIdFromToken } from "../services";

const DEFAULT_PROXY_URL = "http://localhost:3000/proxy";

interface LeanixConfigModalProps {
  onClose: () => void;
}

export const LeanixConfigModal: FC<LeanixConfigModalProps> = ({ onClose }) => {
  const { config, saveConfig, clearConfig } = useLeanixConfig();
  const locale: Locale = "en";

  const [formData, setFormData] = useState<LeanixConfig>({
    baseUrl: "",
    authToken: "",
    userId: "",
    useProxy: true,
    proxyUrl: DEFAULT_PROXY_URL,
  });
  const [showToken, setShowToken] = useState(false);
  const [errors, setErrors] = useState<Partial<LeanixConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Auto-fill userId when token changes
  useEffect(() => {
    if (formData.authToken && !formData.userId) {
      const extractedUserId = extractUserIdFromToken(formData.authToken);
      if (extractedUserId) {
        setFormData((prev) => ({ ...prev, userId: extractedUserId }));
      }
    }
  }, [formData.authToken, formData.userId]);

  const validate = (data: LeanixConfig): boolean => {
    const newErrors: Partial<LeanixConfig> = {};
    if (!data.baseUrl.trim()) {
      newErrors.baseUrl = t(LABELS.validation.urlRequired, locale);
    }
    if (!data.authToken.trim()) {
      newErrors.authToken = t(LABELS.validation.tokenRequired, locale);
    }
    // userId is validated AFTER auto-fill, so we skip it here if empty
    if (formData.useProxy && !data.proxyUrl.trim()) {
      newErrors.proxyUrl = t(LABELS.validation.proxyRequired, locale);
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // Auto-fill userId from token if not set
    let dataToSave = { ...formData };
    if (!dataToSave.userId && dataToSave.authToken) {
      const extractedUserId = extractUserIdFromToken(dataToSave.authToken);
      if (extractedUserId) {
        dataToSave.userId = extractedUserId;
        setFormData(dataToSave);
      }
    }

    if (!validate(dataToSave)) return;

    // Final check: userId is required
    if (!dataToSave.userId?.trim()) {
      setErrors({ userId: t(LABELS.validation.userIdRequired, locale) });
      return;
    }

    setIsSaving(true);
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
    });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    fontSize: "14px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "4px",
    fontSize: "13px",
    fontWeight: 500,
  };

  const errorStyle: React.CSSProperties = {
    color: "var(--destructive)",
    fontSize: "12px",
    marginTop: "2px",
  };

  const checkboxContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  };

  const checkboxStyle: React.CSSProperties = {
    width: "18px",
    height: "18px",
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* Use Proxy toggle */}
      <div style={checkboxContainerStyle}>
        <input
          type="checkbox"
          id="useProxy"
          checked={formData.useProxy}
          onChange={(e) => setFormData({ ...formData, useProxy: e.target.checked })}
          style={checkboxStyle}
        />
        <label htmlFor="useProxy" style={{ fontSize: "14px", cursor: "pointer" }}>
          {t(LABELS.config.useProxy, locale)}
        </label>
      </div>

      {/* Proxy URL (only visible when useProxy is checked) */}
      {formData.useProxy && (
        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>{t(LABELS.config.proxyUrl, locale)}</label>
          <input
            type="url"
            value={formData.proxyUrl}
            onChange={(e) => setFormData({ ...formData, proxyUrl: e.target.value })}
            placeholder={DEFAULT_PROXY_URL}
            style={{
              ...inputStyle,
              borderColor: errors.proxyUrl ? "var(--destructive)" : undefined,
            }}
          />
          {errors.proxyUrl && <div style={errorStyle}>{errors.proxyUrl}</div>}
        </div>
      )}

      {/* Base URL */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>{t(LABELS.config.baseUrl, locale)}</label>
        <input
          type="url"
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder={t(LABELS.config.baseUrlPlaceholder, locale)}
          style={{
            ...inputStyle,
            borderColor: errors.baseUrl ? "var(--destructive)" : undefined,
          }}
        />
        {errors.baseUrl && <div style={errorStyle}>{errors.baseUrl}</div>}
      </div>

      {/* Auth Token */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>{t(LABELS.config.authToken, locale)}</label>
        <div style={{ position: "relative" }}>
          <input
            type={showToken ? "text" : "password"}
            value={formData.authToken}
            onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
            placeholder={t(LABELS.config.authTokenPlaceholder, locale)}
            style={{
              ...inputStyle,
              paddingRight: "50px",
              borderColor: errors.authToken ? "var(--destructive)" : undefined,
            }}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              fontSize: "12px",
            }}
          >
            {showToken ? t(LABELS.config.hideToken, locale) : t(LABELS.config.showToken, locale)}
          </button>
        </div>
        {errors.authToken && <div style={errorStyle}>{errors.authToken}</div>}
      </div>

      {/* User ID */}
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>{t(LABELS.config.userId, locale)}</label>
        <input
          type="text"
          value={formData.userId}
          onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
          placeholder={t(LABELS.config.userIdPlaceholder, locale)}
          style={{
            ...inputStyle,
            borderColor: errors.userId ? "var(--destructive)" : undefined,
          }}
        />
        {errors.userId && <div style={errorStyle}>{errors.userId}</div>}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {t(LABELS.config.clear, locale)}
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {t(LABELS.config.cancel, locale)}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "..." : t(LABELS.config.save, locale)}
          </button>
        </div>
      </div>
    </div>
  );
};

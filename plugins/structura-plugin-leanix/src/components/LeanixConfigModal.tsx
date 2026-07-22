import type { LeanixConfig } from "../types/config";
import { LABELS, t, type Locale } from "../i18n/labels";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { extractUserIdFromToken } from "../services";
import { getReact } from "../hooks/usePluginApi";

const DEFAULT_PROXY_URL = "http://localhost:3000/proxy";

interface LeanixConfigModalProps {
  onClose: () => void;
}

/**
 * Factory function to create the LeanixConfigModal component
 * This pattern allows using React hooks while getting React from the host
 */
export function createLeanixConfigModal({ onClose }: LeanixConfigModalProps) {
  const React = getReact();

  function LeanixConfigModalInner() {
    const { config, saveConfig, clearConfig } = useLeanixConfig();
    const locale: Locale = "en";

    // Local state using React hooks
    const [formData, setFormData] = React.useState<LeanixConfig>({
      baseUrl: "",
      authToken: "",
      userId: "",
      useProxy: true,
      proxyUrl: DEFAULT_PROXY_URL,
    });
    const [showToken, setShowToken] = React.useState(false);
    const [errors, setErrors] = React.useState<Partial<LeanixConfig>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    // Sync with global config
    React.useEffect(() => {
      if (config) {
        setFormData(config);
      }
    }, [config]);

    // Auto-fill userId when token changes
    React.useEffect(() => {
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
      if (formData.useProxy && !data.proxyUrl.trim()) {
        newErrors.proxyUrl = t(LABELS.validation.proxyRequired, locale);
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
      let dataToSave = { ...formData };
      if (!dataToSave.userId && dataToSave.authToken) {
        const extractedUserId = extractUserIdFromToken(dataToSave.authToken);
        if (extractedUserId) {
          dataToSave.userId = extractedUserId;
          setFormData(dataToSave);
        }
      }

      if (!validate(dataToSave)) return;

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

    return React.createElement("div", { style: { padding: "16px" } },
      // Use Proxy toggle
      React.createElement("div", { style: checkboxContainerStyle },
        React.createElement("input", {
          type: "checkbox",
          id: "useProxy",
          checked: formData.useProxy,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, useProxy: e.target.checked }),
          style: checkboxStyle,
        }),
        React.createElement("label", { htmlFor: "useProxy", style: { fontSize: "14px", cursor: "pointer" } },
          t(LABELS.config.useProxy, locale)
        )
      ),

      // Proxy URL (only visible when useProxy is checked)
      formData.useProxy && React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("label", { style: labelStyle }, t(LABELS.config.proxyUrl, locale)),
        React.createElement("input", {
          type: "url",
          value: formData.proxyUrl,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, proxyUrl: e.target.value }),
          placeholder: DEFAULT_PROXY_URL,
          style: { ...inputStyle, borderColor: errors.proxyUrl ? "var(--destructive)" : undefined },
        }),
        errors.proxyUrl && React.createElement("div", { style: errorStyle }, errors.proxyUrl)
      ),

      // Base URL
      React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("label", { style: labelStyle }, t(LABELS.config.baseUrl, locale)),
        React.createElement("input", {
          type: "url",
          value: formData.baseUrl,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, baseUrl: e.target.value }),
          placeholder: t(LABELS.config.baseUrlPlaceholder, locale),
          style: { ...inputStyle, borderColor: errors.baseUrl ? "var(--destructive)" : undefined },
        }),
        errors.baseUrl && React.createElement("div", { style: errorStyle }, errors.baseUrl)
      ),

      // Auth Token
      React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("label", { style: labelStyle }, t(LABELS.config.authToken, locale)),
        React.createElement("div", { style: { position: "relative" } },
          React.createElement("input", {
            type: showToken ? "text" : "password",
            value: formData.authToken,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, authToken: e.target.value }),
            placeholder: t(LABELS.config.authTokenPlaceholder, locale),
            style: { ...inputStyle, paddingRight: "50px", borderColor: errors.authToken ? "var(--destructive)" : undefined },
          }),
          React.createElement("button", {
            type: "button",
            onClick: () => setShowToken(!showToken),
            style: {
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              fontSize: "12px",
            },
          }, showToken ? t(LABELS.config.hideToken, locale) : t(LABELS.config.showToken, locale))
        ),
        errors.authToken && React.createElement("div", { style: errorStyle }, errors.authToken)
      ),

      // User ID
      React.createElement("div", { style: { marginBottom: "16px" } },
        React.createElement("label", { style: labelStyle }, t(LABELS.config.userId, locale)),
        React.createElement("input", {
          type: "text",
          value: formData.userId,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, userId: e.target.value }),
          placeholder: t(LABELS.config.userIdPlaceholder, locale),
          style: { ...inputStyle, borderColor: errors.userId ? "var(--destructive)" : undefined },
        }),
        errors.userId && React.createElement("div", { style: errorStyle }, errors.userId)
      ),

      // Buttons
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
        React.createElement("button", {
          type: "button",
          onClick: handleClear,
          style: {
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "transparent",
            cursor: "pointer",
          },
        }, t(LABELS.config.clear, locale)),
        React.createElement("div", { style: { display: "flex", gap: "8px" } },
          React.createElement("button", {
            type: "button",
            onClick: onClose,
            style: {
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              cursor: "pointer",
            },
          }, t(LABELS.config.cancel, locale)),
          React.createElement("button", {
            type: "button",
            onClick: handleSave,
            disabled: isSaving,
            style: {
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            },
          }, isSaving ? "..." : t(LABELS.config.save, locale))
        )
      )
    );
  }

  return React.createElement(LeanixConfigModalInner);
}

/**
 * @deprecated Use createLeanixConfigModal instead
 */
export function LeanixConfigModal(props: LeanixConfigModalProps) {
  return createLeanixConfigModal(props);
}

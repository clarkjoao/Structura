import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { getReact } from "../hooks/usePluginApi";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { LABELS, t, type Locale } from "../i18n";
import type { LeanixConfig } from "../types/config";

/**
 * Leanix Configuration Modal Content
 *
 * Form for entering/editing Leanix credentials:
 * - Base URL
 * - Auth Token
 * - User ID
 */
export function LeanixConfigModal({ onClose }: { onClose: () => void }): ReactElement {
  const React = getReact();
  const { config, saveConfig, clearConfig, isLoading } = useLeanixConfig();
  const locale: Locale = "en"; // Default to en, could be made dynamic

  const [formData, setFormData] = useState<LeanixConfig>({
    baseUrl: "",
    authToken: "",
    userId: "",
  });

  const [showToken, setShowToken] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LeanixConfig, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LeanixConfig, string>> = {};

    if (!formData.baseUrl.trim()) {
      newErrors.baseUrl = t(LABELS.validation.urlRequired, locale);
    }
    if (!formData.authToken.trim()) {
      newErrors.authToken = t(LABELS.validation.tokenRequired, locale);
    }
    if (!formData.userId.trim()) {
      newErrors.userId = t(LABELS.validation.userIdRequired, locale);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const success = await saveConfig(formData);
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    await clearConfig();
    setFormData({ baseUrl: "", authToken: "", userId: "" });
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
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--foreground)",
  };

  const errorStyle: React.CSSProperties = {
    color: "var(--destructive)",
    fontSize: "12px",
    marginTop: "4px",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  return React.createElement(
    "div",
    { style: { padding: "16px" } },
    // Base URL
    React.createElement(
      "div",
      { style: { marginBottom: "16px" } },
      React.createElement(
        "label",
        { htmlFor: "leanix-base-url", style: labelStyle },
        t(LABELS.config.baseUrl, locale)
      ),
      React.createElement("input", {
        id: "leanix-base-url",
        type: "url",
        value: formData.baseUrl,
        onChange: (e) => setFormData({ ...formData, baseUrl: e.target.value }),
        placeholder: t(LABELS.config.baseUrlPlaceholder, locale),
        style: {
          ...inputStyle,
          borderColor: errors.baseUrl ? "var(--destructive)" : undefined,
        },
      }),
      errors.baseUrl && React.createElement("div", { style: errorStyle }, errors.baseUrl)
    ),

    // Auth Token
    React.createElement(
      "div",
      { style: { marginBottom: "16px" } },
      React.createElement(
        "label",
        { htmlFor: "leanix-auth-token", style: labelStyle },
        t(LABELS.config.authToken, locale)
      ),
      React.createElement(
        "div",
        { style: { position: "relative" } },
        React.createElement("input", {
          id: "leanix-auth-token",
          type: showToken ? "text" : "password",
          value: formData.authToken,
          onChange: (e) => setFormData({ ...formData, authToken: e.target.value }),
          placeholder: t(LABELS.config.authTokenPlaceholder, locale),
          style: {
            ...inputStyle,
            paddingRight: "40px",
            borderColor: errors.authToken ? "var(--destructive)" : undefined,
          },
        }),
        React.createElement(
          "button",
          {
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
          },
          showToken ? t(LABELS.config.hideToken, locale) : t(LABELS.config.showToken, locale)
        )
      ),
      errors.authToken && React.createElement("div", { style: errorStyle }, errors.authToken)
    ),

    // User ID
    React.createElement(
      "div",
      { style: { marginBottom: "24px" } },
      React.createElement(
        "label",
        { htmlFor: "leanix-user-id", style: labelStyle },
        t(LABELS.config.userId, locale)
      ),
      React.createElement("input", {
        id: "leanix-user-id",
        type: "text",
        value: formData.userId,
        onChange: (e) => setFormData({ ...formData, userId: e.target.value }),
        placeholder: t(LABELS.config.userIdPlaceholder, locale),
        style: {
          ...inputStyle,
          borderColor: errors.userId ? "var(--destructive)" : undefined,
        },
      }),
      errors.userId && React.createElement("div", { style: errorStyle }, errors.userId)
    ),

    // Buttons
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        },
      },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: handleClear,
          disabled: isSaving,
          style: {
            ...buttonStyle,
            border: "1px solid var(--border)",
            backgroundColor: "transparent",
            color: "var(--muted-foreground)",
          },
        },
        t(LABELS.config.clear, locale)
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: onClose,
            disabled: isSaving,
            style: {
              ...buttonStyle,
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              color: "var(--foreground)",
            },
          },
          t(LABELS.config.cancel, locale)
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: handleSave,
            disabled: isSaving || isLoading,
            style: {
              ...buttonStyle,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            },
          },
          isSaving ? "..." : t(LABELS.config.save, locale)
        )
      )
    )
  );
}

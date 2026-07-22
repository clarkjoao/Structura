import type { LeanixConfig } from "../types/config";
import { LABELS, t, type Locale } from "../i18n/labels";
import { useLeanixConfig } from "../hooks/useLeanixConfig";
import { extractUserIdFromToken, testConnection, classifyError } from "../services";
import { getReact } from "../hooks/usePluginApi";

const DEFAULT_PROXY_URL = "http://localhost:3000/proxy";

interface LeanixConfigModalProps {
  onClose: () => void;
}

type TestStatus = "idle" | "testing" | "connected" | "failed";

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
      workspaceId: "",
    });
    const [showToken, setShowToken] = React.useState(false);
    const [errors, setErrors] = React.useState<Partial<LeanixConfig>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    // Test-connection state lives alongside the form. We surface a status
    // pill (idle/testing/connected/failed) next to the auth token field.
    const [testStatus, setTestStatus] = React.useState<TestStatus>("idle");
    const [testReason, setTestReason] = React.useState<string>("");

    // Sync with global config
    React.useEffect(() => {
      if (config) {
        setFormData({ workspaceId: "", ...config });
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

    // Reset test status when the inputs the test depends on change.
    React.useEffect(() => {
      setTestStatus("idle");
      setTestReason("");
    }, [formData.baseUrl, formData.authToken, formData.useProxy, formData.proxyUrl]);

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

    const handleTest = async () => {
      // Use the current form values so the user can test before saving.
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
      const dataToSave = { ...formData };
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
        workspaceId: "",
      });
      setTestStatus("idle");
      setTestReason("");
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

    const testPillStyle = (status: TestStatus): React.CSSProperties => {
      const base: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "var(--muted)",
        color: "var(--muted-foreground)",
        fontWeight: 500,
        whiteSpace: "nowrap",
      };
      if (status === "connected") {
        return { ...base, borderColor: "color-mix(in srgb, var(--primary) 50%, transparent)", background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" };
      }
      if (status === "failed") {
        return { ...base, borderColor: "color-mix(in srgb, var(--destructive) 50%, transparent)", background: "color-mix(in srgb, var(--destructive) 12%, transparent)", color: "var(--destructive)" };
      }
      return base;
    };

    const testDot = (status: TestStatus) => {
      const color =
        status === "connected" ? "var(--primary)" :
        status === "failed" ? "var(--destructive)" :
        "var(--muted-foreground)";
      return React.createElement("span", {
        "aria-hidden": true,
        style: {
          width: "6px", height: "6px", borderRadius: "999px",
          background: color,
          display: "inline-block",
        },
      });
    };

    return React.createElement("form", {
      style: { padding: "16px" },
      onSubmit: (e) => e.preventDefault(),
    },
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

      // Auth Token + Test Connection
      React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" },
        },
          React.createElement("label", { style: labelStyle }, t(LABELS.config.authToken, locale)),
          React.createElement("span", { style: testPillStyle(testStatus) },
            testDot(testStatus),
            testStatus === "connected" ? t(LABELS.config.testConnected, locale)
              : testStatus === "failed" ? t(LABELS.config.testFailed, locale)
              : testStatus === "testing" ? t(LABELS.config.testing, locale)
              : t(LABELS.config.testNotTested, locale)
          )
        ),
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
        errors.authToken && React.createElement("div", { style: errorStyle }, errors.authToken),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" } },
          React.createElement("button", {
            type: "button",
            onClick: handleTest,
            disabled: testStatus === "testing" || !formData.baseUrl.trim() || !formData.authToken.trim(),
            style: {
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: testStatus === "testing" ? "var(--muted)" : "var(--secondary)",
              color: "var(--secondary-foreground)",
              cursor: testStatus === "testing" ? "wait" : "pointer",
              opacity: (!formData.baseUrl.trim() || !formData.authToken.trim()) ? 0.5 : 1,
            },
          }, testStatus === "testing" ? t(LABELS.config.testing, locale) : t(LABELS.config.testConnection, locale)),
          testStatus === "failed" && testReason && React.createElement("span", {
            style: { fontSize: "12px", color: "var(--destructive)" },
          }, testReason)
        )
      ),

      // User ID
      React.createElement("div", { style: { marginBottom: "12px" } },
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

      // Workspace / Space selector
      // Note: workspaces aren't auto-fetched in this pass (that would require
      // an additional API call surface). We expose a free-form select with the
      // saved value as the only option so the user can review/change it.
      // When a future API exists, replace the <option> list with a fetched set.
      React.createElement("div", { style: { marginBottom: "16px" } },
        React.createElement("label", { style: labelStyle }, t(LABELS.config.workspace, locale)),
        React.createElement("select", {
          value: formData.workspaceId ?? "",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, workspaceId: e.target.value }),
          style: {
            ...inputStyle,
            cursor: "pointer",
            appearance: "auto",
          },
        },
          React.createElement("option", { value: "" }, t(LABELS.config.workspaceEmpty, locale)),
          formData.workspaceId && React.createElement("option", { value: formData.workspaceId }, formData.workspaceId)
        )
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
            color: "var(--destructive)",
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
              color: "var(--foreground)",
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

// classifyError is re-exported here so any future sibling UI in this file can
// reuse it without going through the services barrel. (Currently unused
// outside; kept to make error mapping a single source of truth.)
export { classifyError };

import React from "react";

// ========================================================================
// Plugin Manifest
// ========================================================================
const manifest = {
  id: "structura-plugin-example-ui",
  name: "Example UI Plugin",
  version: "1.0.0",
  author: "Structura Team",
  description: "Demonstrates toolbar button, toasts, and modal dialogs",
  apiVersion: "^1.1",
  capabilities: ["ui:panels", "ui:overlays", "diagram:read"]
};

// ========================================================================
// Toolbar Button Component
// ========================================================================
function ToolbarButton({ context }) {
  const locale = context?.locale || "en";
  const isEditMode = context?.isEditMode !== false;

  const labels = {
    en: {
      button: "Example",
      demoToasts: "All Toasts",
      demoAction: "With Action"
    },
    "pt-BR": {
      button: "Exemplo",
      demoToasts: "Toasts",
      demoAction: "Com Ação"
    }
  };

  const t = labels[locale] || labels.en;

  const handleMainClick = () => {
    // Show info toast
    window.__structuraPluginApi?.overlay.showToast({
      type: "info",
      title: locale === "pt-BR" ? "Plugin Exemplo!" : "Example Plugin!",
      description: locale === "pt-BR"
        ? "Use os botões abaixo para testar"
        : "Use the buttons below to test",
      duration: 4000
    });
  };

  const handleShowAllToasts = (e) => {
    e.stopPropagation();
    const toasts = [
      { type: "success", title: "Success!", description: locale === "pt-BR" ? "Operação concluída" : "Operation completed" },
      { type: "error", title: "Error!", description: locale === "pt-BR" ? "Algo deu errado" : "Something went wrong" },
      { type: "warning", title: "Warning!", description: locale === "pt-BR" ? "Tenha cuidado" : "Be careful" },
      { type: "info", title: "Info", description: locale === "pt-BR" ? "Informação útil" : "Useful information" }
    ];

    toasts.forEach((toast, index) => {
      setTimeout(() => {
        window.__structuraPluginApi?.overlay.showToast(toast);
      }, index * 600);
    });
  };

  const handleShowActionToast = (e) => {
    e.stopPropagation();
    window.__structuraPluginApi?.overlay.showToast({
      type: "success",
      title: locale === "pt-BR" ? "Ação Disponível!" : "Action Available!",
      description: locale === "pt-BR" ? "Clique no botão abaixo" : "Click the button below",
      action: {
        label: locale === "pt-BR" ? "Fazer algo" : "Do something",
        onClick: () => {
          window.__structuraPluginApi?.overlay.showToast({
            type: "info",
            title: locale === "pt-BR" ? "Ação executada!" : "Action executed!",
            duration: 2000
          });
        }
      },
      duration: 8000
    });
  };

  const handleOpenModal = (e) => {
    e.stopPropagation();
    window.__structuraPluginApi?.overlay.openModal({
      title: locale === "pt-BR" ? "Modal de Exemplo" : "Example Modal",
      content: ModalContent,
      size: "md"
    });
  };

  if (!isEditMode) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground opacity-50 pointer-events-none"
        title={locale === "pt-BR" ? "Modo somente leitura" : "Read-only mode"}
      >
        <span>🔌</span>
        <span>{t.button}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleMainClick}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <span>🔌</span>
        <span>{t.button}</span>
      </button>

      <div className="flex gap-1 ml-4">
        <button
          type="button"
          onClick={handleShowAllToasts}
          className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
        >
          {t.demoToasts}
        </button>
        <button
          type="button"
          onClick={handleShowActionToast}
          className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
        >
          {t.demoAction}
        </button>
        <button
          type="button"
          onClick={handleOpenModal}
          className="text-xs px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
        >
          Modal
        </button>
      </div>
    </div>
  );
}

// ========================================================================
// Modal Content Component
// ========================================================================
function ModalContent({ onClose }) {
  const locale = "en"; // Could get from context
  const api = window.__structuraPluginApi;

  const diagramId = api?.getActiveDiagramId?.();
  const diagram = diagramId ? api?.getDiagram?.(diagramId) : null;

  const handleToast = () => {
    api?.overlay.showToast({
      type: "success",
      title: "Modal Action!",
      description: "This toast was triggered from the modal"
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <h3 className="font-semibold">{diagram ? diagram.name : "No diagram open"}</h3>
        <p className="text-sm text-muted-foreground">
          {diagram
            ? `Components: ${diagram.components.length}, Connections: ${diagram.connections.length}`
            : "Open a diagram to see its details"}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleToast}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Show Toast
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ========================================================================
// Settings Panel Component (shown in element inspector)
// ========================================================================
function SettingsPanel({ context }) {
  const locale = context?.locale || "en";
  const api = window.__structuraPluginApi;
  const selection = context?.selection || [];

  const handleToast = () => {
    api?.overlay.showToast({
      type: "info",
      title: locale === "pt-BR" ? "Painel de Configurações!" : "Settings Panel!",
      description: locale === "pt-BR"
        ? "Este toast veio do painel de configurações"
        : "This toast came from the settings panel"
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {locale === "pt-BR" ? "Configurações de Exemplo" : "Example Settings"}
      </p>
      <p className="text-xs text-muted-foreground">
        {locale === "pt-BR"
          ? "Este painel é exibido quando um elemento está selecionado."
          : "This panel is shown when an element is selected."}
      </p>

      {selection.length > 0 && (
        <div className="rounded-md bg-muted p-2 text-xs">
          <strong>{locale === "pt-BR" ? "Selecionado:" : "Selected:"}</strong> {selection.length} element(s)
        </div>
      )}

      <button
        type="button"
        onClick={handleToast}
        className="w-full rounded-md bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 transition-colors"
      >
        {locale === "pt-BR" ? "Testar Toast" : "Test Toast"}
      </button>
    </div>
  );
}

// ========================================================================
// Plugin Activation
// ========================================================================
window.StructuraPlugin.define({
  manifest,
  activate: (api) => {
    // Store api globally for components (workaround for non-React plugins)
    window.__structuraPluginApi = api;

    // Register toolbar button
    api.registerPanel({
      id: "example-toolbar-button",
      slot: "canvas-toolbar",
      title: { en: "Example", "pt-BR": "Exemplo" },
      component: ToolbarButton
    });

    // Register settings panel
    api.registerPanel({
      id: "example-settings",
      slot: "element-inspector",
      title: { en: "Example Settings", "pt-BR": "Configurações de Exemplo" },
      component: SettingsPanel
    });

    // Log activation
    console.log("[Example UI Plugin] Activated!");
  }
});

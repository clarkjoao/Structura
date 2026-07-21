import type { LocalizedText } from "../types/plugin";

export const LABELS = {
  toolbar: {
    button: {
      en: "Example",
      "pt-BR": "Exemplo",
    } as LocalizedText,
    toasts: {
      en: "Toasts",
      "pt-BR": "Toasts",
    } as LocalizedText,
    action: {
      en: "Action",
      "pt-BR": "Ação",
    } as LocalizedText,
    modal: {
      en: "Modal",
      "pt-BR": "Modal",
    } as LocalizedText,
    readOnly: {
      en: "Read-only mode",
      "pt-BR": "Modo somente leitura",
    } as LocalizedText,
  },
  settings: {
    title: {
      en: "Example Settings",
      "pt-BR": "Configurações de Exemplo",
    } as LocalizedText,
    description: {
      en: "This panel is shown when an element is selected.",
      "pt-BR": "Este painel é exibido quando um elemento está selecionado.",
    } as LocalizedText,
    selected: {
      en: "Selected:",
      "pt-BR": "Selecionado:",
    } as LocalizedText,
    testToast: {
      en: "Test Toast",
      "pt-BR": "Testar Toast",
    } as LocalizedText,
  },
  toasts: {
    pluginActivated: {
      en: "Example Plugin!",
      "pt-BR": "Plugin Exemplo!",
    },
    pluginActivatedDesc: {
      en: "Use the buttons below to test",
      "pt-BR": "Use os botões abaixo para testar",
    },
    success: {
      en: "Success!",
      "pt-BR": "Sucesso!",
    },
    successDesc: {
      en: "Operation completed",
      "pt-BR": "Operação concluída",
    },
    error: {
      en: "Error!",
      "pt-BR": "Erro!",
    },
    errorDesc: {
      en: "Something went wrong",
      "pt-BR": "Algo deu errado",
    },
    warning: {
      en: "Warning!",
      "pt-BR": "Atenção!",
    },
    warningDesc: {
      en: "Be careful",
      "pt-BR": "Tenha cuidado",
    },
    info: {
      en: "Info",
      "pt-BR": "Informação",
    },
    infoDesc: {
      en: "Useful information",
      "pt-BR": "Informação útil",
    },
    actionAvailable: {
      en: "Action Available!",
      "pt-BR": "Ação Disponível!",
    },
    actionAvailableDesc: {
      en: "Click the button below",
      "pt-BR": "Clique no botão abaixo",
    },
    doSomething: {
      en: "Do something",
      "pt-BR": "Fazer algo",
    },
    actionExecuted: {
      en: "Action executed!",
      "pt-BR": "Ação executada!",
    },
    settingsPanel: {
      en: "Settings Panel!",
      "pt-BR": "Painel de Configurações!",
    },
    settingsPanelDesc: {
      en: "This toast came from the settings panel",
      "pt-BR": "Este toast veio do painel de configurações",
    },
    modalAction: {
      en: "Modal Action!",
      "pt-BR": "Ação do Modal!",
    },
    modalActionDesc: {
      en: "This toast was triggered from the modal",
      "pt-BR": "Este toast foi disparado do modal",
    },
  },
  modal: {
    title: {
      en: "Example Modal",
      "pt-BR": "Modal de Exemplo",
    } as LocalizedText,
    noDiagram: {
      en: "No diagram open",
      "pt-BR": "Nenhum diagrama aberto",
    },
    openDiagram: {
      en: "Open a diagram to see its details",
      "pt-BR": "Abra um diagrama para ver os detalhes",
    },
    showToast: {
      en: "Show Toast",
      "pt-BR": "Mostrar Toast",
    },
    close: {
      en: "Close",
      "pt-BR": "Fechar",
    },
  },
} as const;

/**
 * Resolve a localized text based on the current locale
 */
export function t(text: LocalizedText, locale: string): string {
  return text[locale as keyof typeof text] ?? text.en;
}

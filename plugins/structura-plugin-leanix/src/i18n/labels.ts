/**
 * Internationalized labels for the Leanix plugin
 */

export type Locale = "en" | "pt-BR";

export type LocalizedText = {
  [key in Locale]?: string;
} & { en: string };

export const t = (text: LocalizedText, locale: Locale): string => {
  return text[locale] || text.en;
};

export const LABELS = {
  toolbar: {
    button: { en: "Send to Leanix", "pt-BR": "Enviar para Leanix" } as LocalizedText,
    tooltipNoConfig: { en: "Configure Leanix in settings", "pt-BR": "Configure o Leanix nas configurações" } as LocalizedText,
    tooltipNoName: { en: "Set a name for the diagram", "pt-BR": "Defina um nome para o diagrama" } as LocalizedText,
    tooltipReadOnly: { en: "Read-only mode", "pt-BR": "Modo somente leitura" } as LocalizedText,
  },

  toasts: {
    sending: { en: "Sending to Leanix...", "pt-BR": "Enviando para Leanix..." } as LocalizedText,
    sendingDesc: { en: "Please wait", "pt-BR": "Por favor, aguarde" } as LocalizedText,
    successCreated: { en: "Diagram created in Leanix!", "pt-BR": "Diagrama criado no Leanix!" } as LocalizedText,
    successUpdated: { en: "Diagram updated in Leanix!", "pt-BR": "Diagrama atualizado no Leanix!" } as LocalizedText,
    openInLeanix: { en: "Open in Leanix", "pt-BR": "Abrir no Leanix" } as LocalizedText,
    errorAuth: { en: "Invalid or expired token", "pt-BR": "Token inválido ou expirado" } as LocalizedText,
    errorAuthDesc: { en: "Please update your Leanix credentials", "pt-BR": "Por favor, atualize suas credenciais do Leanix" } as LocalizedText,
    openSettings: { en: "Open Settings", "pt-BR": "Abrir Configurações" } as LocalizedText,
    errorConnection: { en: "Connection error", "pt-BR": "Erro de conexão" } as LocalizedText,
    errorConnectionDesc: { en: "Could not connect to Leanix", "pt-BR": "Não foi possível conectar ao Leanix" } as LocalizedText,
    retry: { en: "Retry", "pt-BR": "Tentar novamente" } as LocalizedText,
    errorInternal: { en: "Leanix internal error", "pt-BR": "Erro interno do Leanix" } as LocalizedText,
    errorInternalDesc: { en: "Please try again later", "pt-BR": "Por favor, tente novamente mais tarde" } as LocalizedText,
  },

  config: {
    title: { en: "Leanix Configuration", "pt-BR": "Configuração do Leanix" } as LocalizedText,
    baseUrl: { en: "Base URL", "pt-BR": "URL Base" } as LocalizedText,
    baseUrlPlaceholder: { en: "https://company.leanix.net", "pt-BR": "https://empresa.leanix.net" } as LocalizedText,
    authToken: { en: "Auth Token", "pt-BR": "Token de Autenticação" } as LocalizedText,
    authTokenPlaceholder: { en: "Bearer your-token-here", "pt-BR": "Bearer seu-token-aqui" } as LocalizedText,
    userId: { en: "User ID", "pt-BR": "ID do Usuário" } as LocalizedText,
    userIdPlaceholder: { en: "user-id-here", "pt-BR": "id-do-usuario-aqui" } as LocalizedText,
    save: { en: "Save", "pt-BR": "Salvar" } as LocalizedText,
    clear: { en: "Clear Configuration", "pt-BR": "Limpar Configuração" } as LocalizedText,
    showToken: { en: "Show token", "pt-BR": "Mostrar token" } as LocalizedText,
    hideToken: { en: "Hide token", "pt-BR": "Ocultar token" } as LocalizedText,
    cancel: { en: "Cancel", "pt-BR": "Cancelar" } as LocalizedText,
    settings: { en: "Settings", "pt-BR": "Configurações" } as LocalizedText,
  },

  validation: {
    urlRequired: { en: "URL is required", "pt-BR": "URL é obrigatória" } as LocalizedText,
    tokenRequired: { en: "Token is required", "pt-BR": "Token é obrigatório" } as LocalizedText,
    userIdRequired: { en: "User ID is required", "pt-BR": "ID do usuário é obrigatório" } as LocalizedText,
  },
};

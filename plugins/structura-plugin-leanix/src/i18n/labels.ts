/**
 * Internationalized labels for the Leanix plugin
 */

export type Locale = "en" | "pt-BR";

export type LocalizedText = {
  [key in Locale]?: string;
} & { en: string };

export function t(text: LocalizedText, locale: Locale): string {
  return text[locale] || text.en;
}

export const LABELS = {
  toolbar: {
    button: { en: "Send to Leanix", "pt-BR": "Enviar para Leanix" },
    tooltipNoConfig: { en: "Configure Leanix in settings", "pt-BR": "Configure o Leanix nas configurações" },
    tooltipNoName: { en: "Set a name for the diagram", "pt-BR": "Defina um nome para o diagrama" },
    tooltipReadOnly: { en: "Read-only mode", "pt-BR": "Modo somente leitura" },
    configured: { en: "Configured", "pt-BR": "Configurado" },
  },
  toasts: {
    sending: { en: "Sending to Leanix...", "pt-BR": "Enviando para Leanix..." },
    successCreated: { en: "Diagram created in Leanix!", "pt-BR": "Diagrama criado no Leanix!" },
    successUpdated: { en: "Diagram updated in Leanix!", "pt-BR": "Diagrama atualizado no Leanix!" },
    openInLeanix: { en: "Open in Leanix", "pt-BR": "Abrir no Leanix" },
    errorAuth: { en: "Invalid or expired token", "pt-BR": "Token inválido ou expirado" },
    errorConnection: { en: "Connection error", "pt-BR": "Erro de conexão" },
    errorInternal: { en: "Leanix internal error", "pt-BR": "Erro interno do Leanix" },
    openSettings: { en: "Open Settings", "pt-BR": "Abrir Configurações" },
    retry: { en: "Retry", "pt-BR": "Tentar novamente" },
    noName: { en: "Set a name for the diagram first", "pt-BR": "Defina um nome para o diagrama primeiro" },
    notConfigured: { en: "Configure Leanix first", "pt-BR": "Configure o Leanix primeiro" },
  },
  config: {
    title: { en: "Leanix Configuration", "pt-BR": "Configuração do Leanix" },
    useProxy: { en: "Use server proxy (bypass CORS)", "pt-BR": "Usar proxy do servidor (bypass CORS)" },
    baseUrl: { en: "Base URL", "pt-BR": "URL Base" },
    baseUrlPlaceholder: { en: "https://company.leanix.net", "pt-BR": "https://empresa.leanix.net" },
    authToken: { en: "Auth Token", "pt-BR": "Token de Autenticação" },
    authTokenPlaceholder: { en: "Bearer your-token-here", "pt-BR": "Bearer seu-token-aqui" },
    userId: { en: "User ID", "pt-BR": "ID do Usuário" },
    userIdPlaceholder: { en: "your-user-id", "pt-BR": "seu-id-de-usuario" },
    save: { en: "Save", "pt-BR": "Salvar" },
    clear: { en: "Clear", "pt-BR": "Limpar" },
    cancel: { en: "Cancel", "pt-BR": "Cancelar" },
    showToken: { en: "Show", "pt-BR": "Mostrar" },
    hideToken: { en: "Hide", "pt-BR": "Ocultar" },
  },
  validation: {
    urlRequired: { en: "URL is required", "pt-BR": "URL é obrigatória" },
    tokenRequired: { en: "Token is required", "pt-BR": "Token é obrigatório" },
    userIdRequired: { en: "User ID is required", "pt-BR": "ID do usuário é obrigatório" },
  },
};

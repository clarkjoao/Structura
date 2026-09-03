/**
 * Internationalized labels for the Leanix plugin
 */

export type Locale = "en" | "pt-BR";

export type LocalizedText = string | Partial<Record<Locale, string>>;

export function t(text: LocalizedText, locale: Locale): string {
  if (typeof text === "string") return text;
  return text[locale] ?? text.en ?? "";
}

export const LABELS = {
  toolbar: {
    button: { en: "Send to Leanix", "pt-BR": "Enviar para Leanix" },
    tooltipNoConfig: {
      en: "Configure Leanix in settings",
      "pt-BR": "Configure o Leanix nas configurações",
    },
    tooltipNoName: { en: "Set a name for the diagram", "pt-BR": "Defina um nome para o diagrama" },
    tooltipReadOnly: { en: "Read-only mode", "pt-BR": "Modo somente leitura" },
    configured: { en: "Configured", "pt-BR": "Configurado" },
  },
  panel: {
    title: { en: "Leanix Export", "pt-BR": "Exportar para Leanix" },
    settingsAria: { en: "Open settings", "pt-BR": "Abrir configurações" },
    closeAria: { en: "Close panel", "pt-BR": "Fechar painel" },
    components: { en: "components", "pt-BR": "componentes" },
    connections: { en: "connections", "pt-BR": "conexões" },
    sizeKb: { en: "approx.", "pt-BR": "aprox." },
    includeLabels: { en: "Include connection labels", "pt-BR": "Incluir rótulos das conexões" },
    autoArrange: { en: "Auto-arrange layout", "pt-BR": "Auto-organizar layout" },
    lastSentNever: { en: "Never sent", "pt-BR": "Nunca enviado" },
    lastSent: { en: "Last sent", "pt-BR": "Último envio" },
    resend: { en: "Resend", "pt-BR": "Reenviar" },
    ago: { en: "ago", "pt-BR": "atrás" },
    justNow: { en: "just now", "pt-BR": "agora mesmo" },
    minutesAgo: { en: "min ago", "pt-BR": "min atrás" },
    hoursAgo: { en: "h ago", "pt-BR": "h atrás" },
    daysAgo: { en: "d ago", "pt-BR": "d atrás" },
  },
  status: {
    sending: { en: "Sending diagram...", "pt-BR": "Enviando diagrama..." },
    success: { en: "Sent successfully", "pt-BR": "Enviado com sucesso" },
    successCreated: { en: "Created in Leanix", "pt-BR": "Criado no Leanix" },
    successUpdated: { en: "Updated in Leanix", "pt-BR": "Atualizado no Leanix" },
    openInLeanix: { en: "Open in Leanix", "pt-BR": "Abrir no Leanix" },
    retry: { en: "Retry", "pt-BR": "Tentar novamente" },
    dismiss: { en: "Dismiss", "pt-BR": "Dispensar" },
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
    noName: {
      en: "Set a name for the diagram first",
      "pt-BR": "Defina um nome para o diagrama primeiro",
    },
    notConfigured: { en: "Configure Leanix first", "pt-BR": "Configure o Leanix primeiro" },
  },
  config: {
    title: { en: "Leanix Configuration", "pt-BR": "Configuração do Leanix" },
    useProxy: {
      en: "Use server proxy (bypass CORS)",
      "pt-BR": "Usar proxy do servidor (bypass CORS)",
    },
    proxyUrl: { en: "Proxy URL", "pt-BR": "URL do Proxy" },
    baseUrl: { en: "Base URL", "pt-BR": "URL Base" },
    baseUrlPlaceholder: { en: "https://company.leanix.net", "pt-BR": "https://empresa.leanix.net" },
    authToken: { en: "Auth Token", "pt-BR": "Token de Autenticação" },
    authTokenPlaceholder: { en: "Bearer your-token-here", "pt-BR": "Bearer seu-token-aqui" },
    userId: { en: "User ID", "pt-BR": "ID do Usuário" },
    userIdPlaceholder: { en: "your-user-id", "pt-BR": "seu-id-de-usuario" },
    workspace: { en: "Workspace / Space", "pt-BR": "Workspace / Espaço" },
    workspacePlaceholder: { en: "Select a workspace", "pt-BR": "Selecione um workspace" },
    workspaceEmpty: { en: "No workspaces available", "pt-BR": "Nenhum workspace disponível" },
    save: { en: "Save", "pt-BR": "Salvar" },
    clear: { en: "Clear", "pt-BR": "Limpar" },
    cancel: { en: "Cancel", "pt-BR": "Cancelar" },
    showToken: { en: "Show", "pt-BR": "Mostrar" },
    hideToken: { en: "Hide", "pt-BR": "Ocultar" },
    testConnection: { en: "Test connection", "pt-BR": "Testar conexão" },
    testing: { en: "Testing...", "pt-BR": "Testando..." },
    testNotTested: { en: "Not tested", "pt-BR": "Não testado" },
    testConnected: { en: "Connected", "pt-BR": "Conectado" },
    testFailed: { en: "Connection failed", "pt-BR": "Falha na conexão" },
  },
  validation: {
    urlRequired: { en: "URL is required", "pt-BR": "URL é obrigatória" },
    tokenRequired: { en: "Token is required", "pt-BR": "Token é obrigatório" },
    userIdRequired: { en: "User ID is required", "pt-BR": "ID do usuário é obrigatório" },
    proxyRequired: { en: "Proxy URL is required", "pt-BR": "URL do proxy é obrigatória" },
  },
};

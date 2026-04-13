import type { Diagram, DiagramModel } from "@/features/diagram";

export interface ChatSuggestion {
  id: string;
  /** i18n key for the visible label */
  labelKey: string;
}

export function buildContextualSuggestions(
  diagram: Diagram | DiagramModel | null,
): ChatSuggestion[] {
  const base: ChatSuggestion[] = [
    { id: "explain", labelKey: "llmChat.suggestions.contextual.explainThis" },
    { id: "review", labelKey: "llmChat.suggestions.contextual.reviewThis" },
    { id: "security", labelKey: "llmChat.suggestions.contextual.assessSecurity" },
  ];

  if (!diagram) return base;

  const components = Object.values(diagram.snapshot.components);
  const connections = Object.values(diagram.snapshot.connections);

  const hasAws = components.some(
    (c) => c.type.startsWith("aws-") || (c as { awsService?: string }).awsService,
  );
  const hasSyncChain = connections.some(
    (c) => c.transportPreset === "sync" || c.intent === "call",
  );
  const hasLambda = components.some(
    (c) => (c as { awsService?: string }).awsService === "lambda",
  );
  const hasRds = components.some(
    (c) => (c as { awsService?: string }).awsService === "rds",
  );
  const hasNoCache = !components.some(
    (c) => (c as { awsService?: string }).awsService === "elasticache",
  );
  const nodeCount = components.filter((c) => !["panel", "note"].includes(c.type)).length;

  const contextual: ChatSuggestion[] = [];

  if (hasAws) {
    contextual.push({
      id: "well-architected",
      labelKey: "llmChat.suggestions.contextual.wellArchitected",
    });
  }
  if (hasSyncChain) {
    contextual.push({
      id: "spof",
      labelKey: "llmChat.suggestions.contextual.spof",
    });
  }
  if (hasLambda) {
    contextual.push({
      id: "lambda-patterns",
      labelKey: "llmChat.suggestions.contextual.lambdaPatterns",
    });
  }
  if (hasRds && hasNoCache) {
    contextual.push({
      id: "caching",
      labelKey: "llmChat.suggestions.contextual.dbCaching",
    });
  }
  if (nodeCount >= 5) {
    contextual.push({
      id: "blast-radius",
      labelKey: "llmChat.suggestions.contextual.blastRadius",
    });
  }
  if (nodeCount >= 8) {
    contextual.push({
      id: "observability",
      labelKey: "llmChat.suggestions.contextual.observability",
    });
  }

  return [...contextual.slice(0, 3), ...base].slice(0, 6);
}

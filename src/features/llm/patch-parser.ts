import { isWriteTool } from "./tools";
import { isValidNodeType } from "./component-catalog";
import type {
  AnalysisFinding,
  AnalysisResponse,
  AnalysisSeverity,
  DiagramPatch,
  DiagramPatchAction,
  LLMToolCall,
  ParsedLLMResponse,
} from "./types";

const PARSE_FALLBACK_MESSAGE = "[Resposta não processada. Tente novamente.]";

const ANALYSIS_SEVERITIES: readonly AnalysisSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSeverity(value: unknown): AnalysisSeverity {
  if (typeof value === "string" && (ANALYSIS_SEVERITIES as readonly string[]).includes(value)) {
    return value as AnalysisSeverity;
  }
  return "info";
}

function normalizeFinding(raw: unknown): AnalysisFinding | null {
  if (!isObject(raw)) {
    return null;
  }
  const title = typeof raw.title === "string" ? raw.title : "";
  const detail = typeof raw.detail === "string" ? raw.detail : "";
  const recommendation = typeof raw.recommendation === "string" ? raw.recommendation : "";
  const category = typeof raw.category === "string" ? raw.category : "other";
  const affectedNodes = Array.isArray(raw.affectedNodes)
    ? raw.affectedNodes.filter((id): id is string => typeof id === "string")
    : undefined;
  return {
    severity: normalizeSeverity(raw.severity),
    category,
    title,
    detail,
    recommendation,
    ...(affectedNodes && affectedNodes.length > 0 ? { affectedNodes } : {}),
  };
}

function tryParseAnalysis(candidate: string): ParsedLLMResponse | null {
  try {
    const parsedValue = JSON.parse(candidate) as Record<string, unknown>;
    if (!isObject(parsedValue)) {
      return null;
    }
    if (parsedValue.mode !== "analysis") {
      return null;
    }
    if (!Array.isArray(parsedValue.findings)) {
      return null;
    }
    const summary = typeof parsedValue.summary === "string" ? parsedValue.summary : "";
    const findingsRaw = parsedValue.findings as unknown[];
    const findings: AnalysisFinding[] = [];
    for (const item of findingsRaw) {
      const finding = normalizeFinding(item);
      if (finding) {
        findings.push(finding);
      }
    }
    const strengths = Array.isArray(parsedValue.strengths)
      ? parsedValue.strengths.filter((line): line is string => typeof line === "string")
      : [];
    const nextSteps = Array.isArray(parsedValue.nextSteps)
      ? parsedValue.nextSteps.filter((line): line is string => typeof line === "string")
      : [];

    const analysis: AnalysisResponse = {
      mode: "analysis",
      summary,
      findings,
      strengths,
      nextSteps,
    };
    return { kind: "analysis", analysis };
  } catch {
    return null;
  }
}

function isPatchEnvelope(
  value: unknown,
): value is { message?: string; patch?: Record<string, unknown> } {
  if (!isObject(value)) {
    return false;
  }
  if (value.mode === "analysis") {
    return false;
  }
  const messageValue = value.message;
  const patchValue = value.patch;
  const hasValidMessage = messageValue === undefined || typeof messageValue === "string";
  const hasValidPatch = patchValue === undefined || patchValue === null || isObject(patchValue);
  return hasValidMessage && hasValidPatch;
}

function isDiagramPatch(value: unknown): value is DiagramPatch {
  if (!isObject(value)) {
    return false;
  }
  if (typeof value.id !== "string") {
    return false;
  }
  if (typeof value.description !== "string") {
    return false;
  }
  return Array.isArray(value.actions);
}

function isToolCall(value: unknown): value is LLMToolCall {
  if (!isObject(value)) {
    return false;
  }
  return typeof value.tool === "string" && isObject(value.parameters);
}

function mapToolCallToAction(toolCall: LLMToolCall): DiagramPatchAction | null {
  switch (toolCall.tool) {
    case "add_node": {
      const nodeType = toolCall.parameters.nodeType;
      if (typeof nodeType === "string" && !isValidNodeType(nodeType)) {
        console.warn(`[LLM] Invalid nodeType "${nodeType}" - action skipped`);
        return null;
      }
      return {
        type: "ADD_NODE",
        payload: toolCall.parameters as DiagramPatchAction["payload"],
      } as DiagramPatchAction;
    }
    case "remove_node":
      return {
        type: "REMOVE_NODE",
        payload: toolCall.parameters as DiagramPatchAction["payload"],
      } as DiagramPatchAction;
    case "update_node":
      return {
        type: "UPDATE_NODE",
        payload: toolCall.parameters as DiagramPatchAction["payload"],
      } as DiagramPatchAction;
    case "add_edge":
      return {
        type: "ADD_EDGE",
        payload: toolCall.parameters as DiagramPatchAction["payload"],
      } as DiagramPatchAction;
    case "remove_edge":
      return {
        type: "REMOVE_EDGE",
        payload: toolCall.parameters as DiagramPatchAction["payload"],
      } as DiagramPatchAction;
    default:
      return null;
  }
}

function isAddNodeAction(
  action: DiagramPatchAction,
): action is Extract<DiagramPatchAction, { type: "ADD_NODE" }> {
  return action.type === "ADD_NODE";
}

function sanitizePatchActions(actions: unknown[]): DiagramPatchAction[] {
  const validActions: DiagramPatchAction[] = [];

  for (const rawAction of actions) {
    if (
      !isObject(rawAction) ||
      typeof rawAction.type !== "string" ||
      !isObject(rawAction.payload)
    ) {
      continue;
    }

    const candidateAction = rawAction as unknown as DiagramPatchAction;
    if (isAddNodeAction(candidateAction)) {
      const nodeType = candidateAction.payload.nodeType;
      if (typeof nodeType === "string" && !isValidNodeType(nodeType)) {
        console.warn(`[LLM] Invalid nodeType "${nodeType}" - action skipped`);
        continue;
      }
    }

    validActions.push(candidateAction);
  }

  return validActions;
}

function tryParseEnvelope(candidate: string): ParsedLLMResponse | null {
  try {
    const parsedValue = JSON.parse(candidate);
    if (!isPatchEnvelope(parsedValue)) {
      return null;
    }

    let parsedMessage = typeof parsedValue.message === "string" ? parsedValue.message : "";
    const trimmedParsedMessage = parsedMessage.trim();
    if (trimmedParsedMessage.startsWith("{") && trimmedParsedMessage.endsWith("}")) {
      try {
        const nestedValue = JSON.parse(trimmedParsedMessage);
        if (isObject(nestedValue) && typeof nestedValue.message === "string") {
          parsedMessage = nestedValue.message;
        }
      } catch {}
    }
    const patchValue = parsedValue.patch;
    if (patchValue === null) {
      return { kind: "patch", message: parsedMessage, patch: null };
    }
    if (isObject(patchValue)) {
      const idValue = patchValue.id;
      if (typeof idValue !== "string" || idValue.trim().length === 0) {
        patchValue.id = crypto.randomUUID();
      }
    }
    const parsedPatch = isDiagramPatch(patchValue) ? patchValue : null;
    if (parsedPatch) {
      parsedPatch.actions = sanitizePatchActions(parsedPatch.actions);
    }
    if (parsedPatch && Array.isArray(parsedPatch.toolCalls)) {
      const convertedActions: DiagramPatchAction[] = [];
      for (const rawToolCall of parsedPatch.toolCalls) {
        if (!isToolCall(rawToolCall)) {
          continue;
        }
        if (!isWriteTool(rawToolCall.tool)) {
          console.info("[LLM tool read]", rawToolCall.tool, rawToolCall.parameters);
          continue;
        }
        const convertedAction = mapToolCallToAction(rawToolCall);
        if (convertedAction) {
          convertedActions.push(convertedAction);
        }
      }
      if (convertedActions.length > 0) {
        parsedPatch.actions = [...parsedPatch.actions, ...convertedActions];
      }
    }
    return { kind: "patch", message: parsedMessage, patch: parsedPatch };
  } catch {
    return null;
  }
}

export function parseLLMResponse(rawResponse: string): ParsedLLMResponse {
  const trimmed = rawResponse.trim();
  if (!trimmed) {
    return { kind: "text", message: "" };
  }

  const cleaned = trimmed
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  const directAnalysis = tryParseAnalysis(cleaned);
  if (directAnalysis) {
    return directAnalysis;
  }

  const directParse = tryParseEnvelope(cleaned);
  if (directParse) {
    return directParse;
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extractedAnalysis = tryParseAnalysis(jsonMatch[0]);
    if (extractedAnalysis) {
      return extractedAnalysis;
    }
    const extractedParse = tryParseEnvelope(jsonMatch[0]);
    if (extractedParse) {
      return extractedParse;
    }
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const inner = fencedMatch[1].trim();
    const fencedAnalysis = tryParseAnalysis(inner);
    if (fencedAnalysis) {
      return fencedAnalysis;
    }
    const fencedParse = tryParseEnvelope(inner);
    if (fencedParse) {
      return fencedParse;
    }
  }

  const fallbackMessage =
    trimmed.startsWith("{") && trimmed.endsWith("}") ? PARSE_FALLBACK_MESSAGE : trimmed;

  console.warn("[LLM] parseLLMResponse fallback:", rawResponse.slice(0, 200));
  return { kind: "text", message: fallbackMessage };
}

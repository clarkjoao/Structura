import { isWriteTool } from "./tools";
import { isValidNodeType } from "./component-catalog";
import type { DiagramPatchAction, LLMToolCall, ParsedLLMResponse } from "./types";

/** Shown when the model returns JSON we cannot map to a user-facing message (no i18n in this module). */
const PARSE_FALLBACK_MESSAGE = "[Resposta não processada. Tente novamente.]";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPatchEnvelope(value: unknown): value is { message?: string; patch?: Record<string, unknown> } {
  if (!isObject(value)) {
    return false;
  }
  const messageValue = value.message;
  const patchValue = value.patch;
  const hasValidMessage = messageValue === undefined || typeof messageValue === "string";
  const hasValidPatch =
    patchValue === undefined || patchValue === null || isObject(patchValue);
  return hasValidMessage && hasValidPatch;
}

function isDiagramPatch(value: unknown): value is NonNullable<ParsedLLMResponse["patch"]> {
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
    if (!isObject(rawAction) || typeof rawAction.type !== "string" || !isObject(rawAction.payload)) {
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

    let parsedMessage =
      typeof parsedValue.message === "string" ? parsedValue.message : "";
    const trimmedParsedMessage = parsedMessage.trim();
    if (
      trimmedParsedMessage.startsWith("{") &&
      trimmedParsedMessage.endsWith("}")
    ) {
      try {
        const nestedValue = JSON.parse(trimmedParsedMessage);
        if (isObject(nestedValue) && typeof nestedValue.message === "string") {
          parsedMessage = nestedValue.message;
        }
      } catch {
        // keep original parsedMessage
      }
    }
    const patchValue = parsedValue.patch;
    if (patchValue === null) {
      return { message: parsedMessage, patch: null };
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
    return { message: parsedMessage, patch: parsedPatch };
  } catch {
    return null;
  }
}

export function parseLLMResponse(rawResponse: string): ParsedLLMResponse {
  const trimmed = rawResponse.trim();
  if (!trimmed) {
    return { message: "", patch: null };
  }

  const cleaned = trimmed
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  const directParse = tryParseEnvelope(cleaned);
  if (directParse) {
    return directParse;
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extractedParse = tryParseEnvelope(jsonMatch[0]);
    if (extractedParse) {
      return extractedParse;
    }
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fencedParse = tryParseEnvelope(fencedMatch[1].trim());
    if (fencedParse) {
      return fencedParse;
    }
  }

  const fallbackMessage =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? PARSE_FALLBACK_MESSAGE
      : trimmed;

  console.warn("[LLM] parseLLMResponse fallback:", rawResponse.slice(0, 200));
  return { message: fallbackMessage, patch: null };
}


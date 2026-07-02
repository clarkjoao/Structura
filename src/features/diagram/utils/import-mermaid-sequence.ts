import type {
  Component,
  Connection,
  ConnectionIntent,
  FlowStep,
  NodeLayout,
} from "../model/diagram.types";
import { generateId } from "./generate-id";

interface ParseContext {
  lines: string[];
  errors: string[];
  participantToComponentId: Map<string, string>;
  existingConnections: Record<string, Connection>;
  newConnections: Connection[];
  steps: Record<string, FlowStep>;
}

type ConditionalKind = "alt" | "opt" | "loop" | "par" | "critical" | "break";

type ArrowMatch = {
  sourceAlias: string;
  targetAlias: string;
  label: string;
  intent: ConnectionIntent;
} | null;

export interface MermaidImportPlan {
  newComponents: Component[];
  newConnections: Connection[];
  layouts: NodeLayout[];
  steps: Record<string, FlowStep>;
  entryStepId: string;
  errors: string[];
}

const GRID_COLUMNS = 3;
const GRID_H_GAP = 200;
const GRID_V_GAP = 120;
const NODE_W = 160;
const NODE_H = 60;
const ARROW_RE =
  /^([A-Za-z0-9_]+)\s*(-->>|--[x)]|-->|->>|-[x)]|->)\s*[+-]?\s*([A-Za-z0-9_]+)\s*[+-]?\s*:\s*(.+)$/;

function emptyPlan(errors: string[] = []): MermaidImportPlan {
  return {
    newComponents: [],
    newConnections: [],
    layouts: [],
    steps: {},
    entryStepId: "",
    errors,
  };
}

function isSkippableLine(line: string): boolean {
  if (line === "sequenceDiagram") return true;
  if (line === "autonumber") return true;
  if (line.startsWith("%%")) return true;
  if (/^Note\s+(over|left of|right of)\b/i.test(line)) return true;
  if (/^(?:activate|deactivate)\s+\S+/i.test(line)) return true;
  if (/^rect\s+/i.test(line)) return true;
  if (/^box\b/i.test(line)) return true;
  if (/^link\s+\S+\s*:/i.test(line)) return true;
  return false;
}

function findConnectionByEndpoints(
  connections: Record<string, Connection>,
  sourceId: string,
  targetId: string,
): Connection | undefined {
  return Object.values(connections).find(
    (connection) => connection.sourceId === sourceId && connection.targetId === targetId,
  );
}

function resolveMessageConnection(
  ctx: ParseContext,
  sourceId: string,
  targetId: string,
  label: string,
  intent: ConnectionIntent,
): { connection: Connection; isResponse: boolean } {
  const existing = findConnectionByEndpoints(ctx.existingConnections, sourceId, targetId);
  if (existing) return { connection: existing, isResponse: false };

  const fromNew = findConnectionByEndpoints(
    Object.fromEntries(ctx.newConnections.map((connection) => [connection.id, connection])),
    sourceId,
    targetId,
  );
  if (fromNew) return { connection: fromNew, isResponse: false };

  const canReuseReverse = intent === "async-message" || intent === "event";
  if (canReuseReverse) {
    const reverseExisting = findConnectionByEndpoints(ctx.existingConnections, targetId, sourceId);
    if (reverseExisting) return { connection: reverseExisting, isResponse: true };

    const reverseFromNew = findConnectionByEndpoints(
      Object.fromEntries(ctx.newConnections.map((connection) => [connection.id, connection])),
      targetId,
      sourceId,
    );
    if (reverseFromNew) return { connection: reverseFromNew, isResponse: true };
  }

  const created: Connection = {
    id: generateId("conn"),
    sourceId,
    targetId,
    label,
    intent,
  };
  ctx.newConnections.push(created);
  return { connection: created, isResponse: false };
}

function matchArrowLine(line: string): ArrowMatch {
  const match = line.match(ARROW_RE);
  if (!match) return null;

  const arrowType = match[2];
  const intent: ConnectionIntent =
    arrowType === "-->>"
      ? "async-message"
      : arrowType === "-->"
        ? "dependency"
        : arrowType === "-x" || arrowType === "--x" || arrowType === "-)" || arrowType === "--)"
          ? "event"
          : "call";

  return {
    sourceAlias: match[1],
    targetAlias: match[3],
    label: match[4].trim(),
    intent,
  };
}

function createActionStep(
  ctx: ParseContext,
  connectionId: string,
  note: string,
  sourceComponentId: string,
  intent: ConnectionIntent,
): FlowStep {
  const step: FlowStep = {
    id: generateId("step"),
    type: "action",
    connectionId,
    componentId: sourceComponentId,
    connectionIntent: intent,
    isAsync: intent === "async-message",
    note,
  };
  ctx.steps[step.id] = step;
  return step;
}

function createPlaceholderAction(ctx: ParseContext, note: string): FlowStep {
  const step: FlowStep = {
    id: generateId("step"),
    type: "action",
    note,
  };
  ctx.steps[step.id] = step;
  return step;
}

function connectTailToHead(
  steps: Record<string, FlowStep>,
  tailIds: string[],
  headId: string,
): void {
  for (const tailId of tailIds) {
    const step = steps[tailId];
    if (!step || step.next) continue;
    step.next = headId;
  }
}

function skipConditionalBlock(lines: string[], startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^(alt|opt|loop|par|critical|break)\b/i.test(line)) {
      depth += 1;
      continue;
    }
    if (line === "end") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return lines.length;
}

function parseSequenceFrom(
  ctx: ParseContext,
  startIndex: number,
  inConditionalBlock: boolean,
  stopTokens: Set<string>,
): { index: number; entryId: string; exitIds: string[] } {
  let index = startIndex;
  let entryId = "";
  let tailIds: string[] = [];

  while (index < ctx.lines.length) {
    const line = ctx.lines[index];
    if (!line || isSkippableLine(line)) {
      index += 1;
      continue;
    }

    if (stopTokens.has(line)) break;
    if (/^else\b/i.test(line) && stopTokens.has("else")) break;
    if (/^and\b/i.test(line) && stopTokens.has("and")) break;
    if (/^option\b/i.test(line) && stopTokens.has("option")) break;

    const conditionalMatch = line.match(/^(alt|opt|loop|par|critical|break)\b(.*)$/i);
    if (conditionalMatch) {
      const blockKind = conditionalMatch[1].toLowerCase() as ConditionalKind;
      if (inConditionalBlock) {
        ctx.errors.push(`Nested ${blockKind} block skipped`);
        index = skipConditionalBlock(ctx.lines, index);
        continue;
      }
      const parsed = parseConditionalBlock(ctx, index, blockKind);
      if (parsed.entryId) {
        if (!entryId) entryId = parsed.entryId;
        connectTailToHead(ctx.steps, tailIds, parsed.entryId);
        tailIds = parsed.exitIds;
      }
      index = parsed.index;
      continue;
    }

    const arrow = matchArrowLine(line);
    if (arrow) {
      const sourceId = ctx.participantToComponentId.get(arrow.sourceAlias);
      const targetId = ctx.participantToComponentId.get(arrow.targetAlias);
      if (!sourceId || !targetId) {
        ctx.errors.push(`Unresolved participants in line: ${line}`);
        index += 1;
        continue;
      }
      const { connection, isResponse } = resolveMessageConnection(
        ctx,
        sourceId,
        targetId,
        arrow.label,
        arrow.intent,
      );
      const step = createActionStep(ctx, connection.id, arrow.label, sourceId, arrow.intent);
      if (isResponse) {
        step.payloadDirection = "response";
      }
      if (!entryId) entryId = step.id;
      connectTailToHead(ctx.steps, tailIds, step.id);
      tailIds = [step.id];
      index += 1;
      continue;
    }

    index += 1;
  }

  return { index, entryId, exitIds: tailIds };
}

function parseConditionalBlock(
  ctx: ParseContext,
  startIndex: number,
  kind: ConditionalKind,
): { index: number; entryId: string; exitIds: string[] } {
  const line = ctx.lines[startIndex];
  const firstLabelRaw = line.replace(/^(alt|opt|loop|par|critical|break)\s*/i, "").trim();
  const conditionStep: FlowStep = {
    id: generateId("step"),
    type: "condition",
    branches: [],
    conditionLabel: kind,
  };
  ctx.steps[conditionStep.id] = conditionStep;

  let index = startIndex + 1;
  const branchSeeds: string[] = [];
  const branchTails: string[] = [];
  const defaultLabel = firstLabelRaw || kind;

  const parseBranch = (label: string): void => {
    const stopTokens =
      kind === "par"
        ? new Set(["and", "end"])
        : kind === "critical"
          ? new Set(["option", "end"])
          : new Set(["else", "end"]);
    const parsed = parseSequenceFrom(ctx, index, true, stopTokens);
    index = parsed.index;
    let branchEntryId = parsed.entryId;
    let branchExitIds = parsed.exitIds;
    if (!branchEntryId) {
      const placeholder = createPlaceholderAction(ctx, label);
      branchEntryId = placeholder.id;
      branchExitIds = [placeholder.id];
    }
    conditionStep.branches!.push({ label, nextId: branchEntryId });
    branchSeeds.push(branchEntryId);
    branchTails.push(...branchExitIds);
  };

  parseBranch(defaultLabel);

  if (kind === "alt") {
    while (index < ctx.lines.length) {
      const current = ctx.lines[index];
      if (/^else\b/i.test(current)) {
        const elseLabel = current.replace(/^else\s*/i, "").trim() || "else";
        index += 1;
        parseBranch(elseLabel);
        continue;
      }
      break;
    }
  }

  if (kind === "par") {
    while (index < ctx.lines.length) {
      const current = ctx.lines[index];
      if (/^and\b/i.test(current)) {
        const andLabel = current.replace(/^and\s*/i, "").trim() || "and";
        index += 1;
        parseBranch(andLabel);
        continue;
      }
      break;
    }
  }

  if (kind === "critical") {
    while (index < ctx.lines.length) {
      const current = ctx.lines[index];
      if (/^option\b/i.test(current)) {
        const optionLabel = current.replace(/^option\s*/i, "").trim() || "option";
        index += 1;
        parseBranch(optionLabel);
        continue;
      }
      break;
    }
  }

  if (ctx.lines[index] === "end") {
    index += 1;
  } else {
    ctx.errors.push(`Missing end for ${kind} block`);
  }

  return {
    index,
    entryId: conditionStep.id,
    exitIds: branchTails.length > 0 ? branchTails : branchSeeds,
  };
}

export function parseMermaidSequence(
  text: string,
  existingComponents: Record<string, Component>,
  existingConnections: Record<string, Connection>,
  anchorPosition: { x: number; y: number },
): MermaidImportPlan {
  if (!text.includes("sequenceDiagram")) {
    return emptyPlan(["Text must contain a valid sequenceDiagram"]);
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const errors: string[] = [];
  const participantDisplayNameByAlias = new Map<string, string>();

  for (const line of lines) {
    if (isSkippableLine(line)) continue;
    const aliasWithName = line.match(/^(?:participant|actor)\s+([A-Za-z0-9_]+)\s+as\s+(.+)$/i);
    if (aliasWithName) {
      participantDisplayNameByAlias.set(aliasWithName[1], aliasWithName[2].trim());
      continue;
    }
    const aliasOnly = line.match(/^(?:participant|actor)\s+([A-Za-z0-9_]+)$/i);
    if (aliasOnly) {
      participantDisplayNameByAlias.set(aliasOnly[1], aliasOnly[1]);
      continue;
    }

    const arrow = matchArrowLine(line);
    if (arrow) {
      if (!participantDisplayNameByAlias.has(arrow.sourceAlias)) {
        participantDisplayNameByAlias.set(arrow.sourceAlias, arrow.sourceAlias);
      }
      if (!participantDisplayNameByAlias.has(arrow.targetAlias)) {
        participantDisplayNameByAlias.set(arrow.targetAlias, arrow.targetAlias);
      }
    }
  }

  const componentByLowerName = new Map<string, Component>();
  for (const component of Object.values(existingComponents)) {
    componentByLowerName.set(component.name.toLowerCase(), component);
  }

  const newComponents: Component[] = [];
  const layouts: NodeLayout[] = [];
  const participantToComponentId = new Map<string, string>();

  for (const [alias, fullName] of participantDisplayNameByAlias.entries()) {
    const existing = componentByLowerName.get(fullName.toLowerCase());
    if (existing) {
      participantToComponentId.set(alias, existing.id);
      continue;
    }
    const index = newComponents.length;
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const id = generateId("comp");
    const component = {
      id,
      name: fullName,
      description: "",
      parentId: null,
      type: "component",
      c4Type: "component",
    } as unknown as Component;
    newComponents.push(component);
    layouts.push({
      elementId: id,
      x: anchorPosition.x + column * GRID_H_GAP,
      y: anchorPosition.y + row * GRID_V_GAP,
      width: NODE_W,
      height: NODE_H,
    });
    participantToComponentId.set(alias, id);
  }

  const ctx: ParseContext = {
    lines,
    errors,
    participantToComponentId,
    existingConnections,
    newConnections: [],
    steps: {},
  };
  const parsed = parseSequenceFrom(ctx, 0, false, new Set());

  return {
    newComponents,
    newConnections: ctx.newConnections,
    layouts,
    steps: ctx.steps,
    entryStepId: parsed.entryId,
    errors,
  };
}

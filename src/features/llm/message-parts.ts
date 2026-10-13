import type { LLMError } from "./errors";
import { isMentionRef } from "./mentions/mention-ref";
import { isSkillRef } from "./skills/skill.types";
import type { ChatMessage, CommandRef } from "./types";

/**
 * A chat message is an ordered list of parts. Text is what the model wrote;
 * the other parts are things the chat shows inside the conversation: a tool
 * call, a reference to a diagram suggestion, an error from that turn.
 */
export interface TextPart {
  type: "text";
  text: string;
}

export type ToolCallStatus = "running" | "done" | "error" | "awaiting-approval" | "denied";

/** A tool the model called. Nothing produces these yet; the renderer exists. */
export interface ToolCallPart {
  type: "tool-call";
  id: string;
  name: string;
  source: "internal" | "mcp";
  /** The MCP server the tool came from, when `source` is "mcp". */
  serverId?: string;
  args: unknown;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  /** The user stopped the reply while this call was running. */
  stopped?: boolean;
}

/**
 * Points at a pending suggestion in the store. The suggestion data itself is
 * not copied into the message: it is session state, and a reloaded thread
 * keeps the reference even though the suggestion is gone.
 */
export interface SuggestionPart {
  type: "suggestion";
  suggestionId: string;
}

/** The request for this turn failed. Kept with the thread. */
export interface ErrorPart {
  type: "error";
  error: LLMError;
}

export type MessagePart = TextPart | ToolCallPart | SuggestionPart | ErrorPart;

export type MessageStatus = "streaming" | "complete" | "cancelled" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const TOOL_CALL_STATUSES: readonly ToolCallStatus[] = [
  "running",
  "done",
  "error",
  "awaiting-approval",
  "denied",
];

function isToolCallStatus(value: unknown): value is ToolCallStatus {
  return TOOL_CALL_STATUSES.some((status) => status === value);
}

export function isTextPart(value: unknown): value is TextPart {
  return isRecord(value) && value.type === "text" && typeof value.text === "string";
}

export function isToolCallPart(value: unknown): value is ToolCallPart {
  return (
    isRecord(value) &&
    value.type === "tool-call" &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.source === "internal" || value.source === "mcp") &&
    (value.serverId === undefined || typeof value.serverId === "string") &&
    isToolCallStatus(value.status) &&
    (value.error === undefined || typeof value.error === "string") &&
    (value.stopped === undefined || typeof value.stopped === "boolean")
  );
}

export function isSuggestionPart(value: unknown): value is SuggestionPart {
  return isRecord(value) && value.type === "suggestion" && typeof value.suggestionId === "string";
}

function isLLMError(value: unknown): value is LLMError {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    (value.status === null || typeof value.status === "number") &&
    (value.mode === "direct" || value.mode === "proxy") &&
    typeof value.provider === "string" &&
    typeof value.detail === "string"
  );
}

export function isErrorPart(value: unknown): value is ErrorPart {
  return isRecord(value) && value.type === "error" && isLLMError(value.error);
}

export function isMessagePart(value: unknown): value is MessagePart {
  return (
    isTextPart(value) || isToolCallPart(value) || isSuggestionPart(value) || isErrorPart(value)
  );
}

const MESSAGE_STATUSES: readonly MessageStatus[] = ["streaming", "complete", "cancelled", "error"];

export function isMessageStatus(value: unknown): value is MessageStatus {
  return MESSAGE_STATUSES.some((status) => status === value);
}

export function textPart(text: string): TextPart {
  return { type: "text", text };
}

export function errorPart(error: LLMError): ErrorPart {
  return { type: "error", error };
}

export function suggestionPart(suggestionId: string): SuggestionPart {
  return { type: "suggestion", suggestionId };
}

export function isCommandRef(value: unknown): value is CommandRef {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

/**
 * What the user sees for a message: active skills as "[Skill name]", then a
 * command as "/name", then the text. Used for the bubble's copy, /copy and
 * the thread title — never the command's instruction or the skill's.
 */
export function getVisibleText(message: Pick<ChatMessage, "parts" | "command" | "skills">): string {
  return [
    ...(message.skills ?? []).map((skill) => `[${skill.name}]`),
    message.command ? `/${message.command.name}` : "",
    getMessageText(message),
  ]
    .filter((segment) => segment.trim().length > 0)
    .join(" ");
}

/** The message's text: every text part, in order, joined. */
export function getMessageText(message: Pick<ChatMessage, "parts">): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Appends a streamed chunk to the message's last part when it is text, or
 * starts a new text part when it is not, so text after a tool call stays after
 * it. Returns a new message; the input is not modified.
 */
export function appendTextDelta(message: ChatMessage, delta: string): ChatMessage {
  if (delta.length === 0) {
    return message;
  }
  const last = message.parts[message.parts.length - 1];
  if (isTextPart(last)) {
    return {
      ...message,
      parts: [...message.parts.slice(0, -1), textPart(last.text + delta)],
    };
  }
  return { ...message, parts: [...message.parts, textPart(delta)] };
}

/**
 * Appends a non-text part (a tool call, a suggestion). An empty text part at
 * the end — the placeholder a streaming reply starts with — is dropped so it
 * does not render as an empty paragraph before the part.
 */
export function appendPart(message: ChatMessage, part: MessagePart): ChatMessage {
  const last = message.parts[message.parts.length - 1];
  const kept =
    isTextPart(last) && last.text.length === 0 ? message.parts.slice(0, -1) : message.parts;
  return { ...message, parts: [...kept, part] };
}

/**
 * Updates the running tool-call part with this id (the latest one: some
 * providers reuse ids across steps); other parts are kept as they are.
 */
export function updateToolCallPart(
  message: ChatMessage,
  id: string,
  update: Partial<Pick<ToolCallPart, "status" | "result" | "error">>,
): ChatMessage {
  let target = -1;
  message.parts.forEach((part, index) => {
    if (isToolCallPart(part) && part.id === id && part.status === "running") target = index;
  });
  if (target === -1) return message;
  return {
    ...message,
    parts: message.parts.map((part, index) =>
      index === target && isToolCallPart(part) ? { ...part, ...update } : part,
    ),
  };
}

/**
 * Ends every still-running tool call as an error: `stopped` when the user
 * stopped the reply, otherwise because the request failed around it.
 */
export function failRunningToolCalls(message: ChatMessage, stopped: boolean): ChatMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      isToolCallPart(part) && part.status === "running"
        ? { ...part, status: "error", ...(stopped ? { stopped: true } : {}) }
        : part,
    ),
  };
}

export function getErrorPart(message: Pick<ChatMessage, "parts">): ErrorPart | undefined {
  return message.parts.find(isErrorPart);
}

export function getSuggestionIds(message: Pick<ChatMessage, "parts">): string[] {
  return message.parts.filter(isSuggestionPart).map((part) => part.suggestionId);
}

// ─── Stored-message migration ────────────────────────────────────────────────
//
// Threads saved before message parts existed store `content: string`. A
// stored message is migrated on read, never dropped: a shape this code does
// not recognise is kept as a text part carrying the raw value, so nothing the
// user wrote disappears because a later version could not parse it.

function rawText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface MigratedMessage {
  message: ChatMessage;
  /** False when the stored value was already a well-formed current message. */
  changed: boolean;
}

export function migrateStoredMessage(raw: unknown): MigratedMessage {
  if (!isRecord(raw)) {
    return {
      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [textPart(rawText(raw))],
        timestamp: Date.now(),
      },
      changed: true,
    };
  }

  let changed = false;
  const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : crypto.randomUUID();
  if (id !== raw.id) changed = true;
  const role = raw.role === "user" || raw.role === "assistant" ? raw.role : "assistant";
  if (role !== raw.role) changed = true;
  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : Date.now();
  if (timestamp !== raw.timestamp) changed = true;

  let parts: MessagePart[];
  if (Array.isArray(raw.parts)) {
    parts = raw.parts.map((part: unknown) => {
      if (isMessagePart(part)) {
        return part;
      }
      changed = true;
      return textPart(rawText(part));
    });
  } else if (typeof raw.content === "string") {
    parts = [textPart(raw.content)];
    changed = true;
  } else {
    parts = [textPart(rawText(raw))];
    changed = true;
  }

  const message: ChatMessage = { id, role, parts, timestamp };
  if (isCommandRef(raw.command)) {
    message.command = { id: raw.command.id, name: raw.command.name };
  } else if (raw.command !== undefined) {
    changed = true;
  }
  if (Array.isArray(raw.mentions)) {
    const mentions = raw.mentions.filter(isMentionRef);
    if (mentions.length !== raw.mentions.length) changed = true;
    if (mentions.length > 0) message.mentions = mentions;
  } else if (raw.mentions !== undefined) {
    changed = true;
  }
  if (Array.isArray(raw.skills)) {
    const skills = raw.skills.filter(isSkillRef);
    if (skills.length !== raw.skills.length) changed = true;
    if (skills.length > 0) message.skills = skills;
  } else if (raw.skills !== undefined) {
    changed = true;
  }
  if (raw.truncated === true) {
    message.truncated = true;
  } else if (raw.truncated !== undefined) {
    changed = true;
  }
  if (isMessageStatus(raw.status)) {
    message.status = raw.status;
  } else if (raw.status !== undefined) {
    changed = true;
  }
  if ("content" in raw) {
    changed = true;
  }
  return { message, changed };
}

export function migrateStoredMessages(raw: unknown): { messages: ChatMessage[]; changed: boolean } {
  if (!Array.isArray(raw)) {
    return { messages: [], changed: raw !== undefined };
  }
  let changed = false;
  const messages = raw.map((entry: unknown) => {
    const migrated = migrateStoredMessage(entry);
    if (migrated.changed) changed = true;
    return migrated.message;
  });
  return { messages, changed };
}

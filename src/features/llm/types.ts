import type {
  ChangeBatchReceipt,
  ComponentPatch,
  ComponentType,
  EdgeStyle,
} from "@/features/diagram";
import type { PanelKind } from "@/features/diagram/enums";
import type { MessagePart, MessageStatus } from "./message-parts";
import type { MentionRef } from "./mentions/mention-ref";
import type { SkillRef } from "./skills/skill.types";
import type { SkippedAction } from "./suggestion-apply";

export type LLMProvider = "openai" | "anthropic" | "custom";
export type LLMMode = "direct" | "proxy";

/** The wire protocol a `custom` provider speaks. Ignored for other providers. */
export type CustomProtocol = "openai" | "anthropic";

export interface LLMConfig {
  mode: LLMMode;
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  authHeader?: string;
  extraHeaders?: Record<string, string>;
  extraParams?: Record<string, unknown>;
  /** When `provider === "custom"`, the endpoint's wire protocol. */
  customProtocol?: CustomProtocol;
}

export interface LLMConnection {
  id: string;
  name: string;
  /** The models "Test connection" found (or the presets); the picker lists them. */
  models?: string[];
  mode: LLMMode;
  provider: LLMProvider;
  baseUrl?: string;
  authHeader?: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  extraParams?: Record<string, unknown>;
  customProtocol?: CustomProtocol;
}

/**
 * Why the model stopped emitting.
 *
 * `length` means the provider cut the response at its output-token ceiling, so
 * whatever arrived is incomplete by construction. The generation pipeline has to
 * be able to tell that apart from a natural stop: both reach the parser as text
 * that fails to parse, and reporting "not valid JSON" for a cut-off diagram
 * sends the user looking for a modelling problem that is not there.
 */
export type LLMStopReason = "stop" | "length" | "unknown";

/** A finished model response plus the reason the provider stopped it. */
export interface LLMCompletion {
  text: string;
  stopReason: LLMStopReason;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  timestamp: number;
  /** Assistant messages only: where the turn that produced it ended up. */
  status?: MessageStatus;
  /** Assistant messages only: the model stopped at its output-token limit. */
  truncated?: boolean;
  /**
   * User messages only: the diagram elements attached as context chips. Kept
   * beside the parts (not as parts): they are request context, not content
   * the conversation renders or copies as Markdown.
   */
  mentions?: MentionRef[];
  /**
   * User messages only: the prompt command the message was sent with. The
   * text part holds only the user's extra text; the instruction is looked up
   * by id when the request is built. `name` is cached for display.
   */
  command?: CommandRef;
  /**
   * User messages only: the skills active when the message was sent, so Retry
   * and Regenerate reuse them. Resolved by source and id when a request is
   * built; a skill that no longer exists is left out.
   */
  skills?: SkillRef[];
}

export interface CommandRef {
  id: string;
  name: string;
}

/** Hard cap on composer-queued messages while the assistant is busy. */
export const MAX_QUEUED_MESSAGES = 10;

/**
 * A user message held in the composer queue while the assistant is busy. The
 * composer creates one on every send that arrives while `isLoading` is true;
 * the store drains the queue when the running turn ends. Lives in memory
 * only — reloading the page drops it.
 */
export interface QueuedMessage {
  id: string;
  text: string;
  mentions: MentionRef[];
  command?: CommandRef;
  /** Snapshot of the active skill chips at enqueue time. */
  skills: SkillRef[];
}

/** What a provider sends for one turn: the role and its text. */
export interface LLMRequestMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationThread {
  id: string;
  diagramId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DiagramThreadState {
  threads: ConversationThread[];
  activeThreadId: string;
}

/**
 * One change a write tool queued for the user to review. Ids are the
 * diagram's own, or the `ref` of a node added earlier in the same suggestion.
 */
export type DiagramPatchAction =
  | {
      type: "ADD_NODE";
      payload: {
        /** How later changes in the same suggestion point at this node. */
        ref: string;
        nodeType: ComponentType;
        name: string;
        parentId: string | null;
        position?: { x: number; y: number };
        /** Catalog service id from search_elements; becomes the component's cloud service. */
        serviceId?: string;
        /** Panels only: the group kind (VPC, subnet, availability zone…). */
        panelKind?: PanelKind;
      };
    }
  | { type: "REMOVE_NODE"; payload: { nodeId: string } }
  | { type: "UPDATE_NODE"; payload: { nodeId: string; patch: ComponentPatch } }
  | {
      type: "ADD_EDGE";
      payload: {
        sourceId: string;
        targetId: string;
        label: string;
        edgeStyle?: EdgeStyle;
      };
    }
  | { type: "REMOVE_EDGE"; payload: { edgeId: string } }
  | { type: "INSERT_PATTERN"; payload: { patternId: string; provider?: string } }
  | { type: "AUTO_LAYOUT"; payload: Record<string, never> };

export interface DiagramPatch {
  id: string;
  description: string;
  actions: DiagramPatchAction[];
}

export interface PendingSuggestion {
  id: string;
  messageId: string;
  patch: DiagramPatch;
  status: "pending" | "accepted" | "rejected";
  /** The actions that no longer applied (their target was gone). */
  skipped?: SkippedAction[];
}

/**
 * A pending suggestion drawn on the canvas before Accept: it is applied as
 * one undo step and its elements are marked pending. Accept keeps it; Reject
 * takes it back.
 */
export interface PendingNodePreview {
  suggestionId: string;
  nodeIds: string[];
  edgeIds: string[];
  /** How to take the preview back as one step; null when that is not possible. */
  receipt: ChangeBatchReceipt | null;
}

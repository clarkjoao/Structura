import { StrokeStyle, EdgeMarker } from "../enums";
import type {
  Connection,
  ConnectionDirection,
  ConnectionInteraction,
  ConnectionIntent,
  ConnectionKind,
  ConnectionStyle,
} from "./connection.types";

export interface EffectiveConnectionStyle {
  strokeStyle: ConnectionStyle["strokeStyle"];
  strokeWidth: number;
  markerStart: EdgeMarker;
  markerEnd: EdgeMarker;
  animated: boolean;
}

const DEFAULT_STROKE_WIDTH = 1;

export const INTENT_DEFAULTS: Record<ConnectionIntent, ConnectionStyle> = {
  dependency: {
    strokeStyle: StrokeStyle.Dashed,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.Arrow,
    markerStart: EdgeMarker.None,
    animated: false,
  },
  call: {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: false,
  },
  event: {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
  "data-flow": {
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: 3,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
  "async-message": {
    strokeStyle: StrokeStyle.Dashed,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    markerEnd: EdgeMarker.ArrowClosed,
    markerStart: EdgeMarker.None,
    animated: true,
  },
};

/**
 * The pre-v16 intents in the new vocabulary. Dependency is synchronous here although it was drawn
 * dashed; `migrateConnectionSemantics` keeps that drawing by pinning the old stroke on the edge.
 * Data flow has no kind of its own and becomes a call.
 */
export const INTENT_TO_SEMANTICS: Record<
  ConnectionIntent,
  { interaction: ConnectionInteraction; kind: ConnectionKind }
> = {
  dependency: { interaction: "sync", kind: "dependency" },
  call: { interaction: "sync", kind: "call" },
  event: { interaction: "async", kind: "event" },
  "data-flow": { interaction: "sync", kind: "call" },
  "async-message": { interaction: "async", kind: "command" },
};

/** The pre-v16 intent that stands for a new-vocabulary connection: the glyph a flow step still keys on. */
export function semanticsToIntent(
  conn: Pick<Connection, "interaction" | "kind" | "intent">,
): ConnectionIntent {
  const { interaction, kind } = resolveConnectionSemantics(conn);
  if (kind === "command") return "async-message";
  if (kind === "event") return "event";
  if (kind === "dependency") return "dependency";
  return interaction === "async" ? "async-message" : "call";
}

/** The stroke an interaction draws, when nothing pins another. */
export const INTERACTION_STROKE: Record<ConnectionInteraction, StrokeStyle> = {
  sync: StrokeStyle.Solid,
  async: StrokeStyle.Dashed,
};

/**
 * Interaction and kind of a connection, falling back to its pre-v16 `intent`. A plain edge —
 * neither field, no intent — is synchronous and has no kind.
 */
export function resolveConnectionSemantics(
  conn: Pick<Connection, "interaction" | "kind" | "intent">,
): { interaction: ConnectionInteraction; kind: ConnectionKind | undefined } {
  const legacy = conn.intent ? INTENT_TO_SEMANTICS[conn.intent] : undefined;
  return {
    interaction: conn.interaction ?? legacy?.interaction ?? "sync",
    kind: conn.kind ?? legacy?.kind,
  };
}

export const DIRECTION_MARKERS: Record<
  ConnectionDirection,
  { markerStart: EdgeMarker; markerEnd: EdgeMarker }
> = {
  unidirectional: { markerStart: EdgeMarker.None, markerEnd: EdgeMarker.ArrowClosed },
  bidirectional: { markerStart: EdgeMarker.ArrowClosed, markerEnd: EdgeMarker.ArrowClosed },
  reverse: { markerStart: EdgeMarker.ArrowClosed, markerEnd: EdgeMarker.None },
};

export function getEffectiveConnectionStyle(conn: Connection): EffectiveConnectionStyle {
  const direction = conn.direction ?? "unidirectional";
  const fromDirection = DIRECTION_MARKERS[direction];
  const s = conn.style;

  // The interaction drives the stroke. Only an edge with no interaction falls back to the
  // pre-v16 intent (or, with neither, to a plain call), so unmigrated data draws as it always did.
  const fromIntent = conn.interaction ? undefined : INTENT_DEFAULTS[conn.intent ?? "call"];
  const derivedStroke = conn.interaction ? INTERACTION_STROKE[conn.interaction] : undefined;

  return {
    strokeStyle: s?.strokeStyle ?? derivedStroke ?? fromIntent?.strokeStyle ?? StrokeStyle.Solid,
    strokeWidth: s?.strokeWidth ?? fromIntent?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    markerStart: s?.markerStart ?? fromDirection.markerStart,
    markerEnd: s?.markerEnd ?? fromDirection.markerEnd,
    animated: s?.animated ?? fromIntent?.animated ?? false,
  };
}

export function getIntentDefault(intent: ConnectionIntent): ConnectionStyle {
  return { ...INTENT_DEFAULTS[intent] };
}

import type { Component, Connection, EdgeLayout } from "../model/diagram.types";
import {
  INTENT_DEFAULTS,
  INTENT_TO_SEMANTICS,
  INTERACTION_STROKE,
} from "../model/connection-defaults";
import type { ConnectionKind } from "../model/connection.types";

/**
 * Schema v16: the connection's intent becomes interaction × kind (the D2 table), `reverse` becomes
 * a swapped connection, and the transport preset and the write-only communication type go away.
 *
 * Idempotent: it recognises what it migrates by the legacy fields, which it removes. Existing
 * drawings do not change — where the new derivation would draw differently from the old intent,
 * the old stroke, width and animation are pinned on the edge's own style.
 */

type LegacyTransport = NonNullable<Connection["transportPreset"]>;

const TRANSPORT_AS_TECHNOLOGY: Partial<Record<LegacyTransport, string>> = {
  tcp: "TCP",
  udp: "UDP",
};

/** What a diagram's connections live in: the base snapshot, or a version's additions. */
export interface ConnectionSemanticsTarget {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  edgeLayouts?: Record<string, EdgeLayout>;
}

/**
 * Turns a connection around in place: the ends trade places, the cross-axis sides (which belonged
 * to their ends) and the bends drawn for the old route are dropped, and the label keeps its place
 * along the line. Shared by the migration of `reverse` and the panel's swap button.
 */
export function swapConnectionEnds(conn: Connection, target: ConnectionSemanticsTarget): void {
  const { sourceId, targetId } = conn;
  conn.sourceId = targetId;
  conn.targetId = sourceId;
  // A cross-axis side belongs to its end; the swapped ends fall back to the main output and input.
  delete conn.sourceSide;
  delete conn.targetSide;
  const forget = (componentId: string, side: "incoming" | "outgoing") => {
    const order = target.components[componentId]?.handleOrder;
    if (order) order[side] = order[side].filter((id) => id !== conn.id);
  };
  forget(sourceId, "outgoing");
  forget(targetId, "incoming");
  const layout = target.edgeLayouts?.[conn.id];
  if (layout) {
    // The bends were drawn for the old route. The label stays where it was along the line.
    delete layout.points;
    if (layout.labelOffset !== undefined) layout.labelOffset = 1 - layout.labelOffset;
  }
}

/** Migrates one connection in place. Returns whether anything changed. */
export function migrateConnectionSemantics(
  conn: Connection,
  target: ConnectionSemanticsTarget,
): boolean {
  let changed = false;

  if (conn.intent !== undefined) {
    const legacy = INTENT_DEFAULTS[conn.intent];
    const mapped = INTENT_TO_SEMANTICS[conn.intent];
    if (mapped) {
      conn.interaction ??= mapped.interaction;
      conn.kind ??= mapped.kind;
      // Pin what the new derivation would draw differently.
      const derivedStroke = INTERACTION_STROKE[conn.interaction];
      const style = (conn.style ??= {});
      if (style.strokeStyle === undefined && legacy.strokeStyle !== derivedStroke) {
        style.strokeStyle = legacy.strokeStyle;
      }
      if (style.strokeWidth === undefined && legacy.strokeWidth !== 1) {
        style.strokeWidth = legacy.strokeWidth;
      }
      if (style.animated === undefined && legacy.animated === true) style.animated = true;
      if (Object.keys(style).length === 0) delete conn.style;
    }
    delete conn.intent;
    changed = true;
  }

  if (conn.transportPreset !== undefined) {
    const preset = conn.transportPreset;
    if (preset === "sync" || preset === "async" || preset === "event") {
      conn.interaction ??= preset === "sync" ? "sync" : "async";
      if (preset === "event") conn.kind ??= "event" satisfies ConnectionKind;
    }
    const asTechnology = TRANSPORT_AS_TECHNOLOGY[preset];
    if (asTechnology) {
      const technology = conn.technology?.trim() ?? "";
      if (!technology) conn.technology = asTechnology;
      else if (!technology.toLowerCase().includes(asTechnology.toLowerCase())) {
        conn.technology = `${technology} · ${asTechnology}`;
      }
    }
    delete conn.transportPreset;
    changed = true;
  }

  if (conn.communicationType !== undefined) {
    delete conn.communicationType;
    changed = true;
  }

  if (conn.direction === "reverse") {
    conn.direction = "unidirectional";
    swapConnectionEnds(conn, target);
    changed = true;
  }

  return changed;
}

/** Migrates every connection of `target`. Returns how many changed. */
export function migrateConnectionsSemantics(target: ConnectionSemanticsTarget): number {
  let count = 0;
  for (const conn of Object.values(target.connections)) {
    if (migrateConnectionSemantics(conn, target)) count += 1;
  }
  return count;
}

import { buildFlowOutline, type Connection, type Flow } from "@/features/diagram";

/**
 * A name for a flow nobody named: where it starts and where it ends, `Checkout → Ledger`.
 *
 * The recorder used to finish an unnamed flow with a warning and an empty name, and the list then
 * showed "Untitled" for it. The participants are already known, in script order, so the name
 * offers itself; the author keeps the last word by typing over it.
 *
 * A call contributes both of its ends — where it leaves from, then where it arrives — so a flow
 * recorded as edges only still has a start and an end. `null` when no step names anything.
 */
export function suggestFlowName(
  flow: Flow,
  nameOf: (componentId: string) => string | undefined,
  connections: Record<string, Connection>,
): string | null {
  const visits: string[] = [];
  for (const row of buildFlowOutline(flow).rows) {
    const step = flow.steps[row.stepId];
    if (!step) continue;
    const connection = step.connectionId ? connections[step.connectionId] : undefined;
    if (connection) {
      const response = step.payloadDirection === "response";
      visits.push(
        response ? connection.targetId : connection.sourceId,
        response ? connection.sourceId : connection.targetId,
      );
    } else if (step.componentId) {
      visits.push(step.componentId);
    }
  }

  const names = visits
    .map((id) => nameOf(id)?.trim())
    .filter((name): name is string => Boolean(name));
  const first = names[0];
  const last = names[names.length - 1];
  if (!first || !last) return null;
  return first === last ? first : `${first} → ${last}`;
}

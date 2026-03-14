import type { Connection } from "../model/connection.types";

/**
 * Returns `conns` sorted by the given `order` (array of connection ids).
 * Connections not present in `order` are appended at the end in their original relative order.
 */
export function applyHandleOrder(
  conns: Connection[],
  order: string[],
): Connection[] {
  if (!order.length) return conns;
  return [
    ...order
      .map((id) => conns.find((c) => c.id === id))
      .filter((c): c is Connection => c !== undefined),
    ...conns.filter((c) => !order.includes(c.id)),
  ];
}

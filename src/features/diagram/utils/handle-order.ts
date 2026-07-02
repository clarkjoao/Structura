import type { Connection } from "../model/connection.types";

export function applyHandleOrder(conns: Connection[], order: string[]): Connection[] {
  if (!order.length) return conns;
  return [
    ...order
      .map((id) => conns.find((c) => c.id === id))
      .filter((c): c is Connection => c !== undefined),
    ...conns.filter((c) => !order.includes(c.id)),
  ];
}

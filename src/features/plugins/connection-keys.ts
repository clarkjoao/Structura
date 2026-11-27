/**
 * How a connection of an importer graph (plugin API 1.3) is named: its ends, its label and which
 * occurrence of that triple it is. The embed preview names connections this way
 * (`STRUCTURA_REVEAL`, `STRUCTURA_SELECT`), so a host that builds the graph names them the same way — the opscr plugin's `connectionKeys` is held
 * to this by its tests (`test/connection-keys.parity.test.ts`).
 */
export function connectionKeys(
  connections: readonly { source: string; target: string; label?: string | null }[],
): string[] {
  const seen = new Map<string, number>();
  return connections.map((c) => {
    const base = `${c.source}->${c.target}:${c.label ?? ""}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

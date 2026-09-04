/**
 * A cheap fingerprint of the state a room is supposed to share.
 *
 * Divergence used to be invisible: a client could hold a stale entity forever
 * with nothing to notice it, because version numbers agreed even when content
 * did not. Broadcasting this alongside the version lets a client detect drift
 * in ~16 bytes and ask for the expensive repair only when it actually needs it.
 *
 * Each client computes the same value over the state it believes the room has.
 * Any change here must be mirrored in the twin at
 * `src/features/collaboration/utils/snapshotChecksum.ts`; the client suite has a
 * parity test that fails if the two drift apart.
 */

/**
 * Exactly the fields a patch can carry — no more. Hashing anything that cannot
 * be synced (ids, level, viewport) would report drift that no resync can fix.
 */
const SYNCED_KEYS = [
  "activeSceneId",
  "compareSceneId",
  "components",
  "connections",
  "description",
  "diagramName",
  "domain",
  "edgeLayouts",
  "flows",
  "iconLibrary",
  "nodeLayouts",
  "scenes",
] as const;

/**
 * Serialise with sorted keys so two peers that built the same entity in a
 * different order still agree, and with `undefined` folded into `null` so an
 * absent optional field matches an explicitly empty one.
 */
function canonical(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
}

/**
 * Two FNV-1a passes with different constants, concatenated: 64 bits of hex,
 * enough that a collision is not a practical concern for drift detection, and
 * cheap enough to run on every checksum frame.
 */
export function snapshotChecksum(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot) return "0".repeat(16);

  const text = SYNCED_KEYS.map((key) => `${key}=${canonical(snapshot[key])}`).join(";");

  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high ^ code, 0x85ebca6b) >>> 0;
  }

  return low.toString(16).padStart(8, "0") + high.toString(16).padStart(8, "0");
}

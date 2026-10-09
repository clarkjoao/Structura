/**
 * Key-order-independent fingerprint of a plain data value, for tests asserting that rendering or
 * export left a diagram's synchronised state untouched.
 */
export function stateFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
}

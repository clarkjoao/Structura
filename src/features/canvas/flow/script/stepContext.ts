/**
 * Reading text the author already has into the values a step introduces.
 *
 * Pure on purpose and in a file of its own: the panels above are components,
 * and these are the rules the object depends on being right — worth testing
 * without rendering anything.
 */

/**
 * Parsed content, or `null` for anything that is not JSON — including empty.
 *
 * Never throws and never blocks: `payload` is free text by design and some
 * scripts hold prose in it, so failing to parse is a fact the field reports,
 * not a value it refuses.
 */
export function parseJsonField(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * The step's own body, turned into the values it introduces.
 *
 * Most of the time the object a call carries *is* what the step contributes, so
 * naming those keys again by hand is transcription. Only top-level keys, and
 * only when the body is an object: anything deeper is a shape, not a value.
 */
export function setsFromPayload(payload: string | undefined): Record<string, string> | undefined {
  const text = payload?.trim();
  if (!text || !text.startsWith("{")) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const sets: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      sets[key] =
        typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
    }
    return Object.keys(sets).length > 0 ? sets : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Text pasted into a key field, read as values — or `null` for text that is not
 * shaped like values at all, which the browser then pastes as it always did.
 *
 * Two shapes are worth recognising: a block of `key: value` lines, and a JSON
 * object, which is the same rule `setsFromPayload` applies to a body. The split
 * is on the *first* colon, so a value holding one — a URL, a timestamp — stays
 * whole rather than being cut at its scheme.
 *
 * A single line is left alone. Someone pasting one thing into one field means to
 * fill that field, and a lone `https://url.sh/x` would otherwise become a key
 * `https` holding `//url.sh/x`.
 */
export function valuesFromPaste(text: string): Record<string, string> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) return setsFromPayload(trimmed) ?? null;

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const values: Record<string, string> = {};
  for (const line of lines) {
    const at = line.indexOf(":");
    if (at <= 0) return null;
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return values;
}

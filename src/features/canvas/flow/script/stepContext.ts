/**
 * Turning what a step introduces, consumes and expects into text and back.
 *
 * Pure on purpose and in a file of its own: the editor above it is a component,
 * and these are the rules the reading depends on being right — worth testing
 * without rendering anything.
 */

/**
 * One row of the values a step introduces, with an identity of its own.
 *
 * The identity is the point. These used to be lines of `key: value` text that
 * were parsed on every keystroke and formatted back into the field, so typing
 * `score` turned the first character into a whole `s: ` line and everything
 * after it into the value. Rows are edited as rows; nothing is parsed, so there
 * is nothing to reformat, and a half-typed key is just a key that is half typed.
 */
export interface SetRow {
  id: string;
  key: string;
  value: string;
}

let rowSeq = 0;

export function newSetRow(key = "", value = ""): SetRow {
  rowSeq += 1;
  return { id: `set-${rowSeq}`, key, value };
}

export function toSetRows(sets: Record<string, string> | undefined): SetRow[] {
  return Object.entries(sets ?? {}).map(([key, value]) => newSetRow(key, value));
}

/** A row with no key is one someone is still starting; it reaches nothing. */
export function fromSetRows(rows: readonly SetRow[]): Record<string, string> | undefined {
  const sets: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) sets[key] = row.value;
  }
  return Object.keys(sets).length > 0 ? sets : undefined;
}

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

export function parseReads(text: string): string[] | undefined {
  const reads = text
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  return reads.length > 0 ? reads : undefined;
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
 * Text pasted into a key cell, read as rows — or `null` for text that is not
 * shaped like values at all, which the browser then pastes as it always did.
 *
 * Two shapes are worth recognising: a block of `key: value` lines, and a JSON
 * object, which is the same rule `setsFromPayload` applies to a body. The split
 * is on the *first* colon, so a value holding one — a URL, a timestamp — stays
 * whole rather than being cut at its scheme.
 *
 * A single line is left alone. Someone pasting one thing into one cell means to
 * fill that cell, and a lone `https://url.sh/x` would otherwise become a key
 * `https` holding `//url.sh/x`.
 */
export function rowsFromPaste(text: string): SetRow[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    const sets = setsFromPayload(trimmed);
    return sets ? toSetRows(sets) : null;
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const rows: SetRow[] = [];
  for (const line of lines) {
    const at = line.indexOf(":");
    if (at <= 0) return null;
    rows.push(newSetRow(line.slice(0, at).trim(), line.slice(at + 1).trim()));
  }
  return rows;
}

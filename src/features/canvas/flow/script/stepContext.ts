/**
 * Turning what a step introduces, consumes and expects into text and back.
 *
 * Pure on purpose and in a file of its own: the editor above it is a component,
 * and these are the rules the reading depends on being right — worth testing
 * without rendering anything.
 */

/** `key: value` per line, which is how a small object reads when typed. */
export function parseSets(text: string): Record<string, string> | undefined {
  const sets: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const at = trimmed.indexOf(":");
    // A line with no colon is a key someone has not finished typing. Keeping it
    // with an empty value lets them carry on rather than having it vanish.
    const key = (at < 0 ? trimmed : trimmed.slice(0, at)).trim();
    const value = at < 0 ? "" : trimmed.slice(at + 1).trim();
    if (key) sets[key] = value;
  }
  return Object.keys(sets).length > 0 ? sets : undefined;
}

export function formatSets(sets: Record<string, string> | undefined): string {
  if (!sets) return "";
  return Object.entries(sets)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
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

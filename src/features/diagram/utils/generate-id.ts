let _counter = 0;

/** Generate a unique ID with optional prefix (e.g. "el", "conn", "d", "flow", "folder", "svc"). */
export function generateId(prefix: string = "el"): string {
  return `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
}

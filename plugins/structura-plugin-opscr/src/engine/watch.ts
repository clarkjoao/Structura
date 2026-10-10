/**
 * Noticing changes made to the bound folder outside Structura (another editor, git): which files
 * to read again, and how their disk text merges into the pane's buffers without ever overwriting
 * an unsaved edit. Pure — the pane polls `folder.stats()` and reads the files this names.
 */

export interface FileStat {
  name: string;
  lastModified: number;
  size: number;
}

export interface WatchedBuffer {
  name: string;
  /** Text on disk, as last read or saved. */
  disk: string;
  /** Text in the editor. */
  text: string;
  /** Disk text that changed under an unsaved edit, until the user picks a side. */
  conflict?: string;
}

export type Stats = Record<string, Omit<FileStat, "name">>;

export const toStats = (list: readonly FileStat[]): Stats =>
  Object.fromEntries(list.map(({ name, ...stat }) => [name, stat]));

/** Tracked files that are new, gone, or whose time or size moved since `known`. */
export function changedFiles(
  known: Stats,
  current: readonly FileStat[],
  tracked: (name: string) => boolean,
): { read: string[]; removed: string[] } {
  const now = toStats(current.filter((f) => tracked(f.name)));
  const read = Object.keys(now).filter(
    (name) =>
      !known[name] ||
      known[name]!.lastModified !== now[name]!.lastModified ||
      known[name]!.size !== now[name]!.size,
  );
  const removed = Object.keys(known).filter((name) => tracked(name) && !now[name]);
  return { read, removed };
}

export interface Merge<B extends WatchedBuffer> {
  buffers: B[];
  /** Files whose editor text changed (reloaded, added or removed). */
  reloaded: string[];
  /** Files now in conflict. */
  conflicts: string[];
}

/**
 * Disk texts into buffers. A clean buffer takes the disk text; a dirty one keeps the user's text
 * and records the disk text as a conflict — unless both already agree. A file removed from disk
 * disappears when clean and stays (to be saved again) when dirty. `machine` names files the app
 * writes itself (the layout sidecar): they always keep a buffer and the disk text always wins.
 */
export function mergeDisk<B extends WatchedBuffer>(
  buffers: readonly B[],
  disk: Readonly<Record<string, string>>,
  removed: readonly string[],
  machine: (name: string) => boolean = () => false,
): Merge<B> {
  const reloaded: string[] = [];
  const conflicts: string[] = [];
  const gone = new Set(removed);
  const next: B[] = [];
  for (const buffer of buffers) {
    const text = disk[buffer.name];
    if (gone.has(buffer.name)) {
      const clean = buffer.text === buffer.disk || machine(buffer.name);
      if (clean && !machine(buffer.name)) {
        reloaded.push(buffer.name);
        continue;
      }
      if (clean) {
        if (buffer.text !== "") reloaded.push(buffer.name);
        next.push({ ...buffer, disk: "", text: "", conflict: undefined });
      } else next.push({ ...buffer, disk: "" });
      continue;
    }
    if (text === undefined) {
      next.push(buffer);
      continue;
    }
    if (text === buffer.disk) {
      // Back to the text the edit started from (a checkout): nothing conflicts any more.
      next.push(buffer.conflict === undefined ? buffer : { ...buffer, conflict: undefined });
      continue;
    }
    if (buffer.text === buffer.disk || machine(buffer.name)) {
      reloaded.push(buffer.name);
      next.push({ ...buffer, disk: text, text, conflict: undefined });
    } else if (buffer.text === text) {
      next.push({ ...buffer, disk: text, conflict: undefined });
    } else {
      conflicts.push(buffer.name);
      next.push({ ...buffer, conflict: text });
    }
  }
  const known = new Set(buffers.map((b) => b.name));
  for (const [name, text] of Object.entries(disk)) {
    if (known.has(name)) continue;
    reloaded.push(name);
    next.push({ name, disk: text, text } as B);
  }
  return { buffers: next, reloaded, conflicts };
}

/** The user's choice for a conflicted buffer. */
export function resolveConflict<B extends WatchedBuffer>(buffer: B, side: "disk" | "mine"): B {
  if (buffer.conflict === undefined) return buffer;
  const { conflict, ...rest } = buffer;
  return (
    side === "disk" ? { ...rest, disk: conflict, text: conflict } : { ...rest, disk: conflict }
  ) as B;
}

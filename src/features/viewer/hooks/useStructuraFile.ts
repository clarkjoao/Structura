import { useCallback, useEffect, useRef, useState } from "react";
import type { Diagram } from "@/features/diagram/model";

/**
 * A `.structura.json` on disk, watched for changes.
 *
 * **Why the file has to be picked rather than opened from the `path` query
 * parameter.** A page cannot open an arbitrary path; the File System Access
 * API only hands out a handle the user chose in the picker, and that is a
 * platform rule, not a gap here. So `path` is a label — it tells the reader
 * which file the caller meant — and the handle comes from one click on it.
 * `fetch` was the alternative and is worse: it reaches the dev server's own
 * files, not the user's, so it cannot open what the caller is naming either.
 *
 * **Watching.** `FileSystemObserver` is used where the browser has it (Chrome
 * 129+, behind no flag since 133) because it reports a write instead of being
 * asked about one. Everywhere else, `getFile()` every 500ms and compare
 * `lastModified` — a `File` is a cheap snapshot of the handle's metadata, so
 * this is not a read of the contents, and 500ms is under what a reader
 * notices while staying far away from a busy loop.
 */

const POLL_MS = 500;

interface FilePickerWindow {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
}

interface ObserverWindow {
  FileSystemObserver?: new (callback: () => void) => {
    observe: (handle: FileSystemFileHandle) => Promise<void>;
    disconnect: () => void;
  };
}

export function isFilePickerSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export type FileSourceState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; diagram: Diagram; readAt: number }
  | { status: "error"; message: string };

/**
 * The diagram inside a Structura file.
 *
 * Two shapes are accepted because both are things the user already has: a
 * bare `Diagram`, and a persisted workspace payload, from which the diagram
 * named by `activeDiagramId` is taken (or the only one, when there is one).
 */
export function diagramFromFileText(text: string): Diagram {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("not-a-diagram");

  const candidate = parsed as Record<string, unknown>;
  if ("snapshot" in candidate && "id" in candidate) return candidate as unknown as Diagram;

  const state = (candidate.state ?? candidate) as Record<string, unknown>;
  const diagrams = state.diagrams as Record<string, Diagram> | undefined;
  if (!diagrams) throw new Error("not-a-diagram");

  const activeId = state.activeDiagramId;
  const chosen =
    typeof activeId === "string" && diagrams[activeId]
      ? diagrams[activeId]
      : Object.values(diagrams)[0];
  if (!chosen) throw new Error("not-a-diagram");
  return chosen;
}

export function useStructuraFile(): {
  state: FileSourceState;
  pick: () => Promise<void>;
  supported: boolean;
} {
  const [state, setState] = useState<FileSourceState>({ status: "idle" });
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const lastModifiedRef = useRef<number>(-1);

  const readHandle = useCallback(async (handle: FileSystemFileHandle, force: boolean) => {
    const file = await handle.getFile();
    if (!force && file.lastModified === lastModifiedRef.current) return;
    lastModifiedRef.current = file.lastModified;
    try {
      setState({
        status: "ready",
        diagram: diagramFromFileText(await file.text()),
        // Part of the state on purpose: a save that changes the file back to
        // something it already was still has to re-render, and without this
        // the diagram object could compare equal and the picture would freeze
        // on a file that is visibly different on disk.
        readAt: file.lastModified,
      });
    } catch {
      setState({ status: "error", message: "invalid-file" });
    }
  }, []);

  const pick = useCallback(async () => {
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) return;
    let handle: FileSystemFileHandle;
    try {
      [handle] = await picker({
        multiple: false,
        types: [{ description: "Structura", accept: { "application/json": [".json"] } }],
      });
    } catch {
      return; // the reader closed the picker; not an error worth showing
    }
    handleRef.current = handle;
    setState({ status: "reading" });
    await readHandle(handle, true);
  }, [readHandle]);

  useEffect(() => {
    const handle = handleRef.current;
    if (state.status !== "ready" || !handle) return;

    const Observer = (window as ObserverWindow).FileSystemObserver;
    if (Observer) {
      const observer = new Observer(() => void readHandle(handle, false));
      void observer.observe(handle);
      return () => observer.disconnect();
    }

    const timer = window.setInterval(() => void readHandle(handle, false), POLL_MS);
    return () => window.clearInterval(timer);
  }, [state.status, state.status === "ready" ? state.readAt : 0, readHandle]);

  return { state, pick, supported: isFilePickerSupported() };
}

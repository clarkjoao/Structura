import type { Diagram, Folder, IconDefinition } from "@/features/diagram";
import type { Journey } from "@/features/journeys";
import { normalizeImportedDiagram } from "@/lib/export-service/normalize-imported-diagram";
import { FileSystemEntryKind } from "@/lib/enums";
import type { CustomComponentTemplate } from "@/features/custom-components";
import i18n from "@/infrastructure/i18n";
import {
  validateDiagramFile,
  validateManifest,
} from "./validateWorkspaceFile";

const DB_NAME = "structura-fs";
const DB_STORE = "handles";
const HANDLE_KEY = "workspace-handle";
const MANIFEST_FILE = "structura-manifest.json";
const JOURNEYS_FILE = "structura-journeys.json";

type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemPermissionState = "granted" | "denied" | "prompt";

interface FileSystemPermissionRequest {
  mode?: FileSystemPermissionMode;
}

interface FileSystemDirectoryHandleWithPermissions extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor?: FileSystemPermissionRequest) => Promise<FileSystemPermissionState>;
  requestPermission?: (descriptor?: FileSystemPermissionRequest) => Promise<FileSystemPermissionState>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
}

type DirectoryEntryTuple = [string, FileSystemHandle];

function directoryEntries(
  dir: FileSystemDirectoryHandle,
): AsyncIterable<DirectoryEntryTuple> {
  return (dir as unknown as { entries: () => AsyncIterable<DirectoryEntryTuple> }).entries();
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToIDB(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function clearHandleFromIDB(): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = "readwrite"
): Promise<boolean> {
  const directoryHandle = handle as FileSystemDirectoryHandleWithPermissions;
  const opts = { mode };
  if ((await directoryHandle.queryPermission?.(opts)) === "granted") return true;
  if ((await directoryHandle.requestPermission?.(opts)) === "granted") return true;
  return false;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveDiagramPathSegments(
  diagram: Diagram,
  folders: Record<string, Folder>
): string[] {
  const segments: string[] = [];

  if (diagram.folderId) {
    const folderChain: Folder[] = [];
    let current: Folder | undefined = folders[diagram.folderId];
    while (current) {
      folderChain.unshift(current);
      current = current.parentId ? folders[current.parentId] : undefined;
    }
    segments.push(...folderChain.map((f) => slugify(f.name)));
  }

  if (diagram.domain?.trim()) {
    segments.push(slugify(diagram.domain.trim()));
  }

  return segments;
}

// ── Directory helper ──

async function getOrCreateDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}


export interface WorkspaceManifest {
  version: 1;
  createdAt: string;
  updatedAt: string;
  diagramIds: string[];
  serviceRegistry: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  customComponentTemplates?: Record<string, CustomComponentTemplate>;
  iconLibrary?: Record<string, IconDefinition>;
}

export type WorkspacePayload = {
  diagrams: Record<string, Diagram>;
  serviceRegistry: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  customComponentTemplates?: Record<string, CustomComponentTemplate>;
  iconLibrary?: Record<string, IconDefinition>;
};

// ── Scan result type ──

export interface WorkspaceScanResult {
  valid: Diagram[];
  invalid: { fileName: string; reason: string }[];
  manifest: WorkspaceManifest | null;
  manifestError: string | null;
  totalFilesScanned: number;
}

// ── Main class ──

export class FileSystemAdapter {
  private handle: FileSystemDirectoryHandle | null = null;
  private folders: Record<string, Folder> = {};

  get isConnected(): boolean {
    return this.handle !== null;
  }

  get folderName(): string | null {
    return this.handle?.name ?? null;
  }

  setFolders(folders: Record<string, Folder>): void {
    this.folders = folders;
  }

  async tryReconnect(): Promise<boolean> {
    try {
      const handle = await loadHandleFromIDB();
      if (!handle) return false;
      const ok = await verifyPermission(handle);
      if (!ok) return false;
      this.handle = handle;
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<boolean> {
    try {
      const windowWithDirectoryPicker = window as unknown as WindowWithDirectoryPicker;
      const picker = windowWithDirectoryPicker.showDirectoryPicker;
      if (!picker) return false;

      const handle = await picker({
        mode: "readwrite",
        startIn: "documents",
      });
      const ok = await verifyPermission(handle);
      if (!ok) return false;
      this.handle = handle;
      await saveHandleToIDB(handle);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.handle = null;
    await clearHandleFromIDB();
  }

  async writeDiagram(diagram: Diagram): Promise<void> {
    if (!this.handle) return;
    try {
      const segments = resolveDiagramPathSegments(diagram, this.folders);
      const dir = await getOrCreateDirectory(this.handle, segments);
      const file = await dir.getFileHandle(`${diagram.id}.json`, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(diagram, null, 2));
      await writable.close();
    } catch (e) {
      console.error("[FileSystemAdapter] writeDiagram failed:", e);
    }
  }

  async readDiagram(diagramId: string): Promise<Diagram | null> {
    if (!this.handle) return null;
    return this._findDiagramFile(this.handle, diagramId);
  }

  private async _findDiagramFile(
    dir: FileSystemDirectoryHandle,
    diagramId: string
  ): Promise<Diagram | null> {
    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && name === `${diagramId}.json`) {
        const f = await (entry as FileSystemFileHandle).getFile();
        return normalizeImportedDiagram(JSON.parse(await f.text()) as Diagram);
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const result = await this._findDiagramFile(
          entry as FileSystemDirectoryHandle,
          diagramId
        );
        if (result) return result;
      }
    }
    return null;
  }

  async deleteDiagram(diagramId: string, diagram?: Diagram): Promise<void> {
    if (!this.handle) return;
    try {
      const segments = diagram
        ? resolveDiagramPathSegments(diagram, this.folders)
        : [];
      const dir = await getOrCreateDirectory(this.handle, segments);
      await dir.removeEntry(`${diagramId}.json`);
    } catch {
      // Fallback: logical delete by overwriting the file with a tombstone payload.
      // This prevents the diagram from being re-imported on the next sync if physical deletion fails.
      try {
        const segments = diagram
          ? resolveDiagramPathSegments(diagram, this.folders)
          : [];
        const dir = await getOrCreateDirectory(this.handle, segments);
        const file = await dir.getFileHandle(`${diagramId}.json`, {
          create: true,
        });
        const writable = await file.createWritable();
        await writable.write(
          JSON.stringify(
            { deleted: true, id: diagramId, deletedAt: new Date().toISOString() },
            null,
            2
          )
        );
        await writable.close();
      } catch (error) {
        console.warn(
          "[StructuraContext] FileSystemAdapter deleteDiagram tombstone fallback failed",
          error,
        );
      }
    }
  }

  async writeManifest(manifest: WorkspaceManifest): Promise<void> {
    if (!this.handle) return;
    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(manifest, null, 2));
      await writable.close();
    } catch (e) {
      console.error("[FileSystemAdapter] writeManifest failed:", e);
    }
  }

  async writeJourneys(journeys: Record<string, Journey>): Promise<void> {
    if (!this.handle) return;
    try {
      const file = await this.handle.getFileHandle(JOURNEYS_FILE, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(journeys, null, 2));
      await writable.close();
    } catch (e) {
      console.error("[FileSystemAdapter] writeJourneys failed:", e);
    }
  }

  async readJourneys(): Promise<Record<string, Journey> | null> {
    if (!this.handle) return null;
    try {
      const file = await this.handle.getFileHandle(JOURNEYS_FILE);
      const fileBody = await file.getFile();
      return JSON.parse(await fileBody.text()) as Record<string, Journey>;
    } catch {
      return null;
    }
  }

  async readManifest(): Promise<WorkspaceManifest | null> {
    if (!this.handle) return null;
    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE);
      const f = await file.getFile();
      return JSON.parse(await f.text()) as WorkspaceManifest;
    } catch {
      return null;
    }
  }

  async loadWorkspace(): Promise<WorkspacePayload | null> {
    const manifest = await this.readManifest();
    if (!manifest) return null;

    const diagrams = await this._scanAllDiagrams(this.handle!);

    return {
      diagrams,
      serviceRegistry: manifest.serviceRegistry,
      folders: manifest.folders,
      activeDiagramId: manifest.activeDiagramId,
      customComponentTemplates: manifest.customComponentTemplates,
      iconLibrary: manifest.iconLibrary,
    };
  }

  async scanWorkspace(): Promise<WorkspaceScanResult> {
    if (!this.handle) throw new Error("No folder connected");

    const result: WorkspaceScanResult = {
      valid: [],
      invalid: [],
      manifest: null,
      manifestError: null,
      totalFilesScanned: 0,
    };

    await this._scanDirectory(this.handle, result);
    return result;
  }

  private async _scanDirectory(
    dir: FileSystemDirectoryHandle,
    result: WorkspaceScanResult
  ): Promise<void> {
    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && name.endsWith(".json")) {
        result.totalFilesScanned++;
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          const text = await f.text();

          let raw: unknown;
          try {
            raw = JSON.parse(text);
          } catch {
            result.invalid.push({
              fileName: name,
              reason: i18n.t("workspaceMerge.errors.invalidJson"),
            });
            continue;
          }

          if (name === MANIFEST_FILE) {
            const mv = validateManifest(raw);
            if (mv.valid === true) {
              result.manifest = mv.manifest;
            } else {
              result.manifestError = mv.reason;
            }
            continue;
          }

          if (name === JOURNEYS_FILE) {
            continue;
          }

          const dv = validateDiagramFile(raw);
          if (dv.valid === true) {
            result.valid.push(dv.diagram);
          } else {
            result.invalid.push({ fileName: name, reason: dv.reason });
          }
        } catch (e) {
          result.invalid.push({
            fileName: name,
            reason: i18n.t("workspaceMerge.errors.readFile", {
              message:
                e instanceof Error
                  ? e.message
                  : i18n.t("workspaceMerge.errors.unknown"),
            }),
          });
        }
      }

      if (entry.kind === FileSystemEntryKind.Directory) {
        await this._scanDirectory(
          entry as FileSystemDirectoryHandle,
          result
        );
      }
    }
  }

  private async _scanAllDiagrams(
    dir: FileSystemDirectoryHandle
  ): Promise<Record<string, Diagram>> {
    const result: Record<string, Diagram> = {};
    for await (const [name, entry] of directoryEntries(dir)) {
      if (
        entry.kind === FileSystemEntryKind.File &&
        name.endsWith(".json") &&
        name !== MANIFEST_FILE &&
        name !== JOURNEYS_FILE
      ) {
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          const raw = JSON.parse(await f.text()) as Record<string, unknown>;
          if (raw.deleted) continue;
          const diagram = normalizeImportedDiagram(raw as unknown as Diagram);
          if (diagram && diagram.id) {
            result[diagram.id] = diagram;
          }
        } catch (error) {
          console.warn("[StructuraContext] FileSystemAdapter scan diagram file skipped", name, error);
        }
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const nested = await this._scanAllDiagrams(
          entry as FileSystemDirectoryHandle
        );
        Object.assign(result, nested);
      }
    }
    return result;
  }
}

export const fileSystemAdapter = new FileSystemAdapter();

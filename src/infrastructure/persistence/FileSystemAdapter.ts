import type { Diagram, Folder, IconDefinition } from "@/features/diagram";
import type { Journey } from "@/features/walkthroughs";
import { normalizeImportedDiagram } from "@/lib/export-service/normalize-imported-diagram";
import { FileSystemEntryKind } from "@/features/diagram";
import type { CustomComponentTemplate } from "@/features/custom-components";
import i18n from "@/infrastructure/i18n";
import {
  isDiagramTombstoneJson,
  validateDiagramFile,
  validateManifest,
} from "./validateWorkspaceFile";

const MAX_DIRECTORY_SCAN_DEPTH = 64;

const DB_NAME = "structura-fs";
const DB_STORE = "handles";
const HANDLE_KEY = "workspace-handle";
const MANIFEST_FILE = "structura-manifest.json";
const JOURNEYS_FILE = "structura-walkthroughs.json";

type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemPermissionState = "granted" | "denied" | "prompt";

interface FileSystemPermissionRequest {
  mode?: FileSystemPermissionMode;
}

interface FileSystemDirectoryHandleWithPermissions extends FileSystemDirectoryHandle {
  queryPermission?: (
    descriptor?: FileSystemPermissionRequest,
  ) => Promise<FileSystemPermissionState>;
  requestPermission?: (
    descriptor?: FileSystemPermissionRequest,
  ) => Promise<FileSystemPermissionState>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
}

type DirectoryEntryTuple = [string, FileSystemHandle];

function directoryEntries(dir: FileSystemDirectoryHandle): AsyncIterable<DirectoryEntryTuple> {
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

async function saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
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
  mode: FileSystemPermissionMode = "readwrite",
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

function resolveDiagramPathSegments(diagram: Diagram, folders: Record<string, Folder>): string[] {
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

async function getOrCreateDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

export interface WorkspaceManifest {
  version: 1 | 2;
  createdAt: string;
  updatedAt: string;
  diagramIds: string[];
  serviceCatalog: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  customComponentTemplates?: Record<string, CustomComponentTemplate>;
  iconLibrary?: Record<string, IconDefinition>;
}

export type WorkspacePayload = {
  diagrams: Record<string, Diagram>;
  serviceCatalog: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  /** ISO timestamp from manifest; used for merge/reconnect conflict resolution. */
  manifestUpdatedAt?: string;
  customComponentTemplates?: Record<string, CustomComponentTemplate>;
  iconLibrary?: Record<string, IconDefinition>;
};

export interface WorkspaceScanResult {
  valid: Diagram[];
  invalid: { fileName: string; reason: string }[];
  manifest: WorkspaceManifest | null;
  manifestError: string | null;
  totalFilesScanned: number;
}

export class FileSystemAdapter {
  private handle: FileSystemDirectoryHandle | null = null;
  private folders: Record<string, Folder> = {};
  /** Handle loaded from IDB that still requires a user-gesture permission request. */
  private _pendingHandle: FileSystemDirectoryHandle | null = null;

  get isConnected(): boolean {
    return this.handle !== null;
  }

  get folderName(): string | null {
    return this.handle?.name ?? null;
  }

  /** True when a handle was found in IDB but requires a user gesture to grant readwrite access. */
  get needsPermission(): boolean {
    return this._pendingHandle !== null && this.handle === null;
  }

  get pendingFolderName(): string | null {
    return this._pendingHandle?.name ?? null;
  }

  setFolders(folders: Record<string, Folder>): void {
    this.folders = folders;
  }

  /**
   * Attempts silent reconnection using only queryPermission (no user gesture required).
   * If permission is "prompt", saves the handle as _pendingHandle so the user can
   * later trigger requestReconnectPermission() from a click handler.
   */
  async tryReconnect(): Promise<boolean> {
    try {
      const handle = await loadHandleFromIDB();
      if (!handle) return false;

      const directoryHandle = handle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });

      if (state === "granted") {
        this.handle = handle;
        this._pendingHandle = null;
        return true;
      }

      if (state === "prompt") {
        // Store for user-gesture-triggered permission request; don't attempt requestPermission here.
        this._pendingHandle = handle;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Must be called from a user gesture (click handler).
   * Requests readwrite permission for the pending handle and, if granted, activates the connection.
   */
  async requestReconnectPermission(): Promise<boolean> {
    if (!this._pendingHandle) return false;
    try {
      const directoryHandle = this._pendingHandle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.requestPermission?.({ mode: "readwrite" });
      if (state === "granted") {
        this.handle = this._pendingHandle;
        this._pendingHandle = null;
        return true;
      }
      return false;
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
    this._pendingHandle = null;
    await clearHandleFromIDB();
  }

  computePathSegments(diagram: Diagram): string[] {
    return resolveDiagramPathSegments(diagram, this.folders);
  }

  async deleteAtSegments(diagramId: string, segments: string[]): Promise<void> {
    if (!this.handle) return;
    try {
      const dir = await getOrCreateDirectory(this.handle, segments);
      await dir.removeEntry(`${diagramId}.json`);
    } catch {
      // File may not exist at this path (already moved/deleted), not an error
    }
  }

  async writeDiagram(diagram: Diagram): Promise<boolean> {
    if (!this.handle) return false;
    try {
      const segments = resolveDiagramPathSegments(diagram, this.folders);
      const dir = await getOrCreateDirectory(this.handle, segments);
      const file = await dir.getFileHandle(`${diagram.id}.json`, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(diagram, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      console.error("[FileSystemAdapter] writeDiagram failed:", e);
      return false;
    }
  }

  async readDiagram(diagramId: string): Promise<Diagram | null> {
    if (!this.handle) return null;
    return this._findDiagramFile(this.handle, diagramId);
  }

  private async _findDiagramFile(
    dir: FileSystemDirectoryHandle,
    diagramId: string,
    depth = 0,
  ): Promise<Diagram | null> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) return null;
    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && name === `${diagramId}.json`) {
        const f = await (entry as FileSystemFileHandle).getFile();
        const raw = JSON.parse(await f.text());
        const validation = validateDiagramFile(raw);
        return validation.valid ? validation.diagram : null;
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const result = await this._findDiagramFile(
          entry as FileSystemDirectoryHandle,
          diagramId,
          depth + 1,
        );
        if (result) return result;
      }
    }
    return null;
  }

  async deleteDiagram(diagramId: string, diagram?: Diagram): Promise<void> {
    if (!this.handle) return;
    try {
      const segments = diagram ? resolveDiagramPathSegments(diagram, this.folders) : [];
      const dir = await getOrCreateDirectory(this.handle, segments);
      await dir.removeEntry(`${diagramId}.json`);
    } catch {
      try {
        const segments = diagram ? resolveDiagramPathSegments(diagram, this.folders) : [];
        const dir = await getOrCreateDirectory(this.handle, segments);
        const file = await dir.getFileHandle(`${diagramId}.json`, {
          create: true,
        });
        const writable = await file.createWritable();
        await writable.write(
          JSON.stringify(
            { deleted: true, id: diagramId, deletedAt: new Date().toISOString() },
            null,
            2,
          ),
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

  async writeManifest(manifest: WorkspaceManifest): Promise<boolean> {
    if (!this.handle) return false;
    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(manifest, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      console.error("[FileSystemAdapter] writeManifest failed:", e);
      return false;
    }
  }

  /** Single-file workspace export; large journey sets may warrant sharding in a future schema. */
  async writeWalkthroughs(walkthroughs: Record<string, Journey>): Promise<boolean> {
    if (!this.handle) return false;
    try {
      const file = await this.handle.getFileHandle(JOURNEYS_FILE, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(walkthroughs, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      console.error("[FileSystemAdapter] writeWalkthroughs failed:", e);
      return false;
    }
  }

  async readWalkthroughs(): Promise<Record<string, Journey> | null> {
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

    let activeDiagramId = manifest.activeDiagramId;
    if (activeDiagramId && !diagrams[activeDiagramId]) {
      activeDiagramId = Object.keys(diagrams)[0] ?? null;
    }

    return {
      diagrams,
      serviceCatalog: manifest.serviceCatalog,
      folders: manifest.folders,
      activeDiagramId,
      manifestUpdatedAt: manifest.updatedAt,
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
    result: WorkspaceScanResult,
    depth = 0,
  ): Promise<void> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) return;

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
              message: e instanceof Error ? e.message : i18n.t("workspaceMerge.errors.unknown"),
            }),
          });
        }
      }

      if (entry.kind === FileSystemEntryKind.Directory) {
        await this._scanDirectory(entry as FileSystemDirectoryHandle, result, depth + 1);
      }
    }
  }

  private async _scanAllDiagrams(
    dir: FileSystemDirectoryHandle,
    depth = 0,
  ): Promise<Record<string, Diagram>> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) {
      return {};
    }
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
          const rawUnknown: unknown = JSON.parse(await f.text());
          if (isDiagramTombstoneJson(rawUnknown)) continue;
          const validation = validateDiagramFile(rawUnknown);
          if (validation.valid && validation.diagram.id) {
            result[validation.diagram.id] = validation.diagram;
          }
        } catch (error) {
          console.warn(
            "[StructuraContext] FileSystemAdapter scan diagram file skipped",
            name,
            error,
          );
        }
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const nested = await this._scanAllDiagrams(entry as FileSystemDirectoryHandle, depth + 1);
        Object.assign(result, nested);
      }
    }
    return result;
  }
}

export const fileSystemAdapter = new FileSystemAdapter();

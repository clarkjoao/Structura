import type { ExporterContribution, ImporterContribution } from "./plugin.types";

/**
 * Registry for plugin importers/exporters. Built-in formats stay on the
 * `DiagramExportFormat` union in `lib/export-service`; plugin contributions are offered
 * alongside them by the import/export UI (which subscribes here for reactivity).
 */

const importers = new Map<string, ImporterContribution>();
const exporters = new Map<string, ExporterContribution>();
const listeners = new Set<() => void>();

let snapshot: { importers: ImporterContribution[]; exporters: ExporterContribution[] } = {
  importers: [],
  exporters: [],
};

function notifyChanged(): void {
  snapshot = { importers: [...importers.values()], exporters: [...exporters.values()] };
  for (const listener of listeners) listener();
}

export function registerImporterContribution(contribution: ImporterContribution): void {
  if (importers.has(contribution.id)) {
    throw new Error(`[plugins] An importer with id "${contribution.id}" is already registered.`);
  }
  importers.set(contribution.id, contribution);
  notifyChanged();
}

export function registerExporterContribution(contribution: ExporterContribution): void {
  if (exporters.has(contribution.id)) {
    throw new Error(`[plugins] An exporter with id "${contribution.id}" is already registered.`);
  }
  exporters.set(contribution.id, contribution);
  notifyChanged();
}

export function unregisterImporterContribution(id: string): void {
  if (importers.delete(id)) notifyChanged();
}

export function unregisterExporterContribution(id: string): void {
  if (exporters.delete(id)) notifyChanged();
}

export function getImporterContribution(id: string): ImporterContribution | undefined {
  return importers.get(id);
}

export function getExporterContribution(id: string): ExporterContribution | undefined {
  return exporters.get(id);
}

/** Stable snapshot for useSyncExternalStore; new identity after every change. */
export function getIoRegistrySnapshot(): {
  importers: ImporterContribution[];
  exporters: ExporterContribution[];
} {
  return snapshot;
}

export function subscribeIoRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Importers able to handle the given file, by extension and optional content sniffing. */
export function findImportersForFile(fileName: string, contents: string): ImporterContribution[] {
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  return snapshot.importers.filter((importer) => {
    if (!importer.extensions.map((e) => e.toLowerCase()).includes(extension)) return false;
    return importer.canImport ? importer.canImport(fileName, contents) : true;
  });
}

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions, useDiagramStore } from "@/features/diagram";
import {
  allDiagramComponents,
  buildFallbackEntries,
  buildServiceRelinkPlan,
  planNeedsReview,
  type ServiceRelinkPlan,
} from "@/features/integrations/service-matching";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";
import { applyServiceRelink, type ServiceRelinkDecisions } from "./apply-service-relink";
import {
  ensureFolderPath,
  folderSegmentsFromRelativePath,
  isImportableDiagramFileName,
} from "./import-folder-path";

interface UseWorkspaceImportOptions {
  /** When set, the new diagram is moved into this folder after import (if it still exists). */
  targetFolderId?: string | null;
}

/** A validated diagram waiting on the user's service-relink decisions. */
interface PendingRelink {
  diagram: Diagram;
  plan: ServiceRelinkPlan;
  /** Folder to place the diagram in after confirm (null = root). */
  destinationFolderId: string | null;
  /** Open the diagram after import (single-file flow only). */
  openAfterImport: boolean;
}

export interface ImportJsonSource {
  /** File name or basename for errors. */
  name: string;
  text: string;
  /**
   * Relative path when importing a folder tree (webkitRelativePath).
   * Folder segments are created under `targetFolderId`.
   */
  relativePath?: string;
}

export interface ImportJsonBatchResult {
  imported: number;
  failed: number;
  pendingRelink: number;
}

/**
 * Rename a diagram for import by appending " - imported" and the date.
 *
 * The file's own `folderId` is dropped here: it names a folder in the workspace the diagram
 * was exported from, not in this one. The store enforces the same rule (see
 * `reparentOrphanDiagram`); dropping it here keeps the intent visible at the call site.
 * `finishImport` then moves the diagram into the destination folder when that folder exists.
 */
function renameForImport(diagram: Diagram, locale: string): Diagram {
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const { folderId: _sourceFolderId, ...rest } = diagram;

  return {
    ...rest,
    id: crypto.randomUUID(),
    name: `${diagram.name} - imported ${dateStr}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function resolveDestinationFolderId(
  relativePath: string | undefined,
  targetFolderId: string | null | undefined,
): string | null {
  const baseParentId = targetFolderId ?? null;
  const folders = useDiagramStore.getState().folders;
  if (baseParentId !== null && folders[baseParentId] === undefined) {
    // Import was opened from a folder that no longer exists — land at root.
    return resolveDestinationFolderId(relativePath, null);
  }

  const segments = relativePath ? folderSegmentsFromRelativePath(relativePath) : [];
  if (segments.length === 0) return baseParentId;

  const { addFolder } = useDiagramStore.getState();
  return ensureFolderPath(
    segments,
    baseParentId,
    () => useDiagramStore.getState().folders,
    (name, parentId) => addFolder(name, parentId),
  );
}

export function useWorkspaceImport(options: UseWorkspaceImportOptions = {}) {
  const { targetFolderId } = options;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { importDiagram, openDiagram, moveDiagram } = useDiagramActions();
  const [relinkQueue, setRelinkQueue] = useState<PendingRelink[]>([]);

  const finishImport = useCallback(
    (diagram: Diagram, destinationFolderId: string | null, openAfterImport: boolean) => {
      const renamed = renameForImport(diagram, i18n.language);
      const imported = importDiagram(renamed);
      if (destinationFolderId) {
        moveDiagram(imported.id, destinationFolderId);
      }
      if (openAfterImport) {
        openDiagram(imported.id);
        navigate(`/model/${imported.id}`);
      }
      return imported;
    },
    [importDiagram, moveDiagram, navigate, openDiagram, i18n.language],
  );

  const tryImportParsed = useCallback(
    (
      parsed: unknown,
      destinationFolderId: string | null,
      openAfterImport: boolean,
    ): "imported" | "pending" | "failed" => {
      const validation = validateDiagramFile(parsed);
      if (!validation.valid) {
        toast.error(t("import.jsonErrorWithReason", { reason: validation.reason }));
        return "failed";
      }

      const components = allDiagramComponents(validation.diagram);
      const entries = validation.services ?? buildFallbackEntries(components);
      const plan = buildServiceRelinkPlan({
        entries,
        components,
        localCatalog: useDiagramStore.getState().serviceCatalog,
      });

      if (planNeedsReview(plan)) {
        setRelinkQueue((prev) => [
          ...prev,
          {
            diagram: validation.diagram,
            plan,
            destinationFolderId,
            openAfterImport,
          },
        ]);
        return "pending";
      }

      finishImport(validation.diagram, destinationFolderId, openAfterImport);
      return "imported";
    },
    [finishImport, t],
  );

  const importJsonText = useCallback(
    (text: string): boolean => {
      try {
        const parsed = JSON.parse(text) as unknown;
        const destination = resolveDestinationFolderId(undefined, targetFolderId);
        const outcome = tryImportParsed(parsed, destination, true);
        return outcome !== "failed";
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Invalid JSON";
        toast.error(t("import.jsonErrorWithReason", { reason }));
        return false;
      }
    },
    [t, targetFolderId, tryImportParsed],
  );

  const importJsonSources = useCallback(
    (sources: ImportJsonSource[]): ImportJsonBatchResult => {
      const importable = sources.filter((source) => isImportableDiagramFileName(source.name));
      const openAfterImport = importable.length === 1;
      let imported = 0;
      let failed = 0;
      let pendingRelink = 0;

      for (const source of importable) {
        try {
          const parsed = JSON.parse(source.text) as unknown;
          const destination = resolveDestinationFolderId(source.relativePath, targetFolderId);
          const outcome = tryImportParsed(parsed, destination, openAfterImport);
          if (outcome === "imported") imported += 1;
          else if (outcome === "pending") pendingRelink += 1;
          else failed += 1;
        } catch (err) {
          failed += 1;
          const reason = err instanceof Error ? err.message : "Invalid JSON";
          toast.error(t("import.jsonErrorNamed", { name: source.name, reason }));
        }
      }

      if (imported > 0 && pendingRelink === 0) {
        toast.success(
          imported === 1 ? t("import.successOne") : t("import.successMany", { count: imported }),
        );
      } else if (pendingRelink > 0 && imported > 0) {
        toast.success(t("import.successPartial", { imported, pending: pendingRelink }));
      }

      return { imported, failed, pendingRelink };
    },
    [t, targetFolderId, tryImportParsed],
  );

  const confirmRelink = useCallback(
    (decisions: ServiceRelinkDecisions) => {
      const [current, ...rest] = relinkQueue;
      if (!current) return;
      const diagram = applyServiceRelink(current.diagram, decisions);
      setRelinkQueue(rest);
      finishImport(
        diagram,
        current.destinationFolderId,
        current.openAfterImport && rest.length === 0,
      );
      if (rest.length === 0) {
        toast.success(t("import.successOne"));
      }
    },
    [finishImport, relinkQueue, t],
  );

  const cancelRelink = useCallback(() => setRelinkQueue([]), []);

  return {
    importJsonText,
    importJsonSources,
    /** Non-null while the user is reviewing which services to reconnect. */
    pendingRelinkPlan: relinkQueue[0]?.plan ?? null,
    confirmRelink,
    cancelRelink,
  };
}

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

interface UseWorkspaceImportOptions {
  /** When set, the new diagram is moved into this folder after import. */
  targetFolderId?: string | null;
}

/** A validated diagram waiting on the user's service-relink decisions. */
interface PendingRelink {
  diagram: Diagram;
  plan: ServiceRelinkPlan;
}

/**
 * Rename a diagram for import by appending " - imported" and the date.
 *
 * The file's own `folderId` is dropped here: it names a folder in the workspace the diagram
 * was exported from, not in this one. The store enforces the same rule (see
 * `reparentOrphanDiagram`); dropping it here keeps the intent visible at the call site.
 * `finishImport` then moves the diagram into `targetFolderId` when the import was launched
 * from inside a folder.
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
    id: crypto.randomUUID(), // Generate new ID to avoid conflicts
    name: `${diagram.name} - imported ${dateStr}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function useWorkspaceImport(options: UseWorkspaceImportOptions = {}) {
  const { targetFolderId } = options;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { importDiagram, openDiagram, moveDiagram } = useDiagramActions();
  const [pendingRelink, setPendingRelink] = useState<PendingRelink | null>(null);

  const finishImport = useCallback(
    (diagram: Diagram) => {
      const renamed = renameForImport(diagram, i18n.language);
      const imported = importDiagram(renamed);
      if (targetFolderId) {
        moveDiagram(imported.id, targetFolderId);
      }
      openDiagram(imported.id);
      navigate(`/model/${imported.id}`);
    },
    [importDiagram, moveDiagram, navigate, openDiagram, targetFolderId, i18n.language],
  );

  const importJsonText = useCallback(
    (text: string): boolean => {
      try {
        const parsed = JSON.parse(text) as unknown;
        const validation = validateDiagramFile(parsed);
        if (!validation.valid) {
          toast.error(t("import.jsonErrorWithReason", { reason: validation.reason }));
          return false;
        }

        // A component only stores a `serviceId`, and that id is local to the workspace that
        // produced the file. Reconcile it against this catalog before the diagram is written,
        // so the whole import stays a single store write.
        const components = allDiagramComponents(validation.diagram);
        const entries = validation.services ?? buildFallbackEntries(components);
        const plan = buildServiceRelinkPlan({
          entries,
          components,
          localCatalog: useDiagramStore.getState().serviceCatalog,
        });

        if (planNeedsReview(plan)) {
          setPendingRelink({ diagram: validation.diagram, plan });
          return true;
        }

        finishImport(validation.diagram);
        return true;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Invalid JSON";
        toast.error(t("import.jsonErrorWithReason", { reason }));
        return false;
      }
    },
    [finishImport, t],
  );

  const confirmRelink = useCallback(
    (decisions: ServiceRelinkDecisions) => {
      if (!pendingRelink) return;
      const diagram = applyServiceRelink(pendingRelink.diagram, decisions);
      setPendingRelink(null);
      finishImport(diagram);
    },
    [finishImport, pendingRelink],
  );

  const cancelRelink = useCallback(() => setPendingRelink(null), []);

  return {
    importJsonText,
    /** Non-null while the user is reviewing which services to reconnect. */
    pendingRelinkPlan: pendingRelink?.plan ?? null,
    confirmRelink,
    cancelRelink,
  };
}

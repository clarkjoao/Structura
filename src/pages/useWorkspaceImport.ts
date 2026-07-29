import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";

interface UseWorkspaceImportOptions {
  /** When set, the new diagram is moved into this folder after import. */
  targetFolderId?: string | null;
}

/**
 * Rename a diagram for import by appending " - imported" and the date.
 */
function renameForImport(diagram: Diagram, locale: string): Diagram {
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    ...diagram,
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

  return { importJsonText };
}

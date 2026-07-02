import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions } from "@/features/diagram";
import { importStructurizr } from "@/lib/export-service";
import { validateDiagramFile } from "@/infrastructure/persistence/validateWorkspaceFile";

interface UseWorkspaceImportOptions {
  /** When set, the new diagram is moved into this folder after import. */
  targetFolderId?: string | null;
}

export function useWorkspaceImport(options: UseWorkspaceImportOptions = {}) {
  const { targetFolderId } = options;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { importDiagram, openDiagram, moveDiagram } = useDiagramActions();

  const finishImport = useCallback(
    (diagram: Diagram) => {
      const imported = importDiagram(diagram);
      if (targetFolderId) {
        moveDiagram(imported.id, targetFolderId);
      }
      openDiagram(imported.id);
      navigate(`/model/${imported.id}`);
    },
    [importDiagram, moveDiagram, navigate, openDiagram, targetFolderId],
  );

  const importJsonText = useCallback(
    (text: string): boolean => {
      try {
        const parsed = JSON.parse(text) as unknown;
        const validation = validateDiagramFile(parsed);
        if (!validation.valid) {
          toast.error(t("import.jsonError"));
          return false;
        }
        finishImport(validation.diagram);
        return true;
      } catch {
        toast.error(t("import.jsonError"));
        return false;
      }
    },
    [finishImport, t],
  );

  const importDslText = useCallback(
    (text: string): boolean => {
      try {
        const diagram = importStructurizr(text);
        finishImport(diagram);
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("import.structurizrError"));
        return false;
      }
    },
    [finishImport, t],
  );

  return { importJsonText, importDslText };
}

import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GithubImportPanel } from "@/features/integrations/github/components/GithubImportPanel";
import { ImportPanel } from "@/features/integrations/import-panel";
import type { ServiceDefinition } from "@/features/diagram";
import { ManualCreateForm } from "./ManualCreateForm";

const DefectDojoPanel = lazy(() =>
  import("@/features/integrations/defectdojo").then((m) => ({
    default: m.DefectDojoPanel,
  })),
);

interface AddServiceDialogProps {
  panel: ImportPanel | null;
  onPanelChange: (panel: ImportPanel | null) => void;
  onCreate: (svc: Omit<ServiceDefinition, "id">) => void;
}

/** Overlay for adding services; the list behind it does not move. */
export function AddServiceDialog({ panel, onPanelChange, onCreate }: AddServiceDialogProps) {
  const { t } = useTranslation();
  const showEnableGithub = import.meta.env.VITE_ENABLE_GITHUB_IMPORT === "true";
  const showEnableDefectDojo = import.meta.env.VITE_ENABLE_DEFECTDOJO === "true";
  const importPanel = panel;
  const onClose = () => onPanelChange(null);

  return (
    <Dialog open={panel !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-[680px] overflow-y-auto">
        <DialogTitle>{t("services.addServiceTitle")}</DialogTitle>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-secondary p-1">
              <button
                onClick={() => onPanelChange(ImportPanel.Manual)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  importPanel === ImportPanel.Manual
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("services.importManual")}
              </button>
              {showEnableGithub && (
                <button
                  onClick={() => onPanelChange(ImportPanel.Github)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    importPanel === ImportPanel.Github
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("services.importGithub")}
                </button>
              )}
              {showEnableDefectDojo && (
                <button
                  onClick={() => onPanelChange(ImportPanel.Defectdojo)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    importPanel === ImportPanel.Defectdojo
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("services.importDefectDojo")}
                </button>
              )}
            </div>
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-secondary" />}>
            {importPanel === ImportPanel.Manual && (
              <ManualCreateForm onCancel={onClose} onCreate={onCreate} />
            )}
            {importPanel === ImportPanel.Defectdojo && <DefectDojoPanel />}
            {importPanel === ImportPanel.Github && <GithubImportPanel />}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveDiagram, useDiagramActions, versionConflicts } from "@/features/diagram";
import { Button } from "@/components/ui/button";

/**
 * Shown on an element whose copy in the active Version conflicts with the base: the base changed
 * (or lost the element) after the Version copied it. The user keeps the Version's copy or goes
 * back to the base; the Version cannot be merged until every conflict is settled.
 */
export function VersionConflictNotice({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { keepVersionCopy, takeBaseVersion } = useDiagramActions();
  const versionId = diagram?.activeVersionId ?? null;
  if (!diagram || !versionId) return null;
  const conflict = versionConflicts(diagram, versionId).find((c) => c.id === elementId);
  if (!conflict) return null;
  const removed = conflict.reason === "base-removed";

  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground"
    >
      <p className="flex gap-2">
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
          aria-hidden
        />
        <span>{t(removed ? "versions.conflictNoticeRemoved" : "versions.conflictNotice")}</span>
      </p>
      <div className="flex gap-2">
        {!removed && (
          <Button size="sm" variant="outline" onClick={() => keepVersionCopy(versionId, elementId)}>
            {t("versions.keepVersion")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => takeBaseVersion(versionId, elementId)}>
          {t("versions.useBase")}
        </Button>
      </div>
    </div>
  );
}

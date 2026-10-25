import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  countVersionChanges,
  versionChanges,
  type Diagram,
  type DiagramModel,
} from "@/features/diagram";
import { useCanvasPreferencesStore } from "../preferences";

/**
 * The changes view's legend: what the active Version changes against the base, counted, with a
 * way to hide the view. Only while a Version with changes is active and nothing is compared.
 */
export function VersionChangesLegend({ diagram }: { diagram: Diagram | DiagramModel }) {
  const { t } = useTranslation();
  const show = useCanvasPreferencesStore((state) => state.showVersionChanges);
  const setShow = useCanvasPreferencesStore((state) => state.setShowVersionChanges);
  const versionId = diagram.activeVersionId ?? null;
  if (!show || !versionId || diagram.compareVersionId) return null;
  const changes = versionChanges(diagram, versionId);
  if (!changes) return null;
  const counts = countVersionChanges(changes, diagram.snapshot.connections);
  if (counts.added + counts.changed + counts.removed + counts.connections === 0) return null;
  const name = diagram.versions?.[versionId]?.name ?? "";

  return (
    <div
      role="status"
      className="absolute top-12 left-1/2 z-20 flex max-w-[min(100vw-2rem,42rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-1.5 text-[11px] text-muted-foreground shadow-sm"
    >
      <span className="font-medium text-foreground">{t("versions.changesIn", { name })}</span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 shrink-0 rounded-full bg-green-500" aria-hidden />
        {t("versions.changesAdded", { count: counts.added })}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" aria-hidden />
        {t("versions.changesChanged", { count: counts.changed })}
      </span>
      <span className="flex items-center gap-1">
        <span
          className="h-3 w-3 shrink-0 rounded-full border-2 border-dashed border-red-500"
          aria-hidden
        />
        {t("versions.changesRemoved", { count: counts.removed })}
      </span>
      {counts.connections > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 shrink-0 bg-muted-foreground" aria-hidden />
          {t("versions.changesConnections", { count: counts.connections })}
        </span>
      )}
      <button
        type="button"
        onClick={() => setShow(false)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hover hover:text-foreground"
      >
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        {t("versions.hideChanges")}
      </button>
    </div>
  );
}

/** The switch for the changes view, for the Version panel. */
export function VersionChangesToggle() {
  const { t } = useTranslation();
  const show = useCanvasPreferencesStore((state) => state.showVersionChanges);
  const setShow = useCanvasPreferencesStore((state) => state.setShowVersionChanges);
  return (
    <label className="flex cursor-pointer items-start gap-2 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={show}
        onChange={(event) => setShow(event.target.checked)}
      />
      <span>
        <span className="block text-xs text-foreground">{t("versions.showChanges")}</span>
        {t("versions.showChangesHint")}
      </span>
    </label>
  );
}

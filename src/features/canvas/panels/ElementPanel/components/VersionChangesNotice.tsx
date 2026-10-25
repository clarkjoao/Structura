import { GitCompare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveDiagram, versionChanges, type FieldChange } from "@/features/diagram";
import { useCanvasPreferencesStore } from "../../../preferences";

/** A field value as one short line. */
function shown(value: unknown, none: string): string {
  if (value === undefined || value === null || value === "") return none;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * The changes view, in the inspector: what the active Version changed on this element against the
 * base, field by field (base → Version). Nothing for an element the Version did not change.
 */
export function VersionChangesNotice({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const show = useCanvasPreferencesStore((state) => state.showVersionChanges);
  const versionId = diagram?.activeVersionId ?? null;
  if (!show || !diagram || !versionId || diagram.compareVersionId) return null;
  const fields: FieldChange[] | undefined = versionChanges(diagram, versionId)?.changed.get(
    elementId,
  );
  if (!fields?.length) return null;
  const name = diagram.versions?.[versionId]?.name ?? "";
  const none = t("versions.changeNone");
  const label = (field: string) => t(`versions.changeField.${field}`, { defaultValue: field });

  return (
    <section
      aria-label={t("versions.changedIn", { name })}
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground"
    >
      <p className="flex items-center gap-2 font-medium">
        <GitCompare className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
        <span>{t("versions.changedIn", { name })}</span>
      </p>
      <dl className="flex flex-col gap-1.5">
        {fields.map((change) => (
          <div key={change.field} className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-muted-foreground">{label(change.field)}</dt>
            <dd className="flex flex-col gap-0.5 break-words">
              <span className="text-muted-foreground line-through" title={shown(change.base, none)}>
                {shown(change.base, none)}
              </span>
              <span title={shown(change.version, none)}>{shown(change.version, none)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

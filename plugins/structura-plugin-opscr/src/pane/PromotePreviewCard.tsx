import type { PromotePreview } from "./useInitiatives";
import type { text } from "./i18n";
import { BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "./styles";

type Text = ReturnType<typeof text>;

/** One group of element keys (`Kind/name`), or nothing when it is empty. */
function Keys({ label, keys, tone }: { label: string; keys: string[]; tone: string }) {
  if (keys.length === 0) return null;
  return (
    <div>
      <p className={`text-[11px] font-medium ${tone}`}>
        {label} ({keys.length})
      </p>
      <ul className="ml-3 list-disc text-[11px] text-foreground">
        {keys.map((key) => (
          <li key={key} className="break-all">
            {key}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What promoting an initiative would do — elements, edges, files — or why it cannot yet, with
 * Confirm / Cancel. Nothing is written before Confirm (and then only to the buffers, until Save).
 */
export function PromotePreviewCard({
  preview,
  t,
  onConfirm,
  onCancel,
  onMarkDone,
}: {
  preview: PromotePreview;
  t: Text;
  onConfirm: () => void;
  onCancel: () => void;
  onMarkDone: () => void;
}) {
  const { diff, plan } = preview;
  const edges = diff.edges.added.length + diff.edges.removed.length;
  const empty = diff.added.length + diff.modified.length + diff.retired.length + edges === 0;
  const files = plan.operations;

  return (
    <section
      aria-label={t.previewTitle(preview.title)}
      className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2.5 text-xs"
    >
      <p className="font-semibold text-foreground">{t.previewTitle(preview.title)}</p>
      {empty ? (
        <p className="text-muted-foreground">{t.previewEmpty}</p>
      ) : (
        <div className="space-y-1.5">
          <Keys
            label={t.previewAdded}
            keys={diff.added}
            tone="text-green-700 dark:text-green-400"
          />
          <Keys
            label={t.previewChanged}
            keys={diff.modified}
            tone="text-amber-700 dark:text-amber-400"
          />
          <Keys
            label={t.previewRetired}
            keys={diff.retired}
            tone="text-red-700 dark:text-red-400"
          />
          {edges > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t.previewEdges(diff.edges.added.length, diff.edges.removed.length)}
            </p>
          )}
        </div>
      )}
      {plan.ok ? (
        files.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">{t.previewFiles}</p>
            <ul className="ml-3 list-disc font-mono text-[10px] text-foreground">
              {files.map((op) => (
                <li key={`${op.op}:${op.path}`} className="break-all">
                  {op.op === "write" ? t.previewWrite : t.previewDelete} {op.path}
                  {op.op === "deleteDir" ? "/" : ""}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="space-y-1 text-amber-700 dark:text-amber-400">
          <p className="text-[11px] font-medium">{t.previewRefused}</p>
          <ul className="ml-3 list-disc text-[11px]">
            {plan.diagnostics.map((d, index) => (
              <li key={`${d.ruleId}:${index}`}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{t.previewUnsaved}</p>
      <div className="flex gap-1.5">
        {plan.ok ? (
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} h-7 flex-1`}
            onClick={onConfirm}
          >
            {t.previewConfirm}
          </button>
        ) : (
          preview.onlyNotDone && (
            <button type="button" className={`${BUTTON_CLASS} h-7 flex-1`} onClick={onMarkDone}>
              {t.previewMarkDone}
            </button>
          )
        )}
        <button type="button" className={`${BUTTON_CLASS} h-7 flex-1`} onClick={onCancel}>
          {t.previewCancel}
        </button>
      </div>
    </section>
  );
}

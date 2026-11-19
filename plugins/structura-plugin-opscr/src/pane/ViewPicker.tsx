import type { text } from "./i18n";
import { ChangeCounts, StatusDot } from "./InitiativeBits";
import { LABEL_CLASS } from "./styles";
import type { InitiativeRow } from "./useInitiatives";

type Text = ReturnType<typeof text>;

const SEGMENT_CLASS =
  "inline-flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * What the bound diagram shows, in two choices: the root (AS-IS) or an initiative's Version, and
 * the whole workspace or one View. Each View says which initiatives change it, and how much — a
 * View with no mark is the root only, and has no Version.
 */
export function ViewPicker({
  t,
  views,
  view,
  onView,
  initiatives,
  shown,
  onShow,
}: {
  t: Text;
  views: readonly string[];
  /** The View shown (undefined: the whole workspace). */
  view: string | undefined;
  onView: (view: string | undefined) => void;
  /** The folder's initiatives; empty outside a product workspace. */
  initiatives: readonly InitiativeRow[];
  shown: string | null;
  /** Shows an initiative's Version (null: the root), switching to `at.view` first when given. */
  onShow: (name: string | null, at?: { view: string | undefined }) => void;
}) {
  const changing = (name: string | undefined) =>
    initiatives.flatMap((row) => {
      if (name === undefined) {
        const d = row.diff;
        const edges = d.edges.added.length + d.edges.removed.length;
        return d.added.length + d.modified.length + d.retired.length + edges > 0
          ? [
              {
                row,
                added: d.added.length,
                modified: d.modified.length,
                retired: d.retired.length,
                edges,
              },
            ]
          : [];
      }
      const c = row.views.find((v) => v.view === name)?.changes;
      return c
        ? [
            {
              row,
              added: c.added.length,
              modified: c.modified.length,
              retired: c.retired.length,
              edges: c.edges,
            },
          ]
        : [];
    });
  const drawnHere = (row: InitiativeRow) =>
    view === undefined || row.views.some((v) => v.view === view);

  return (
    <div className="space-y-3">
      {initiatives.length > 0 && (
        <div>
          <span className={LABEL_CLASS}>{t.showingLabel}</span>
          <div
            role="radiogroup"
            aria-label={t.showingLabel}
            className="flex flex-wrap gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={shown === null}
              className={`${SEGMENT_CLASS} ${shown === null ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => onShow(null)}
            >
              {t.rootAsIs}
            </button>
            {initiatives.map((row) => (
              <button
                key={row.name}
                type="button"
                role="radio"
                aria-checked={shown === row.name}
                disabled={!drawnHere(row)}
                title={drawnHere(row) ? row.title : t.notInView}
                className={`${SEGMENT_CLASS} ${shown === row.name ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => onShow(row.name)}
              >
                <StatusDot status={row.status} />
                <span className="truncate">{row.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className={LABEL_CLASS}>{t.viewLabel}</span>
        <ul role="radiogroup" aria-label={t.viewLabel} className="space-y-0.5">
          {[undefined, ...views].map((name) => {
            const current = name === view;
            return (
              <li
                key={name ?? ""}
                className={`flex items-center gap-1 rounded-md pr-1 ${current ? "bg-primary/10" : "hover:bg-accent/40"}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={current}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs"
                  onClick={() => onView(name)}
                >
                  <span
                    aria-hidden
                    className={`h-3 w-3 shrink-0 rounded-full border ${current ? "border-[4px] border-primary" : "border-muted-foreground/50"}`}
                  />
                  <span className={`truncate ${current ? "font-medium text-foreground" : ""}`}>
                    {name ?? t.wholeWorkspace}
                  </span>
                </button>
                {changing(name).map(({ row, ...counts }) => (
                  <button
                    key={row.name}
                    type="button"
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                      shown === row.name && current
                        ? "border-primary/50 bg-background text-foreground"
                        : "border-border text-muted-foreground hover:bg-background"
                    }`}
                    title={t.showInitiativeIn(row.title, name ?? t.wholeWorkspace)}
                    onClick={() => onShow(row.name, { view: name })}
                  >
                    <StatusDot status={row.status} />
                    <span className="max-w-24 truncate">{row.title}</span>
                    <ChangeCounts {...counts} />
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

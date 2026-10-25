import { useEffect, useState, type ReactNode } from "react";
import type { PluginVersionStatus } from "../types/plugin.types";
import type { text } from "./i18n";
import { ChangeCounts, StatusDot } from "./InitiativeBits";
import {
  ARROW_RIGHT,
  BUTTON_CLASS,
  LABEL_CLASS,
  LINK_ROW_CLASS,
  PLUS,
  PRIMARY_BUTTON_CLASS,
  SELECT_CLASS,
} from "./styles";
import { Icon } from "./ui";
import type { InitiativeRow } from "./useInitiatives";

type Text = ReturnType<typeof text>;

const STATUSES: PluginVersionStatus[] = ["proposed", "approved", "in-progress", "done"];
const ARROW_LEFT = ["m12 19-7-7 7-7", "M19 12H5"];
const FIELD_CLASS =
  "w-full min-w-0 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** What the tab does with an initiative: the pane carries each out on the buffers. */
export interface InitiativeActions {
  /** Shows its Version on the bound diagram (null: the root). */
  show(name: string | null): void;
  /** Shows its Version and lights one of its elements. */
  locate(name: string, key: string): void;
  create(): void;
  remove(name: string): void;
  setField(name: string, field: "displayName" | "status" | "description", value: string): void;
  accept(name: string): void;
  promote(name: string): void;
  openFile(name: string): void;
  /** Shows a View on the bound diagram, with the initiative's Version. */
  openView(name: string, view: string): void;
}

/**
 * The folder's initiatives: a list with what each changes, and — for the one picked — its
 * detail, where it is shown on the canvas, renamed, described, set to a status, promoted or
 * deleted. Every change goes to the buffers, unsaved until Save.
 */
export function InitiativesTab({
  t,
  rows,
  shown,
  view,
  picked,
  onPick,
  actions,
  preview,
}: {
  t: Text;
  rows: readonly InitiativeRow[];
  /** The initiative the bound diagram shows (null: the root). */
  shown: string | null;
  /** The View the bound diagram shows (undefined: the whole workspace). */
  view: string | undefined;
  picked: string | null;
  onPick: (name: string | null) => void;
  actions: InitiativeActions;
  /** The promote preview, above everything while it is open. */
  preview: ReactNode;
}) {
  const row = rows.find((r) => r.name === picked);
  return (
    <div className="space-y-3 px-4 py-3">
      {preview}
      {row ? (
        <InitiativeDetail
          key={row.name}
          t={t}
          row={row}
          shown={shown === row.name}
          drawnHere={view === undefined || row.views.some((v) => v.view === view)}
          back={() => onPick(null)}
          actions={actions}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">{t.initiativesHint}</p>
            <button
              type="button"
              className={`${BUTTON_CLASS} h-7 px-2`}
              onClick={() => actions.create()}
            >
              <Icon path={PLUS} />
              {t.newInitiative}
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.initiativesNone}</p>
          ) : (
            <ul aria-label={t.tabInitiatives} className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => onPick(r.name)}
                    className={`w-full space-y-1 rounded-md border p-2.5 text-left transition-colors hover:bg-accent/40 ${
                      shown === r.name
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-secondary/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={r.name}>
                        {r.title}
                      </span>
                      {shown === r.name && (
                        <span className="shrink-0 text-[10px] font-medium uppercase text-primary">
                          {t.onCanvas}
                        </span>
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        <StatusDot status={r.status} />
                        {r.status ? t.statusLabel(r.status) : "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <ChangeCounts
                        added={r.diff.added.length}
                        modified={r.diff.modified.length}
                        retired={r.diff.retired.length}
                        edges={r.diff.edges.added.length + r.diff.edges.removed.length}
                      />
                      <span>· {t.viewsChanged(r.views.length)}</span>
                      {r.lockIssues.length > 0 && (
                        <span className="text-amber-700 dark:text-amber-400">
                          · ⚠ {t.lockIssues(r.lockIssues.length)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** A text field written to the manifest when it loses focus (or on Enter, for one line). */
function CommitField({
  value,
  label,
  multiline,
  onCommit,
}: {
  value: string;
  label: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
  };
  return multiline ? (
    <textarea
      aria-label={label}
      rows={3}
      className={`${FIELD_CLASS} resize-y`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  ) : (
    <input
      aria-label={label}
      className={`${FIELD_CLASS} h-8 text-sm font-medium`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
    />
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={LABEL_CLASS}>{title}</p>
      {children}
    </div>
  );
}

function InitiativeDetail({
  t,
  row,
  shown,
  drawnHere,
  back,
  actions,
}: {
  t: Text;
  row: InitiativeRow;
  shown: boolean;
  /** The bound diagram has its Version (it shows the workspace, or a View it changes). */
  drawnHere: boolean;
  back: () => void;
  actions: InitiativeActions;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { diff } = row;
  const changes: Array<[string, string[], string]> = [
    ["+", diff.added, "text-green-700 dark:text-green-400"],
    ["~", diff.modified, "text-amber-700 dark:text-amber-400"],
    ["−", diff.retired, "text-red-700 dark:text-red-400"],
  ];
  const edges = diff.edges.added.length + diff.edges.removed.length;

  return (
    <section aria-label={row.title} className="space-y-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={back}
      >
        <Icon path={ARROW_LEFT} className="h-3 w-3" />
        {t.tabInitiatives}
      </button>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CommitField
            label={t.initiativeName}
            value={row.title}
            onCommit={(v) => actions.setField(row.name, "displayName", v || row.name)}
          />
        </div>
        <button
          type="button"
          className={`${shown ? BUTTON_CLASS : PRIMARY_BUTTON_CLASS} h-8 px-2.5`}
          disabled={!shown && !drawnHere}
          title={drawnHere ? undefined : t.notInView}
          onClick={() => actions.show(shown ? null : row.name)}
        >
          {shown ? t.showRoot : t.showOnCanvas}
        </button>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">initiatives/{row.name}/</p>

      <div>
        <label htmlFor={`initiative-status-${row.name}`} className={LABEL_CLASS}>
          {t.statusField}
        </label>
        <select
          id={`initiative-status-${row.name}`}
          className={SELECT_CLASS}
          value={row.status ?? ""}
          onChange={(e) => actions.setField(row.name, "status", e.target.value)}
        >
          {row.status === null && <option value="">—</option>}
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <Group title={t.descriptionField}>
        <CommitField
          label={t.descriptionField}
          value={row.description}
          multiline
          onCommit={(v) => actions.setField(row.name, "description", v)}
        />
        {row.docs && (
          <a
            href={row.docs}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[11px] text-primary underline"
          >
            {t.docsLink} ↗ {row.docs.replace(/^https?:\/\//, "")}
          </a>
        )}
      </Group>

      <Group title={t.changesTitle}>
        {changes.every(([, keys]) => keys.length === 0) && edges === 0 ? (
          <p className="text-xs text-muted-foreground">{t.previewEmpty}</p>
        ) : (
          <ul>
            {changes.flatMap(([sign, keys, tone]) =>
              keys.map((key) => (
                <li key={`${sign}${key}`}>
                  <button
                    type="button"
                    className={`${LINK_ROW_CLASS} flex items-center gap-1.5`}
                    title={t.locateHint}
                    onClick={() => actions.locate(row.name, key)}
                  >
                    <span className={`w-3 shrink-0 font-mono ${tone}`}>{sign}</span>
                    <span className="min-w-0 truncate">{key}</span>
                  </button>
                </li>
              )),
            )}
          </ul>
        )}
        {edges > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {t.previewEdges(diff.edges.added.length, diff.edges.removed.length)}
          </p>
        )}
      </Group>

      {row.views.length > 0 && (
        <Group title={t.viewsTitle}>
          <ul className="flex flex-wrap gap-1.5">
            {row.views.map(({ view, changes: c }) => (
              <li key={view}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-accent"
                  title={t.openViewHint}
                  onClick={() => actions.openView(row.name, view)}
                >
                  {view}
                  <ChangeCounts
                    added={c.added.length}
                    modified={c.modified.length}
                    retired={c.retired.length}
                    edges={c.edges}
                  />
                  <Icon path={ARROW_RIGHT} className="h-3 w-3 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title={t.tabFiles}>
        <ul>
          {row.files.map((file) => (
            <li key={file}>
              <button
                type="button"
                className={`${LINK_ROW_CLASS} truncate font-mono text-[11px]`}
                title={file}
                onClick={() => actions.openFile(file)}
              >
                {file.slice(file.lastIndexOf("/") + 1)}
              </button>
            </li>
          ))}
        </ul>
      </Group>

      {row.lockIssues.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
          <p className="text-amber-700 dark:text-amber-400">
            {t.lockIssues(row.lockIssues.length)}
          </p>
          <ul className="ml-3 list-disc text-[11px] text-amber-700 dark:text-amber-400">
            {row.lockIssues.map((d, index) => (
              <li key={`${d.ruleId}:${index}`}>{d.message}</li>
            ))}
          </ul>
          <button
            type="button"
            className={`${BUTTON_CLASS} h-7 px-2`}
            title={t.acceptRootHint}
            onClick={() => actions.accept(row.name)}
          >
            {t.acceptRoot}
          </button>
        </div>
      )}

      <div className="flex gap-1.5 border-t border-border pt-3">
        <button
          type="button"
          className={`${BUTTON_CLASS} h-8 flex-1`}
          title={t.promoteHint}
          onClick={() => actions.promote(row.name)}
        >
          {t.promote}
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              className={`${BUTTON_CLASS} h-8 border-destructive/50 text-destructive`}
              onClick={() => {
                setConfirmDelete(false);
                actions.remove(row.name);
                back();
              }}
            >
              {t.deleteConfirm}
            </button>
            <button
              type="button"
              className={`${BUTTON_CLASS} h-8`}
              onClick={() => setConfirmDelete(false)}
            >
              {t.previewCancel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${BUTTON_CLASS} h-8 text-destructive`}
            title={t.deleteHint}
            onClick={() => setConfirmDelete(true)}
          >
            {t.deleteInitiative}
          </button>
        )}
      </div>
    </section>
  );
}

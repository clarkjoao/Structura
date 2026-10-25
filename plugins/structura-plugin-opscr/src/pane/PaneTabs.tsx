import type { Diagnostic } from "opscr/core";
import type { text } from "./i18n";
import { LINK_ROW_CLASS } from "./styles";

type Text = ReturnType<typeof text>;

export type PaneTab = "overview" | "initiatives" | "files" | "problems";

/** The pane's tabs, drawn like the element panel's. */
export function PaneTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: PaneTab; label: string; count?: number; alert?: boolean }>;
  active: PaneTab;
  onChange: (tab: PaneTab) => void;
}) {
  return (
    <div role="tablist" className="flex shrink-0 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${
            active === tab.id
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                tab.alert
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** What the folder holds, at a glance. */
export interface PaneSummary {
  elements: number;
  files: number;
  views: number;
  initiatives: number;
  errors: number;
  warnings: number;
}

/** The overview's head: counts of what the folder holds, and the way to its files. */
export function Overview({
  t,
  summary,
  showFiles,
}: {
  t: Text;
  summary: PaneSummary;
  showFiles: () => void;
}) {
  const cells: Array<[string, number]> = [
    [t.summaryElements, summary.elements],
    [t.summaryViews, summary.views],
    [t.summaryInitiatives, summary.initiatives],
    [t.summaryFiles, summary.files],
  ];
  return (
    <div className="space-y-2 border-b border-border px-4 py-3">
      <dl className="grid grid-cols-4 gap-2">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">
        {summary.errors + summary.warnings === 0
          ? t.summaryClean
          : t.summaryProblems(summary.errors, summary.warnings)}{" "}
        <button type="button" className="underline" onClick={showFiles}>
          {t.summaryOpenFiles}
        </button>
      </p>
    </div>
  );
}

/** opscr's diagnostics, by file; one opens its file at its line. */
export function DiagnosticsList({
  t,
  diagnostics,
  onOpen,
}: {
  t: Text;
  diagnostics: readonly Diagnostic[];
  onOpen: (diagnostic: Diagnostic) => void;
}) {
  const shown = diagnostics.filter((d) => d.severity === "error" || d.severity === "warning");
  if (shown.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">{t.problemsNone}</p>;
  }
  const byFile = new Map<string, Diagnostic[]>();
  for (const d of shown) byFile.set(d.file ?? "", [...(byFile.get(d.file ?? "") ?? []), d]);
  return (
    <div className="space-y-2 border-b border-border px-4 py-3">
      <p className="text-xs font-semibold text-foreground">{t.diagnosticsTitle(shown.length)}</p>
      {[...byFile].map(([file, list]) => (
        <div key={file}>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{file || "—"}</p>
          <ul>
            {list.map((d, index) => (
              <li key={`${d.ruleId}:${d.line}:${index}`}>
                <button type="button" className={LINK_ROW_CLASS} onClick={() => onOpen(d)}>
                  <span
                    className={
                      d.severity === "error"
                        ? "text-destructive"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {d.severity === "error" ? "●" : "▲"}
                  </span>{" "}
                  {d.line ? `${d.line}: ` : ""}
                  {d.message}
                  {d.ruleId ? <span className="text-muted-foreground"> [{d.ruleId}]</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

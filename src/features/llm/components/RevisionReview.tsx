import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { resolveKindText } from "@/features/diagram-kinds/context";
import { cn } from "@/lib/utils";
import { useLLMStore } from "../store";
import type { JourneyRevision } from "../types";
import { groupOf, useRevisionSelection } from "./useRevisionSelection";

type InitialChange = JourneyRevision["initial"][number];

/**
 * A journey revision, change by change (spec guided-assistant-revisions): grouped
 * by phase, one checkbox per dependency group, the reason when the assistant gave
 * one; a change whose step is gone shows as no longer applicable.
 */
export function RevisionReview({
  suggestionId,
  revision,
  pending,
}: {
  suggestionId: string;
  revision: JourneyRevision;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const toggle = useLLMStore((s) => s.toggleRevisionGroup);
  const refresh = useLLMStore((s) => s.refreshRevisionPreview);
  const { current } = useRevisionSelection(revision);
  // The canvas preview follows the diagram too.
  useEffect(() => {
    if (pending) refresh(suggestionId);
  }, [current, pending, refresh, suggestionId]);

  const unticked = new Set(revision.unticked);
  const phases = new Map<string, Map<string, InitialChange[]>>();
  for (const change of revision.initial) {
    const phase = change.phase ?? "";
    const groups = phases.get(phase) ?? new Map<string, InitialChange[]>();
    groups.set(groupOf(change), [...(groups.get(groupOf(change)) ?? []), change]);
    phases.set(phase, groups);
  }

  // Phases in the revised journey's reading order; changes before any phase first.
  const order = [
    "",
    ...revision.outline
      .split("\n")
      .map((line) => /^\s*##\s+(.+?)\s*$/.exec(line)?.[1])
      .filter((name): name is string => !!name),
  ];
  const rank = (phase: string) => (order.includes(phase) ? order.indexOf(phase) : order.length);
  const sorted = [...phases.entries()].sort(([a], [b]) => rank(a) - rank(b));

  return (
    <div className="space-y-3 px-4 pb-3" data-testid="revision-review">
      {sorted.map(([phase, groups]) => {
        const live = [...groups.entries()].filter(([, changes]) =>
          changes.some((c) => current.has(c.key)),
        );
        const allTicked = live.every(([group]) => !unticked.has(group));
        return (
          <section key={phase || "—"} data-testid="revision-phase">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {phase || t("llmChat.revision.noPhase")}
              </h5>
              {pending && live.length > 1 && (
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => {
                    // Untick every group, or tick the ones left out.
                    for (const [group] of live)
                      if (unticked.has(group) !== allTicked) toggle(suggestionId, group);
                  }}
                >
                  {allTicked ? t("llmChat.revision.untickAll") : t("llmChat.revision.tickAll")}
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {[...groups.entries()].map(([group, changes]) => {
                const stale = !changes.some((c) => current.has(c.key));
                const ticked = !stale && !unticked.has(group);
                return (
                  <li key={group}>
                    <label
                      className={cn(
                        "flex items-start gap-2 rounded-md px-1.5 py-1 text-xs",
                        stale ? "opacity-50" : "hover:bg-muted/60",
                      )}
                      data-testid="revision-group"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={ticked}
                        disabled={stale || !pending}
                        onChange={() => toggle(suggestionId, group)}
                      />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        {changes.map((change) => (
                          <span key={change.key} className="block text-foreground">
                            {resolveKindText(change.label, change.values)}
                            {change.reason && (
                              <span className="block text-[11px] text-muted-foreground">
                                {change.reason}
                              </span>
                            )}
                          </span>
                        ))}
                        {stale && (
                          <span className="block text-[11px] text-muted-foreground">
                            {t("llmChat.revision.stale")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

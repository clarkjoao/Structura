import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBranchColor } from "../branchColors";

export interface ForkFormProps {
  /** Writes the fork; false when the store refused it, and the form stays open. */
  onSubmit: (question: string, branchLabels: string[]) => boolean;
  onCancel: () => void;
}

/**
 * "From here the flow forks", asked in one line under the recording strip.
 *
 * Fast first: the question may stay blank and the ways out start as yes / no,
 * so Enter alone forks the flow and recording carries on in the first way out.
 * Naming comes later, in the script, like every other detail.
 */
export function ForkForm({ onSubmit, onCancel }: ForkFormProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [branches, setBranches] = useState(() => [
    t("flowRecorder.fork.yes"),
    t("flowRecorder.fork.no"),
  ]);
  const named = branches.map((branch) => branch.trim()).filter(Boolean);
  const canSubmit = named.length >= 2;

  const submit = () => {
    if (canSubmit) onSubmit(question.trim(), named);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      data-testid="recording-fork-form"
      className="flex flex-col gap-2 border-t border-border px-3.5 pb-2.5 pt-2.5"
      onKeyDown={onKeyDown}
    >
      <input
        autoFocus
        aria-label={t("flowRecorder.fork.question")}
        placeholder={t("flowRecorder.fork.questionPlaceholder")}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        className="h-8 w-full rounded-md border border-border bg-secondary px-2.5 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {branches.map((branch, index) => (
          <span
            key={index}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-card pl-1.5 pr-1"
          >
            <span
              aria-hidden
              className="h-3.5 w-1 shrink-0 rounded-full"
              style={{ background: getBranchColor(index) }}
            />
            <input
              aria-label={t("flowRecorder.fork.branch", { n: index + 1 })}
              value={branch}
              onChange={(event) =>
                setBranches((all) =>
                  all.map((value, i) => (i === index ? event.target.value : value)),
                )
              }
              onFocus={(event) => event.target.select()}
              size={Math.max(branch.length, 3)}
              className="bg-transparent text-xs focus:outline-none"
            />
            {branches.length > 2 && (
              <button
                type="button"
                aria-label={t("flowRecorder.fork.removeBranch")}
                onClick={() => setBranches((all) => all.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          aria-label={t("flowRecorder.fork.addBranch")}
          title={t("flowRecorder.fork.addBranch")}
          onClick={() => setBranches((all) => [...all, ""])}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="h-7" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button size="sm" className="h-7" onClick={submit} disabled={!canSubmit}>
          {t("flowRecorder.fork.submit")}
        </Button>
      </div>
    </div>
  );
}

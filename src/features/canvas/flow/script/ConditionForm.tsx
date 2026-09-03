import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { getBranchColor } from "../branchColors";

export interface ConditionFormState {
  /** Step being turned into a condition. */
  stepId: string;
  label: string;
  branches: string[];
}

export interface ConditionFormProps {
  form: ConditionFormState;
  onChange: (form: ConditionFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ConditionForm({ form, onChange, onSubmit, onCancel }: ConditionFormProps) {
  const { t } = useTranslation();
  const incomplete = !form.label.trim() || form.branches.some((branch) => !branch.trim());

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-400">◇</span>
        <span className="text-xs font-semibold text-amber-400">
          {t("flowScript.newConditionTitle")}
        </span>
      </div>

      <input
        placeholder={t("flowScript.conditionExample")}
        value={form.label}
        onChange={(event) => onChange({ ...form, label: event.target.value })}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
        autoFocus
      />

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("flowScript.branches")}
        </p>
        {form.branches.map((branch, branchIndex) => (
          <div key={branchIndex} className="flex items-center gap-2">
            <div
              className="h-6 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: getBranchColor(branchIndex) }}
            />
            <input
              value={branch}
              onChange={(event) => {
                const branches = [...form.branches];
                branches[branchIndex] = event.target.value;
                onChange({ ...form, branches });
              }}
              placeholder={t("flowScript.branchPlaceholder", { n: branchIndex + 1 })}
              className="flex-1 rounded border border-border bg-secondary px-2 py-1 text-sm"
            />
            {form.branches.length > 2 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...form,
                    branches: form.branches.filter((_, index) => index !== branchIndex),
                  })
                }
                title={t("flowScript.removeBranch")}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...form, branches: [...form.branches, ""] })}
          className="text-[11px] text-primary hover:underline"
        >
          + {t("flowScript.addBranchOption")}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("flowScript.cancel")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={incomplete}
          className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("flowScript.createCondition")}
        </button>
      </div>
    </div>
  );
}

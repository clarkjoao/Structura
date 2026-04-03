import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { getBranchColor } from "../../utils/branchColors";

export interface ConditionFormState {
  index: number;
  label: string;
  branches: string[];
}

export interface ConditionStepFormProps {
  conditionForm: ConditionFormState;
  onChange: (form: ConditionFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ConditionStepForm({ conditionForm, onChange, onSubmit, onCancel }: ConditionStepFormProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/05 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-400">◇</span>
        <span className="text-xs font-semibold text-amber-400">
          {t("flowRecorder.newConditionTitle", "Nova Condição")}
        </span>
      </div>

      <input
        placeholder={t("flowRecorder.conditionPlaceholderExample", "se o usuário for menor de idade...")}
        value={conditionForm.label}
        onChange={(e) => onChange({ ...conditionForm, label: e.target.value })}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
        autoFocus
      />

      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {t("flowRecorder.branches", "Branches")}
        </p>
        {conditionForm.branches.map((b, bi) => (
          <div key={bi} className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: getBranchColor(bi) }} />
            <input
              value={b}
              onChange={(e) => {
                const nb = [...conditionForm.branches];
                nb[bi] = e.target.value;
                onChange({ ...conditionForm, branches: nb });
              }}
              placeholder={t("flowRecorder.branchOptionPlaceholder", {
                n: bi + 1,
                defaultValue: `Opção ${bi + 1}`,
              })}
              className="flex-1 rounded border border-border bg-secondary px-2 py-1 text-sm"
            />
            {conditionForm.branches.length > 2 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...conditionForm,
                    branches: conditionForm.branches.filter((_, j) => j !== bi),
                  })
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...conditionForm, branches: [...conditionForm.branches, ""] })}
          className="text-[11px] text-primary hover:underline"
        >
          + {t("flowRecorder.addBranchOption", "Adicionar opção")}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("flowRecorder.cancel")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!conditionForm.label.trim() || conditionForm.branches.some((b) => !b.trim())}
          className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("flowRecorder.createCondition", "Criar")}
        </button>
      </div>
    </div>
  );
}

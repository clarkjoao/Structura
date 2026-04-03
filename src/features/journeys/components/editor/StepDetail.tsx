import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useJourney, useJourneyActions } from "../../selectors";
import type { JourneyStep } from "../../types";

const FIELD_DEBOUNCE_MS = 300;

interface StepDetailProps {
  journeyId: string;
  stepId: string;
}

export function StepDetail({ journeyId, stepId }: StepDetailProps) {
  const { t } = useTranslation();
  const journey = useJourney(journeyId);
  const step = journey?.steps[stepId];

  const { updateJourneyStep } = useJourneyActions();

  const [collapsed, setCollapsed] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    setCollapsed(false);
  }, [stepId]);

  useEffect(() => {
    if (!step) return;
    setLabel(step.label);
    setDescription(step.description ?? "");
    setDuration(step.duration ?? "");
  }, [step]);

  const debouncedPatch = useMemo(
    () =>
      debounce((patch: Partial<Omit<JourneyStep, "id">>) => {
        updateJourneyStep(journeyId, stepId, patch);
      }, FIELD_DEBOUNCE_MS),
    [journeyId, stepId, updateJourneyStep],
  );

  useEffect(() => () => debouncedPatch.cancel(), [debouncedPatch]);

  if (!journey || !step) {
    return (
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        {t("journeys.editor.selectStepForVisual")}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setCollapsed((previous) => !previous)}
      >
        <span className="text-xs font-semibold text-foreground">
          {t("journeys.step.detailsTitle")}
        </span>
        {collapsed ? (
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <ChevronUp
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
        )}
      </button>

      {!collapsed ? (
        <div className="flex max-h-[38vh] flex-col gap-3 overflow-y-auto border-t border-border px-3 pb-3 pt-2">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("journeys.step.label")}
            </label>
            <Input
              value={label}
              onChange={(event) => {
                const value = event.target.value;
                setLabel(value);
                debouncedPatch({ label: value });
              }}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("journeys.step.description")}
            </label>
            <textarea
              value={description}
              onChange={(event) => {
                const value = event.target.value;
                setDescription(value);
                debouncedPatch({ description: value || undefined });
              }}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("journeys.step.duration")}
            </label>
            <Input
              value={duration}
              placeholder={t("journeys.step.durationPlaceholder")}
              onChange={(event) => {
                const value = event.target.value;
                setDuration(value);
                debouncedPatch({ duration: value || undefined });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { memo } from "react";

interface RecordingBadgeProps {
  badges: string[];
  /** The last row on screen, which the recorder pulses to show where it is. */
  isLastRecorded?: boolean;
}

export const StepBadge = memo(function StepBadge({ badges, isLastRecorded }: RecordingBadgeProps) {
  if (!badges.length) return null;
  return (
    <div
      data-testid="node-step-badges"
      className={`absolute -top-2.5 -right-2.5 z-10 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 ${isLastRecorded ? "animate-pulse" : ""}`}
    >
      {badges.join(",")}
    </div>
  );
});

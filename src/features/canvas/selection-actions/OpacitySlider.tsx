import { useTranslation } from "react-i18next";

interface OpacitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function OpacitySlider({ value, onChange }: OpacitySliderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground shrink-0">
        {t("canvas.quickActions.opacity")}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 h-1 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
        style={{ touchAction: "none" }}
      />
      <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

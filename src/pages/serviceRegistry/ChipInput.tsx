import { useState } from "react";
import { useTranslation } from "react-i18next";

export const ChipInput = ({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("registry.chipAddPlaceholder");
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput("");
  };
  return (
    <div>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="hover:text-foreground leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={resolvedPlaceholder}
          className="flex-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          {t("registry.chipAddButton")}
        </button>
      </div>
    </div>
  );
};

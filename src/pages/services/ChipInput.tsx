import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KEY, keyIs } from "@/lib/core/keyboard";

export const ChipInput = ({
  label,
  items,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("services.chipAddPlaceholder");
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
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
          >
            {item}
            <button
              type="button"
              disabled={disabled}
              aria-label={t("services.removeChip", { item })}
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (keyIs(e, KEY.ENTER)) {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={resolvedPlaceholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
};

import * as React from "react";
import type { IconDefinition } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { CustomIconRenderer } from "./CustomIconRenderer";

export interface IconPickerLibraryGridProps {
  icons: IconDefinition[];
  currentIconId?: string;
  disabled: boolean;
  onPick: (iconId: string) => void;
}

export function IconPickerLibraryGrid({
  icons,
  currentIconId,
  disabled,
  onPick,
}: IconPickerLibraryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {icons.map((icon) => (
        <button
          key={icon.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(icon.id)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-accent",
            icon.id === currentIconId && "ring-2 ring-primary",
          )}
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center">
            <CustomIconRenderer svgContent={icon.svgContent} size={56} className="shrink-0" />
          </div>
          <span className="line-clamp-2 w-full text-center text-xs text-muted-foreground">
            {icon.name}
          </span>
        </button>
      ))}
    </div>
  );
}

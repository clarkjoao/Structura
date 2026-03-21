import { ChevronDown, ChevronRight } from "lucide-react";
import type { AwsCategory, AwsCategoryId } from "@/lib/catalogs/aws";
import AwsIcon from "../../nodes/AwsIcon";
import { shortAwsName } from "./elementPickerModal.utils";

export function AwsCategoryBlock({
  cat,
  q,
  expanded,
  onToggle,
  onPickAws,
}: {
  cat: AwsCategory;
  q: string;
  expanded: boolean;
  onToggle: () => void;
  onPickAws: (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => void;
}) {
  const filtered = q
    ? cat.services.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q))
    : cat.services;
  if (filtered.length === 0) return null;

  return (
    <div className="border-b border-border/40 last:border-0 pb-2 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {cat.name}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
          {filtered.length}
        </span>
      </button>
      {expanded && (
        <div className="grid grid-cols-5 gap-2 pl-5 pb-2">
          {filtered.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => onPickAws(cat.id as AwsCategoryId, svc.id, svc.name)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-muted/40 p-2 transition-colors hover:bg-muted"
            >
              <AwsIcon iconName={svc.iconName} size={40} />
              <span className="line-clamp-2 text-center text-[10px] leading-tight text-foreground">
                {shortAwsName(svc.name)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

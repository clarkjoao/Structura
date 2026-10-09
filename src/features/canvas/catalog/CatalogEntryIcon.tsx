import { CloudIcon } from "@/features/cloud";
import type { CatalogEntry } from "@/features/elements/search";
import { cn } from "@/lib/utils";

interface CatalogEntryIconProps {
  entry: CatalogEntry;
  /** Pixel size of the icon box. */
  size: number;
  className?: string;
}

/** The entry's real icon: the family's (AWS, GCP, …) when it has one, else its lucide icon. */
export function CatalogEntryIcon({ entry, size, className }: CatalogEntryIconProps) {
  if (entry.familyIcon) {
    return (
      <CloudIcon
        familyId={entry.familyIcon.familyId}
        iconName={entry.familyIcon.iconName}
        size={size}
        className={cn("shrink-0", className)}
      />
    );
  }
  if (entry.awsIconName) {
    return (
      <CloudIcon
        familyId="aws"
        iconName={entry.awsIconName}
        size={size}
        className={cn("shrink-0", className)}
      />
    );
  }
  const Icon = entry.icon;
  return (
    <Icon
      aria-hidden
      className={cn("shrink-0 text-muted-foreground", className)}
      style={{ width: size, height: size }}
    />
  );
}

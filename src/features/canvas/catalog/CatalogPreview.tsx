import { useTranslation } from "react-i18next";
import type { CatalogEntry } from "@/features/elements/search";
import { CatalogEntryIcon } from "./CatalogEntryIcon";

interface CatalogPreviewProps {
  entry: CatalogEntry;
  groupLabel?: string;
  onInsert: () => void;
}

/** How many concept tags the preview lists. */
const PREVIEW_TAGS = 6;

/** The active search hit, larger: what it is, what it is also called, and how to place it. */
export function CatalogPreview({ entry, groupLabel, onInsert }: CatalogPreviewProps) {
  const { t } = useTranslation();
  const tags = entry.tags.slice(0, PREVIEW_TAGS);

  return (
    <aside
      aria-live="polite"
      className="flex w-[232px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-4"
    >
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40">
        <CatalogEntryIcon entry={entry} size={48} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{entry.label}</p>
        {groupLabel && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {groupLabel}
          </p>
        )}
      </div>
      {entry.description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
      )}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onInsert}
        className="mt-auto rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("elementCatalog.insertAtCenter")}
      </button>
    </aside>
  );
}

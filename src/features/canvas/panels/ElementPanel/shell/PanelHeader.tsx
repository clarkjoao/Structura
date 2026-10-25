import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, X } from "lucide-react";
import { Fragment, type MutableRefObject, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CommitField } from "./CommitField";
import { PanelCollapseButton } from "./PanelFrame";

export interface PanelMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  /** Draws a separator above the item. */
  separated?: boolean;
}

export interface PanelTrailItem {
  id: string;
  name: string;
}

export interface PanelHeaderProps {
  icon: ReactNode;
  /** The type chip ("System", "Boundary"). */
  typeLabel: string;
  name: string;
  namePlaceholder: string;
  /** Omitted, the name is shown but not editable here. */
  onCommitName?: (name: string) => void;
  nameInputRef?: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  textLock?: { onFocus: () => void; onBlur: () => void; lockedBy: string | null };
  /** Ancestors, nearest first; each segment selects that element. */
  trail?: PanelTrailItem[];
  onSelectElement?: (id: string) => void;
  menu: PanelMenuItem[];
  onClose: () => void;
  /** Extra chips beside the type chip ("Locked"). */
  badges?: ReactNode;
  /** A row under the name, above the trail — the multi-selection's type chips. */
  subheader?: ReactNode;
}

/**
 * The inspector's header, the same on every panel: icon and type chip, the name edited in
 * place, a clickable trail to the parent, the ⋯ menu and close.
 */
export function PanelHeader({
  icon,
  typeLabel,
  name,
  namePlaceholder,
  onCommitName,
  nameInputRef,
  textLock,
  trail = [],
  onSelectElement,
  menu,
  onClose,
  badges,
  subheader,
}: PanelHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="shrink-0 space-y-1.5 border-b border-border px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{icon}</span>
          <span className="truncate">{typeLabel}</span>
        </span>
        {badges}
        <span className="flex-1" />
        {menu.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("panelShell.moreActions")}
                title={t("panelShell.moreActions")}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {menu.map((item) => (
                <Fragment key={item.key}>
                  {item.separated && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={item.onSelect}
                    className={cn(item.destructive && "text-destructive focus:text-destructive")}
                  >
                    {item.icon && <item.icon className="mr-2 h-3.5 w-3.5" />}
                    {item.label}
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <PanelCollapseButton />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          title={t("common.close")}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {textLock?.lockedBy && (
        <p role="status" className="text-[11px] text-amber-600 dark:text-amber-400">
          {t("collaboration.lockedBy", { name: textLock.lockedBy })}
        </p>
      )}
      {onCommitName ? (
        <CommitField
          variant="title"
          ariaLabel={t("common.name")}
          value={name}
          onCommit={onCommitName}
          placeholder={namePlaceholder}
          inputRef={nameInputRef}
          onFocus={textLock?.onFocus}
          onBlur={textLock?.onBlur}
        />
      ) : (
        <h3 className="break-words px-1.5 text-base font-semibold leading-snug text-foreground">
          {name || namePlaceholder}
        </h3>
      )}
      {subheader}
      {trail.length > 0 && onSelectElement && (
        <nav
          aria-label={t("panelShell.trail")}
          className="flex flex-wrap items-center gap-x-1 px-1.5 text-xs text-muted-foreground"
        >
          <span>{t("panelShell.in")}</span>
          {trail.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <span aria-hidden>·</span>}
              <button
                type="button"
                onClick={() => onSelectElement(item.id)}
                className="max-w-full break-words text-left underline-offset-2 hover:text-foreground hover:underline"
              >
                {item.name || t("common.unnamedElement")}
              </button>
            </Fragment>
          ))}
        </nav>
      )}
    </header>
  );
}

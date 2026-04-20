import { useCallback, useEffect, useRef } from "react";
import type { ElementType } from "react";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Platform } from "../hooks/keyboard/helpers";

interface PaneContextMenuProps {
  x: number;
  y: number;
  onAutoLayout: () => void;
  onClose: () => void;
  platform: Platform;
  isAutoLayoutRunning: boolean;
}

function ShortcutHint({ mac, other, platform }: { mac: string; other: string; platform: Platform }) {
  return (
    <span className="ml-auto text-[10px] font-mono text-muted-foreground">
      {platform === "mac" ? mac : other}
    </span>
  );
}

interface MenuItemProps {
  icon: ElementType;
  label: string;
  shortcutMac?: string;
  shortcutOther?: string;
  platform: Platform;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  shortcutMac,
  shortcutOther,
  platform,
  onClick,
  disabled = false,
}: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "text-foreground hover:bg-surface-hover",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{label}</span>
      {shortcutMac && shortcutOther ? (
        <ShortcutHint mac={shortcutMac} other={shortcutOther} platform={platform} />
      ) : null}
    </button>
  );
}

export default function PaneContextMenu({
  x,
  y,
  onAutoLayout,
  onClose,
  platform,
  isAutoLayoutRunning,
}: PaneContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      <MenuItem
        icon={LayoutGrid}
        label={t("autoLayout.contextMenuLabel")}
        shortcutMac="⌘⇧L"
        shortcutOther="Ctrl+Shift+L"
        platform={platform}
        disabled={isAutoLayoutRunning}
        onClick={() => {
          onAutoLayout();
          onClose();
        }}
      />
    </div>
  );
}

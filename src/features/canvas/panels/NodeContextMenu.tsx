import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  BookmarkPlus,
  Copy,
  Group,
  LayoutGrid,
  Layers2,
  Maximize2,
  Trash2,
  Ungroup,
} from "lucide-react";
import type { Platform } from "../hooks/keyboard/helpers";

interface Props {
  x: number;
  y: number;
  elementId: string;
  onBringToFront: (elementId: string) => void;
  onSendToBack: (elementId: string) => void;
  onSaveAsTemplate?: (elementId: string) => void;
  onFitToChildren?: (elementId: string) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onAutoLayout?: () => void;
  isAutoLayoutRunning?: boolean;
  selectionCount: number;
  platform: Platform;
  onClose: () => void;
}

function ShortcutHint({
  mac,
  other,
  platform,
}: {
  mac: string;
  other: string;
  platform: Platform;
}) {
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
  danger?: boolean;
  disabled?: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  shortcutMac,
  shortcutOther,
  platform,
  onClick,
  danger = false,
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
          : danger
            ? "text-destructive hover:bg-destructive/10"
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

function Divider() {
  return <div className="mx-2 my-1 border-t border-border" />;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 py-1.5">
      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

const NodeContextMenu = ({
  x,
  y,
  elementId,
  onBringToFront,
  onSendToBack,
  onSaveAsTemplate,
  onFitToChildren,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onAutoLayout,
  isAutoLayoutRunning,
  selectionCount,
  platform,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const MARGIN = 8;

    const menuW = el.offsetWidth;
    const menuH = el.offsetHeight;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    let top = y;
    let left = x;

    if (left + menuW + MARGIN > viewW) {
      left = viewW - menuW - MARGIN;
    }

    if (top + menuH + MARGIN > viewH) {
      top = viewH - menuH - MARGIN;
    }

    left = Math.max(MARGIN, left);
    top = Math.max(MARGIN, top);

    setPosition({ top, left });
    setVisible(true);
  }, []);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const hasEditActions = onCopy || onPaste || onDuplicate || onDelete;
  const hasGrouping = onGroup || onUngroup || onFitToChildren;
  const hasTemplates = !!onSaveAsTemplate;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{
        top: position.top,
        left: position.left,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      {hasEditActions ? (
        <>
          <SectionLabel label={t("nodeContextMenu.sectionEdit")} />
          {onCopy ? (
            <MenuItem
              icon={Copy}
              label={
                selectionCount > 1
                  ? t("nodeContextMenu.copyCount", { count: selectionCount })
                  : t("nodeContextMenu.copy")
              }
              shortcutMac="⌘C"
              shortcutOther="Ctrl+C"
              platform={platform}
              onClick={() => {
                onCopy();
                onClose();
              }}
            />
          ) : null}
          {onPaste ? (
            <MenuItem
              icon={Copy}
              label={t("nodeContextMenu.paste")}
              shortcutMac="⌘V"
              shortcutOther="Ctrl+V"
              platform={platform}
              onClick={() => {
                onPaste();
                onClose();
              }}
            />
          ) : null}
          {onDuplicate ? (
            <MenuItem
              icon={Layers2}
              label={
                selectionCount > 1
                  ? t("nodeContextMenu.duplicateCount", { count: selectionCount })
                  : t("nodeContextMenu.duplicate")
              }
              shortcutMac="⌘D"
              shortcutOther="Ctrl+D"
              platform={platform}
              onClick={() => {
                onDuplicate();
                onClose();
              }}
            />
          ) : null}
          {onDelete ? (
            <MenuItem
              icon={Trash2}
              label={
                selectionCount > 1
                  ? t("nodeContextMenu.deleteCount", { count: selectionCount })
                  : t("nodeContextMenu.delete")
              }
              shortcutMac="⌫"
              shortcutOther="Del"
              platform={platform}
              onClick={() => {
                onDelete();
                onClose();
              }}
              danger
            />
          ) : null}
          <Divider />
        </>
      ) : null}

      <SectionLabel label={t("nodeContextMenu.ordering")} />
      <MenuItem
        icon={ArrowUpToLine}
        label={t("nodeContextMenu.bringToFront")}
        platform={platform}
        onClick={() => {
          onBringToFront(elementId);
          onClose();
        }}
      />
      <MenuItem
        icon={ArrowDownToLine}
        label={t("nodeContextMenu.sendToBack")}
        platform={platform}
        onClick={() => {
          onSendToBack(elementId);
          onClose();
        }}
      />

      {hasGrouping ? (
        <>
          <Divider />
          <SectionLabel label={t("nodeContextMenu.sectionGroup")} />
          {onGroup ? (
            <MenuItem
              icon={Group}
              label={t("nodeContextMenu.group")}
              shortcutMac="⌘G"
              shortcutOther="Ctrl+G"
              platform={platform}
              onClick={() => {
                onGroup();
                onClose();
              }}
            />
          ) : null}
          {onUngroup ? (
            <MenuItem
              icon={Ungroup}
              label={t("nodeContextMenu.ungroup")}
              shortcutMac="⌘⇧G"
              shortcutOther="Ctrl+Shift+G"
              platform={platform}
              onClick={() => {
                onUngroup();
                onClose();
              }}
            />
          ) : null}
          {onFitToChildren ? (
            <MenuItem
              icon={Maximize2}
              label={t("nodeContextMenu.fitToChildren")}
              platform={platform}
              onClick={() => {
                onFitToChildren(elementId);
                onClose();
              }}
            />
          ) : null}
        </>
      ) : null}

      {hasTemplates ? (
        <>
          <Divider />
          <MenuItem
            icon={BookmarkPlus}
            label={t("customComponents.saveAsTemplate")}
            platform={platform}
            onClick={() => {
              onSaveAsTemplate(elementId);
              onClose();
            }}
          />
        </>
      ) : null}

      {onAutoLayout ? (
        <>
          <Divider />
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
        </>
      ) : null}
    </div>
  );
};

export default NodeContextMenu;

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, GitBranch, GitMerge, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  computeMergePreview,
  versionHasDiff,
  useActiveDiagram,
  useDiagramActions,
  type MergePreview,
  type VersionDiff,
} from "@/features/diagram";
import { useInteractionMode } from "../hooks/useInteractionMode";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { MergeVersionDialog } from "./MergeVersionDialog";

export type VersionDrawerVersion = VersionDiff;

export interface VersionDrawerProps {
  versions: VersionDrawerVersion[];
  activeVersionId: string | null;
  compareVersionId: string | null;
  onClose: () => void;
  onSelectVersion: (id: string) => void;
  onAddVersion: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMerge: (version: VersionDiff) => void;
  onSelectBase: () => void;

  versionsLocked?: boolean;

  versionsGuestReadOnly?: boolean;
}

function VersionRow({
  version,
  isActive,
  isCompare,
  versionsLocked,
  versionsGuestReadOnly,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMerge,
}: {
  version: VersionDrawerVersion;
  isActive: boolean;
  isCompare: boolean;
  versionsLocked?: boolean;
  versionsGuestReadOnly?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const hasDiff = versionHasDiff(version);
  const structuralDisabled = Boolean(versionsLocked || versionsGuestReadOnly);
  const readOnlyTitle = versionsGuestReadOnly ? t("collaboration.versionsReadOnly") : undefined;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        versionsLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isActive
          ? "bg-primary/10 text-primary"
          : isCompare
            ? "border border-dashed border-border bg-muted/30 hover:bg-surface-hover text-foreground"
            : "hover:bg-surface-hover text-foreground",
      )}
      onClick={() => {
        if (versionsLocked) return;
        onSelect();
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          "w-2.5 h-2.5 rounded-full shrink-0 transition-transform",
          isActive ? "scale-125" : "",
        )}
        style={{ backgroundColor: version.color }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{version.name}</p>
      </div>

      {isCompare && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
          ≠
        </span>
      )}

      {isActive && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary shrink-0">
          {t("versions.drawerActiveBadge")}
        </span>
      )}

      {showActions && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={structuralDisabled}
            onClick={onRename}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:pointer-events-none disabled:opacity-40"
            title={structuralDisabled && readOnlyTitle ? readOnlyTitle : t("versions.rename")}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={structuralDisabled}
            onClick={onDuplicate}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:pointer-events-none disabled:opacity-40"
            title={structuralDisabled && readOnlyTitle ? readOnlyTitle : t("versions.duplicate")}
          >
            <Copy className="h-3 w-3" />
          </button>
          {hasDiff && (
            <button
              type="button"
              disabled={structuralDisabled}
              onClick={onMerge}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:pointer-events-none disabled:opacity-40"
              title={
                structuralDisabled && readOnlyTitle ? readOnlyTitle : t("versions.mergeIntoBase")
              }
            >
              <GitMerge className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            disabled={structuralDisabled}
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors disabled:pointer-events-none disabled:opacity-40"
            title={
              structuralDisabled && readOnlyTitle
                ? readOnlyTitle
                : hasDiff
                  ? t("versions.remove")
                  : t("versions.deleteEmptyVersion")
            }
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function VersionDrawer({
  versions,
  activeVersionId,
  compareVersionId,
  onClose,
  onSelectVersion,
  onAddVersion,
  onRename,
  onDuplicate,
  onDelete,
  onMerge,
  onSelectBase,
  versionsLocked = false,
  versionsGuestReadOnly = false,
}: VersionDrawerProps) {
  const { t } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{
    version: VersionDiff;
    preview: MergePreview;
  } | null>(null);

  const diagram = useActiveDiagram();

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) onRename(id, trimmed);
    setRenamingId(null);
    setRenameDraft("");
  };

  const openMergeDialog = (sc: VersionDiff) => {
    if (!diagram) return;
    try {
      const preview = computeMergePreview(diagram, sc.id);
      setMergeDialog({ version: sc, preview });
    } catch {
      toast.error(t("versions.mergePreviewError"));
    }
  };

  return (
    <>
      <div
        className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="absolute top-14 left-4 z-30 w-[420px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("versions.drawerTitle")}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">
              {t("versions.drawerTitle")}
            </span>
            {versionsGuestReadOnly && (
              <span className="shrink-0" title={t("collaboration.versionsReadOnly")}>
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </span>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">
              {t("versions.drawerVersionCount", { count: versions.length })}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-hover"
            aria-label={t("canvasSearch.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {versionsLocked && (
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border bg-muted/20">
            {t("versions.switchBlockedDuringFlow")}
          </div>
        )}

        {versionsGuestReadOnly && (
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border bg-muted/20 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t("collaboration.versionsReadOnly")}</span>
          </div>
        )}

        <div className="p-2 space-y-0.5 max-h-[320px] overflow-y-auto">
          <button
            type="button"
            disabled={versionsLocked}
            onClick={() => {
              onSelectBase();
              onClose();
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 w-full text-left transition-colors",
              versionsLocked && "opacity-60 cursor-not-allowed",
              activeVersionId === null && !compareVersionId
                ? "bg-primary/10 text-primary"
                : "hover:bg-surface-hover text-foreground",
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
            <span className="text-xs font-medium">{t("versions.base")}</span>
            {activeVersionId === null && !compareVersionId && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary ml-auto">
                {t("versions.drawerActiveBadge")}
              </span>
            )}
          </button>

          {versions.map((versionItem) =>
            renamingId === versionItem.id ? (
              <div key={versionItem.id} className="px-2 py-1">
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (keyIs(e, KEY.ENTER)) commitRename(versionItem.id);
                    if (keyIs(e, KEY.ESCAPE)) {
                      setRenamingId(null);
                      setRenameDraft("");
                    }
                  }}
                  onBlur={() => commitRename(versionItem.id)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
                />
              </div>
            ) : (
              <VersionRow
                key={versionItem.id}
                version={versionItem}
                isActive={versionItem.id === activeVersionId}
                isCompare={versionItem.id === compareVersionId}
                versionsLocked={versionsLocked}
                versionsGuestReadOnly={versionsGuestReadOnly}
                onSelect={() => {
                  onSelectVersion(versionItem.id);
                  onClose();
                }}
                onRename={() => {
                  setRenamingId(versionItem.id);
                  setRenameDraft(versionItem.name);
                }}
                onDuplicate={() => onDuplicate(versionItem.id)}
                onDelete={() => onDelete(versionItem.id)}
                onMerge={() => openMergeDialog(versionItem)}
              />
            ),
          )}
        </div>

        <div className="border-t border-border p-2">
          {newOpen ? (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (keyIs(e, KEY.ENTER)) {
                  onAddVersion(newName.trim());
                  setNewName("");
                  setNewOpen(false);
                }
                if (keyIs(e, KEY.ESCAPE)) {
                  setNewName("");
                  setNewOpen(false);
                }
              }}
              onBlur={() => {
                setNewName("");
                setNewOpen(false);
              }}
              placeholder={t("versions.newNamePlaceholder")}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
            />
          ) : (
            <button
              type="button"
              disabled={versionsLocked || versionsGuestReadOnly}
              title={versionsGuestReadOnly ? t("collaboration.versionsReadOnly") : undefined}
              onClick={() => {
                setNewOpen(true);
              }}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("versions.newVersion")}
            </button>
          )}
        </div>
      </div>

      {mergeDialog && diagram && (
        <MergeVersionDialog
          open
          onOpenChange={(open) => {
            if (!open) setMergeDialog(null);
          }}
          diagram={diagram}
          version={mergeDialog.version}
          preview={mergeDialog.preview}
          onConfirm={() => {
            if (!mergeDialog) return;
            const { version, preview } = mergeDialog;
            const conflictCount = preview.conflicts.length;
            onMerge(version);
            setMergeDialog(null);
            toast.success(t("versions.mergeSuccess", { name: version.name }), {
              description:
                conflictCount > 0
                  ? t("versions.mergeSuccessConflicts", { count: conflictCount })
                  : undefined,
            });
          }}
          onCancel={() => setMergeDialog(null)}
        />
      )}
    </>
  );
}

export function ConnectedVersionDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const { canEditVersions, isCollabGuest } = useInteractionMode(diagram);
  const versionsGuestReadOnly = isCollabGuest;
  const versionsLocked = !canEditVersions;
  const {
    addVersion,
    removeVersion,
    setActiveVersion,
    setCompareVersion,
    renameVersion,
    mergeVersionIntoBase,
    duplicateVersion,
  } = useDiagramActions();

  if (!diagram) return null;

  const sceneRecord = diagram.versions ?? {};
  const versions = Object.values(sceneRecord).sort((a, b) => a.createdAt - b.createdAt);
  const activeId =
    diagram.activeVersionId && sceneRecord[diagram.activeVersionId] ? diagram.activeVersionId : null;
  const compareId =
    diagram.compareVersionId && sceneRecord[diagram.compareVersionId] ? diagram.compareVersionId : null;

  const handleVersionPillClick = (versionId: string) => {
    if (versionsLocked) {
      toast.warning(t("versions.switchBlockedDuringFlow"));
      return;
    }
    if (activeId === null) {
      setActiveVersion(versionId);
      return;
    }
    if (activeId === versionId) {
      setActiveVersion(null);
      setCompareVersion(null);
      return;
    }
    if (compareId === versionId) {
      setCompareVersion(null);
      return;
    }
    if (compareId === null) {
      setCompareVersion(versionId);
      return;
    }
    setCompareVersion(versionId);
  };

  const handleDeleteEmptyVersion = (sc: VersionDiff) => {
    removeVersion(sc.id);
    toast.success(t("versions.emptyVersionDeleted", { name: sc.name }));
  };

  return (
    <VersionDrawer
      versions={versions}
      activeVersionId={activeId}
      compareVersionId={compareId}
      onClose={onClose}
      versionsLocked={versionsLocked}
      versionsGuestReadOnly={versionsGuestReadOnly}
      onSelectVersion={(id) => handleVersionPillClick(id)}
      onAddVersion={(trimmed) => {
        if (versionsGuestReadOnly) return;
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        const name = trimmed.trim() || t("versions.defaultVersionName");
        const created = addVersion(name);
        setActiveVersion(created.id);
      }}
      onRename={(id, name) => {
        if (versionsGuestReadOnly) return;
        renameVersion(id, name);
      }}
      onDuplicate={(id) => {
        if (versionsGuestReadOnly) return;
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        const src = sceneRecord[id];
        const dupName = t("versions.duplicatedVersionName", { name: src?.name ?? "" });
        const created = duplicateVersion(id, dupName);
        if (created) {
          setActiveVersion(created.id);
          toast.success(t("versions.duplicateSuccess", { name: created.name }));
        }
      }}
      onDelete={(id) => {
        if (versionsGuestReadOnly) return;
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        const sc = sceneRecord[id];
        if (!sc) return;
        if (versionHasDiff(sc)) {
          removeVersion(sc.id);
        } else {
          handleDeleteEmptyVersion(sc);
        }
      }}
      onMerge={(scene) => {
        if (versionsGuestReadOnly) return;
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        mergeVersionIntoBase(scene.id);
      }}
      onSelectBase={() => {
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        setActiveVersion(null);
        setCompareVersion(null);
      }}
    />
  );
}

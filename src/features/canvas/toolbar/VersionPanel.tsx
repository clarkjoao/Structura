import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  GitBranch,
  GitMerge,
  Lock,
  Pencil,
  Plug,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  computeMergePreview,
  versionConflicts,
  versionHasDiff,
  useActiveDiagram,
  useDiagramActions,
  VERSION_STATUSES,
  type MergePreview,
  type VersionDiff,
  type VersionStatus,
} from "@/features/diagram";
import {
  deliverVersionAction,
  pluginHandlesVersionActions,
} from "@/features/plugins/version-actions";
import { useInteractionMode } from "../hooks/useInteractionMode";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { MergeVersionDialog } from "./MergeVersionDialog";
import { groupVersionsByStatus, STATUS_LABEL } from "./version-groups";
import { VersionChangesToggle } from "./VersionChangesLegend";

export type VersionPanelVersion = VersionDiff;

/**
 * The diagram's versions: switch, compare, create, rename, duplicate, merge.
 * Content only — the host (the bottom toolbar's popover) positions it and
 * closes it on Escape or an outside click.
 */
export interface VersionPanelProps {
  versions: VersionPanelVersion[];
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
  /** Sets the status of a Version (a plugin-owned one's goes to its plugin). */
  onSetStatus?: (id: string, status: VersionStatus | null) => void;
  /** Version id → how many of its copies conflict with the base (merge waits for zero). */
  conflictCounts?: Readonly<Record<string, number>>;

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
  onSetStatus,
  conflictCount,
}: {
  version: VersionPanelVersion;
  isActive: boolean;
  isCompare: boolean;
  versionsLocked?: boolean;
  versionsGuestReadOnly?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMerge: () => void;
  onSetStatus?: (status: VersionStatus | null) => void;
  conflictCount: number;
}) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const hasDiff = versionHasDiff(version);
  const owned = version.ownerPluginId !== undefined;
  const mergeBlocked = conflictCount > 0;
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

      {owned && (
        <span
          className="shrink-0 text-muted-foreground"
          title={t("versions.ownedBy", { plugin: version.ownerPluginId })}
        >
          <Plug
            className="h-3 w-3"
            aria-label={t("versions.ownedBy", { plugin: version.ownerPluginId })}
          />
        </span>
      )}

      {conflictCount > 0 && (
        <span
          className="flex items-center gap-0.5 shrink-0 text-[9px] font-semibold text-warning"
          title={t("versions.conflictCount", { count: conflictCount })}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {conflictCount}
        </span>
      )}

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
          {onSetStatus && (
            <select
              aria-label={t("versions.statusLabel")}
              title={t("versions.statusLabel")}
              disabled={structuralDisabled}
              value={version.status ?? ""}
              onChange={(e) =>
                onSetStatus(e.target.value === "" ? null : (e.target.value as VersionStatus))
              }
              className="h-6 rounded border border-border bg-background px-1 text-[10px] text-muted-foreground disabled:opacity-40"
            >
              <option value="">{t("versions.statusNone")}</option>
              {VERSION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(STATUS_LABEL[status])}
                </option>
              ))}
            </select>
          )}
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
              disabled={structuralDisabled || mergeBlocked}
              onClick={onMerge}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              title={
                structuralDisabled && readOnlyTitle
                  ? readOnlyTitle
                  : mergeBlocked
                    ? t("versions.mergeBlockedConflicts", { count: conflictCount })
                    : t("versions.mergeIntoBase")
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

export function VersionPanel({
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
  onSetStatus,
  conflictCounts = {},
  versionsLocked = false,
  versionsGuestReadOnly = false,
}: VersionPanelProps) {
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
      <div className="flex flex-col">
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

        <VersionChangesToggle />

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

          {groupVersionsByStatus(versions).map((group) => (
            <div key={group.status ?? "draft"} className="pt-1">
              {(group.status !== null || versions.some((v) => v.status !== undefined)) && (
                <p className="px-3 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(group.status === null ? "versions.statusDraft" : STATUS_LABEL[group.status])}
                </p>
              )}
              {group.versions.map((versionItem) =>
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
                    onMerge={() =>
                      versionItem.ownerPluginId !== undefined
                        ? onMerge(versionItem)
                        : openMergeDialog(versionItem)
                    }
                    onSetStatus={
                      onSetStatus ? (status) => onSetStatus(versionItem.id, status) : undefined
                    }
                    conflictCount={conflictCounts[versionItem.id] ?? 0}
                  />
                ),
              )}
            </div>
          ))}
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

/** `VersionPanel` wired to the active diagram and the store. */
export function ConnectedVersionPanel({ onClose }: { onClose: () => void }) {
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
    setVersionStatus,
  } = useDiagramActions();

  if (!diagram) return null;

  /**
   * Hands an action on a plugin-owned Version to its plugin. True when the Version is owned
   * (whether or not the plugin was there to take it), so the caller leaves the store alone.
   */
  const routedToOwner = (
    version: VersionDiff,
    type: "merge" | "rename" | "delete" | "status",
    name = version.name,
    status: VersionStatus | null = version.status ?? null,
  ): boolean => {
    const owner = version.ownerPluginId;
    if (owner === undefined) return false;
    const key = version.key;
    const delivered =
      key !== undefined &&
      deliverVersionAction(
        owner,
        type === "rename"
          ? { type, diagramId: diagram.id, key, name }
          : type === "status"
            ? { type, diagramId: diagram.id, key, status }
            : { type, diagramId: diagram.id, key },
      );
    if (!delivered) toast.warning(t("versions.ownerInactive", { plugin: owner }));
    return true;
  };
  const conflictCounts = Object.fromEntries(
    Object.keys(diagram.versions ?? {}).map((id) => [id, versionConflicts(diagram, id).length]),
  );
  const owners = [
    ...new Set(
      Object.values(diagram.versions ?? {}).flatMap((v) =>
        v.ownerPluginId !== undefined ? [v.ownerPluginId] : [],
      ),
    ),
  ];
  /** "New version" on a diagram whose Versions a plugin owns: that plugin creates it. */
  const creatingOwner = owners.find((id) => pluginHandlesVersionActions(id));

  const sceneRecord = diagram.versions ?? {};
  const versions = Object.values(sceneRecord).sort((a, b) => a.createdAt - b.createdAt);
  const activeId =
    diagram.activeVersionId && sceneRecord[diagram.activeVersionId]
      ? diagram.activeVersionId
      : null;
  const compareId =
    diagram.compareVersionId && sceneRecord[diagram.compareVersionId]
      ? diagram.compareVersionId
      : null;

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
    <VersionPanel
      versions={versions}
      activeVersionId={activeId}
      compareVersionId={compareId}
      onClose={onClose}
      versionsLocked={versionsLocked}
      versionsGuestReadOnly={versionsGuestReadOnly}
      conflictCounts={conflictCounts}
      onSetStatus={(id, status) => {
        if (versionsGuestReadOnly) return;
        const version = sceneRecord[id];
        if (version && routedToOwner(version, "status", version.name, status)) return;
        setVersionStatus(id, status);
      }}
      onSelectVersion={(id) => handleVersionPillClick(id)}
      onAddVersion={(trimmed) => {
        if (versionsGuestReadOnly) return;
        if (versionsLocked) {
          toast.warning(t("versions.switchBlockedDuringFlow"));
          return;
        }
        if (creatingOwner !== undefined) {
          deliverVersionAction(creatingOwner, { type: "create", diagramId: diagram.id });
          return;
        }
        const name = trimmed.trim() || t("versions.defaultVersionName");
        const created = addVersion(name);
        setActiveVersion(created.id);
      }}
      onRename={(id, name) => {
        if (versionsGuestReadOnly) return;
        const version = sceneRecord[id];
        // A plugin-owned Version is renamed by its plugin, in its own source.
        if (version && routedToOwner(version, "rename", name)) return;
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
        if (routedToOwner(sc, "delete")) return;
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
        if (routedToOwner(scene, "merge")) return;
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

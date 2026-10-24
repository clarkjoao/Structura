import { useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveDiagramId, useAllDiagrams, useFolders } from "@/features/diagram";
import { LinkPalette } from "./LinkPalette";
import { buildDiagramLinkSource, suggestDiagram, type DiagramRef } from "./diagramLinkItems";
import type { PalettePick } from "./palette.types";

export interface DiagramLinkPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element being linked: its name drives the title, the suggestion and "create". */
  elementName: string;
  currentDiagramId?: string | null;
  /** Whether "Create '<name>' and link" is offered. */
  canCreate: boolean;
  onPick: (diagramId: string, pick: PalettePick) => void;
  onCreate: (pick: PalettePick) => void;
}

/**
 * The link palette fed with the workspace's diagrams. Mounted only while open: it subscribes to
 * every diagram, which the panel behind it must not.
 */
export function DiagramLinkPalette({
  open,
  onOpenChange,
  elementName,
  currentDiagramId,
  canCreate,
  onPick,
  onCreate,
}: DiagramLinkPaletteProps) {
  const { t } = useTranslation();
  const diagrams = useAllDiagrams();
  const folders = useFolders();
  const activeId = useActiveDiagramId();

  const source = useMemo(
    () =>
      buildDiagramLinkSource(diagrams, folders, {
        excludeId: activeId,
        levelLabel: (level) =>
          ({
            context: t("canvasToolbar.levelContext"),
            container: t("canvasToolbar.levelContainer"),
            component: t("canvasToolbar.levelComponent"),
            deployment: t("canvasToolbar.levelDeployment"),
          })[level] ?? level,
        importedLabel: t("diagramLink.imported"),
        noFolderLabel: t("diagramLink.noFolder"),
        icon: <LayoutDashboard className="h-4 w-4" />,
      }),
    [diagrams, folders, activeId, t],
  );

  const name = elementName.trim();
  const suggestions = useMemo(
    () => suggestDiagram(source.items, name, t("diagramLink.sameName")),
    [source.items, name, t],
  );

  if (!open) return null;

  return (
    <LinkPalette<DiagramRef>
      open={open}
      onOpenChange={onOpenChange}
      title={t("diagramLink.title", { name: name || t("common.unnamedElement") })}
      items={source.items}
      groups={source.groups}
      recentIds={source.recentIds}
      suggestions={suggestions}
      createAction={
        canCreate && name ? { label: t("diagramLink.createAndLink", { name }) } : undefined
      }
      currentId={currentDiagramId}
      searchPlaceholder={t("diagramLink.searchPlaceholder")}
      onPick={(item, pick) => onPick(item.payload.id, pick)}
      onCreate={onCreate}
    />
  );
}

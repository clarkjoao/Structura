import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Diagram } from "@/features/diagram";
import { removeRecentRef, useDiagramActions, useFolders } from "@/features/diagram";
import { deletePreview } from "@/lib/diagram-preview/previewCache";
import { getPreview } from "@/lib/diagram-preview";
import { cn } from "@/lib/utils";
import { DiagramCardFooter } from "@/pages/dashboard/components/diagram-card/DiagramCardFooter";
import { DiagramCardPreview } from "@/pages/dashboard/components/diagram-card/DiagramCardPreview";
import { MoveDiagramDialog } from "@/pages/dashboard/components/diagram-card/MoveDiagramDialog";
import { RenameDiagramModal } from "@/pages/dashboard/RenameDiagramModal";

interface DiagramCardProps {
  diagram: Diagram;
  index: number;
  isSelected: boolean;
  onSelect: (diagram: Diagram, event: ReactMouseEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent, diagramId: string) => void;
  levelLabels: Record<string, string>;
}

export function DiagramCard({
  diagram,
  index,
  isSelected,
  onSelect,
  onDragStart,
  levelLabels,
}: DiagramCardProps) {
  const { t } = useTranslation();
  const folders = useFolders();
  const { updateDiagram, updateDiagramDescription, duplicateDiagram, moveDiagram, deleteDiagram } =
    useDiagramActions();
  const [preview, setPreview] = useState<string | null>(() => getPreview(diagram.id));
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [moveFolderOpen, setMoveFolderOpen] = useState(false);
  const [renamingDiagram, setRenamingDiagram] = useState<Diagram | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sortedFolders = useMemo(
    () =>
      Object.values(folders).sort((folderA, folderB) => folderA.name.localeCompare(folderB.name)),
    [folders],
  );

  const componentCount = Object.keys(diagram.snapshot.components).length;
  const connectionCount = Object.keys(diagram.snapshot.connections).length;
  const flowCount = Object.keys(diagram.snapshot.flows).length;

  useEffect(() => {
    setPreview(getPreview(diagram.id));
  }, [diagram.updatedAt, diagram.id]);

  const handleRename = (event: ReactMouseEvent) => {
    event.stopPropagation();
    setRenamingDiagram(diagram);
  };

  const handleDuplicate = (event: ReactMouseEvent) => {
    event.stopPropagation();
    duplicateDiagram(diagram.id, t("dashboard.card.duplicatedDiagramName", { name: diagram.name }));
  };

  const handleMove = (event: ReactMouseEvent) => {
    event.stopPropagation();
    setMoveFolderOpen(true);
  };

  const handleDelete = (event: ReactMouseEvent) => {
    event.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleSelectMoveFolder = (event: ReactMouseEvent, folderId: string | null) => {
    event.stopPropagation();
    moveDiagram(diagram.id, folderId);
    setMoveFolderOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        draggable={!isPreviewHovered}
        onDragStart={(event) => onDragStart(event as unknown as DragEvent, diagram.id)}
        onClick={(event) => onSelect(diagram, event)}
        className={cn(
          "group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]",
          isSelected && "ring-2 ring-primary",
        )}
      >
        <DiagramCardPreview
          diagram={diagram}
          preview={preview}
          isPreviewHovered={isPreviewHovered}
          onPreviewMouseEnter={() => setIsPreviewHovered(true)}
          onPreviewMouseLeave={() => setIsPreviewHovered(false)}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onMove={handleMove}
          onDelete={handleDelete}
        />
        <DiagramCardFooter
          diagram={diagram}
          levelLabels={levelLabels}
          componentCount={componentCount}
          connectionCount={connectionCount}
          flowCount={flowCount}
        />
      </motion.div>

      <MoveDiagramDialog
        open={moveFolderOpen}
        onOpenChange={setMoveFolderOpen}
        sortedFolders={sortedFolders}
        onSelectFolder={handleSelectMoveFolder}
      />

      <RenameDiagramModal
        open={!!renamingDiagram}
        onOpenChange={(open) => {
          if (!open) setRenamingDiagram(null);
        }}
        diagram={renamingDiagram}
        onSave={(name, description) => {
          if (!renamingDiagram) return;
          updateDiagram(renamingDiagram.id, { name });
          updateDiagramDescription(renamingDiagram.id, description);
          setRenamingDiagram(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("diagram.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("diagram.deleteConfirmDescription", {
                name: diagram.name,
                nodeCount: componentCount,
                flowCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deletePreview(diagram.id);
                deleteDiagram(diagram.id);
                removeRecentRef(diagram.id);
                setDeleteDialogOpen(false);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

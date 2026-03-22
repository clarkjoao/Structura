import type { DragEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { useDiagramActions, useFolders } from "@/features/diagram";
import { getPreview } from "@/lib/diagram-preview";
import { DiagramCardFooter } from "./components/diagram-card/DiagramCardFooter";
import { DiagramCardPreview } from "./components/diagram-card/DiagramCardPreview";
import { MoveDiagramDialog } from "./components/diagram-card/MoveDiagramDialog";

interface DiagramCardProps {
  diagram: Diagram;
  index: number;
  onOpen: (diagram: Diagram) => void;
  onDragStart: (event: DragEvent, diagramId: string) => void;
  levelLabels: Record<string, string>;
}

export function DiagramCard({
  diagram,
  index,
  onOpen,
  onDragStart,
  levelLabels,
}: DiagramCardProps) {
  const { t } = useTranslation();
  const folders = useFolders();
  const { updateDiagram, duplicateDiagram, moveDiagram, deleteDiagram } =
    useDiagramActions();
  const [preview, setPreview] = useState<string | null>(() => getPreview(diagram.id));
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [moveFolderOpen, setMoveFolderOpen] = useState(false);

  const sortedFolders = useMemo(
    () => Object.values(folders).sort((folderA, folderB) => folderA.name.localeCompare(folderB.name)),
    [folders],
  );

  const componentCount = Object.keys(diagram.snapshot.components).length;
  const connectionCount = Object.keys(diagram.snapshot.connections).length;
  const flowCount = Object.keys(diagram.snapshot.flows).length;

  useEffect(() => {
    setPreview(getPreview(diagram.id));
  }, [diagram.updatedAt, diagram.id]);

  const handleRename = (event: MouseEvent) => {
    event.stopPropagation();
    const newName = window.prompt(t("dashboard.card.renamePrompt"), diagram.name);
    if (newName?.trim()) updateDiagram(diagram.id, { name: newName.trim() });
  };

  const handleDuplicate = (event: MouseEvent) => {
    event.stopPropagation();
    duplicateDiagram(
      diagram.id,
      t("dashboard.card.duplicatedDiagramName", { name: diagram.name }),
    );
  };

  const handleMove = (event: MouseEvent) => {
    event.stopPropagation();
    setMoveFolderOpen(true);
  };

  const handleDelete = (event: MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(t("dashboard.card.deleteConfirm", { name: diagram.name }))) {
      deleteDiagram(diagram.id);
    }
  };

  const handleSelectMoveFolder = (event: MouseEvent, folderId: string | null) => {
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
        onClick={() => onOpen(diagram)}
        className="group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
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
    </>
  );
}

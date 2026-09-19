import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Diagram } from "@/features/diagram";
import { getPreview } from "@/lib/diagram-preview";
import { cn } from "@/lib/utils";
import { DiagramCardFooter } from "@/pages/dashboard/components/diagram-card/DiagramCardFooter";
import { DiagramCardPreview } from "@/pages/dashboard/components/diagram-card/DiagramCardPreview";

interface DiagramCardProps {
  diagram: Diagram;
  index: number;
  isSelected: boolean;
  onSelect: (diagram: Diagram, event: ReactMouseEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent, diagramId: string) => void;
  levelLabels: Record<string, string>;
  isFavorite?: boolean;
  onToggleFavorite?: (diagramId: string) => void;
}

export function DiagramCard({
  diagram,
  index,
  isSelected,
  onSelect,
  onDragStart,
  levelLabels,
  isFavorite = false,
  onToggleFavorite,
}: DiagramCardProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const componentCount = Object.keys(diagram.snapshot.components).length;
  const connectionCount = Object.keys(diagram.snapshot.connections).length;
  const flowCount = Object.keys(diagram.snapshot.flows).length;

  useEffect(() => {
    setPreview(getPreview(diagram.id));
  }, [diagram.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      draggable
      onDragStart={(event) => onDragStart(event as unknown as DragEvent, diagram.id)}
      onClick={(event) => onSelect(diagram, event)}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-md",
        isSelected && "ring-2 ring-primary",
      )}
    >
      <DiagramCardPreview diagram={diagram} preview={preview} />
      <DiagramCardFooter
        diagram={diagram}
        levelLabels={levelLabels}
        componentCount={componentCount}
        connectionCount={connectionCount}
        flowCount={flowCount}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    </motion.div>
  );
}

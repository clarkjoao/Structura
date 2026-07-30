import { useActiveDiagramModel } from "@/features/diagram";

export interface DiagramDescriptionFieldProps {
  editLocked: boolean;
}

export function DiagramDescriptionField({ editLocked }: DiagramDescriptionFieldProps) {
  const diagram = useActiveDiagramModel();

  if (editLocked || !diagram) return null;
  if (!diagram.description?.trim()) return null;

  return (
    <p className="text-[11px] text-muted-foreground truncate pl-[22px]" title={diagram.description}>
      {diagram.description}
    </p>
  );
}

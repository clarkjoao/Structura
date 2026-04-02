import {
  useActiveDiagram,
} from "@/features/diagram";

export interface DiagramDescriptionFieldProps {
  editLocked: boolean;
}

export function DiagramDescriptionField({ editLocked: _editLocked }: DiagramDescriptionFieldProps) {
  const diagram = useActiveDiagram();

  if (!diagram) return null;
  if (!diagram.description?.trim()) return null;

  return (
    <p
      className="text-[11px] text-muted-foreground truncate pl-[22px]"
      title={diagram.description}
    >
      {diagram.description}
    </p>
  );
}

import { ArrowRight } from "lucide-react";

interface PatternFlowPreviewProps {
  components: { name: string }[];
}


export function PatternFlowPreview({ components }: PatternFlowPreviewProps) {
  const nodes = components;
  if (nodes.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1.5">
      {nodes.map((c, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div className="rounded border border-border bg-secondary/80 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground whitespace-nowrap max-w-[80px] truncate">
            {c.name}
          </div>
          {i < nodes.length - 1 && (
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

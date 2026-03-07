import { useComponents, useConnections } from "@/lib/model-store";
import type { FlowStep, Component, Connection } from "@/lib/model-types";
import { X } from "lucide-react";
import { toast } from "sonner";

export function stepsToMermaid(
  steps: FlowStep[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  const lines = ["sequenceDiagram"];
  steps.forEach((step) => {
    if (step.connectionId) {
      const conn = connections[step.connectionId];
      if (conn) {
        const src = components[conn.sourceId]?.name ?? "?";
        const tgt = components[conn.targetId]?.name ?? "?";
        lines.push(`  ${src}->>${tgt}: ${conn.label}`);
      }
    } else if (step.componentId) {
      const name = components[step.componentId]?.name ?? "?";
      lines.push(`  Note over ${name}: step ${step.order + 1}`);
    }
  });
  return lines.join("\n");
}

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  steps: FlowStep[];
  onCancel: () => void;
  onFinalize: () => void;
}

const FlowRecorderPanel = ({
  name,
  onNameChange,
  steps,
  onCancel,
  onFinalize,
}: Props) => {
  const components = useComponents();
  const connections = useConnections();

  const getStepLabel = (step: FlowStep): string => {
    if (step.connectionId) {
      const conn = connections[step.connectionId];
      if (conn) return `→ ${conn.label}`;
    }
    if (step.componentId) {
      return components[step.componentId]?.name ?? "?";
    }
    return "?";
  };

  const handleFinalize = () => {
    if (!name.trim()) {
      toast.warning("Nome do flow está vazio");
    }
    if (steps.length === 0) {
      toast.warning("Nenhum passo gravado");
    }
    onFinalize();
  };

  const mermaidPreview = stepsToMermaid(steps, components, connections);

  return (
    <div className="w-80 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Gravando Flow
          </h3>
        </div>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-auto">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Nome do flow"
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />

        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Passos ({steps.length})
          </p>
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Clique em nós e conexões no canvas para gravar passos.
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-auto">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    i === steps.length - 1
                      ? "bg-primary/10 text-primary"
                      : "text-foreground"
                  }`}
                >
                  <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">
                    {step.order + 1}.
                  </span>
                  <span className="truncate">{getStepLabel(step)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {steps.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Mermaid
            </p>
            <pre className="rounded-md border border-border bg-secondary p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
              {mermaidPreview}
            </pre>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <button
          onClick={handleFinalize}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Finalizar
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default FlowRecorderPanel;

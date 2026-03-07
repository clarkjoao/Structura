import { X, Plus, Play, Trash2 } from "lucide-react";
import { useFlows, useDiagramActions } from "@/lib/model-store";
import type { Flow } from "@/lib/model-types";

interface Props {
  onClose: () => void;
  onPlay: (flow: Flow) => void;
  onStartRecording: () => void;
}

const FlowPanel = ({ onClose, onPlay, onStartRecording }: Props) => {
  const flows = useFlows();
  const { removeFlow } = useDiagramActions();

  return (
    <div className="w-80 border-l border-border bg-card overflow-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Flows
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {flows.map((flow) => (
          <div key={flow.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-surface-hover transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{flow.name}</p>
              <p className="text-[10px] text-muted-foreground">{flow.steps.length} passos</p>
            </div>
            <button onClick={() => onPlay(flow)} className="text-primary hover:text-primary/80 transition-colors" title="Iniciar flow">
              <Play className="h-4 w-4" />
            </button>
            <button onClick={() => removeFlow(flow.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remover">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {flows.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum flow definido.</p>
        )}

        <button onClick={onStartRecording}
          className="flex items-center gap-1.5 w-full justify-center rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all">
          <Plus className="h-3.5 w-3.5" /> Novo Flow
        </button>
      </div>
    </div>
  );
};

export default FlowPanel;

import { ChevronLeft, ChevronRight, X, MessageSquare } from "lucide-react";
import type { Flow } from "@/lib/model-types";

interface Props {
  flow: Flow;
  currentStep: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

const FlowStepNavigator = ({ flow, currentStep, onPrev, onNext, onExit }: Props) => {
  const step = flow.steps[currentStep];
  const total = flow.steps.length;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[420px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onPrev} disabled={currentStep === 0}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-foreground truncate">{flow.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {currentStep + 1} / {total}
          </span>
          <button onClick={onNext} disabled={currentStep >= total - 1}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button onClick={onExit} className="text-muted-foreground hover:text-foreground transition-colors" title="Sair do flow">
          <X className="h-4 w-4" />
        </button>
      </div>

      {step?.note && (
        <div className="px-4 py-3 flex items-start gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground leading-relaxed">{step.note}</p>
        </div>
      )}

      <div className="px-4 py-2 flex justify-center gap-2">
        <button onClick={onPrev} disabled={currentStep === 0}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <button onClick={onNext} disabled={currentStep >= total - 1}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          Próximo <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default FlowStepNavigator;

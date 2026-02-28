import { useState } from "react";
import { Plus, User, Network, Server, Database, ChevronUp, Layers } from "lucide-react";
import { useModel } from "@/lib/model-store";
import type { C4ElementType } from "@/lib/model-types";

const elementOptions: { type: C4ElementType; label: string; icon: typeof Network }[] = [
  { type: "person",    label: "Person",    icon: User },
  { type: "system",    label: "System",    icon: Network },
  { type: "container", label: "Container", icon: Server },
  { type: "component", label: "Component", icon: Database },
];

const CanvasToolbar = () => {
  const { activeView, navigateUp, addElement, draft } = useModel();
  const [showAdd, setShowAdd] = useState(false);

  const levelLabels: Record<string, string> = {
    context: "System Context",
    container: "Container",
    component: "Component",
  };

  const handleAdd = (type: C4ElementType) => {
    const name = `Novo ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    addElement(type, name, activeView.rootElementId, { x: 300, y: 200 });
    setShowAdd(false);
  };

  const canGoUp = activeView.rootElementId !== null;

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      {/* View info */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">{activeView.name}</span>
        <span className="text-[10px] font-mono text-muted-foreground rounded bg-secondary px-1.5 py-0.5">
          {levelLabels[activeView.level]}
        </span>
      </div>

      {/* Navigation */}
      {canGoUp && (
        <button
          onClick={navigateUp}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Nível acima
        </button>
      )}

      {/* Add element */}
      <div className="relative">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Elemento
        </button>

        {showAdd && (
          <div className="absolute top-full left-0 mt-1 rounded-lg border border-border bg-card shadow-xl py-1 min-w-[160px]">
            {elementOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAdd(opt.type)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
              >
                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasToolbar;

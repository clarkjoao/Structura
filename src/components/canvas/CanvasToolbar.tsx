import { useState } from "react";
import {
  Plus,
  User,
  Network,
  Server,
  Database,
  ChevronUp,
  Layers,
  ChevronRight,
  Cloud,
} from "lucide-react";
import { useActiveBluePrintView, useDiagramActions } from "@/lib/model-store";
import type { ComponentType } from "@/lib/model-types";
import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/aws-catalog";
import AwsIcon from "./AwsIcon";

const c4Options: {
  type: ComponentType;
  label: string;
  icon: typeof Network;
}[] = [
  { type: "person", label: "Person", icon: User },
  { type: "system", label: "System", icon: Network },
  { type: "container", label: "Container", icon: Server },
  { type: "component", label: "Component", icon: Database },
];

const levelLabels: Record<string, string> = {
  context: "System Context",
  container: "Container",
  component: "Component",
};

const CanvasToolbar = () => {
  const activeView = useActiveBluePrintView();
  const { navigateUp, addComponent } = useDiagramActions();

  const [showAdd, setShowAdd] = useState(false);
  const [showAws, setShowAws] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const handleAddC4 = (type: ComponentType) => {
    const name = `Novo ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    addComponent(type, name, activeView.rootElementId, { x: 300, y: 200 });
    setShowAdd(false);
  };

  const handleAddAws = (
    categoryId: AwsCategoryId,
    serviceId: string,
    serviceName: string,
  ) => {
    addComponent(
      categoryId,
      serviceName,
      activeView.rootElementId,
      { x: 300, y: 200 },
      serviceId,
    );
    setShowAws(false);
    setShowAdd(false);
    setExpandedCat(null);
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

      {/* Add component */}
      <div className="relative">
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setShowAws(false);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-primary hover:bg-surface-hover transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Elemento
        </button>

        {showAdd && (
          <div className="absolute top-full left-0 mt-1 rounded-lg border border-border bg-card shadow-xl py-1 min-w-[200px]">
            {/* C4 components */}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                C4 Model
              </span>
            </div>
            {c4Options.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAddC4(opt.type)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
              >
                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {opt.label}
              </button>
            ))}

            {/* AWS separator */}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => setShowAws(!showAws)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors font-medium text-[hsl(var(--aws-orange))]"
            >
              <Cloud className="h-3.5 w-3.5" />
              AWS Services
              <ChevronRight
                className={`h-3 w-3 ml-auto transition-transform ${showAws ? "rotate-90" : ""}`}
              />
            </button>
          </div>
        )}

        {/* AWS service palette */}
        {showAdd && showAws && (
          <div className="absolute top-full left-[208px] mt-1 rounded-lg border border-border bg-card shadow-xl py-1 min-w-[240px] max-h-[70vh] overflow-auto">
            {AWS_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <button
                  onClick={() =>
                    setExpandedCat(expandedCat === cat.id ? null : cat.id)
                  }
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold hover:bg-surface-hover transition-colors"
                >
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${expandedCat === cat.id ? "rotate-90" : ""}`}
                  />
                  <span className="text-foreground">{cat.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                    {cat.services.length}
                  </span>
                </button>

                {expandedCat === cat.id && (
                  <div className="pl-2">
                    {cat.services.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() =>
                          handleAddAws(
                            cat.id as AwsCategoryId,
                            svc.id,
                            svc.name,
                          )
                        }
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] hover:bg-surface-hover transition-colors"
                      >
                        <AwsIcon iconName={svc.iconName} size={18} />
                        <span className="text-foreground truncate">
                          {svc.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasToolbar;

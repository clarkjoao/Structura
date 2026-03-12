import { useEffect, useRef, useState, useMemo } from "react";
import { User, Network, Server, Database } from "lucide-react";
import { useDiagramActions, useAllServices } from "@/features/diagram";
import type { ComponentType } from "@/features/diagram";

const C4_OPTIONS: {
  type: ComponentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "person", label: "Person", icon: User },
  { type: "system", label: "System", icon: Network },
  { type: "container", label: "Container", icon: Server },
  { type: "component", label: "Component", icon: Database },
];

const POPOVER_W = 240;
const POPOVER_H_MAX = 320;

interface QuickInsertPopoverProps {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  sourceNodeId: string;
  onInsert: (newNodeId: string) => void;
  onClose: () => void;
}

const QuickInsertPopover = ({
  screenPos,
  flowPos,
  sourceNodeId,
  onInsert,
  onClose,
}: QuickInsertPopoverProps) => {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addComponent, addConnection, linkComponentToService } =
    useDiagramActions();
  const services = useAllServices();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const filteredC4 = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return C4_OPTIONS;
    return C4_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [search]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.technology.some((t) => t.toLowerCase().includes(q)) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [search, services]);

  const handleSelectC4 = (type: ComponentType, label: string) => {
    const comp = addComponent(type, `Novo ${label}`, null, {
      x: flowPos.x + 20,
      y: flowPos.y + 20,
    });
    addConnection(sourceNodeId, comp.id, "Usa");
    onInsert(comp.id);
  };

  const handleSelectService = (serviceId: string, name: string) => {
    const comp = addComponent("system", name, null, {
      x: flowPos.x + 20,
      y: flowPos.y + 20,
    });
    linkComponentToService(comp.id, serviceId);
    addConnection(sourceNodeId, comp.id, "Usa");
    onInsert(comp.id);
  };

  const left = Math.min(screenPos.x + 8, window.innerWidth - POPOVER_W - 8);
  const top = Math.min(screenPos.y + 8, window.innerHeight - POPOVER_H_MAX - 8);

  const showEmpty = search.trim() && filteredC4.length === 0 && filteredServices.length === 0;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 rounded-lg border border-border bg-card shadow-xl"
      style={{ left, top, width: POPOVER_W }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar elemento..."
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="max-h-64 overflow-y-auto pb-1">
        {filteredC4.length > 0 && (
          <>
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                C4 Model
              </span>
            </div>
            {filteredC4.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleSelectC4(opt.type, opt.label)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
              >
                <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {opt.label}
              </button>
            ))}
          </>
        )}
        {filteredServices.length > 0 && (
          <>
            {filteredC4.length > 0 && <div className="border-t border-border my-1" />}
            <div className="px-3 py-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                Registry
              </span>
            </div>
            {filteredServices.map((svc) => (
              <button
                key={svc.id}
                onClick={() => handleSelectService(svc.id, svc.name)}
                className="flex flex-col w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-left"
              >
                <span className="font-medium text-foreground">{svc.name}</span>
                {svc.technology.length > 0 && (
                  <span className="text-muted-foreground">
                    {svc.technology.slice(0, 2).join(", ")}
                  </span>
                )}
              </button>
            ))}
          </>
        )}
        {showEmpty && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Nenhum resultado
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickInsertPopover;

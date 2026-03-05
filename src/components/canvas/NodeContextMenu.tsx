import { useCallback, useEffect, useRef } from "react";
import { ArrowUpToLine, ArrowDownToLine } from "lucide-react";

interface Props {
  x: number;
  y: number;
  elementId: string;
  onBringToFront: (elementId: string) => void;
  onSendToBack: (elementId: string) => void;
  onClose: () => void;
}

const NodeContextMenu = ({
  x,
  y,
  elementId,
  onBringToFront,
  onSendToBack,
  onClose,
}: Props) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-1.5">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          Ordenação
        </span>
      </div>
      <button
        onClick={() => {
          onBringToFront(elementId);
          onClose();
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-foreground"
      >
        <ArrowUpToLine className="h-3.5 w-3.5 text-muted-foreground" />
        Trazer para frente
      </button>
      <button
        onClick={() => {
          onSendToBack(elementId);
          onClose();
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-surface-hover transition-colors text-foreground"
      >
        <ArrowDownToLine className="h-3.5 w-3.5 text-muted-foreground" />
        Enviar para trás
      </button>
    </div>
  );
};

export default NodeContextMenu;

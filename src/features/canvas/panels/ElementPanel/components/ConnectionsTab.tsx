import { useState, useMemo, useEffect } from "react";
import { Search, ArrowRight, GripVertical } from "lucide-react";
import {
  useConnections,
  useComponents,
  useComponent,
  useDiagramActions,
  applyHandleOrder,
} from "@/features/diagram";
import type { ComponentType, Connection } from "@/features/diagram";
import { useHandleHighlight } from "../../../contexts/HandleHighlightContext";
import { Network as NetworkIcon, Server, Database, User } from "lucide-react";

const typeIcons: Record<string, typeof NetworkIcon> = {
  person: User,
  system: NetworkIcon,
  container: Server,
  component: Database,
};

function NodeIcon({ type }: { type: ComponentType }) {
  const Icon = typeIcons[type] ?? NetworkIcon;
  return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
}

interface DragState {
  connId: string;
  side: "incoming" | "outgoing";
}

interface GroupProps {
  label: string;
  conns: Connection[];
  side: "incoming" | "outgoing";
  componentId: string;
  dragState: DragState | null;
  dragOverId: string | null;
  highlightedConnId: string | null;
  hasHighlight: boolean;
  onDragStart: (connId: string, side: "incoming" | "outgoing") => void;
  onDragOver: (
    e: React.DragEvent,
    connId: string,
    side: "incoming" | "outgoing",
  ) => void;
  onDrop: (
    e: React.DragEvent,
    targetConnId: string,
    side: "incoming" | "outgoing",
  ) => void;
  onDragEnd: () => void;
  onConnClick: (connId: string, side: "incoming" | "outgoing") => void;
}

function ConnectionGroup({
  label,
  conns,
  side,
  componentId,
  dragState,
  dragOverId,
  highlightedConnId,
  hasHighlight,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onConnClick,
}: GroupProps) {
  const components = useComponents();
  const self = components[componentId];

  if (conns.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
        {label} ({conns.length})
      </div>
      {conns.map((conn) => {
        const isSource = conn.sourceId === componentId;
        const peerId = isSource ? conn.targetId : conn.sourceId;
        const peer = components[peerId];
        const source = isSource ? self : peer;
        const target = isSource ? peer : self;
        const isDragging =
          dragState?.connId === conn.id && dragState.side === side;
        const isOver =
          dragOverId === conn.id &&
          dragState?.side === side &&
          dragState.connId !== conn.id;

        const isHighlighted = highlightedConnId === conn.id;
        const dimmed = hasHighlight && !isHighlighted;

        return (
          <div
            key={conn.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(conn.id, side);
            }}
            onDragOver={(e) => onDragOver(e, conn.id, side)}
            onDrop={(e) => onDrop(e, conn.id, side)}
            onDragEnd={onDragEnd}
            onClick={() => onConnClick(conn.id, side)}
            className={`flex items-center gap-1.5 rounded-md bg-secondary/50 border px-2.5 py-2 text-xs cursor-pointer select-none transition-all duration-150 ${
              isDragging
                ? "opacity-40"
                : dimmed
                  ? "opacity-40 hover:opacity-70"
                  : "opacity-100"
            } ${isHighlighted ? "bg-cyan-500/10 border-l-2 border-cyan-500 border-border" : isOver ? "border-t-2 border-t-primary border-border" : "border-border"}`}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground shrink-0 transition-colors" />
            {source && <NodeIcon type={source.type} />}
            <span className="text-foreground font-medium truncate max-w-[60px]">
              {source?.name ?? "?"}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            {target && <NodeIcon type={target.type} />}
            <span className="text-foreground font-medium truncate max-w-[60px]">
              {target?.name ?? "?"}
            </span>
            <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[70px]">
              {conn.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ConnectionsTab = ({ componentId }: { componentId: string }) => {
  const connections = useConnections();
  const component = useComponent(componentId);
  const { updateHandleOrder } = useDiagramActions();
  const [search, setSearch] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [highlightedConnId, setHighlightedConnId] = useState<string | null>(
    null,
  );
  const { highlightedConnectionId, setHighlight, clearHighlight } =
    useHandleHighlight();

  const { incoming, outgoing } = useMemo(() => {
    const allConns = Object.values(connections);
    return {
      incoming: applyHandleOrder(
        allConns.filter((c) => c.targetId === componentId),
        component?.handleOrder?.incoming ?? [],
      ),
      outgoing: applyHandleOrder(
        allConns.filter((c) => c.sourceId === componentId),
        component?.handleOrder?.outgoing ?? [],
      ),
    };
  }, [connections, componentId, component?.handleOrder]);

  const filteredIncoming = useMemo(() => {
    if (!search) return incoming;
    const q = search.toLowerCase();
    return incoming.filter((conn) => conn.label.toLowerCase().includes(q));
  }, [incoming, search]);

  const filteredOutgoing = useMemo(() => {
    if (!search) return outgoing;
    const q = search.toLowerCase();
    return outgoing.filter((conn) => conn.label.toLowerCase().includes(q));
  }, [outgoing, search]);

  useEffect(() => {
    setHighlightedConnId(null);
    clearHighlight();
  }, [componentId, clearHighlight]);

  useEffect(() => {
    return () => clearHighlight();
  }, [clearHighlight]);

  useEffect(() => {
    if (highlightedConnectionId === null) {
      setHighlightedConnId(null);
    }
  }, [highlightedConnectionId]);

  const handleConnClick = (connId: string) => {
    if (highlightedConnId === connId) {
      setHighlightedConnId(null);
      clearHighlight();
    } else {
      setHighlightedConnId(connId);
      const nodeIds = [
        connections[connId].sourceId,
        connections[connId].targetId,
      ];
      setHighlight(connId, nodeIds);
    }
  };

  const handleDragStart = (connId: string, side: "incoming" | "outgoing") => {
    setDragState({ connId, side });
  };

  const handleDragOver = (
    e: React.DragEvent,
    connId: string,
    side: "incoming" | "outgoing",
  ) => {
    if (dragState?.side !== side) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(connId);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetConnId: string,
    side: "incoming" | "outgoing",
  ) => {
    e.preventDefault();
    if (!dragState || dragState.side !== side) return;
    const list = side === "incoming" ? incoming : outgoing;
    const oldIdx = list.findIndex((c) => c.id === dragState.connId);
    const newIdx = list.findIndex((c) => c.id === targetConnId);
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) {
      setDragState(null);
      setDragOverId(null);
      return;
    }
    const newOrder = list.map((c) => c.id);
    newOrder.splice(oldIdx, 1);
    newOrder.splice(newIdx, 0, dragState.connId);
    updateHandleOrder(componentId, side, newOrder);
    setDragState(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDragOverId(null);
  };

  const totalCount = incoming.length + outgoing.length;

  if (totalCount === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground italic text-center">
        Nenhuma conexão encontrada.
      </div>
    );
  }

  const isSearching = !!search;

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por label..."
          className="w-full rounded-md border border-border bg-secondary pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {!isSearching && (
        <p className="text-[10px] text-muted-foreground/60 italic">
          Arraste as linhas para reordenar os handles.
        </p>
      )}
      <div className="space-y-3">
        <ConnectionGroup
          label="Entradas"
          conns={isSearching ? filteredIncoming : incoming}
          side="incoming"
          componentId={componentId}
          dragState={isSearching ? null : dragState}
          dragOverId={isSearching ? null : dragOverId}
          highlightedConnId={highlightedConnId}
          hasHighlight={highlightedConnId !== null}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onConnClick={handleConnClick}
        />
        <ConnectionGroup
          label="Saídas"
          conns={isSearching ? filteredOutgoing : outgoing}
          side="outgoing"
          componentId={componentId}
          dragState={isSearching ? null : dragState}
          dragOverId={isSearching ? null : dragOverId}
          highlightedConnId={highlightedConnId}
          hasHighlight={highlightedConnId !== null}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onConnClick={handleConnClick}
        />
        {isSearching &&
          filteredIncoming.length === 0 &&
          filteredOutgoing.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Nenhum resultado para &ldquo;{search}&rdquo;
            </p>
          )}
      </div>
    </div>
  );
};

export default ConnectionsTab;

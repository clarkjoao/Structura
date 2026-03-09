import { useState, useMemo } from "react";
import { Search, ArrowRight, Network, Server, Database, User } from "lucide-react";
import { useConnections, useComponents } from "@/features/diagram";
import type { ComponentType, Connection } from "@/features/diagram";

const typeIcons: Record<string, typeof Network> = {
  person: User,
  system: Network,
  container: Server,
  component: Database,
};

function NodeIcon({ type }: { type: ComponentType }) {
  const Icon = typeIcons[type] ?? Network;
  return <Icon className="h-3 w-3 text-muted-foreground shrink-0" />;
}

const ConnectionsTab = ({ componentId }: { componentId: string }) => {
  const connections = useConnections();
  const components = useComponents();
  const [search, setSearch] = useState("");

  const { incoming, outgoing } = useMemo(() => {
    const allConns = Object.values(connections);
    return {
      incoming: allConns.filter((c) => c.targetId === componentId),
      outgoing: allConns.filter((c) => c.sourceId === componentId),
    };
  }, [connections, componentId]);

  const allEntries = useMemo(() => {
    const entries: { conn: Connection; direction: "in" | "out"; peerId: string }[] = [];
    for (const c of incoming) entries.push({ conn: c, direction: "in", peerId: c.sourceId });
    for (const c of outgoing) entries.push({ conn: c, direction: "out", peerId: c.targetId });
    return entries;
  }, [incoming, outgoing]);

  const filtered = useMemo(() => {
    if (!search) return allEntries;
    const q = search.toLowerCase();
    return allEntries.filter((e) => {
      const peer = components[e.peerId];
      return peer?.name.toLowerCase().includes(q) || e.conn.label.toLowerCase().includes(q);
    });
  }, [allEntries, search, components]);

  if (allEntries.length === 0)
    return <div className="p-4 text-xs text-muted-foreground italic text-center">Nenhuma conexão encontrada.</div>;

  const self = components[componentId];

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nome ou label..."
          className="w-full rounded-md border border-border bg-secondary pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div className="text-[10px] text-muted-foreground">
        {incoming.length} entrada{incoming.length !== 1 ? "s" : ""} · {outgoing.length} saída{outgoing.length !== 1 ? "s" : ""}
      </div>
      <div className="space-y-1">
        {filtered.map((entry) => {
          const peer = components[entry.peerId];
          if (!peer) return null;
          const source = entry.direction === "in" ? peer : self;
          const target = entry.direction === "in" ? self : peer;
          return (
            <div key={entry.conn.id} className="flex items-center gap-1.5 rounded-md bg-secondary/50 border border-border px-2.5 py-2 text-xs">
              {source && <NodeIcon type={source.type} />}
              <span className="text-foreground font-medium truncate max-w-[60px]">{source?.name ?? "?"}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              {target && <NodeIcon type={target.type} />}
              <span className="text-foreground font-medium truncate max-w-[60px]">{target?.name ?? "?"}</span>
              <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[70px]">{entry.conn.label}</span>
            </div>
          );
        })}
        {filtered.length === 0 && search && (
          <p className="text-xs text-muted-foreground italic text-center py-2">Nenhum resultado para &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
};

export default ConnectionsTab;

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Layers, Clock, Network, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAllDiagrams, useDiagramActions } from "@/lib/model-store";
import type { Level, Diagram } from "@/lib/model-types";

const levelLabels: Record<string, string> = { context: "Level 1", container: "Level 2", component: "Level 3" };

type SortKey = "name" | "domain" | "level" | "updatedAt";

const Dashboard = () => {
  const diagrams = useAllDiagrams();
  const { addDiagram, openDiagram, deleteDiagram } = useDiagramActions();
  const navigate = useNavigate();

  const [showAdd, setShowAdd] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...diagrams];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "domain") cmp = (a.domain ?? "").localeCompare(b.domain ?? "");
      else if (sortKey === "level") cmp = a.level.localeCompare(b.level);
      else cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [diagrams, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleOpen = (d: Diagram) => {
    openDiagram(d.id);
    navigate(`/model/${d.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteDiagram(id);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " ↑" : " ↓";
  };

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Diagrams</h1>
            <p className="text-sm text-muted-foreground mt-1">Seus diagramas de arquitetura C4</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> New diagram
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="w-10 px-4 py-3" />
                <th onClick={() => handleSort("name")} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                  Diagram name{sortIcon("name")}
                </th>
                <th onClick={() => handleSort("domain")} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                  Domain{sortIcon("domain")}
                </th>
                <th onClick={() => handleSort("level")} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                  C4 Level{sortIcon("level")}
                </th>
                <th onClick={() => handleSort("updatedAt")} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                  Last edit{sortIcon("updatedAt")}
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} onClick={() => handleOpen(d)} className="border-b border-border last:border-0 cursor-pointer hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/10">
                      <Network className="h-4 w-4 text-primary" />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.domain ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      {levelLabels[d.level]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {d.updatedAt}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => handleDelete(e, d.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum diagrama. Crie o primeiro!</td></tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground bg-secondary/30">
            Total diagrams: {diagrams.length}
          </div>
        </div>
      </div>

      {showAdd && <AddDiagramDialog onClose={() => setShowAdd(false)} onAdd={(name, level, domain) => {
        const d = addDiagram(name, level, domain);
        openDiagram(d.id);
        navigate(`/model/${d.id}`);
        setShowAdd(false);
      }} />}
    </div>
  );
};

const AddDiagramDialog = ({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (name: string, level: Level, domain?: string) => void;
}) => {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("context");
  const [domain, setDomain] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">New Diagram</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. System Context"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">C4 Level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="context">Level 1 – System Context</option>
              <option value="container">Level 2 – Container</option>
              <option value="component">Level 3 – Component</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">Domain (opcional)</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. E-commerce"
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors">Cancelar</button>
          <button onClick={() => { if (name.trim()) onAdd(name.trim(), level, domain.trim() || undefined); }} disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            Criar Diagrama
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;

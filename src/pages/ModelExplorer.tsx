import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, GitCommit, ChevronRight, FileJson } from "lucide-react";
import Navbar from "@/components/Navbar";
import Canvas from "@/components/canvas/Canvas";
import { useActiveBluePrintView, useComponents, useDiagramActions } from "@/lib/model-store";

const CommitDialog = ({ onClose, onCommit }: { onClose: () => void; onCommit: (msg: string) => void }) => {
  const [msg, setMsg] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Novo Commit</h3>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Mensagem do commit..."
          className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-foreground mb-4 focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors">Cancelar</button>
          <button onClick={() => { if (msg.trim()) { onCommit(msg); onClose(); } }} disabled={!msg.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <GitCommit className="h-3.5 w-3.5 inline mr-1.5" /> Commit
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ModelExplorer = () => {
  const activeView = useActiveBluePrintView();
  const components = useComponents();
  const { commit } = useDiagramActions();
  const [showCommit, setShowCommit] = useState(false);

  const rootComponent = activeView.rootElementId ? components[activeView.rootElementId] : null;

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-muted-foreground">Plataforma E-commerce</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{rootComponent?.name ?? "System Context"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCommit(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <GitCommit className="h-3.5 w-3.5" /> Commit
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all">
              <FileJson className="h-3.5 w-3.5" /> Exportar
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <ReactFlowProvider><Canvas /></ReactFlowProvider>
      </div>
      {showCommit && <CommitDialog onClose={() => setShowCommit(false)} onCommit={(msg) => commit(msg)} />}
    </div>
  );
};

export default ModelExplorer;

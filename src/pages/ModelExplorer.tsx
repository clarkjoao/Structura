import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  GitCommit,
  ChevronRight,
  History,
  FileJson,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Canvas from "@/components/canvas/Canvas";
import {
  useActiveBluePrintView,
  useVersions,
  useComponents,
  useDiagramActions,
} from "@/lib/model-store";

const VersionHistory = ({ onClose }: { onClose: () => void }) => {
  const versions = useVersions();

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-l border-border bg-card overflow-hidden shrink-0"
    >
      <div className="w-80">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Histórico de Versões
          </h3>
        </div>
        <div className="p-3 space-y-1">
          {versions.map((v, i) => (
            <div
              key={v.id}
              className={`relative rounded-lg p-3 cursor-pointer transition-all text-sm ${
                i === 0
                  ? "bg-primary/5 border border-primary/20"
                  : "hover:bg-surface-hover border border-transparent"
              }`}
            >
              {i < versions.length - 1 && (
                <div className="absolute left-[22px] top-[38px] bottom-[-8px] w-px bg-border" />
              )}
              <div className="flex items-center gap-2 mb-1">
                <GitCommit className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-mono text-xs font-semibold text-primary">
                  {v.version}
                </span>
                {i === 0 && (
                  <span className="text-[9px] font-mono bg-primary/10 text-primary rounded px-1.5 py-0.5">
                    LATEST
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground pl-[22px]">{v.message}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 pl-[22px]">
                <span>{v.author}</span>
                <span>·</span>
                <span>{v.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const CommitDialog = ({
  onClose,
  onCommit,
}: {
  onClose: () => void;
  onCommit: (msg: string) => void;
}) => {
  const [msg, setMsg] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Novo Commit</h3>
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Mensagem do commit..."
          className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-foreground mb-4 focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (msg.trim()) {
                onCommit(msg);
                onClose();
              }
            }}
            disabled={!msg.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <GitCommit className="h-3.5 w-3.5 inline mr-1.5" />
            Commit
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ModelExplorer = () => {
  const activeView = useActiveBluePrintView();
  const versions = useVersions();
  const components = useComponents();
  const { commit } = useDiagramActions();

  const [showHistory, setShowHistory] = useState(false);
  const [showCommit, setShowCommit] = useState(false);

  const rootComponent = activeView.rootElementId
    ? components[activeView.rootElementId]
    : null;

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      {/* Model header */}
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-muted-foreground">Plataforma E-commerce</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">
              {rootComponent?.name ?? "System Context"}
            </span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-[10px] font-mono text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-glow" />
              draft
            </span>
            <span className="font-mono text-xs text-muted-foreground ml-1">
              {versions[0]?.version}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showHistory
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Histórico
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all">
              <FileJson className="h-3.5 w-3.5" />
              Exportar
            </button>
            <button
              onClick={() => setShowCommit(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <GitCommit className="h-3.5 w-3.5" />
              Commit
            </button>
          </div>
        </div>
      </div>

      {/* Canvas + panels */}
      <div className="flex-1 flex overflow-hidden">
        <Canvas />
        <AnimatePresence>
          {showHistory && (
            <VersionHistory onClose={() => setShowHistory(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Commit dialog */}
      {showCommit && (
        <CommitDialog onClose={() => setShowCommit(false)} onCommit={commit} />
      )}
    </div>
  );
};

export default ModelExplorer;

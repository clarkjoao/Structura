import { ReactFlowProvider } from "@xyflow/react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileJson } from "lucide-react";
import Navbar from "@/components/Navbar";
import Canvas from "@/components/canvas/Canvas";
import { useActiveDiagram } from "@/lib/model-store";

const ModelExplorer = () => {
  const diagram = useActiveDiagram();

  if (!diagram) {
    return (
      <div className="h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center mt-16">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Nenhum diagrama selecionado.</p>
            <Link to="/dashboard" className="text-primary hover:underline text-sm">Voltar ao Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {diagram.domain && <span className="text-muted-foreground">{diagram.domain}</span>}
            <span className="font-medium">{diagram.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all">
              <FileJson className="h-3.5 w-3.5" /> Exportar
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <ReactFlowProvider><Canvas /></ReactFlowProvider>
      </div>
    </div>
  );
};

export default ModelExplorer;

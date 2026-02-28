import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, GitBranch, GitCommit, Clock, Box, Layers,
  ChevronRight, ChevronDown, Network, User, Database,
  Server, Shield, Plus, History, FileJson, Settings
} from "lucide-react";
import Navbar from "@/components/Navbar";

type C4Level = "context" | "container" | "component";

interface ArchElement {
  id: string;
  name: string;
  type: "person" | "system" | "container" | "component";
  description: string;
  technology?: string;
  children?: ArchElement[];
}

interface VersionEntry {
  id: string;
  version: string;
  message: string;
  author: string;
  timestamp: string;
  isCurrent: boolean;
}

const mockElements: ArchElement[] = [
  {
    id: "e1",
    name: "Cliente",
    type: "person",
    description: "Usuário final do sistema",
    children: [],
  },
  {
    id: "e2",
    name: "Sistema de Pedidos",
    type: "system",
    description: "Processa e gerencia pedidos de compra",
    children: [
      {
        id: "e2-1",
        name: "API Gateway",
        type: "container",
        description: "Roteamento e autenticação de requisições",
        technology: "Kong / Nginx",
        children: [
          { id: "e2-1-1", name: "Auth Middleware", type: "component", description: "Validação JWT", technology: "Node.js" },
          { id: "e2-1-2", name: "Rate Limiter", type: "component", description: "Controle de taxa de requisições", technology: "Redis" },
        ],
      },
      {
        id: "e2-2",
        name: "Order Service",
        type: "container",
        description: "Lógica de negócio de pedidos",
        technology: "Java / Spring Boot",
        children: [
          { id: "e2-2-1", name: "Order Controller", type: "component", description: "Endpoints REST", technology: "Spring MVC" },
          { id: "e2-2-2", name: "Order Repository", type: "component", description: "Persistência de dados", technology: "JPA" },
        ],
      },
      {
        id: "e2-3",
        name: "Database",
        type: "container",
        description: "Armazenamento de pedidos e produtos",
        technology: "PostgreSQL",
        children: [],
      },
    ],
  },
  {
    id: "e3",
    name: "Sistema de Pagamento",
    type: "system",
    description: "Processamento de transações financeiras",
    children: [],
  },
];

const mockVersions: VersionEntry[] = [
  { id: "v6", version: "v3.2.1", message: "Adicionado Rate Limiter ao Gateway", author: "maria.dev", timestamp: "2h atrás", isCurrent: false },
  { id: "v5", version: "v3.2.0", message: "Refatoração do Order Service", author: "joao.arq", timestamp: "1 dia", isCurrent: false },
  { id: "v4", version: "v3.1.0", message: "Novo container: Database", author: "maria.dev", timestamp: "3 dias", isCurrent: false },
  { id: "v3", version: "v3.0.0", message: "Migração para microservices", author: "joao.arq", timestamp: "1 sem", isCurrent: false },
  { id: "v2", version: "v2.0.0", message: "Adicionado sistema de pagamentos", author: "maria.dev", timestamp: "2 sem", isCurrent: false },
  { id: "v1", version: "v1.0.0", message: "Commit inicial do modelo", author: "joao.arq", timestamp: "1 mês", isCurrent: false },
];

const typeIcons: Record<string, typeof Box> = {
  person: User,
  system: Network,
  container: Server,
  component: Database,
};

const typeColors: Record<string, string> = {
  person: "text-node-person border-node-person/30 bg-node-person/5",
  system: "text-node-system border-node-system/30 bg-node-system/5",
  container: "text-node-container border-node-container/30 bg-node-container/5",
  component: "text-node-component border-node-component/30 bg-node-component/5",
};

const typeBadgeColors: Record<string, string> = {
  person: "text-node-person bg-node-person/10",
  system: "text-node-system bg-node-system/10",
  container: "text-node-container bg-node-container/10",
  component: "text-node-component bg-node-component/10",
};

const ElementNode = ({
  element,
  depth = 0,
  onSelect,
  selectedId,
}: {
  element: ArchElement;
  depth?: number;
  onSelect: (el: ArchElement) => void;
  selectedId: string | null;
}) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = element.children && element.children.length > 0;
  const Icon = typeIcons[element.type] || Box;
  const isSelected = selectedId === element.id;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm group ${
          isSelected
            ? "bg-primary/10 border border-primary/20"
            : "hover:bg-surface-hover border border-transparent"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(element)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}

        <div className={`flex h-6 w-6 items-center justify-center rounded border ${typeColors[element.type]}`}>
          <Icon className="h-3 w-3" />
        </div>

        <span className={`flex-1 truncate ${isSelected ? "text-foreground font-medium" : "text-secondary-foreground"}`}>
          {element.name}
        </span>

        <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${typeBadgeColors[element.type]}`}>
          {element.type}
        </span>
      </div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {element.children!.map((child) => (
              <ElementNode key={child.id} element={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ModelExplorer = () => {
  const { id } = useParams();
  const [selectedElement, setSelectedElement] = useState<ArchElement | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      <Navbar />
      {/* Model header */}
      <div className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-muted-foreground">Plataforma E-commerce</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">Sistema de Pedidos</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-[10px] font-mono text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-glow" />
              draft
            </span>
            <span className="font-mono text-xs text-muted-foreground ml-1">v3.2.1</span>
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
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <GitCommit className="h-3.5 w-3.5" />
              Commit
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Element tree */}
        <div className="w-80 border-r border-border bg-card overflow-auto">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elementos</h3>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="py-1">
            {mockElements.map((el) => (
              <ElementNode
                key={el.id}
                element={el}
                onSelect={setSelectedElement}
                selectedId={selectedElement?.id ?? null}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 grid-pattern" />
          <div className="relative p-8">
            {selectedElement ? (
              <motion.div
                key={selectedElement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${typeColors[selectedElement.type]}`}>
                    {(() => { const Icon = typeIcons[selectedElement.type] || Box; return <Icon className="h-5 w-5" />; })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedElement.name}</h2>
                    <span className={`text-xs font-mono rounded px-2 py-0.5 ${typeBadgeColors[selectedElement.type]}`}>
                      {selectedElement.type}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Descrição</label>
                    <p className="text-sm mt-1">{selectedElement.description}</p>
                  </div>
                  {selectedElement.technology && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tecnologia</label>
                      <p className="text-sm mt-1 font-mono text-primary">{selectedElement.technology}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">ID</label>
                    <p className="text-sm mt-1 font-mono text-muted-foreground">{selectedElement.id}</p>
                  </div>
                  {selectedElement.children && selectedElement.children.length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Filhos</label>
                      <p className="text-sm mt-1">{selectedElement.children.length} elemento(s)</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-32">
                <Network className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">Selecione um elemento para ver detalhes</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Navegue pela árvore à esquerda</p>
              </div>
            )}
          </div>
        </div>

        {/* Version history */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border bg-card overflow-hidden"
            >
              <div className="w-80">
                <div className="p-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Versões</h3>
                </div>
                <div className="p-3 space-y-1">
                  {mockVersions.map((v, i) => (
                    <div
                      key={v.id}
                      className={`relative rounded-lg p-3 cursor-pointer transition-all text-sm ${
                        i === 0
                          ? "bg-primary/5 border border-primary/20"
                          : "hover:bg-surface-hover border border-transparent"
                      }`}
                    >
                      {i < mockVersions.length - 1 && (
                        <div className="absolute left-[22px] top-[38px] bottom-[-8px] w-px bg-border" />
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <GitCommit className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-mono text-xs font-semibold text-primary">{v.version}</span>
                        {i === 0 && (
                          <span className="text-[9px] font-mono bg-primary/10 text-primary rounded px-1.5 py-0.5">LATEST</span>
                        )}
                      </div>
                      <p className="text-xs text-foreground ml-5.5 pl-[22px]">{v.message}</p>
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ModelExplorer;

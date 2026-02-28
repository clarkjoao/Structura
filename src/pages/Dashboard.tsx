import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Plus, GitBranch, Clock, Users, MoreHorizontal,
  Network, Box, Layers, ChevronRight
} from "lucide-react";
import Navbar from "@/components/Navbar";

interface Workspace {
  id: string;
  name: string;
  models: Model[];
}

interface Model {
  id: string;
  name: string;
  description: string;
  version: string;
  lastModified: string;
  isDraft: boolean;
  elements: number;
  relationships: number;
}

const mockWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "Plataforma E-commerce",
    models: [
      {
        id: "m-1",
        name: "Sistema de Pedidos",
        description: "Arquitetura completa do sistema de processamento de pedidos",
        version: "v3.2.1",
        lastModified: "há 2 horas",
        isDraft: true,
        elements: 24,
        relationships: 31,
      },
      {
        id: "m-2",
        name: "Gateway de Pagamentos",
        description: "Integração com provedores de pagamento",
        version: "v1.8.0",
        lastModified: "há 3 dias",
        isDraft: false,
        elements: 12,
        relationships: 15,
      },
    ],
  },
  {
    id: "ws-2",
    name: "Infraestrutura Core",
    models: [
      {
        id: "m-3",
        name: "Plataforma de Observabilidade",
        description: "Stack de monitoramento e alertas",
        version: "v2.1.0",
        lastModified: "há 1 semana",
        isDraft: false,
        elements: 18,
        relationships: 22,
      },
    ],
  },
];

const ModelCard = ({ model }: { model: Model }) => (
  <Link to={`/model/${model.id}`}>
    <motion.div
      whileHover={{ y: -2 }}
      className="group rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/10">
          <Network className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          {model.isDraft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2.5 py-0.5 text-[10px] font-mono text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-glow" />
              draft
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">{model.version}</span>
        </div>
      </div>

      <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
        {model.name}
      </h3>
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{model.description}</p>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Box className="h-3 w-3" /> {model.elements}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" /> {model.relationships}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {model.lastModified}
        </span>
      </div>
    </motion.div>
  </Link>
);

const Dashboard = () => {
  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus modelos de arquitetura</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Novo Workspace
          </button>
        </div>

        {/* Workspaces */}
        {mockWorkspaces.map((ws, i) => (
          <motion.div
            key={ws.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary border border-border">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <h2 className="font-semibold text-sm">{ws.name}</h2>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{ws.models.length} modelos</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ws.models.map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}
              <button className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all min-h-[160px]">
                <Plus className="h-5 w-5" />
                <span className="text-xs font-medium">Novo Modelo</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

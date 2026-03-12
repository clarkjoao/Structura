import { motion } from "framer-motion";
import {
  GitBranch,
  Layers,
  Box,
  ArrowRight,
  Network,
  History,
  Users,
  Shield,
} from "lucide-react";
import { Link } from "react-router-dom";

const C4Node = ({
  label,
  type,
  x,
  y,
  delay,
}: {
  label: string;
  type: string;
  x: number;
  y: number;
  delay: number;
}) => {
  const colors: Record<string, string> = {
    system: "border-node-system text-node-system bg-node-system/5",
    container: "border-node-container text-node-container bg-node-container/5",
    component: "border-node-component text-node-component bg-node-component/5",
    person: "border-node-person text-node-person bg-node-person/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className={`absolute rounded-lg border px-3 py-2 text-xs font-mono ${colors[type]}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {label}
    </motion.div>
  );
};

const ConnectionLine = ({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}) => (
  <motion.line
    x1={`${x1}%`}
    y1={`${y1}%`}
    x2={`${x2}%`}
    y2={`${y2}%`}
    stroke="hsl(187 72% 51% / 0.2)"
    strokeWidth="1"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ delay, duration: 0.8 }}
  />
);

const HeroGraph = () => (
  <div className="relative w-full h-full grid-pattern-dense rounded-xl border border-border overflow-hidden">
    <svg className="absolute inset-0 w-full h-full">
      <ConnectionLine x1={50} y1={15} x2={25} y2={40} delay={0.8} />
      <ConnectionLine x1={50} y1={15} x2={75} y2={40} delay={0.9} />
      <ConnectionLine x1={25} y1={50} x2={20} y2={72} delay={1.0} />
      <ConnectionLine x1={25} y1={50} x2={45} y2={72} delay={1.1} />
      <ConnectionLine x1={75} y1={50} x2={70} y2={72} delay={1.2} />
    </svg>
    <C4Node label="User" type="person" x={44} y={5} delay={0.3} />
    <C4Node label="API Gateway" type="system" x={15} y={35} delay={0.5} />
    <C4Node label="Web App" type="system" x={65} y={35} delay={0.6} />
    <C4Node label="Auth Service" type="container" x={8} y={65} delay={0.7} />
    <C4Node label="Order Service" type="container" x={33} y={65} delay={0.8} />
    <C4Node label="Database" type="component" x={60} y={65} delay={0.9} />

    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
      <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse-glow" />
      v3.2.1 — draft
    </div>
  </div>
);

const features = [
  {
    icon: Layers,
    title: "C4 Model Nativo",
    desc: "Navegue entre Context, Container, Component e Code com hierarquia nativa.",
  },
  {
    icon: GitBranch,
    title: "Versionamento Imutável",
    desc: "Cada commit é um snapshot completo. Histórico rastreável, e branching.",
  },
  {
    icon: Network,
    title: "Modelo como Grafo",
    desc: "Elementos e relacionamentos são entidades de primeira classe, não desenhos.",
  },
  {
    icon: Shield,
    title: "Workspaces & Permissões",
    desc: "Colaboração multi-equipe com controle de acesso por workspace.",
  },
  {
    icon: History,
    title: "Working Draft",
    desc: "Edite livremente, faça commit quando pronto. Sem perda de contexto.",
  },
  {
    icon: Box,
    title: "Export & Import",
    desc: "JSON completo para portabilidade. Integração com pipelines de CI/CD.",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 gradient-radial" />
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-mono text-primary mb-6"
              >
                <GitBranch className="h-3 w-3" />
                Git para Arquitetura de Software
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
              >
                Arquitetura como{" "}
                <span className="text-primary glow-text">
                  modelo versionado
                </span>
                , não como diagrama.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed"
              >
                Modele, versione e navegue sua arquitetura com o C4 Model. O
                modelo é a fonte da verdade — diagramas são apenas projeções.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex items-center gap-4"
              >
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors glow-primary"
                >
                  Começar agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  Ver documentação
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="h-[400px] hidden lg:block"
            >
              <HeroGraph />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-border">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold mb-4">
              Projetado para arquitetura{" "}
              <span className="text-primary">como código</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Cada decisão arquitetural é rastreável, cada versão é imutável,
              cada relacionamento é uma entidade de primeira classe.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/20 hover:bg-surface-hover transition-all duration-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/10 mb-4 group-hover:glow-primary transition-shadow duration-300">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="container">
          <div className="relative rounded-2xl border border-border bg-card p-12 text-center overflow-hidden">
            <div className="absolute inset-0 grid-pattern opacity-30" />
            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">
                Comece a versionar sua arquitetura hoje
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Crie seu primeiro workspace, modele seu sistema e faça o
                primeiro commit em minutos.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors glow-primary"
              >
                Criar workspace gratuito
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Structura</span>
          </div>
          <p className="font-mono text-xs">
            © 2026 Structura. Architecture as code.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

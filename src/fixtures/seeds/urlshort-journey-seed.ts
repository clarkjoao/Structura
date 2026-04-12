import type { Journey } from "@/features/journeys";

// ─────────────────────────────────────────────────────────────────────────────
// Jornada: Apresentação Completa do URLShort
// Percorre L1 → L2 → L3 → Deployment, com flow em cada step
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_US_JOURNEYS: Record<string, Journey> = {
  "journey-urlshort-tour": {
    id: "journey-urlshort-tour",
    name: "URLShort — Tour Arquitetural",
    description:
      "Apresentação completa da arquitetura do URLShort: do contexto de negócio até o deployment na AWS, acompanhando o fluxo de redirect em cada nível C4.",
    domain: "seed",
    tags: ["arquitetura", "c4", "onboarding", "aws"],
    createdAt: 1705312800000,
    updatedAt: 1705312800000,
    steps: {
      "step-us-1-context": {
        id: "step-us-1-context",
        label: "Contexto do Sistema",
        description:
          "Visão de negócio: quem usa o URLShort, quais sistemas externos ele depende e quais SLOs ele precisa cumprir. Ideal para apresentar a stakeholders não-técnicos.\n\nDestaque: o sistema precisa redirecionar em < 50ms P95 — essa restrição guia todas as decisões arquiteturais nos próximos slides.",
        order: 0,
        diagramId: "d-us-context",
        flowId: "flow-ctx-create",
      },
      "step-us-2-containers": {
        id: "step-us-2-containers",
        label: "Containers e Comunicação",
        description:
          "Zoom no URLShort: os 5 containers que o compõem e como se comunicam. O flow demonstra o caminho crítico de redirect com cache hit e a publicação assíncrona de analytics no SQS.\n\nDestaque: o redirect NUNCA espera o analytics — o HTTP 301 é enviado antes de publicar no SQS.",
        order: 1,
        diagramId: "d-us-containers",
        flowId: "flow-ct-redirect",
      },
      "step-us-3-components": {
        id: "step-us-3-components",
        label: "Componentes da Management API",
        description:
          "Zoom na Management API: endpoints REST documentados, módulos internos em camadas (HTTP → Negócio → Infra), tabelas do banco e schemas de request/response.\n\nDestaque: o swimlane mostra a separação clara entre HTTP, lógica de negócio e infraestrutura de dados.",
        order: 2,
        diagramId: "d-us-components",
        flowId: "flow-cp-create",
      },
      "step-us-4-deployment": {
        id: "step-us-4-deployment",
        label: "Deployment AWS — Well-Architected",
        description:
          "Infraestrutura AWS completa com ícones reais: CloudFront, WAF, ALB, ECS Fargate, RDS Multi-AZ, ElastiCache e SQS.\n\nScene TO-BE ativo: Lambda@Edge para geolocalização na borda, eliminando a latência de rede do Analytics Worker.\n\nNote 'Well-Architected' detalha como cada pilar é atendido: Reliability (Multi-AZ), Performance (Redis + Go), Security (WAF + subnets privadas), Cost (Fargate sob demanda).",
        order: 3,
        diagramId: "d-us-deployment",
        flowId: "flow-dp-redirect",
      },
    },
  },
};
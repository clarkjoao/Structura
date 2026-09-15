import { ServiceSource, type Folder, type ServiceDefinition } from "@/features/diagram";
import { FOLDER_CATALOG, FOLDER_ROOT } from "./ids";

export function buildFolders(): Record<string, Folder> {
  return {
    [FOLDER_ROOT]: {
      id: FOLDER_ROOT,
      name: "PixLedger",
      parentId: null,
      domain: "seed",
    },
    [FOLDER_CATALOG]: {
      id: FOLDER_CATALOG,
      name: "Catálogo de elementos",
      parentId: null,
      domain: "seed",
    },
  };
}

export function buildServiceRegistry(): Record<string, ServiceDefinition> {
  return {
    "svc-pl-cob-api": {
      id: "svc-pl-cob-api",
      name: "cob-api",
      description:
        "API de cobranças Pix: cria cobranças imediatas/com vencimento, emite BR Code e consulta status via SPI.",
      repositoryUrl: "https://github.com/pixledger/cob-api",
      technology: ["Go", "gRPC", "DynamoDB"],
      owner: "squad-pix-hub",
      tags: ["pix", "cobranca", "core"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-dict-client": {
      id: "svc-pl-dict-client",
      name: "dict-client",
      description: "Cliente do DICT/Bacen para resolução de chaves Pix e sincronização de claims.",
      repositoryUrl: "https://github.com/pixledger/dict-client",
      technology: ["Go", "mTLS"],
      owner: "squad-pix-hub",
      tags: ["pix", "dict", "bacen"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-webhook-ingress": {
      id: "svc-pl-webhook-ingress",
      name: "webhook-ingress",
      description: "Ingresso de webhooks SPI: valida assinatura, deduplica e publica eventos de pagamento.",
      repositoryUrl: "https://github.com/pixledger/webhook-ingress",
      technology: ["Node.js", "TypeScript", "SQS"],
      owner: "squad-pix-hub",
      tags: ["webhook", "spi", "async"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-ledger-engine": {
      id: "svc-pl-ledger-engine",
      name: "ledger-engine",
      description:
        "Motor de partida dobrada: lança créditos/débitos, mantém saldos e prepara liquidação D+0/D+1.",
      repositoryUrl: "https://github.com/pixledger/ledger-engine",
      technology: ["Java", "Kotlin", "PostgreSQL", "Kafka"],
      owner: "squad-ledger",
      tags: ["ledger", "settlement", "core"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-settlement-worker": {
      id: "svc-pl-settlement-worker",
      name: "settlement-worker",
      description: "Worker de liquidação com o banco liquidante e conciliação de extratos SPI.",
      repositoryUrl: "https://github.com/pixledger/settlement-worker",
      technology: ["Kotlin", "Kafka", "SFTP"],
      owner: "squad-ledger",
      tags: ["settlement", "banco", "batch"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-risk-engine": {
      id: "svc-pl-risk-engine",
      name: "risk-engine",
      description: "Motor de limites, scoring AML e bloqueios em tempo real para cobranças e pagamentos.",
      repositoryUrl: "https://github.com/pixledger/risk-engine",
      technology: ["Python", "Redis", "gRPC"],
      owner: "squad-risk",
      tags: ["risco", "aml", "compliance"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-merchant-api": {
      id: "svc-pl-merchant-api",
      name: "merchant-api",
      description: "API e dashboard do lojista: cobranças, webhooks outbound, extrato e conciliação.",
      repositoryUrl: "https://github.com/pixledger/merchant-api",
      technology: ["TypeScript", "NestJS", "PostgreSQL"],
      owner: "squad-merchant",
      tags: ["merchant", "api", "webhooks"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-pl-notify": {
      id: "svc-pl-notify",
      name: "notify-service",
      description: "Disparo de SMS/e-mail transacionais para pagadores e lojistas.",
      repositoryUrl: "https://github.com/pixledger/notify-service",
      technology: ["Node.js", "SQS"],
      owner: "squad-merchant",
      tags: ["notificacao", "async"],
      sources: [{ type: ServiceSource.Manual }],
    },
  };
}

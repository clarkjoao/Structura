import {
  PanelKind,
  ServiceSource,
  StrokeStyle,
  type Diagram,
  type FlowStep,
  type Folder,
  type ServiceDefinition,
} from "@/features/diagram";

function steps(list: FlowStep[]): Record<string, FlowStep> {
  const map: Record<string, FlowStep> = {};
  for (let i = 0; i < list.length; i++) {
    const step = list[i]!;

    const autoNext = step.type !== "condition" ? list[i + 1]?.id : undefined;
    map[step.id] = { ...step, next: step.next ?? autoNext };
  }
  return map;
}

const FOLDER_ROOT = "folder-bancocentro";
const FOLDER_CORE = "folder-core-banking";
const FOLDER_CHANNELS = "folder-channels";
const FOLDER_COMPLIANCE = "folder-compliance";

function buildFolders(): Record<string, Folder> {
  return {
    [FOLDER_ROOT]: {
      id: FOLDER_ROOT,
      name: "BancoCentro — Core Banking",
      parentId: null,
      domain: "seed",
    },
    [FOLDER_CORE]: {
      id: FOLDER_CORE,
      name: "Core Banking & Ledger",
      parentId: FOLDER_ROOT,
      domain: "seed",
    },
    [FOLDER_CHANNELS]: {
      id: FOLDER_CHANNELS,
      name: "Canais Digitais",
      parentId: FOLDER_ROOT,
      domain: "seed",
    },
    [FOLDER_COMPLIANCE]: {
      id: FOLDER_COMPLIANCE,
      name: "Compliance & Regulatório",
      parentId: FOLDER_ROOT,
      domain: "seed",
    },
  };
}

function buildServiceRegistry(): Record<string, ServiceDefinition> {
  return {
    "svc-core-account": {
      id: "svc-core-account",
      name: "core-account-service",
      description:
        "Serviço de domínio de contas correntes e poupança. Gerencia abertura, encerramento, saldo disponível, saldo contábil e limites. Fonte de verdade para account state.",
      repositoryUrl: "https://github.com/bancocentro/core-account-service",
      technology: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
      owner: "squad-contas",
      tags: ["core", "domain", "accounts"],
      source: ServiceSource.Manual,
    },
    "svc-ledger": {
      id: "svc-ledger",
      name: "ledger-service",
      description:
        "Ledger de partidas dobradas imutável. Todos os débitos e créditos passam obrigatoriamente pelo ledger antes de qualquer atualização de saldo. Append-only + event sourcing.",
      repositoryUrl: "https://github.com/bancocentro/ledger-service",
      technology: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
      owner: "squad-financeiro",
      tags: ["core", "ledger", "compliance", "immutable"],
      source: ServiceSource.Manual,
    },
    "svc-pix": {
      id: "svc-pix",
      name: "pix-service",
      description:
        "Orquestração completa de transações PIX: initiação, consulta DICT, reserva de fundos, envio ao SPI (Banco Central), reconciliação e estorno. Integração com RSFN.",
      repositoryUrl: "https://github.com/bancocentro/pix-service",
      technology: ["Kotlin", "Spring Boot", "Kafka", "Redis"],
      owner: "squad-pix",
      tags: ["payments", "pix", "bacen", "core"],
      source: ServiceSource.Manual,
    },
    "svc-ted-doc": {
      id: "svc-ted-doc",
      name: "ted-doc-service",
      description:
        "Processamento de transferências TED e DOC via STR (Sistema de Transferência de Reservas). Janelas de liquidação, validações FEBRABAN e integração com ISPB.",
      repositoryUrl: "https://github.com/bancocentro/ted-doc-service",
      technology: ["Java", "Spring Boot", "ActiveMQ"],
      owner: "squad-transferencias",
      tags: ["payments", "ted", "doc", "bacen"],
      source: ServiceSource.Manual,
    },
    "svc-reconciliation": {
      id: "svc-reconciliation",
      name: "reconciliation-service",
      description:
        "Reconciliação automática diária entre posições internas e extratos do Banco Central (SISBACEN). Identifica divergências, gera alertas e aciona workflows de correção.",
      repositoryUrl: "https://github.com/bancocentro/reconciliation-service",
      technology: ["Python", "Airflow", "PostgreSQL", "Kafka"],
      owner: "squad-financeiro",
      tags: ["compliance", "reconciliation", "bacen"],
      source: ServiceSource.Manual,
    },
    "svc-fraud": {
      id: "svc-fraud",
      name: "fraud-prevention-service",
      description:
        "Scoring de fraude em tempo real (<50ms). Modelos XGBoost + regras comportamentais. Features: velocidade de transações, geolocalização, device fingerprint, padrão histórico.",
      repositoryUrl: "https://github.com/bancocentro/fraud-prevention",
      technology: ["Python", "FastAPI", "Redis", "Kafka", "SageMaker"],
      owner: "squad-risco",
      tags: ["risk", "ml", "fraud", "real-time"],
      source: ServiceSource.Manual,
    },
    "svc-notification": {
      id: "svc-notification",
      name: "notification-service",
      description:
        "Entrega multicanal: push (Firebase), SMS (Twilio), e-mail (SES) e webhook para parceiros. Templates versionados, preferências por cliente, retry com backoff.",
      repositoryUrl: "https://github.com/bancocentro/notification-service",
      technology: ["Node.js", "NestJS", "Kafka", "Redis"],
      owner: "squad-engajamento",
      tags: ["notification", "async"],
      source: ServiceSource.Manual,
    },
    "svc-customer": {
      id: "svc-customer",
      name: "customer-service",
      description:
        "Cadastro completo de PF/PJ: dados pessoais, KYC, documentos, endereços, contatos e relacionamentos. Emite customer.updated via Kafka para serviços downstream.",
      repositoryUrl: "https://github.com/bancocentro/customer-service",
      technology: ["Kotlin", "Spring Boot", "PostgreSQL"],
      owner: "squad-cadastro",
      tags: ["core", "kyc", "customer"],
      source: ServiceSource.Manual,
    },
    "svc-api-gateway": {
      id: "svc-api-gateway",
      name: "api-gateway",
      description:
        "Kong como API Gateway. Autenticação OAuth2/mTLS, rate limiting por cliente/produto, logging de auditoria, roteamento semântico por versão de API.",
      repositoryUrl: "https://github.com/bancocentro/api-gateway",
      technology: ["Kong", "Nginx", "Lua"],
      owner: "squad-plataforma",
      tags: ["infra", "gateway", "security"],
      source: ServiceSource.Manual,
    },
    "svc-bff-app": {
      id: "svc-bff-app",
      name: "bff-app",
      description:
        "BFF para o app mobile. Agrega dados de conta, últimas transações e limite disponível em uma única resposta. Cache inteligente por cliente com invalidação por evento.",
      repositoryUrl: "https://github.com/bancocentro/bff-app",
      technology: ["Kotlin", "Spring Boot", "GraphQL", "Redis"],
      owner: "squad-mobile",
      tags: ["bff", "mobile", "graphql"],
      source: ServiceSource.Manual,
    },
  };
}

function buildDiagrams(): Record<string, Diagram> {
  return {
    "d-bc-context": {
      id: "d-bc-context",
      name: "BancoCentro — Contexto do Sistema",
      level: "context",
      domain: "seed",
      folderId: FOLDER_ROOT,
      createdAt: Date.parse("2026-01-08T09:00:00.000Z"),
      updatedAt: Date.parse("2026-03-26T10:00:00.000Z"),
      viewport: { x: 0, y: 0, zoom: 0.52 },
      edgeLayouts: {},
      nodeLayouts: {
        "bc-ctx-correntista": { elementId: "bc-ctx-correntista", x: 60, y: 240 },
        "bc-ctx-empresa": { elementId: "bc-ctx-empresa", x: 60, y: 560 },
        "bc-ctx-platform": { elementId: "bc-ctx-platform", x: 520, y: 360 },
        "bc-ctx-bacen": { elementId: "bc-ctx-bacen", x: 1040, y: 120 },
        "bc-ctx-sisbacen": { elementId: "bc-ctx-sisbacen", x: 1040, y: 320 },
        "bc-ctx-dict": { elementId: "bc-ctx-dict", x: 1040, y: 500 },
        "bc-ctx-febraban": { elementId: "bc-ctx-febraban", x: 1040, y: 680 },
        "bc-ctx-bureau": { elementId: "bc-ctx-bureau", x: 1040, y: 860 },
        "bc-ctx-note": { elementId: "bc-ctx-note", x: 1380, y: 60, width: 380, height: 500 },
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-bc-ctx-pix": {
            id: "flow-bc-ctx-pix",
            name: "Transferência PIX — Visão de Contexto",
            diagramId: "d-bc-context",
            description:
              "Jornada de um correntista iniciando um PIX até a liquidação pelo Banco Central.",
            tags: ["pix", "pagamentos", "happy-path"],
            mermaid: "sequenceDiagram",
            entryStepId: "bc-ctx-f0",
            steps: steps([
              {
                id: "bc-ctx-f0",
                type: "action",
                componentId: "bc-ctx-correntista",
                connectionId: "bc-ctx-r1",
                description:
                  "Correntista inicia transferência PIX pelo app mobile informando chave e valor",
                payload:
                  '{ "pixKey": "destinatario@email.com", "amount": 1500.00, "description": "Aluguel março" }',
                payloadDirection: "request",
              },
              {
                id: "bc-ctx-f1",
                type: "action",
                componentId: "bc-ctx-platform",
                connectionId: "bc-ctx-r3",
                description:
                  "Plataforma consulta DICT do Banco Central para resolução da chave PIX",
                duration: "~180ms",
              },
              {
                id: "bc-ctx-f2",
                type: "action",
                componentId: "bc-ctx-platform",
                description: "Plataforma valida saldo, limites e score de fraude do correntista",
                duration: "~60ms",
              },
              {
                id: "bc-ctx-f3",
                type: "condition",
                componentId: "bc-ctx-platform",
                conditionLabel: "Fraude detectada?",
                branches: [
                  { label: "Não — prossegue", nextId: "bc-ctx-f4" },
                  { label: "Sim — bloqueia", nextId: "bc-ctx-f-blocked" },
                ],
              },
              {
                id: "bc-ctx-f-blocked",
                type: "note",
                note: "Transação bloqueada. Notificação enviada ao correntista e caso registrado no sistema de investigação.",
              },
              {
                id: "bc-ctx-f4",
                type: "action",
                componentId: "bc-ctx-platform",
                connectionId: "bc-ctx-r2",
                description:
                  "Envia instrução de pagamento ao SPI (Sistema de Pagamentos Instantâneos) do Banco Central",
                duration: "~400ms",
                payload:
                  '{ "endToEndId": "E123456789", "amount": 1500.00, "creditParty": { "ispb": "60701190", "account": "123456" } }',
                payloadDirection: "request",
              },
              {
                id: "bc-ctx-f5",
                type: "action",
                componentId: "bc-ctx-bacen",
                description:
                  "SPI liquida a transação e notifica o banco destinatário em tempo real",
                duration: "~800ms",
                payload:
                  '{ "endToEndId": "E123456789", "status": "ACSC", "settledAt": "2026-03-26T14:32:01Z" }',
                payloadDirection: "response",
              },
              {
                id: "bc-ctx-f6",
                type: "action",
                componentId: "bc-ctx-platform",
                description:
                  "Plataforma confirma liquidação, atualiza saldo e dispara notificação push ao correntista",
              },
            ]),
          },
        },
        components: {
          "bc-ctx-correntista": {
            id: "bc-ctx-correntista",
            name: "Correntista (PF/PJ)",
            type: "person",
            description:
              "Cliente pessoa física ou jurídica que opera contas, realiza transferências, pagamentos e consultas pelo app mobile ou internet banking.",
            parentId: null,
          },
          "bc-ctx-empresa": {
            id: "bc-ctx-empresa",
            name: "Empresa Parceira",
            type: "person",
            description:
              "Parceiro B2B que integra via Open Banking API ou webhook para automação de cobranças e reconciliação financeira.",
            parentId: null,
          },
          "bc-ctx-platform": {
            id: "bc-ctx-platform",
            name: "BancoCentro Platform",
            type: "system",
            description:
              "Plataforma de Core Banking modernizada: contas, ledger de partidas dobradas, PIX, TED/DOC, reconciliação com Banco Central e prevenção a fraudes.",
            parentId: null,
            linkedDiagramId: "d-bc-containers",
          },
          "bc-ctx-bacen": {
            id: "bc-ctx-bacen",
            name: "Banco Central (SPI / STR)",
            type: "system",
            description:
              "Sistema de Pagamentos Instantâneos (SPI) para PIX e Sistema de Transferência de Reservas (STR) para TED. Infraestrutura crítica regulatória.",
            parentId: null,
            tags: ["externo", "regulatorio", "bacen"],
          },
          "bc-ctx-sisbacen": {
            id: "bc-ctx-sisbacen",
            name: "SISBACEN",
            type: "system",
            description:
              "Sistema de Informações do Banco Central. Fonte de extratos oficiais para reconciliação, compulsório e posição de reservas. Acesso via certificado ICP-Brasil.",
            parentId: null,
            tags: ["externo", "regulatorio", "bacen"],
          },
          "bc-ctx-dict": {
            id: "bc-ctx-dict",
            name: "DICT (Diretório de Chaves PIX)",
            type: "system",
            description:
              "Diretório central do Banco Central para resolução de chaves PIX: CPF, CNPJ, e-mail, telefone e chave aleatória. Consultas e registros via API REST certificada.",
            parentId: null,
            tags: ["externo", "pix", "bacen"],
          },
          "bc-ctx-febraban": {
            id: "bc-ctx-febraban",
            name: "FEBRABAN / CIP",
            type: "system",
            description:
              "Câmara Interbancária de Pagamentos para compensação de DOC e cheques. Tabela ISPB de identificação de bancos. Normas técnicas para integração.",
            parentId: null,
            tags: ["externo", "compensacao"],
          },
          "bc-ctx-bureau": {
            id: "bc-ctx-bureau",
            name: "Bureau de Crédito",
            type: "system",
            description:
              "Serasa / SPC para consulta de score de crédito, negativações e dados cadastrais durante onboarding e análise de risco de crédito.",
            parentId: null,
            tags: ["externo", "credito", "kyc"],
          },
          "bc-ctx-note": {
            id: "bc-ctx-note",
            name: "Contexto de Transformação Digital",
            type: "note",
            description:
              "## Cenário\nBancoCentro é um banco regional com 40 anos de história em processo de modernização do core banking legado (COBOL + mainframe IBM z15) para arquitetura distribuída em nuvem.\n\n## Estratégia\n- **Strangler Fig**: novas capacidades em microserviços, legado mantido em paralelo\n- **Event-driven**: Kafka como backbone de integração entre novo e legado\n- **PIX-first**: PIX é o vetor de modernização — primeiro domínio 100% cloud-native\n\n## Restrições regulatórias\n- Resolução BCB 85/2021: open banking obrigatório\n- Circular 3.909: segregação de funções em TI\n- Dados financeiros: LGPD + sigilo bancário (LC 105/2001)\n\n## SLOs\n- Disponibilidade: 99,97% (máx. 2,6h downtime/ano)\n- PIX latência P95: < 4s (regulatório)\n- Reconciliação: < 2h após fechamento do dia",
            parentId: null,
          },
        },
        connections: {
          "bc-ctx-r1": {
            id: "bc-ctx-r1",
            sourceId: "bc-ctx-correntista",
            targetId: "bc-ctx-platform",
            label: "Opera conta via app e internet banking",
            technology: "HTTPS / OAuth2",
            intent: "call",
            direction: "bidirectional",
          },
          "bc-ctx-r2": {
            id: "bc-ctx-r2",
            sourceId: "bc-ctx-platform",
            targetId: "bc-ctx-bacen",
            label: "PIX (SPI) e TED (STR)",
            technology: "RSFN / mTLS",
            intent: "call",
            direction: "bidirectional",
          },
          "bc-ctx-r3": {
            id: "bc-ctx-r3",
            sourceId: "bc-ctx-platform",
            targetId: "bc-ctx-dict",
            label: "Consulta e registra chaves PIX",
            technology: "HTTPS / mTLS",
            intent: "call",
            direction: "bidirectional",
          },
          "bc-ctx-r4": {
            id: "bc-ctx-r4",
            sourceId: "bc-ctx-platform",
            targetId: "bc-ctx-sisbacen",
            label: "Consulta extratos para reconciliação",
            technology: "HTTPS / ICP-Brasil",
            intent: "call",
            direction: "unidirectional",
          },
          "bc-ctx-r5": {
            id: "bc-ctx-r5",
            sourceId: "bc-ctx-platform",
            targetId: "bc-ctx-febraban",
            label: "Compensação DOC / consulta ISPB",
            technology: "HTTPS / SFTP",
            intent: "call",
            direction: "bidirectional",
          },
          "bc-ctx-r6": {
            id: "bc-ctx-r6",
            sourceId: "bc-ctx-platform",
            targetId: "bc-ctx-bureau",
            label: "Consulta score e dados cadastrais",
            technology: "HTTPS / REST",
            intent: "call",
            direction: "unidirectional",
          },
          "bc-ctx-r7": {
            id: "bc-ctx-r7",
            sourceId: "bc-ctx-empresa",
            targetId: "bc-ctx-platform",
            label: "Integração B2B via Open Banking API",
            technology: "HTTPS / mTLS",
            intent: "call",
            direction: "bidirectional",
          },
        },
      },
    },

    "d-bc-containers": {
      id: "d-bc-containers",
      name: "BancoCentro — Containers",
      level: "container",
      domain: "seed",
      folderId: FOLDER_CORE,
      createdAt: Date.parse("2026-01-15T09:00:00.000Z"),
      updatedAt: Date.parse("2026-03-26T11:00:00.000Z"),
      viewport: { x: 0, y: 0, zoom: 0.4 },
      edgeLayouts: {},
      nodeLayouts: {
        "bc-ct-correntista": { elementId: "bc-ct-correntista", x: 40, y: 480 },
        "bc-ct-empresa": { elementId: "bc-ct-empresa", x: 40, y: 860 },

        "bc-ct-panel-channels": {
          elementId: "bc-ct-panel-channels",
          x: 210,
          y: 200,
          width: 360,
          height: 960,
        },
        "bc-ct-app-mobile": { elementId: "bc-ct-app-mobile", x: 30, y: 60 },
        "bc-ct-internet-banking": { elementId: "bc-ct-internet-banking", x: 30, y: 260 },
        "bc-ct-totem": { elementId: "bc-ct-totem", x: 30, y: 460 },
        "bc-ct-open-api": { elementId: "bc-ct-open-api", x: 30, y: 660 },
        "bc-ct-bff-app": { elementId: "bc-ct-bff-app", x: 30, y: 820 },

        "bc-ct-panel-api": {
          elementId: "bc-ct-panel-api",
          x: 650,
          y: 200,
          width: 360,
          height: 960,
        },
        "bc-ct-api-gateway": { elementId: "bc-ct-api-gateway", x: 30, y: 60 },
        "bc-ct-auth-svc": { elementId: "bc-ct-auth-svc", x: 30, y: 260 },
        "bc-ct-rate-limiter": { elementId: "bc-ct-rate-limiter", x: 30, y: 460 },

        "bc-ct-panel-core": {
          elementId: "bc-ct-panel-core",
          x: 1090,
          y: 200,
          width: 360,
          height: 960,
        },
        "bc-ct-account-svc": { elementId: "bc-ct-account-svc", x: 30, y: 60 },
        "bc-ct-ledger-svc": { elementId: "bc-ct-ledger-svc", x: 30, y: 260 },
        "bc-ct-pix-svc": { elementId: "bc-ct-pix-svc", x: 30, y: 460 },
        "bc-ct-ted-doc-svc": { elementId: "bc-ct-ted-doc-svc", x: 30, y: 660 },
        "bc-ct-customer-svc": { elementId: "bc-ct-customer-svc", x: 30, y: 860 },

        "bc-ct-panel-async": {
          elementId: "bc-ct-panel-async",
          x: 1530,
          y: 200,
          width: 360,
          height: 960,
        },
        "bc-ct-kafka": { elementId: "bc-ct-kafka", x: 30, y: 60 },
        "bc-ct-fraud-svc": { elementId: "bc-ct-fraud-svc", x: 30, y: 260 },
        "bc-ct-reconciliation": { elementId: "bc-ct-reconciliation", x: 30, y: 460 },
        "bc-ct-notification-svc": { elementId: "bc-ct-notification-svc", x: 30, y: 660 },

        "bc-ct-postgres": { elementId: "bc-ct-postgres", x: 30, y: 840 },

        "bc-ct-bacen-ext": { elementId: "bc-ct-bacen-ext", x: 1980, y: 300 },
        "bc-ct-dict-ext": { elementId: "bc-ct-dict-ext", x: 1980, y: 520 },
        "bc-ct-sisbacen-ext": { elementId: "bc-ct-sisbacen-ext", x: 1980, y: 740 },
        "bc-ct-legado": { elementId: "bc-ct-legado", x: 1980, y: 960 },

        "bc-ct-note": { elementId: "bc-ct-note", x: 1980, y: 60, width: 380, height: 200 },
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-bc-pix-containers": {
            id: "flow-bc-pix-containers",
            name: "PIX — Orquestração Completa",
            diagramId: "d-bc-containers",
            description:
              "Fluxo end-to-end de um PIX de saída com validação de fraude e contabilização no ledger. Inclui caminho de bloqueio por risco.",
            tags: ["pix", "ledger", "fraude", "core"],
            mermaid: "sequenceDiagram",
            entryStepId: "pix-f0",
            steps: steps([
              {
                id: "pix-f0",
                type: "action",
                componentId: "bc-ct-app-mobile",
                connectionId: "bc-ct-r1",
                description: "Correntista confirma PIX com biometria no app. App envia para BFF.",
                payload: '{ "pixKey": "11999990000", "amount": 1500.00, "scheduledFor": null }',
                payloadDirection: "request",
              },
              {
                id: "pix-f1",
                type: "action",
                componentId: "bc-ct-bff-app",
                connectionId: "bc-ct-r2",
                description:
                  "BFF valida sessão OAuth2, agrega dados da conta e proxia para API Gateway",
                duration: "~20ms",
              },
              {
                id: "pix-f2",
                type: "action",
                componentId: "bc-ct-api-gateway",
                connectionId: "bc-ct-r4",
                description:
                  "Gateway aplica rate limiting (5 PIX/min por cliente) e roteia para pix-service",
                duration: "~8ms",
              },
              {
                id: "pix-f3",
                type: "action",
                componentId: "bc-ct-pix-svc",
                connectionId: "bc-ct-r8",
                description:
                  "PIX service consulta DICT do Banco Central para resolver a chave telefone → conta/ISPB",
                duration: "~180ms",
                payload: '{ "key": "11999990000", "keyType": "PHONE" }',
                payloadDirection: "request",
                isAsync: false,
              },
              {
                id: "pix-f4",
                type: "action",
                componentId: "bc-ct-pix-svc",
                connectionId: "bc-ct-r15",
                description:
                  "Publica evento pix.initiated no Kafka para análise assíncrona de fraude (não bloqueia o caminho crítico)",
                isAsync: true,
              },
              {
                id: "pix-f5",
                type: "action",
                componentId: "bc-ct-fraud-svc",
                connectionId: "bc-ct-r16",
                description:
                  "Fraud service consome pix.initiated, executa modelo XGBoost + regras comportamentais",
                duration: "~45ms (async)",
                isAsync: true,
              },
              {
                id: "pix-f6",
                type: "condition",
                componentId: "bc-ct-fraud-svc",
                conditionLabel: "Score de risco?",
                branches: [
                  { label: "Baixo/Médio (< 0.7) — aprova", nextId: "pix-f7" },
                  { label: "Alto (≥ 0.7) — bloqueia", nextId: "pix-f-fraud" },
                ],
              },
              {
                id: "pix-f-fraud",
                type: "action",
                componentId: "bc-ct-fraud-svc",
                connectionId: "bc-ct-r15",
                description:
                  "Publica pix.fraud_blocked. Notificação enviada ao cliente. Caso registrado para análise manual.",
                isAsync: true,
              },
              {
                id: "pix-f7",
                type: "action",
                componentId: "bc-ct-pix-svc",
                connectionId: "bc-ct-r5",
                description:
                  "PIX service instrui account-service a reservar os fundos (débito provisório no saldo disponível)",
                duration: "~25ms",
                payload:
                  '{ "accountId": "acc-77821", "amount": 1500.00, "reservationType": "PIX_OUTGOING" }',
                payloadDirection: "request",
              },
              {
                id: "pix-f8",
                type: "action",
                componentId: "bc-ct-account-svc",
                connectionId: "bc-ct-r6",
                description:
                  "Account service ordena lançamento de débito provisório ao ledger (partida dupla: débito conta cliente / crédito conta trânsito PIX)",
                duration: "~15ms",
              },
              {
                id: "pix-f9",
                type: "action",
                componentId: "bc-ct-ledger-svc",
                description:
                  "Ledger persiste entrada imutável com status PROVISIONAL e retorna ledger_entry_id",
                duration: "~10ms",
                payload:
                  '{ "ledgerEntryId": "le-994421", "debit": "acc-77821", "credit": "transit-pix-out", "amount": 1500.00, "status": "PROVISIONAL" }',
                payloadDirection: "response",
              },
              {
                id: "pix-f10",
                type: "action",
                componentId: "bc-ct-pix-svc",
                connectionId: "bc-ct-r7",
                description:
                  "Envio da mensagem PIX ao SPI do Banco Central via RSFN (rede de mensageria certificada)",
                duration: "~350ms",
              },
              {
                id: "pix-f11",
                type: "condition",
                componentId: "bc-ct-pix-svc",
                conditionLabel: "SPI confirmou liquidação?",
                branches: [
                  { label: "ACSC — liquidado", nextId: "pix-f12" },
                  { label: "RJCT — rejeitado", nextId: "pix-f-rejected" },
                  { label: "Timeout >4s", nextId: "pix-f-timeout" },
                ],
              },
              {
                id: "pix-f-rejected",
                type: "action",
                componentId: "bc-ct-pix-svc",
                connectionId: "bc-ct-r5",
                description:
                  "Rejeição pelo Banco Central (saldo insuficiente no destino, conta encerrada, etc.). Estorno automático do débito provisório.",
              },
              {
                id: "pix-f-timeout",
                type: "note",
                note: "SPI não respondeu em 4s (SLA regulatório). Transação fica em status PENDENTE. Job de reconciliação verifica posição no SISBACEN nas próximas 2 horas e decide: confirmar ou estornar.",
              },
              {
                id: "pix-f12",
                type: "action",
                componentId: "bc-ct-ledger-svc",
                connectionId: "bc-ct-r6",
                description:
                  "Ledger confirma entrada: atualiza status de PROVISIONAL → SETTLED. Lançamento torna-se imutável.",
                duration: "~12ms",
                payload:
                  '{ "ledgerEntryId": "le-994421", "status": "SETTLED", "settledAt": "2026-03-26T14:32:01Z", "endToEndId": "E123456789" }',
                payloadDirection: "request",
              },
              {
                id: "pix-f13",
                type: "action",
                componentId: "bc-ct-kafka",
                connectionId: "bc-ct-r15",
                description:
                  "Publica pix.settled — notification-service envia push ao correntista confirmando a transferência",
                isAsync: true,
              },
            ]),
          },

          "flow-bc-reconciliation": {
            id: "flow-bc-reconciliation",
            name: "Reconciliação Diária com SISBACEN",
            diagramId: "d-bc-containers",
            description:
              "Processo noturno de reconciliação entre posições internas e extrato oficial do Banco Central. Identifica e trata divergências.",
            tags: ["reconciliacao", "bacen", "compliance", "batch"],
            mermaid: "sequenceDiagram",
            entryStepId: "rec-f0",
            steps: steps([
              {
                id: "rec-f0",
                type: "note",
                note: "Disparado às 23:30 pelo scheduler do Airflow após fechamento do dia operacional (janela TED/DOC encerrada às 17h).",
              },
              {
                id: "rec-f1",
                type: "action",
                componentId: "bc-ct-reconciliation",
                connectionId: "bc-ct-r11",
                description:
                  "Reconciliation service autentica no SISBACEN via certificado ICP-Brasil e solicita extrato do dia (arquivo STRBCO0)",
                duration: "~2min (arquivo ~50MB)",
              },
              {
                id: "rec-f2",
                type: "action",
                componentId: "bc-ct-reconciliation",
                connectionId: "bc-ct-r12",
                description:
                  "Consulta posição de fechamento do ledger interno para o mesmo período",
                duration: "~30s",
              },
              {
                id: "rec-f3",
                type: "condition",
                componentId: "bc-ct-reconciliation",
                conditionLabel: "Divergências encontradas?",
                branches: [
                  { label: "Não — posições batem", nextId: "rec-f-ok" },
                  { label: "Sim — investigar", nextId: "rec-f4" },
                ],
              },
              {
                id: "rec-f-ok",
                type: "note",
                note: "Reconciliação aprovada. Relatório D0 gerado e arquivado no S3. Conformidade com regulatório confirmada. Alarme PagerDuty desmarcado.",
              },
              {
                id: "rec-f4",
                type: "condition",
                componentId: "bc-ct-reconciliation",
                conditionLabel: "Tipo de divergência?",
                branches: [
                  { label: "Transações PIX pending > 4s (timeout)", nextId: "rec-f5" },
                  { label: "Diferença de saldo de reserva", nextId: "rec-f6" },
                  { label: "Lançamento sem contraparte", nextId: "rec-f7" },
                ],
              },
              {
                id: "rec-f5",
                type: "action",
                componentId: "bc-ct-reconciliation",
                connectionId: "bc-ct-r15",
                description:
                  "Para cada PIX pendente: consulta status no SPI. Se ACSC → confirma ledger. Se RJCT → estorna automaticamente.",
                isAsync: true,
              },
              {
                id: "rec-f6",
                type: "action",
                componentId: "bc-ct-reconciliation",
                connectionId: "bc-ct-r15",
                description:
                  "Publica alerta reconciliation.reserve_mismatch. Caso crítico: aciona compliance e squad financeiro via PagerDuty.",
                isAsync: true,
              },
              {
                id: "rec-f7",
                type: "action",
                componentId: "bc-ct-reconciliation",
                connectionId: "bc-ct-r15",
                description:
                  "Publica reconciliation.unmatched_entry para análise manual. Lançamento suspeito quarentenado no ledger (status QUARANTINE).",
                isAsync: true,
              },
              {
                id: "rec-f8",
                type: "action",
                componentId: "bc-ct-notification-svc",
                connectionId: "bc-ct-r17",
                description:
                  "Relatório de reconciliação enviado por e-mail ao time financeiro com sumário: total transações, divergências, ações automáticas tomadas.",
              },
            ]),
          },
        },
        components: {
          "bc-ct-correntista": {
            id: "bc-ct-correntista",
            name: "Correntista",
            type: "person",
            description: "Cliente PF ou PJ.",
            parentId: null,
          },
          "bc-ct-empresa": {
            id: "bc-ct-empresa",
            name: "Empresa Parceira",
            type: "person",
            description: "Integração B2B via API.",
            parentId: null,
          },

          "bc-ct-panel-channels": {
            id: "bc-ct-panel-channels",
            name: "Canais de Atendimento",
            type: "panel",
            panelKind: PanelKind.Default,
            panelColor: "hsl(210 60% 50%)",
            panelOpacity: 8,
            description: "Apps, portais e canais de acesso ao correntista.",
            parentId: null,
          },
          "bc-ct-app-mobile": {
            id: "bc-ct-app-mobile",
            name: "App Mobile",
            type: "container",
            description:
              "App nativo iOS/Android. Biometria para transações sensíveis. Suporte a offline mode para consultas. PIX QR Code integrado.",
            technology: "Swift / Kotlin",
            parentId: "bc-ct-panel-channels",
          },
          "bc-ct-internet-banking": {
            id: "bc-ct-internet-banking",
            name: "Internet Banking",
            type: "container",
            description:
              "Web app React com token OTP para operações. Módulo de DDA, extrato e agendamentos. Acessibilidade WCAG 2.1 AA.",
            technology: "React / TypeScript",
            parentId: "bc-ct-panel-channels",
          },
          "bc-ct-totem": {
            id: "bc-ct-totem",
            name: "Terminal de Autoatendimento",
            type: "container",
            description:
              "Totem nas agências para saques, depósitos e extrato. Conecta via API Gateway interno com certificado de dispositivo.",
            technology: "Embedded Linux / Java",
            parentId: "bc-ct-panel-channels",
          },
          "bc-ct-open-api": {
            id: "bc-ct-open-api",
            name: "Open Banking API",
            type: "container",
            description:
              "API pública para parceiros (Open Finance fase 2/3). Consentimento gerenciado pelo usuario. Endpoints de dados e pagamentos conforme BACEN.",
            technology: "Kong / OpenAPI 3.0",
            parentId: "bc-ct-panel-channels",
          },
          "bc-ct-bff-app": {
            id: "bc-ct-bff-app",
            name: "BFF App",
            type: "container",
            description:
              "Backend-for-Frontend do app mobile. Agrega saldo, limite PIX, últimas 10 transações e alertas de segurança em uma única query. Cache por cliente (TTL 30s).",
            technology: "Kotlin / GraphQL / Redis",
            parentId: "bc-ct-panel-channels",
            serviceId: "svc-bff-app",
          },

          "bc-ct-panel-api": {
            id: "bc-ct-panel-api",
            name: "API & Security Layer",
            type: "panel",
            panelKind: PanelKind.Default,
            panelColor: "hsl(280 50% 50%)",
            panelOpacity: 8,
            description: "Gateway, autenticação e controle de acesso.",
            parentId: null,
          },
          "bc-ct-api-gateway": {
            id: "bc-ct-api-gateway",
            name: "API Gateway",
            type: "container",
            description:
              "Kong Enterprise. Plugins: JWT + mTLS, rate limiting por cliente, log de auditoria (PCI-compliant), transformação de request, circuit breaker por serviço.",
            technology: "Kong Enterprise",
            parentId: "bc-ct-panel-api",
            serviceId: "svc-api-gateway",
          },
          "bc-ct-auth-svc": {
            id: "bc-ct-auth-svc",
            name: "Auth Service",
            type: "container",
            description:
              "OAuth 2.0 Authorization Server. Tokens JWT de 15min com refresh rotativo. Suporte a MFA (TOTP + biometria). Revogação em tempo real via Redis.",
            technology: "Kotlin / Spring Security / Redis",
            parentId: "bc-ct-panel-api",
          },
          "bc-ct-rate-limiter": {
            id: "bc-ct-rate-limiter",
            name: "Rate Limiter / DDoS Guard",
            type: "container",
            description:
              "Controle de rate por IP, conta e produto. Limites PIX regulatórios (5 transações simultâneas). Detecção de credential stuffing.",
            technology: "Redis / Lua",
            parentId: "bc-ct-panel-api",
          },

          "bc-ct-panel-core": {
            id: "bc-ct-panel-core",
            name: "Core Banking Domain",
            type: "panel",
            panelKind: PanelKind.Default,
            panelColor: "hsl(150 50% 40%)",
            panelOpacity: 8,
            description: "Serviços de domínio: contas, ledger, PIX, TED/DOC e cadastro.",
            parentId: null,
          },
          "bc-ct-account-svc": {
            id: "bc-ct-account-svc",
            name: "Account Service",
            type: "container",
            description:
              "Fonte de verdade para estado de contas: saldo disponível, saldo contábil, limite PIX diário, status (ativa/bloqueada/encerrada). Comandos via API síncrona; eventos via Kafka.",
            technology: "Java / Spring Boot / PostgreSQL",
            parentId: "bc-ct-panel-core",
            serviceId: "svc-core-account",
          },
          "bc-ct-ledger-svc": {
            id: "bc-ct-ledger-svc",
            name: "Ledger Service",
            type: "container",
            description:
              "Ledger contábil de partidas dobradas. Append-only (nenhum UPDATE/DELETE permitido). Cada entrada tem: tipo, débito, crédito, valor, moeda, status, correlationId e timestamp imutável. Event sourcing completo.",
            technology: "Java / Spring Boot / PostgreSQL",
            parentId: "bc-ct-panel-core",
            serviceId: "svc-ledger",
          },
          "bc-ct-pix-svc": {
            id: "bc-ct-pix-svc",
            name: "PIX Service",
            type: "container",
            description:
              "Orquestra o ciclo de vida completo do PIX: resolução de chave (DICT), reserva de fundos, envio ao SPI, confirmação de liquidação, estorno em caso de rejeição. Idempotente por endToEndId.",
            technology: "Kotlin / Spring Boot / Kafka",
            parentId: "bc-ct-panel-core",
            serviceId: "svc-pix",
          },
          "bc-ct-ted-doc-svc": {
            id: "bc-ct-ted-doc-svc",
            name: "TED/DOC Service",
            type: "container",
            description:
              "Processamento de TED via STR (janela: 6h30–17h) e DOC via CIP (D+1). Validação de ISPB, geração de arquivos FEBRABAN e integração com STR via MQ.",
            technology: "Java / Spring Boot / ActiveMQ",
            parentId: "bc-ct-panel-core",
            serviceId: "svc-ted-doc",
          },
          "bc-ct-customer-svc": {
            id: "bc-ct-customer-svc",
            name: "Customer Service",
            type: "container",
            description:
              "Cadastro PF/PJ com KYC integrado. Onboarding via OCR de documentos + biometria facial. Compliance AML: monitoramento de operações suspeitas conforme COAF.",
            technology: "Kotlin / Spring Boot / PostgreSQL",
            parentId: "bc-ct-panel-core",
            serviceId: "svc-customer",
          },

          "bc-ct-panel-async": {
            id: "bc-ct-panel-async",
            name: "Async & Intelligence",
            type: "panel",
            panelKind: PanelKind.Default,
            panelColor: "hsl(30 70% 50%)",
            panelOpacity: 8,
            description: "Kafka, detecção de fraude, reconciliação e notificações.",
            parentId: null,
          },
          "bc-ct-kafka": {
            id: "bc-ct-kafka",
            name: "Event Bus (MSK Kafka)",
            type: "container",
            description:
              "Tópicos principais: pix.initiated, pix.settled, pix.fraud_blocked, pix.rejected, account.balance_updated, reconciliation.divergence, ted.submitted, ted.settled. Retenção 30 dias (compliance).",
            technology: "Apache Kafka / AWS MSK",
            parentId: "bc-ct-panel-async",
          },
          "bc-ct-fraud-svc": {
            id: "bc-ct-fraud-svc",
            name: "Fraud Prevention Service",
            type: "container",
            description:
              "Scoring em <50ms. Features: velocidade (N transações/hora), geolocation (novo dispositivo?), horário atípico, valor outlier. Modelo XGBoost + regras YAML versionadas. Retroalimenta-se via Kafka.",
            technology: "Python / FastAPI / SageMaker / Redis",
            parentId: "bc-ct-panel-async",
            serviceId: "svc-fraud",
          },
          "bc-ct-reconciliation": {
            id: "bc-ct-reconciliation",
            name: "Reconciliation Service",
            type: "container",
            description:
              "Reconciliação automática diária. Compara posições internas com extrato SISBACEN. Classifica divergências: PIX pendente, diferença de reserva, lançamento sem contraparte. Orquestrado por Apache Airflow.",
            technology: "Python / Airflow / PostgreSQL",
            parentId: "bc-ct-panel-async",
            serviceId: "svc-reconciliation",
          },
          "bc-ct-notification-svc": {
            id: "bc-ct-notification-svc",
            name: "Notification Service",
            type: "container",
            description:
              "Entrega push (Firebase), SMS (Twilio), e-mail (SES). Template engine com personalização. Retry com exponential backoff. Canal de preferência por cliente.",
            technology: "Node.js / NestJS / Kafka",
            parentId: "bc-ct-panel-async",
            serviceId: "svc-notification",
          },
          "bc-ct-postgres": {
            id: "bc-ct-postgres",
            name: "PostgreSQL (Aurora Serverless v2)",
            type: "container",
            description:
              "Schemas segregados: core_accounts, ledger (append-only, row-level security), pix_transactions, customers. Multi-AZ. Réplica de leitura para reconciliação.",
            technology: "PostgreSQL 16 / Aurora",
            parentId: "bc-ct-panel-async",
          },

          "bc-ct-bacen-ext": {
            id: "bc-ct-bacen-ext",
            name: "Banco Central (SPI/STR)",
            type: "system",
            description:
              "SPI para liquidação PIX em tempo real. STR para reservas e TED. Conexão via RSFN com certificado ICP-Brasil.",
            parentId: null,
            tags: ["externo", "regulatorio"],
          },
          "bc-ct-dict-ext": {
            id: "bc-ct-dict-ext",
            name: "DICT",
            type: "system",
            description:
              "Diretório de Chaves PIX do Banco Central. Consulta e manutenção de chaves via API REST certificada.",
            parentId: null,
            tags: ["externo", "pix"],
          },
          "bc-ct-sisbacen-ext": {
            id: "bc-ct-sisbacen-ext",
            name: "SISBACEN",
            type: "system",
            description:
              "Extratos oficiais para reconciliação. Consulta via certificado ICP-Brasil.",
            parentId: null,
            tags: ["externo", "regulatorio"],
          },
          "bc-ct-legado": {
            id: "bc-ct-legado",
            name: "Core Legado (Mainframe)",
            type: "system",
            description:
              "Sistema COBOL no IBM z15. Ainda fonte de verdade para: contas antigas (pré-2020), folha de pagamento e alguns contratos de crédito. Integração via Kafka Connect + MQ.",
            parentId: null,
            tags: ["legado", "mainframe"],
          },
          "bc-ct-note": {
            id: "bc-ct-note",
            name: "Padrão Strangler Fig",
            type: "note",
            description:
              "## Estratégia de migração\nO core legado ainda processa ~30% das transações. A migração segue o padrão **Strangler Fig**: novos volumes vão para microserviços; o legado é desligado por domínio após validação.\n\n## Linha do tempo\n- ✅ 2024: PIX 100% cloud-native\n- 🔄 2025: TED/DOC em migração\n- 📅 2026: Contas correntes novas\n- 📅 2027: Migração total planejada",
            parentId: null,
          },
        },
        connections: {
          "bc-ct-r1": {
            id: "bc-ct-r1",
            sourceId: "bc-ct-app-mobile",
            targetId: "bc-ct-bff-app",
            label: "GraphQL queries",
            technology: "GraphQL / HTTPS",
            intent: "call",
          },
          "bc-ct-r2": {
            id: "bc-ct-r2",
            sourceId: "bc-ct-bff-app",
            targetId: "bc-ct-api-gateway",
            label: "Proxia requisições autenticadas",
            technology: "HTTPS / REST",
            intent: "call",
          },
          "bc-ct-r3": {
            id: "bc-ct-r3",
            sourceId: "bc-ct-internet-banking",
            targetId: "bc-ct-api-gateway",
            label: "Chamadas REST autenticadas",
            technology: "HTTPS / JWT",
            intent: "call",
          },
          "bc-ct-r4": {
            id: "bc-ct-r4",
            sourceId: "bc-ct-api-gateway",
            targetId: "bc-ct-pix-svc",
            label: "Roteia POST /pix/payments",
            technology: "HTTPS",
            intent: "call",
          },
          "bc-ct-r5": {
            id: "bc-ct-r5",
            sourceId: "bc-ct-pix-svc",
            targetId: "bc-ct-account-svc",
            label: "Reserva / libera fundos (gRPC)",
            technology: "gRPC",
            intent: "call",
          },
          "bc-ct-r6": {
            id: "bc-ct-r6",
            sourceId: "bc-ct-account-svc",
            targetId: "bc-ct-ledger-svc",
            label: "Ordena lançamentos contábeis",
            technology: "gRPC",
            intent: "call",
          },
          "bc-ct-r7": {
            id: "bc-ct-r7",
            sourceId: "bc-ct-pix-svc",
            targetId: "bc-ct-bacen-ext",
            label: "Mensagens PIX via SPI (RSFN)",
            technology: "ISO 20022 / mTLS",
            intent: "call",
            style: { strokeWidth: 2 },
          },
          "bc-ct-r8": {
            id: "bc-ct-r8",
            sourceId: "bc-ct-pix-svc",
            targetId: "bc-ct-dict-ext",
            label: "Consulta e registra chaves PIX",
            technology: "HTTPS / mTLS",
            intent: "call",
          },
          "bc-ct-r9": {
            id: "bc-ct-r9",
            sourceId: "bc-ct-ted-doc-svc",
            targetId: "bc-ct-bacen-ext",
            label: "TED via STR",
            technology: "STR / ActiveMQ",
            intent: "call",
          },
          "bc-ct-r10": {
            id: "bc-ct-r10",
            sourceId: "bc-ct-api-gateway",
            targetId: "bc-ct-ted-doc-svc",
            label: "Roteia POST /transfers/ted",
            technology: "HTTPS",
            intent: "call",
          },
          "bc-ct-r11": {
            id: "bc-ct-r11",
            sourceId: "bc-ct-reconciliation",
            targetId: "bc-ct-sisbacen-ext",
            label: "Busca extrato oficial D0",
            technology: "HTTPS / ICP-Brasil",
            intent: "call",
          },
          "bc-ct-r12": {
            id: "bc-ct-r12",
            sourceId: "bc-ct-reconciliation",
            targetId: "bc-ct-ledger-svc",
            label: "Consulta posição de fechamento",
            technology: "gRPC",
            intent: "call",
          },
          "bc-ct-r13": {
            id: "bc-ct-r13",
            sourceId: "bc-ct-account-svc",
            targetId: "bc-ct-postgres",
            label: "Persiste estado de conta",
            technology: "JDBC",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "bc-ct-r14": {
            id: "bc-ct-r14",
            sourceId: "bc-ct-ledger-svc",
            targetId: "bc-ct-postgres",
            label: "Append-only ledger entries",
            technology: "JDBC",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "bc-ct-r15": {
            id: "bc-ct-r15",
            sourceId: "bc-ct-pix-svc",
            targetId: "bc-ct-kafka",
            label: "Publica pix.* events",
            technology: "Kafka Producer",
            intent: "event",
            style: { animated: true },
          },
          "bc-ct-r16": {
            id: "bc-ct-r16",
            sourceId: "bc-ct-kafka",
            targetId: "bc-ct-fraud-svc",
            label: "Consome pix.initiated",
            technology: "Kafka Consumer",
            intent: "event",
            style: { animated: true },
          },
          "bc-ct-r17": {
            id: "bc-ct-r17",
            sourceId: "bc-ct-kafka",
            targetId: "bc-ct-notification-svc",
            label: "Consome pix.settled / pix.blocked",
            technology: "Kafka Consumer",
            intent: "event",
            style: { animated: true },
          },
          "bc-ct-r18": {
            id: "bc-ct-r18",
            sourceId: "bc-ct-kafka",
            targetId: "bc-ct-reconciliation",
            label: "Consome eventos de transação",
            technology: "Kafka Consumer",
            intent: "event",
            style: { animated: true },
          },
          "bc-ct-r19": {
            id: "bc-ct-r19",
            sourceId: "bc-ct-legado",
            targetId: "bc-ct-kafka",
            label: "Eventos legado via Kafka Connect",
            technology: "Kafka Connect / MQ",
            intent: "event",
            style: { strokeStyle: StrokeStyle.Dashed, animated: true },
          },
          "bc-ct-r20": {
            id: "bc-ct-r20",
            sourceId: "bc-ct-api-gateway",
            targetId: "bc-ct-account-svc",
            label: "Roteia GET /accounts/:id",
            technology: "HTTPS",
            intent: "call",
          },
        },
      },
    },

    "d-bc-ted-evolution": {
      id: "d-bc-ted-evolution",
      name: "Evolução TED — Legado para Cloud-Native",
      level: "container",
      domain: "seed",
      folderId: FOLDER_CORE,
      createdAt: Date.parse("2026-02-10T09:00:00.000Z"),
      updatedAt: Date.parse("2026-03-26T14:00:00.000Z"),
      viewport: { x: 0, y: 0, zoom: 0.56 },
      edgeLayouts: {},
      activeSceneId: "scene-ted-tobe",
      scenes: {
        "scene-ted-tobe": {
          id: "scene-ted-tobe",
          name: "To-Be — TED cloud-native + fallback",
          color: "#22c55e",
          createdAt: Date.parse("2026-03-01T00:00:00.000Z"),
          addedComponents: {
            "ted-new-svc": {
              id: "ted-new-svc",
              name: "TED Service (cloud-native)",
              type: "container",
              description:
                "Reimplementação cloud-native do TED/DOC. Spring Boot + Kotlin. Integração via REST com STR (substituindo ActiveMQ). Idempotência por transferId. Suporte a agendamento e DDA.",
              technology: "Kotlin / Spring Boot",
              parentId: null,
              tags: ["cloud-native", "ted"],
            },
            "ted-shadow-mode": {
              id: "ted-shadow-mode",
              name: "Shadow Mode Proxy",
              type: "container",
              description:
                "Durante rollout: duplica chamadas TED para o serviço legado e cloud-native em paralelo. Compara resultados. Se divergir, fallback automático para legado sem impacto ao usuário.",
              technology: "Go / Feature Flag",
              parentId: null,
            },
            "ted-note-tobe": {
              id: "ted-note-tobe",
              name: "Estratégia de Migração TED",
              type: "note",
              description:
                "## Shadow mode (Q1 2026)\n100% do tráfego TED no legado; cloud-native recebe cópia em paralelo para validação silenciosa.\n\n## Canary (Q2 2026)\n5% → 20% → 50% do tráfego real migrado, com feature flag por segmento de cliente.\n\n## Full migration (Q3 2026)\nLegado desligado após 30 dias de 100% no cloud-native sem incidentes.\n\n## Critérios de rollback automático\n- Taxa de erro > 0,1%\n- Latência P99 > 500ms\n- Qualquer divergência de valor no shadow mode",
              parentId: null,
            },
          },
          addedConnections: {
            "ted-r-gw-shadow": {
              id: "ted-r-gw-shadow",
              sourceId: "ted-gateway",
              targetId: "ted-shadow-mode",
              label: "Roteia TED (com feature flag)",
              intent: "call",
            },
            "ted-r-shadow-new": {
              id: "ted-r-shadow-new",
              sourceId: "ted-shadow-mode",
              targetId: "ted-new-svc",
              label: "Cópia shadow / tráfego migrado",
              intent: "call",
            },
            "ted-r-shadow-legado": {
              id: "ted-r-shadow-legado",
              sourceId: "ted-shadow-mode",
              targetId: "ted-legado-svc",
              label: "Tráfego legado (fallback)",
              intent: "call",
              style: { strokeStyle: StrokeStyle.Dashed },
            },
            "ted-r-new-str": {
              id: "ted-r-new-str",
              sourceId: "ted-new-svc",
              targetId: "ted-str",
              label: "REST direto ao STR",
              intent: "call",
              style: { strokeWidth: 2 },
            },
            "ted-r-new-kafka": {
              id: "ted-r-new-kafka",
              sourceId: "ted-new-svc",
              targetId: "ted-kafka",
              label: "Publica ted.settled",
              intent: "event",
              style: { animated: true },
            },
          },
          removedComponentIds: [],
          removedConnectionIds: ["ted-r-gw-legado"],
          nodeLayouts: {
            "ted-shadow-mode": {
              elementId: "ted-shadow-mode",
              x: 680,
              y: 240,
              width: 220,
              height: 100,
            },
            "ted-new-svc": { elementId: "ted-new-svc", x: 1000, y: 140, width: 220, height: 100 },
            "ted-note-tobe": {
              elementId: "ted-note-tobe",
              x: 1300,
              y: 60,
              width: 380,
              height: 400,
            },
          },
        },
      },
      nodeLayouts: {
        "ted-correntista": { elementId: "ted-correntista", x: 60, y: 320 },
        "ted-gateway": { elementId: "ted-gateway", x: 360, y: 280, width: 200, height: 100 },
        "ted-legado-svc": { elementId: "ted-legado-svc", x: 700, y: 420, width: 220, height: 100 },
        "ted-mq": { elementId: "ted-mq", x: 1000, y: 420, width: 200, height: 80 },
        "ted-str": { elementId: "ted-str", x: 1300, y: 300, width: 220, height: 100 },
        "ted-kafka": { elementId: "ted-kafka", x: 1000, y: 600, width: 220, height: 80 },
        "ted-note-asis": { elementId: "ted-note-asis", x: 60, y: 560, width: 360, height: 300 },
      },
      snapshot: {
        iconLibrary: {},
        flows: {},
        components: {
          "ted-correntista": {
            id: "ted-correntista",
            name: "Correntista",
            type: "person",
            description: "Inicia TED pelo app ou internet banking.",
            parentId: null,
          },
          "ted-gateway": {
            id: "ted-gateway",
            name: "API Gateway",
            type: "container",
            description: "Valida JWT e roteia chamadas de transferência.",
            technology: "Kong",
            parentId: null,
          },
          "ted-legado-svc": {
            id: "ted-legado-svc",
            name: "TED/DOC Service (legado)",
            type: "container",
            description:
              "Serviço COBOL/Java legado que processa TED. Geração de arquivo FEBRABAN e integração com STR via ActiveMQ. Acoplado ao mainframe.",
            technology: "Java 8 / ActiveMQ",
            parentId: null,
            tags: ["legado"],
          },
          "ted-mq": {
            id: "ted-mq",
            name: "ActiveMQ (legado)",
            type: "container",
            description:
              "Message broker do stack legado. Fila de envio ao STR e recebimento de confirmações. Single point of failure histórico.",
            technology: "ActiveMQ",
            parentId: null,
            tags: ["legado"],
          },
          "ted-str": {
            id: "ted-str",
            name: "STR — Banco Central",
            type: "system",
            description:
              "Sistema de Transferência de Reservas. Janela operacional: 6h30–17h. TED liquidado em D0 dentro da janela.",
            parentId: null,
            tags: ["externo", "regulatorio"],
          },
          "ted-kafka": {
            id: "ted-kafka",
            name: "Kafka (MSK)",
            type: "container",
            description:
              "Event bus cloud-native. Ausente no stack legado — adicionado no to-be para integração com notification-service e reconciliation-service.",
            technology: "MSK / Kafka",
            parentId: null,
          },
          "ted-note-asis": {
            id: "ted-note-asis",
            name: "Diagnóstico As-Is — TED Legado",
            type: "note",
            description:
              "## Problemas identificados\n- **ActiveMQ como SPOF**: 3 incidentes de downtime em 2025, total de 4h30min de indisponibilidade\n- **Sem observabilidade**: logs em arquivo, sem traces distribuídos\n- **Deploy acoplado ao mainframe**: janela de manutenção semanal necessária\n- **Sem suporte a agendamento**: implementado como workaround no gateway\n\n## Custo de manutenção\n~R$380k/ano em consultoria especializada em ActiveMQ/COBOL",
            parentId: null,
          },
        },
        connections: {
          "ted-r-c-gw": {
            id: "ted-r-c-gw",
            sourceId: "ted-correntista",
            targetId: "ted-gateway",
            label: "Inicia TED",
            intent: "call",
          },
          "ted-r-gw-legado": {
            id: "ted-r-gw-legado",
            sourceId: "ted-gateway",
            targetId: "ted-legado-svc",
            label: "Roteia TED (direto ao legado)",
            intent: "call",
          },
          "ted-r-legado-mq": {
            id: "ted-r-legado-mq",
            sourceId: "ted-legado-svc",
            targetId: "ted-mq",
            label: "Enfileira para STR",
            intent: "async-message",
          },
          "ted-r-mq-str": {
            id: "ted-r-mq-str",
            sourceId: "ted-mq",
            targetId: "ted-str",
            label: "Mensagem STR",
            intent: "call",
            style: { strokeWidth: 2 },
          },
          "ted-r-str-mq": {
            id: "ted-r-str-mq",
            sourceId: "ted-str",
            targetId: "ted-mq",
            label: "Confirmação de liquidação",
            intent: "call",
            style: { strokeStyle: StrokeStyle.Dashed },
          },
        },
      },
    },

    "d-bc-deployment": {
      id: "d-bc-deployment",
      name: "BancoCentro — Deployment AWS (sa-east-1)",
      level: "container",
      domain: "seed",
      folderId: FOLDER_COMPLIANCE,
      createdAt: Date.parse("2026-02-20T09:00:00.000Z"),
      updatedAt: Date.parse("2026-03-26T15:00:00.000Z"),
      viewport: { x: 0, y: 0, zoom: 0.42 },
      edgeLayouts: {},
      nodeLayouts: {
        "dep-bc-route53": { elementId: "dep-bc-route53", x: 40, y: 60 },
        "dep-bc-waf": { elementId: "dep-bc-waf", x: 40, y: 240 },
        "dep-bc-hsm": { elementId: "dep-bc-hsm", x: 40, y: 420 },
        "dep-bc-s3-audit": { elementId: "dep-bc-s3-audit", x: 1820, y: 60 },
        "dep-bc-sagemaker": { elementId: "dep-bc-sagemaker", x: 1820, y: 260 },
        "dep-bc-cloudwatch": { elementId: "dep-bc-cloudwatch", x: 1820, y: 460 },
        "dep-bc-macie": { elementId: "dep-bc-macie", x: 1820, y: 660 },

        "dep-bc-vpc": { elementId: "dep-bc-vpc", x: 230, y: 40, width: 1480, height: 1100 },

        "dep-bc-panel-pub": {
          elementId: "dep-bc-panel-pub",
          x: 30,
          y: 80,
          width: 420,
          height: 380,
        },
        "dep-bc-alb": { elementId: "dep-bc-alb", x: 30, y: 60 },
        "dep-bc-nat": { elementId: "dep-bc-nat", x: 30, y: 240 },

        "dep-bc-panel-priv": {
          elementId: "dep-bc-panel-priv",
          x: 30,
          y: 520,
          width: 980,
          height: 540,
        },
        "dep-bc-eks": { elementId: "dep-bc-eks", x: 30, y: 60, width: 900, height: 420 },
        "dep-bc-pod-gateway": { elementId: "dep-bc-pod-gateway", x: 30, y: 60 },
        "dep-bc-pod-pix": { elementId: "dep-bc-pod-pix", x: 30, y: 220 },
        "dep-bc-pod-account": { elementId: "dep-bc-pod-account", x: 250, y: 60 },
        "dep-bc-pod-ledger": { elementId: "dep-bc-pod-ledger", x: 250, y: 220 },
        "dep-bc-pod-fraud": { elementId: "dep-bc-pod-fraud", x: 470, y: 60 },
        "dep-bc-pod-bff": { elementId: "dep-bc-pod-bff", x: 470, y: 220 },
        "dep-bc-pod-recon": { elementId: "dep-bc-pod-recon", x: 690, y: 60 },
        "dep-bc-pod-notif": { elementId: "dep-bc-pod-notif", x: 690, y: 220 },

        "dep-bc-panel-data": {
          elementId: "dep-bc-panel-data",
          x: 1080,
          y: 520,
          width: 360,
          height: 540,
        },
        "dep-bc-aurora": { elementId: "dep-bc-aurora", x: 30, y: 60 },
        "dep-bc-redis": { elementId: "dep-bc-redis", x: 30, y: 260 },
        "dep-bc-msk": { elementId: "dep-bc-msk", x: 30, y: 440 },

        "dep-bc-panel-hsm": {
          elementId: "dep-bc-panel-hsm",
          x: 30,
          y: 700,
          width: 980,
          height: 360,
        },
        "dep-bc-hsm-luna": { elementId: "dep-bc-hsm-luna", x: 30, y: 60 },
        "dep-bc-cert-manager": { elementId: "dep-bc-cert-manager", x: 280, y: 60 },
        "dep-bc-vault": { elementId: "dep-bc-vault", x: 530, y: 60 },
        "dep-bc-directconn": { elementId: "dep-bc-directconn", x: 780, y: 60 },

        "dep-bc-note": { elementId: "dep-bc-note", x: 1820, y: 840, width: 380, height: 400 },
      },
      snapshot: {
        iconLibrary: {},
        flows: {},
        components: {
          "dep-bc-route53": {
            id: "dep-bc-route53",
            name: "Route 53 + Health Check",
            type: "aws-networking",
            awsService: "Amazon Route 53",
            description:
              "DNS com failover automático para região secundária (us-east-1). Health check a cada 10s. RTO < 60s em caso de falha regional.",
            technology: "Route 53",
            parentId: null,
          },
          "dep-bc-waf": {
            id: "dep-bc-waf",
            name: "WAF + Shield Advanced",
            type: "aws-security",
            awsService: "AWS WAF",
            description:
              "Regras gerenciadas OWASP + regras customizadas para banking (bloqueio de credential stuffing, rate limiting por CPF). Shield Advanced para proteção DDoS L3/L4/L7.",
            technology: "WAF / Shield Advanced",
            parentId: null,
          },
          "dep-bc-hsm": {
            id: "dep-bc-hsm",
            name: "AWS CloudHSM",
            type: "aws-security",
            awsService: "AWS CloudHSM",
            description:
              "HSM dedicado para chaves PIX (certificado ICP-Brasil), chaves de assinatura de tokens e chaves de criptografia de dados sensíveis. FIPS 140-2 Level 3.",
            technology: "CloudHSM / FIPS 140-2 L3",
            parentId: null,
          },
          "dep-bc-s3-audit": {
            id: "dep-bc-s3-audit",
            name: "S3 Audit & Compliance",
            type: "aws-storage",
            awsService: "Amazon S3",
            description:
              "Bucket de auditoria imutável (Object Lock WORM). Logs de CloudTrail, auditoria de transações, extratos SISBACEN e relatórios regulatórios. Retenção 10 anos.",
            technology: "S3 Object Lock (WORM)",
            parentId: null,
          },
          "dep-bc-sagemaker": {
            id: "dep-bc-sagemaker",
            name: "SageMaker (Fraud ML)",
            type: "aws-ml",
            awsService: "Amazon SageMaker",
            description:
              "Treinamento semanal do modelo de fraude com dados anonimizados. Feature Store gerenciado. Endpoints de inference para serving em batch e real-time.",
            technology: "SageMaker / XGBoost",
            parentId: null,
          },
          "dep-bc-cloudwatch": {
            id: "dep-bc-cloudwatch",
            name: "CloudWatch + X-Ray + Security Hub",
            type: "aws-management",
            awsService: "Amazon CloudWatch",
            description:
              "Métricas: taxa de sucesso PIX, latência P95/P99, fila de reconciliação. Alarmes PagerDuty para P1. Traces distribuídos via X-Ray. Security Hub para conformidade CIS.",
            technology: "CloudWatch / X-Ray / Security Hub",
            parentId: null,
          },
          "dep-bc-macie": {
            id: "dep-bc-macie",
            name: "Amazon Macie",
            type: "aws-security",
            awsService: "Amazon Macie",
            description:
              "Escaneamento automático de buckets S3 para detecção de dados pessoais (CPF, conta) expostos inadvertidamente. Conformidade LGPD + sigilo bancário.",
            technology: "Macie / ML",
            parentId: null,
          },

          "dep-bc-vpc": {
            id: "dep-bc-vpc",
            name: "VPC Bancária (10.10.0.0/16)",
            type: "panel",
            panelKind: PanelKind.Vpc,
            panelColor: "hsl(220 60% 45%)",
            panelOpacity: 6,
            description:
              "VPC isolada para workloads bancários. Flow logs para auditoria de rede. VPC Endpoints para todos os serviços AWS (sem tráfego pela internet pública). 3 AZs sa-east-1.",
            parentId: null,
          },

          "dep-bc-panel-pub": {
            id: "dep-bc-panel-pub",
            name: "Subnets Públicas (10.10.0.0/20)",
            type: "panel",
            panelKind: PanelKind.PublicSubnet,
            panelColor: "hsl(140 55% 40%)",
            panelOpacity: 10,
            description: "Apenas ALB e NAT com IPs públicos. Security Group restritivo.",
            parentId: "dep-bc-vpc",
          },
          "dep-bc-alb": {
            id: "dep-bc-alb",
            name: "Application Load Balancer",
            type: "aws-networking",
            awsService: "Elastic Load Balancing",
            description:
              "ALB com terminação TLS 1.3 (TLS 1.0/1.1 desabilitados). Access logs → S3 WORM. Sticky sessions para totem ATM.",
            technology: "ALB / TLS 1.3",
            parentId: "dep-bc-panel-pub",
          },
          "dep-bc-nat": {
            id: "dep-bc-nat",
            name: "NAT Gateway",
            type: "aws-networking",
            awsService: "Amazon VPC",
            description:
              "Saída para DICT, SISBACEN e STR do Banco Central. IPs elásticos fixos pré-cadastrados no BACEN.",
            technology: "NAT Gateway (EIP fixo)",
            parentId: "dep-bc-panel-pub",
          },

          "dep-bc-panel-priv": {
            id: "dep-bc-panel-priv",
            name: "Subnets Privadas (10.10.16.0/20)",
            type: "panel",
            panelKind: PanelKind.PrivateSubnet,
            panelColor: "hsl(38 80% 50%)",
            panelOpacity: 10,
            description: "Workloads de aplicação. Sem acesso direto à internet.",
            parentId: "dep-bc-vpc",
          },
          "dep-bc-eks": {
            id: "dep-bc-eks",
            name: "Cluster EKS (v1.30) — FIPS mode",
            type: "panel",
            panelKind: PanelKind.EksCluster,
            panelColor: "hsl(220 60% 50%)",
            panelOpacity: 12,
            description:
              "Nós com Amazon Linux 2023 FIPS. Kyverno para pod security policies. Falco para detecção de comportamento anômalo em runtime. ArgoCD GitOps.",
            parentId: "dep-bc-panel-priv",
          },
          "dep-bc-pod-gateway": {
            id: "dep-bc-pod-gateway",
            name: "pods api-gateway",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "4–16 pods Kong. mTLS de entrada. Rate limiting distribuído via Redis. Audit log de todas as operações.",
            technology: "Kong Enterprise / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-pix": {
            id: "dep-bc-pod-pix",
            name: "pods pix-service",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "3–12 pods (HPA por RPS). Conexão RSFN via Direct Connect + CloudHSM para assinatura. Circuit breaker para DICT/SPI. SLA 99,97%.",
            technology: "Kotlin / JVM / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-account": {
            id: "dep-bc-pod-account",
            name: "pods account-service",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "3–8 pods. Serialização de escritas por conta via Redis lock (evita race condition de saldo). Réplica Aurora para leituras.",
            technology: "Java / JVM / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-ledger": {
            id: "dep-bc-pod-ledger",
            name: "pods ledger-service",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "2–6 pods. Partition key por conta para escrita paralela. Schema append-only no Aurora (IAM policy bloqueando UPDATE/DELETE na tabela ledger_entries).",
            technology: "Java / JVM / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-fraud": {
            id: "dep-bc-pod-fraud",
            name: "pods fraud-prevention",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "4–10 pods Python/FastAPI. Modelo XGBoost carregado em memória (< 200MB). Feature store Redis para velocidade < 50ms. Warm-up automático no startup.",
            technology: "Python / FastAPI / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-bff": {
            id: "dep-bc-pod-bff",
            name: "pods bff-app",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "3–8 pods Kotlin. Cache GraphQL por cliente (TTL 30s, invalidado por eventos Kafka). DataLoader para N+1.",
            technology: "Kotlin / JVM / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-recon": {
            id: "dep-bc-pod-recon",
            name: "pods reconciliation (Airflow)",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "Airflow Scheduler + Workers. DAGs: reconciliacao_diaria, verificacao_pix_pendente, relatorio_compliance. Disparado às 23:30 após fechamento operacional.",
            technology: "Python / Airflow / Docker",
            parentId: "dep-bc-eks",
          },
          "dep-bc-pod-notif": {
            id: "dep-bc-pod-notif",
            name: "pods notification-service",
            type: "aws-containers",
            awsService: "Amazon EKS",
            description:
              "2–6 pods Node.js. Consumidor Kafka com DLQ para falhas de entrega. Retry 3× com backoff exponencial. Firebase + SES + Twilio.",
            technology: "Node.js / Docker",
            parentId: "dep-bc-eks",
          },

          "dep-bc-panel-data": {
            id: "dep-bc-panel-data",
            name: "Subnets de Dados (10.10.32.0/20)",
            type: "panel",
            panelKind: PanelKind.PrivateSubnet,
            panelColor: "hsl(270 50% 50%)",
            panelOpacity: 10,
            description:
              "Camada de dados isolada. Acesso apenas via VPC Endpoint e security group dedicado.",
            parentId: "dep-bc-vpc",
          },
          "dep-bc-aurora": {
            id: "dep-bc-aurora",
            name: "Aurora PostgreSQL (Multi-AZ)",
            type: "aws-database",
            awsService: "Amazon RDS",
            description:
              "Aurora PostgreSQL 16 Multi-AZ dedicado. Réplica de leitura para reconciliação e relatórios. PITR 35 dias. KMS CMK para criptografia. Performance Insights habilitado. IAM auth.",
            technology: "Aurora PostgreSQL 16",
            parentId: "dep-bc-panel-data",
          },
          "dep-bc-redis": {
            id: "dep-bc-redis",
            name: "ElastiCache Redis 7",
            type: "aws-database",
            awsService: "Amazon ElastiCache",
            description:
              "Cluster mode. 3 shards × 2 réplicas. Usos: sessões OAuth (TTL 15min), feature store de fraude, locks de saldo (TTL 2s), rate limiting por CPF.",
            technology: "Redis 7 / ElastiCache",
            parentId: "dep-bc-panel-data",
          },
          "dep-bc-msk": {
            id: "dep-bc-msk",
            name: "MSK Kafka 3.7 (FIPS)",
            type: "aws-integration",
            awsService: "Amazon MSK",
            description:
              "3 brokers kafka.m5.2xlarge. TLS em trânsito obrigatório. mTLS para producers/consumers. Retenção 30 dias (compliance regulatório). KMS CMK para criptografia em repouso.",
            technology: "MSK / Kafka 3.7 / FIPS",
            parentId: "dep-bc-panel-data",
          },

          "dep-bc-panel-hsm": {
            id: "dep-bc-panel-hsm",
            name: "Zona Segura — Conectividade Regulatória",
            type: "panel",
            panelKind: PanelKind.Default,
            panelColor: "hsl(0 70% 40%)",
            panelOpacity: 8,
            description:
              "Componentes com requisitos de segurança regulatória: HSM, gestão de certificados e conectividade BACEN.",
            parentId: "dep-bc-vpc",
          },
          "dep-bc-hsm-luna": {
            id: "dep-bc-hsm-luna",
            name: "CloudHSM Cluster",
            type: "aws-security",
            awsService: "AWS CloudHSM",
            description:
              "2 HSMs em AZs distintas (HA). Armazena: chave privada ICP-Brasil (PIX/RSFN), chaves de assinatura JWT, KEK para dados sensíveis. PKCS#11 interface.",
            technology: "CloudHSM Luna / FIPS 140-2 L3",
            parentId: "dep-bc-panel-hsm",
          },
          "dep-bc-cert-manager": {
            id: "dep-bc-cert-manager",
            name: "AWS Private CA + ACM",
            type: "aws-security",
            awsService: "AWS Certificate Manager",
            description:
              "CA privada para certificados mTLS internos (pods ↔ pods). ACM para certificados públicos (*.bancocentro.com.br). Rotação automática 90 dias.",
            technology: "ACM / Private CA",
            parentId: "dep-bc-panel-hsm",
          },
          "dep-bc-vault": {
            id: "dep-bc-vault",
            name: "HashiCorp Vault",
            type: "container",
            description:
              "Gestão de secrets: credenciais de banco de dados (rotação automática via Vault Agent), chaves de API de parceiros, tokens de serviço. HA mode com Raft.",
            technology: "HashiCorp Vault / Raft",
            parentId: "dep-bc-panel-hsm",
          },
          "dep-bc-directconn": {
            id: "dep-bc-directconn",
            name: "AWS Direct Connect",
            type: "aws-networking",
            awsService: "AWS Direct Connect",
            description:
              "Conexão dedicada 1Gbps para RSFN (rede do Banco Central). Latência garantida < 5ms. Redundância física por duas operadoras distintas. Exigência regulatória PIX.",
            technology: "Direct Connect / BGP",
            parentId: "dep-bc-panel-hsm",
          },

          "dep-bc-note": {
            id: "dep-bc-note",
            name: "Custos, Compliance e IaC",
            type: "note",
            description:
              "## Custo mensal estimado (sa-east-1)\n- EKS nodes: ~$1.600 (m5.2xlarge Spot + On-demand críticos)\n- Aurora Multi-AZ: ~$720 (r6g.2xlarge)\n- ElastiCache: ~$420 (r6g.large × 6)\n- MSK FIPS: ~$680 (m5.2xlarge × 3)\n- CloudHSM: ~$1.440 (2 HSMs × $720)\n- Direct Connect: ~$560 (1Gbps dedicado)\n- WAF + Shield: ~$400\n\n**Total estimado: ~$5.820/mês**\n\n## Compliance\n- PCI-DSS Level 1 (em processo)\n- BACEN Res. 4.893/2021 (Cybersecurity)\n- LGPD + Sigilo Bancário (LC 105/2001)\n- Circular BCB 3.909 (segregação TI)\n\n## IaC\n- Terraform com módulos de segurança bancária\n- ArgoCD GitOps + OPA Gatekeeper\n- Checkov para scan de infraestrutura",
            parentId: null,
          },
        },
        connections: {
          "dep-bc-r1": {
            id: "dep-bc-r1",
            sourceId: "dep-bc-waf",
            targetId: "dep-bc-alb",
            label: "Inspeciona tráfego HTTPS",
            intent: "call",
          },
          "dep-bc-r2": {
            id: "dep-bc-r2",
            sourceId: "dep-bc-alb",
            targetId: "dep-bc-pod-gateway",
            label: "Roteia para Kong (mTLS)",
            intent: "call",
          },
          "dep-bc-r3": {
            id: "dep-bc-r3",
            sourceId: "dep-bc-pod-gateway",
            targetId: "dep-bc-pod-pix",
            label: "Roteia /pix/payments",
            intent: "call",
          },
          "dep-bc-r4": {
            id: "dep-bc-r4",
            sourceId: "dep-bc-pod-gateway",
            targetId: "dep-bc-pod-account",
            label: "Roteia /accounts",
            intent: "call",
          },
          "dep-bc-r5": {
            id: "dep-bc-r5",
            sourceId: "dep-bc-pod-gateway",
            targetId: "dep-bc-pod-bff",
            label: "Roteia /graphql",
            intent: "call",
          },
          "dep-bc-r6": {
            id: "dep-bc-r6",
            sourceId: "dep-bc-pod-pix",
            targetId: "dep-bc-msk",
            label: "Publica pix.* events",
            intent: "event",
            style: { animated: true },
          },
          "dep-bc-r7": {
            id: "dep-bc-r7",
            sourceId: "dep-bc-pod-pix",
            targetId: "dep-bc-directconn",
            label: "Mensagens SPI via RSFN",
            intent: "call",
            style: { strokeWidth: 2 },
          },
          "dep-bc-r8": {
            id: "dep-bc-r8",
            sourceId: "dep-bc-pod-pix",
            targetId: "dep-bc-hsm-luna",
            label: "Assina mensagens (ICP-Brasil)",
            intent: "call",
            style: { strokeStyle: StrokeStyle.Dashed },
          },
          "dep-bc-r9": {
            id: "dep-bc-r9",
            sourceId: "dep-bc-pod-account",
            targetId: "dep-bc-aurora",
            label: "JDBC (leitura/escrita de saldo)",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "dep-bc-r10": {
            id: "dep-bc-r10",
            sourceId: "dep-bc-pod-ledger",
            targetId: "dep-bc-aurora",
            label: "Append-only ledger entries",
            intent: "data-flow",
            style: { strokeWidth: 2 },
          },
          "dep-bc-r11": {
            id: "dep-bc-r11",
            sourceId: "dep-bc-pod-fraud",
            targetId: "dep-bc-redis",
            label: "Feature store (velocity checks)",
            intent: "data-flow",
          },
          "dep-bc-r12": {
            id: "dep-bc-r12",
            sourceId: "dep-bc-msk",
            targetId: "dep-bc-pod-fraud",
            label: "Consome pix.initiated",
            intent: "event",
            style: { animated: true },
          },
          "dep-bc-r13": {
            id: "dep-bc-r13",
            sourceId: "dep-bc-msk",
            targetId: "dep-bc-pod-notif",
            label: "Consome pix.settled / blocked",
            intent: "event",
            style: { animated: true },
          },
          "dep-bc-r14": {
            id: "dep-bc-r14",
            sourceId: "dep-bc-msk",
            targetId: "dep-bc-pod-recon",
            label: "Consome eventos de transação",
            intent: "event",
            style: { animated: true },
          },
          "dep-bc-r15": {
            id: "dep-bc-r15",
            sourceId: "dep-bc-pod-recon",
            targetId: "dep-bc-nat",
            label: "Acessa SISBACEN via NAT (EIP fixo)",
            intent: "dependency",
          },
          "dep-bc-r16": {
            id: "dep-bc-r16",
            sourceId: "dep-bc-pod-gateway",
            targetId: "dep-bc-cloudwatch",
            label: "Audit logs + traces X-Ray",
            intent: "async-message",
            style: { strokeStyle: StrokeStyle.Dashed, animated: true },
          },
          "dep-bc-r17": {
            id: "dep-bc-r17",
            sourceId: "dep-bc-pod-pix",
            targetId: "dep-bc-redis",
            label: "Locks de reserva de fundos (TTL 2s)",
            intent: "data-flow",
          },
          "dep-bc-r18": {
            id: "dep-bc-r18",
            sourceId: "dep-bc-vault",
            targetId: "dep-bc-pod-pix",
            label: "Injeta credentials (Vault Agent)",
            intent: "call",
            style: { strokeStyle: StrokeStyle.Dashed },
          },
        },
      },
    },
  };
}

export const SEED_BC_SERVICE_REGISTRY: Record<string, ServiceDefinition> = buildServiceRegistry();
export const SEED_BC_DIAGRAMS: Record<string, Diagram> = buildDiagrams();
export const SEED_BC_FOLDERS: Record<string, Folder> = buildFolders();

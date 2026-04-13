import {
  ExternalLinkType,
  PanelKind,
  ServiceSource,
  StrokeStyle,
  type Diagram,
  type FlowStep,
  type Folder,
  type ServiceDefinition,
} from "@/features/diagram";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: constrói Record<id, FlowStep> encadeando .next automaticamente
// ─────────────────────────────────────────────────────────────────────────────
function steps(list: FlowStep[]): Record<string, FlowStep> {
  const map: Record<string, FlowStep> = {};
  for (let i = 0; i < list.length; i++) {
    const step = list[i]!;
    const autoNext = step.type !== "condition" ? list[i + 1]?.id : undefined;
    map[step.id] = { ...step, next: step.next ?? autoNext };
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDs de pasta
// ─────────────────────────────────────────────────────────────────────────────
const FOLDER_ROOT = "folder-urlshort-root";

// ─────────────────────────────────────────────────────────────────────────────
// Folders
// ─────────────────────────────────────────────────────────────────────────────
function buildFolders(): Record<string, Folder> {
  return {
    [FOLDER_ROOT]: {
      id: FOLDER_ROOT,
      name: "URLShort",
      parentId: null,
      domain: "seed",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Registry
// ─────────────────────────────────────────────────────────────────────────────
function buildServiceRegistry(): Record<string, ServiceDefinition> {
  return {
    "svc-redirect-api": {
      id: "svc-redirect-api",
      name: "redirect-api",
      description:
        "API de redirecionamento. Recebe o slug curto, consulta o Redis e redireciona via HTTP 301/302. Responsável por 99% do tráfego do sistema.",
      repositoryUrl: "https://github.com/urlshort/redirect-api",
      technology: ["Go", "Redis", "PostgreSQL"],
      owner: "squad-core",
      tags: ["core", "redirect", "performance"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-management-api": {
      id: "svc-management-api",
      name: "management-api",
      description:
        "API REST para criação, edição e remoção de URLs curtas. Autentica via JWT. Expõe endpoints de analytics e configuração de expiração.",
      repositoryUrl: "https://github.com/urlshort/management-api",
      technology: ["Node.js", "TypeScript", "PostgreSQL", "Fastify"],
      owner: "squad-core",
      tags: ["management", "crud", "analytics"],
      sources: [{ type: ServiceSource.Manual }],
    },
    "svc-analytics-worker": {
      id: "svc-analytics-worker",
      name: "analytics-worker",
      description:
        "Worker assíncrono que consome eventos de acesso da fila SQS e persiste métricas agregadas no banco. Processa geolocalização por IP e device detection.",
      repositoryUrl: "https://github.com/urlshort/analytics-worker",
      technology: ["Python", "SQS", "PostgreSQL", "MaxMind GeoIP"],
      owner: "squad-analytics",
      tags: ["analytics", "worker", "async"],
      sources: [{ type: ServiceSource.Manual }],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagrams
// ─────────────────────────────────────────────────────────────────────────────
function buildDiagrams(): Record<string, Diagram> {
  return {

    // ═══════════════════════════════════════════════════════════════════════
    // L1 — Contexto
    // ═══════════════════════════════════════════════════════════════════════
    "d-us-context": {
      id: "d-us-context",
      name: "URLShort — Contexto do Sistema",
      description: "Visão C4 L1: atores e sistemas externos que interagem com o URLShort.",
      level: "context",
      domain: "seed",
      folderId: FOLDER_ROOT,
      createdAt: Date.parse("2026-01-10T09:00:00.000Z"),
      updatedAt: Date.parse("2026-04-13T01:09:29.290Z"),
      viewport: { x: 281, y: -47.75, zoom: 1.5 },
      edgeLayouts: {},
      scenes: {},
      activeSceneId: null,
      nodeLayouts: {
        "us-ctx-creator": { elementId: "us-ctx-creator", x: 80, y: 200, width: 260, height: 85 },
        "us-ctx-visitor": { elementId: "us-ctx-visitor", x: 80, y: 480, width: 260, height: 85 },
        "us-ctx-system": { elementId: "us-ctx-system", x: 480, y: 300, width: 260, height: 100 },
        "us-ctx-auth0": { elementId: "us-ctx-auth0", x: 900, y: 120, width: 260, height: 85 },
        "us-ctx-sendgrid": { elementId: "us-ctx-sendgrid", x: 900, y: 320, width: 260, height: 85 },
        "us-ctx-maxmind": { elementId: "us-ctx-maxmind", x: 900, y: 500, width: 260, height: 85 },
        "us-ctx-note": { elementId: "us-ctx-note", x: 1239.1752577319585, y: 57.5257731958763, width: 360, height: 560 }
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-ctx-create": {
            id: "flow-ctx-create",
            name: "Criar URL Curta",
            diagramId: "d-us-context",
            description: "Um criador autentica, envia a URL longa e recebe o slug curto.",
            tags: ["happy-path", "criacao"],
            mermaid: "sequenceDiagram",
            entryStepId: "ctx-f1",
            steps: steps([
              {
                id: "ctx-f1",
                type: "action",
                componentId: "us-ctx-creator",
                connectionId: "us-ctx-r1",
                description: "Criador acessa o dashboard e cola a URL longa no campo de criação.",
                payload: '{ "longUrl": "https://meu-site.com/artigo-muito-longo-2026", "customSlug": "artigo26" }',
                payloadDirection: "request",
              },
              {
                id: "ctx-f2",
                type: "action",
                componentId: "us-ctx-system",
                connectionId: "us-ctx-r3",
                description: "Sistema valida o token JWT com Auth0 e verifica o plano do usuário.",
                duration: "~80ms",
              },
              {
                id: "ctx-f3",
                type: "action",
                componentId: "us-ctx-system",
                description: "Sistema gera o slug único, persiste no banco e aquece o cache Redis.",
                duration: "~40ms",
                payload: '{ "shortUrl": "https://url.sh/artigo26", "expiresAt": null }',
                payloadDirection: "response",
              },
              {
                id: "ctx-f4",
                type: "action",
                componentId: "us-ctx-sendgrid",
                description: "Sistema dispara e-mail de confirmação com a URL curta gerada via SendGrid.",
                isAsync: true,
              },
            ]),
          },
        },
        components: {
          "us-ctx-creator": {
            id: "us-ctx-creator",
            name: "Criador de Links",
            type: "person",
            description:
              "Usuário autenticado que cria e gerencia URLs curtas pelo dashboard web. Pode ser pessoa física ou integrador via API com token.",
            parentId: null,
            tags: ["usuario", "autenticado"],
          },
          "us-ctx-visitor": {
            id: "us-ctx-visitor",
            name: "Visitante",
            type: "person",
            description:
              "Qualquer pessoa que clica em um link curto. Não precisa de conta. Recebe redirect HTTP 301/302 imediato.",
            parentId: null,
            tags: ["usuario", "anonimo"],
          },
          "us-ctx-system": {
            id: "us-ctx-system",
            name: "URLShort",
            type: "system",
            description:
              "Plataforma de encurtamento de URLs com analytics em tempo real. Permite criar links curtos, customizar slugs, definir expiração e acompanhar cliques por país, dispositivo e hora.",
            parentId: null,
            linkedDiagramId: "d-us-containers",
            tags: ["core", "saas"],
            externalLinks: [
              {
                id: "el-1",
                label: "Spec no Confluence",
                url: "https://confluence.example.com/urlshort/spec",
                type: ExternalLinkType.Confluence,
              },
              {
                id: "el-2",
                label: "Epic no Jira",
                url: "https://jira.example.com/browse/URL-1",
                type: ExternalLinkType.Jira,
              },
            ],
          },
          "us-ctx-auth0": {
            id: "us-ctx-auth0",
            name: "Auth0",
            type: "system",
            description:
              "Provedor de identidade externo. Emite e valida JWTs para criadores de links. Suporta social login (Google, GitHub) e MFA.",
            parentId: null,
            tags: ["externo", "auth", "identidade"],
          },
          "us-ctx-sendgrid": {
            id: "us-ctx-sendgrid",
            name: "SendGrid",
            type: "system",
            description:
              "Plataforma de envio de e-mails transacionais. Usada para confirmações de criação de link, alertas de expiração e resumos semanais de analytics.",
            parentId: null,
            tags: ["externo", "email", "notificacao"],
          },
          "us-ctx-maxmind": {
            id: "us-ctx-maxmind",
            name: "MaxMind GeoIP",
            type: "system",
            description:
              "Banco de dados de geolocalização por IP. Usado pelo Analytics Worker para enriquecer eventos de clique com país, estado e cidade.",
            parentId: null,
            tags: ["externo", "geoip", "analytics"],
          },
          "us-ctx-note": {
            id: "us-ctx-note",
            name: "Contexto do Produto",
            type: "note",
            description:
              "## URLShort — Por quê?\n\nServiço de encurtamento de URLs com foco em **desempenho** e **analytics**, voltado para times de marketing e desenvolvedores.\n\n## Objetivos de Produto\n- Redirect em **< 50ms** P95 (crítico para UX e SEO)\n- Analytics em tempo real: cliques por país, dispositivo e hora\n- Slugs customizados e expiração configurável\n\n## SLOs\n- **Disponibilidade**: 99,9% (máx. 8,7h downtime/ano)\n- **Latência de redirect P95**: < 50ms\n- **Latência de criação P95**: < 500ms\n\n## Segurança\n- JWT com Auth0 em todas as rotas de gestão\n- Rate limit por IP: 100 req/min em criação\n- Scan de URLs maliciosas (Google Safe Browsing API)",
            parentId: null,
          },
        },
        connections: {
          "us-ctx-r1": { id: "us-ctx-r1", sourceId: "us-ctx-creator", targetId: "us-ctx-system", label: "Cria e gerencia links", technology: "HTTPS / JWT", intent: "call" },
          "us-ctx-r2": { id: "us-ctx-r2", sourceId: "us-ctx-visitor", targetId: "us-ctx-system", label: "Acessa link curto → redirect", technology: "HTTPS", intent: "call" },
          "us-ctx-r3": { id: "us-ctx-r3", sourceId: "us-ctx-system", targetId: "us-ctx-auth0", label: "Valida token JWT", technology: "OIDC / JWKS", intent: "call" },
          "us-ctx-r4": { id: "us-ctx-r4", sourceId: "us-ctx-system", targetId: "us-ctx-sendgrid", label: "Envia e-mails transacionais", technology: "HTTPS / REST", intent: "event", style: { strokeStyle: StrokeStyle.Dashed } },
          "us-ctx-r5": { id: "us-ctx-r5", sourceId: "us-ctx-system", targetId: "us-ctx-maxmind", label: "Geolocaliza IPs de cliques", technology: "lib local / DB", intent: "call", style: { strokeStyle: StrokeStyle.Dashed } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // L2 — Containers
    // ═══════════════════════════════════════════════════════════════════════
    "d-us-containers": {
      id: "d-us-containers",
      name: "URLShort — Containers",
      description: "Visão C4 L2: os containers do URLShort e como se comunicam.",
      level: "container",
      domain: "seed",
      folderId: FOLDER_ROOT,
      createdAt: Date.parse("2026-01-10T09:10:00.000Z"),
      updatedAt: Date.parse("2026-04-13T02:09:52.538Z"),
      viewport: { x: 210.21052631578948, y: 20.63157894736844, zoom: 0.6421052631578947 },
      edgeLayouts: {},
      scenes: {},
      activeSceneId: null,
      nodeLayouts: {
        "us-ct-creator": { elementId: "us-ct-creator", x: -80.16393442622953, y: 175.08196721311478, width: 260, height: 85 },
        "us-ct-visitor": { elementId: "us-ct-visitor", x: -84.8360655737705, y: 520, width: 200, height: 68 },
        "us-ct-boundary": { elementId: "us-ct-boundary", x: 250.57377049180326, y: 66.06557377049177, width: 1192, height: 836 },
        "us-ct-spa": { elementId: "us-ct-spa", x: 73.27868852459011, y: 58.68852459016394, width: 260, height: 109 },
        "us-ct-mgmt-api": { elementId: "us-ct-mgmt-api", x: 449.59016393442613, y: 38.28688524590163, width: 260, height: 155 },
        "us-ct-queue": { elementId: "us-ct-queue", x: 446.90163934426215, y: 650.9590163934427, width: 260, height: 109 },
        "us-ct-redir-api": { elementId: "us-ct-redir-api", x: 40, y: 473.6885245901639, width: 260, height: 109 },
        "us-ct-cache": { elementId: "us-ct-cache", x: 405.5163934426229, y: 315.5819672131148, width: 260, height: 109 },
        "us-ct-db": { elementId: "us-ct-db", x: 891.7540983606555, y: 54.754098360655746, width: 260, height: 109 },
        "us-ct-worker": { elementId: "us-ct-worker", x: 849.0163934426228, y: 647.4590163934427, width: 260, height: 109 },
        "us-ct-note": { elementId: "us-ct-note", x: 1479.0983606557375, y: 132.95081967213116, width: 340, height: 420 }
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-ct-redirect": {
            id: "flow-ct-redirect",
            name: "Redirecionar Visitante",
            diagramId: "d-us-containers",
            description:
              "Visitante acessa link curto e é redirecionado em < 50ms. Analytics registrado de forma assíncrona.",
            tags: ["redirect", "performance", "happy-path"],
            mermaid: "sequenceDiagram",
            entryStepId: "ct-r-f1",
            steps: steps([
              {
                id: "ct-r-f1",
                type: "action",
                componentId: "us-ct-visitor",
                connectionId: "us-ct-r6",
                description: "Visitante clica no link curto. Browser envia GET /abc123 para a Redirect API.",
              },
              {
                id: "ct-r-f2",
                type: "action",
                componentId: "us-ct-redir-api",
                connectionId: "us-ct-r9",
                description: "Redirect API consulta o slug 'abc123' no Redis.",
                duration: "~2ms",
              },
              {
                id: "ct-r-f3",
                type: "condition",
                componentId: "us-ct-cache",
                conditionLabel: "Cache hit?",
                branches: [
                  { label: "Sim — retorna URL longa", nextId: "ct-r-f4" },
                  { label: "Não — busca no banco", nextId: "ct-r-f-miss" },
                ],
              },
              {
                id: "ct-r-f-miss",
                type: "action",
                componentId: "us-ct-redir-api",
                connectionId: "us-ct-r10",
                description: "Cache miss: busca no PostgreSQL e aquece o Redis com TTL de 24h.",
                duration: "~20ms",
                next: "ct-r-f4",
              },
              {
                id: "ct-r-f4",
                type: "action",
                componentId: "us-ct-redir-api",
                description: "Redirect API responde HTTP 301 com Location: <url-longa>. Total < 50ms.",
                payload: '{ "status": 301, "Location": "https://meu-site.com/artigo-muito-longo-2026" }',
                payloadDirection: "response",
              },
              {
                id: "ct-r-f5",
                type: "action",
                componentId: "us-ct-redir-api",
                connectionId: "us-ct-r11",
                description: "Publica evento de clique na fila SQS de forma assíncrona (não bloqueia o redirect).",
                isAsync: true,
              },
              {
                id: "ct-r-f6",
                type: "action",
                componentId: "us-ct-worker",
                description: "Analytics Worker consome o evento, faz lookup GeoIP e persiste métricas no banco.",
                isAsync: true,
              },
            ]),
          },
        },
        components: {
          "us-ct-creator": {
            id: "us-ct-creator",
            name: "Criador de Links",
            type: "person",
            description: "Usuário autenticado que gerencia links via dashboard.",
            parentId: null,
          },
          "us-ct-visitor": {
            id: "us-ct-visitor",
            name: "Visitante",
            type: "person",
            description: "Quem clica no link curto.",
            parentId: null,
          },
          "us-ct-boundary": {
            id: "us-ct-boundary",
            name: "URLShort Platform",
            type: "panel",
            description: "Boundary do sistema URLShort.",
            parentId: null,
            panelKind: PanelKind.Default,
          },
          "us-ct-spa": {
            id: "us-ct-spa",
            name: "Dashboard SPA",
            type: "container",
            description: "App React para criação e analytics de links. Hospedado no CloudFront/S3.",
            parentId: "us-ct-boundary",
            technology: "React 18 + TypeScript",
            tags: ["frontend", "spa"],
          },
          "us-ct-mgmt-api": {
            id: "us-ct-mgmt-api",
            name: "Management API",
            type: "container",
            description:
              "API REST para CRUD de URLs, configuração de slugs customizados, expiração e consulta de analytics. Autenticação JWT.",
            parentId: "us-ct-boundary",
            technology: "Node.js + Fastify",
            linkedDiagramId: "d-us-components",
            tags: ["backend", "crud"],
            registryServiceId: "svc-management-api",
          },
          "us-ct-redir-api": {
            id: "us-ct-redir-api",
            name: "Redirect API",
            type: "container",
            description:
              "Serviço de alta performance para resolver slugs e emitir redirects HTTP 301/302. Otimizado para < 50ms P95.",
            parentId: "us-ct-boundary",
            technology: "Go 1.22",
            tags: ["backend", "performance", "critical"],
            registryServiceId: "svc-redirect-api",
          },
          "us-ct-worker": {
            id: "us-ct-worker",
            name: "Analytics Worker",
            type: "container",
            description:
              "Worker assíncrono que processa eventos de clique da fila SQS, enriquece com GeoIP e persiste métricas agregadas.",
            parentId: "us-ct-boundary",
            technology: "Python 3.12 + Celery",
            tags: ["worker", "async", "analytics"],
            registryServiceId: "svc-analytics-worker",
          },
          "us-ct-db": {
            id: "us-ct-db",
            name: "PostgreSQL",
            type: "container",
            description:
              "Banco relacional principal. Armazena URLs, usuários e métricas de analytics. Multi-AZ para alta disponibilidade.",
            parentId: "us-ct-boundary",
            technology: "PostgreSQL 16 (RDS)",
            tags: ["database", "persistencia"],
          },
          "us-ct-cache": {
            id: "us-ct-cache",
            name: "Redis",
            type: "container",
            description:
              "Cache de slugs com TTL de 24h. Elimina 95%+ das consultas ao banco no caminho crítico de redirect.",
            parentId: "us-ct-boundary",
            technology: "Redis 7 (ElastiCache)",
            tags: ["cache", "performance"],
          },
          "us-ct-queue": {
            id: "us-ct-queue",
            name: "SQS — Click Events",
            type: "container",
            description:
              "Fila SQS Standard para eventos de clique. Desacopla o redirect do processamento de analytics. DLQ após 3 tentativas.",
            parentId: "us-ct-boundary",
            technology: "AWS SQS + DLQ",
            tags: ["queue", "async", "eventos"],
          },
          "us-ct-note": {
            id: "us-ct-note",
            name: "Decisões Arquiteturais",
            type: "note",
            description:
              "## Por que Go na Redirect API?\n\nO redirect é o caminho crítico: P95 < 50ms com > 10k req/s. Go foi escolhido por:\n- Latência de startup próxima de zero\n- Sem GC pauses significativos\n- Modelo de concorrência eficiente (goroutines)\n\n## Por que Redis e não somente o banco?\n\nUma consulta ao PostgreSQL leva ~15-25ms. Com 10k req/s, o banco seria saturado. O Redis resolve 95%+ dos redirects em ~2ms, sem tocar no banco.\n\n## Cache Strategy\n\n- **TTL**: 24h por slug\n- **Invalidação**: write-through na criação/edição\n- **Eviction**: allkeys-lru\n\n## Analytics Assíncrono\n\nO analytics **nunca bloqueia o redirect**. O evento é publicado no SQS após o HTTP 301 ser enviado. Se o SQS estiver indisponível, o redirect funciona normalmente — apenas o analytics é perdido.",
            parentId: null,
          },
        },
        connections: {
          "us-ct-r1": { id: "us-ct-r1", sourceId: "us-ct-creator", targetId: "us-ct-spa", label: "Gerencia links", technology: "HTTPS", intent: "call" },
          "us-ct-r2": { id: "us-ct-r2", sourceId: "us-ct-spa", targetId: "us-ct-mgmt-api", label: "REST API calls", technology: "HTTPS / JWT", intent: "call" },
          "us-ct-r3": { id: "us-ct-r3", sourceId: "us-ct-mgmt-api", targetId: "us-ct-db", label: "CRUD de URLs e usuários", technology: "SQL / TCP", intent: "data-flow", style: { strokeStyle: StrokeStyle.Solid, strokeWidth: 2 } },
          "us-ct-r4": { id: "us-ct-r4", sourceId: "us-ct-mgmt-api", targetId: "us-ct-cache", label: "Aquece cache (write-through)", technology: "Redis", intent: "call" },
          "us-ct-r5": { id: "us-ct-r5", sourceId: "us-ct-mgmt-api", targetId: "us-ct-queue", label: "Publica link.created", technology: "AWS SQS", intent: "event", style: { animated: true } },
          "us-ct-r6": { id: "us-ct-r6", sourceId: "us-ct-visitor", targetId: "us-ct-redir-api", label: "GET /{slug}", technology: "HTTPS", intent: "call" },
          "us-ct-r9": { id: "us-ct-r9", sourceId: "us-ct-redir-api", targetId: "us-ct-cache", label: "Lookup slug (< 2ms)", technology: "Redis", intent: "call" },
          "us-ct-r10": { id: "us-ct-r10", sourceId: "us-ct-redir-api", targetId: "us-ct-db", label: "Cache miss — SELECT", technology: "SQL / TCP", intent: "call", style: { strokeStyle: StrokeStyle.Dashed } },
          "us-ct-r11": { id: "us-ct-r11", sourceId: "us-ct-redir-api", targetId: "us-ct-queue", label: "Publica click.registered", technology: "AWS SQS", intent: "event", style: { animated: true } },
          "us-ct-r12": { id: "us-ct-r12", sourceId: "us-ct-queue", targetId: "us-ct-worker", label: "Consome eventos de clique", technology: "SQS polling", intent: "event", style: { animated: true } },
          "us-ct-r13": { id: "us-ct-r13", sourceId: "us-ct-worker", targetId: "us-ct-db", label: "Persiste métricas", technology: "SQL / TCP", intent: "data-flow" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // L3 — Componentes da Management API
    // ═══════════════════════════════════════════════════════════════════════
    "d-us-components": {
      id: "d-us-components",
      name: "URLShort — Componentes da Management API",
      description:
        "Visão C4 L3: módulos internos da Management API, contrato REST e modelo de dados.",
      level: "component",
      domain: "seed",
      folderId: FOLDER_ROOT,
      createdAt: Date.parse("2026-01-10T09:20:00.000Z"),
      updatedAt: Date.parse("2026-04-13T02:11:54.454Z"),
      viewport: { x: 388.97622542546725, y: 144.52874015022635, zoom: 0.43608625423010544 },
      edgeLayouts: {},
      scenes: {},
      activeSceneId: null,
      nodeLayouts: {
        "us-cp-lane-http": { elementId: "us-cp-lane-http", x: -492.96721311475403, y: -64.70491803278694, width: 909, height: 458 },
        "us-cp-lane-app": { elementId: "us-cp-lane-app", x: 460.0000000000002, y: -71.07377049180336, width: 1097, height: 530 },
        "us-cp-lane-infra": { elementId: "us-cp-lane-infra", x: 1609.2295081967213, y: -73.7950819672132, width: 567, height: 934 },
        "us-cp-api-group": { elementId: "us-cp-api-group", x: 40, y: 70.3032786885246, width: 300, height: 308 },
        "us-cp-ep-post": { elementId: "us-cp-ep-post", x: 80, y: 60, width: 300, height: 40 },
        "us-cp-ep-get": { elementId: "us-cp-ep-get", x: 80, y: 100, width: 300, height: 40 },
        "us-cp-ep-patch": { elementId: "us-cp-ep-patch", x: 80, y: 140, width: 300, height: 40 },
        "us-cp-ep-delete": { elementId: "us-cp-ep-delete", x: 80, y: 180, width: 300, height: 40 },
        "us-cp-ep-analytics": { elementId: "us-cp-ep-analytics", x: 80, y: 220, width: 300, height: 40 },
        "us-cp-auth-guard": { elementId: "us-cp-auth-guard", x: 609.3196721311476, y: 40, width: 260, height: 109 },
        "us-cp-url-svc": { elementId: "us-cp-url-svc", x: 42.95081967213116, y: 40, width: 260, height: 109 },
        "us-cp-analytics-svc": { elementId: "us-cp-analytics-svc", x: 40, y: 341.2213114754097, width: 260, height: 109 },
        "us-cp-cache-svc": { elementId: "us-cp-cache-svc", x: 796.5163934426228, y: 185.37704918032787, width: 260, height: 109 },
        "us-cp-event-pub": { elementId: "us-cp-event-pub", x: 416.7950819672127, y: 259.6065573770493, width: 260, height: 109 },
        "us-cp-db-table-urls": { elementId: "us-cp-db-table-urls", x: 80, y: 40, width: 300, height: 244 },
        "us-cp-db-table-clicks": { elementId: "us-cp-db-table-clicks", x: 40, y: 634, width: 300, height: 220 },
        "us-cp-json-create-req": { elementId: "us-cp-json-create-req", x: 247.13114754098365, y: 382.8360655737704, width: 280, height: 180 },
        "us-cp-json-create-res": { elementId: "us-cp-json-create-res", x: 235.7377049180327, y: 512.5327868852461, width: 280, height: 180 }
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-cp-create": {
            id: "flow-cp-create",
            name: "Criar URL — Fluxo Interno",
            diagramId: "d-us-components",
            description: "Caminho interno na Management API desde o endpoint até o cache e evento.",
            tags: ["criacao", "interno"],
            mermaid: "sequenceDiagram",
            entryStepId: "cp-f1",
            steps: steps([
              {
                id: "cp-f1",
                type: "action",
                componentId: "us-cp-ep-post",
                description: "POST /api/v1/urls recebe o body com longUrl e customSlug opcional.",
                payload: '{ "longUrl": "https://meu-site.com/...", "customSlug": "artigo26", "expiresAt": null }',
                payloadDirection: "request",
              },
              {
                id: "cp-f2",
                type: "action",
                componentId: "us-cp-auth-guard",
                description: "AuthGuard valida o JWT com JWKS do Auth0 e injeta userId no contexto.",
                duration: "~40ms",
              },
              {
                id: "cp-f3",
                type: "action",
                componentId: "us-cp-url-svc",
                connectionId: "us-cp-conn-svc-db",
                description: "UrlService valida unicidade do slug, gera hash de 6 chars se não customizado, persiste na tabela urls.",
                duration: "~25ms",
              },
              {
                id: "cp-f4",
                type: "action",
                componentId: "us-cp-cache-svc",
                description: "CacheService grava slug → longUrl no Redis com TTL 24h (write-through).",
                duration: "~3ms",
              },
              {
                id: "cp-f5",
                type: "action",
                componentId: "us-cp-event-pub",
                description: "EventPublisher emite link.created no SQS de forma assíncrona.",
                isAsync: true,
              },
            ]),
          },
        },
        components: {
          // ── Swimlanes ────────────────────────────────────────────────────
          "us-cp-lane-http": {
            id: "us-cp-lane-http",
            name: "HTTP / Entrada",
            type: "panel",
            description: "Camada de entrada: roteamento HTTP, autenticação e validação de schemas.",
            parentId: null,
            panelKind: PanelKind.Swimlane,
          },
          "us-cp-lane-app": {
            id: "us-cp-lane-app",
            name: "Aplicação / Negócio",
            type: "panel",
            description: "Serviços de domínio: regras de negócio, orquestração e cache.",
            parentId: null,
            panelKind: PanelKind.Swimlane,
          },
          "us-cp-lane-infra": {
            id: "us-cp-lane-infra",
            name: "Infraestrutura / Dados",
            type: "panel",
            description: "Tabelas do banco, schemas de request/response e contratos de dados.",
            parentId: null,
            panelKind: PanelKind.Swimlane,
          },

          // ── API Group + Endpoints ────────────────────────────────────────
          "us-cp-api-group": {
            id: "us-cp-api-group",
            name: "Management API",
            type: "api-group",
            description: "Contrato REST completo da Management API. Todas as rotas exigem JWT Bearer.",
            parentId: "us-cp-lane-http",
            serviceName: "management-api",
            basePath: "/api/v1",
            protocol: "REST",
            sla: "P95 < 500ms"
          },
          "us-cp-ep-post": {
            id: "us-cp-ep-post",
            name: "Criar URL",
            type: "endpoint",
            description: "Cria uma nova URL curta. Valida unicidade do slug e retorna o link gerado.",
            parentId: "us-cp-api-group",
            method: "POST",
            path: "/urls",
            endpointDescription: "Body: { longUrl, customSlug?, expiresAt? }. Retorna 201 com shortUrl.",
            handlers: [
              {
                id: "h-post-1",
                label: "Criar URL Curta",
                flowId: "flow-cp-create",
                description: "Valida slug, persiste e publica evento.",
              },
            ],
          },
          "us-cp-ep-get": {
            id: "us-cp-ep-get",
            name: "Buscar URL",
            type: "endpoint",
            description: "Retorna detalhes de uma URL curta pelo slug.",
            parentId: "us-cp-api-group",
            method: "GET",
            path: "/urls/{slug}",
            handlers: [],
          },
          "us-cp-ep-patch": {
            id: "us-cp-ep-patch",
            name: "Atualizar URL",
            type: "endpoint",
            description: "Atualiza a URL de destino ou a data de expiração.",
            parentId: "us-cp-api-group",
            method: "PATCH",
            path: "/urls/{slug}",
            handlers: [],
          },
          "us-cp-ep-delete": {
            id: "us-cp-ep-delete",
            name: "Remover URL",
            type: "endpoint",
            description: "Desativa permanentemente uma URL curta.",
            parentId: "us-cp-api-group",
            method: "DELETE",
            path: "/urls/{slug}",
            handlers: [],
          },
          "us-cp-ep-analytics": {
            id: "us-cp-ep-analytics",
            name: "Analytics da URL",
            type: "endpoint",
            description: "Retorna métricas de cliques com filtro por período, país e dispositivo.",
            parentId: "us-cp-api-group",
            method: "GET",
            path: "/urls/{slug}/analytics",
            endpointDescription: "Query params: ?from=&to=&groupBy=country|device|hour. Retorna séries temporais.",
            handlers: [],
          },

          // ── Auth Guard ───────────────────────────────────────────────────
          "us-cp-auth-guard": {
            id: "us-cp-auth-guard",
            name: "Auth Guard",
            type: "component",
            description:
              "Middleware Fastify que valida JWT Bearer em todas as rotas. Busca JWKS do Auth0 com cache local de 5 min. Injeta userId e plano no contexto da request.",
            parentId: "us-cp-lane-http",
            technology: "jose / JWKS",
            tags: ["auth", "middleware"],
          },

          // ── App Layer ────────────────────────────────────────────────────
          "us-cp-url-svc": {
            id: "us-cp-url-svc",
            name: "UrlService",
            type: "component",
            description:
              "Lógica de negócio de URLs: validação de unicidade de slug, geração de hash Base62 de 6 chars, checagem de expiração e limites por plano.",
            parentId: "us-cp-lane-app",
            technology: "TypeScript class",
            tags: ["dominio", "core"],
          },
          "us-cp-analytics-svc": {
            id: "us-cp-analytics-svc",
            name: "AnalyticsService",
            type: "component",
            description:
              "Consulta métricas pré-agregadas da tabela url_clicks com filtros por período, país e dispositivo. Suporta granularidade por hora, dia e mês.",
            parentId: "us-cp-lane-app",
            technology: "TypeScript class + Prisma",
            tags: ["analytics", "consulta"],
          },
          "us-cp-cache-svc": {
            id: "us-cp-cache-svc",
            name: "CacheService",
            type: "component",
            description:
              "Abstração sobre o Redis. Operações: get(slug), set(slug, url, ttl), invalidate(slug). Serialização JSON. Metrics de hit rate expostas via Prometheus.",
            parentId: "us-cp-lane-app",
            technology: "ioredis",
            tags: ["cache", "redis"],
          },
          "us-cp-event-pub": {
            id: "us-cp-event-pub",
            name: "EventPublisher",
            type: "component",
            description:
              "Publica eventos de domínio no SQS. Eventos: link.created, link.updated, link.expired. Payload em JSON com correlationId para rastreabilidade.",
            parentId: "us-cp-lane-app",
            technology: "AWS SDK v3 + SQS",
            tags: ["eventos", "async"],
          },

          // ── Infra: DB Tables ─────────────────────────────────────────────
          "us-cp-db-table-urls": {
            id: "us-cp-db-table-urls",
            name: "urls",
            type: "db-table",
            description: "Tabela principal de URLs curtas.",
            parentId: "us-cp-lane-infra",
            tableName: "urls",
            columns: [
              { id: "col-url-1", name: "id", dataType: "uuid", isPrimaryKey: true, nullable: false, unique: true },
              { id: "col-url-2", name: "slug", dataType: "varchar(8)", nullable: false, unique: true },
              { id: "col-url-3", name: "long_url", dataType: "text", nullable: false },
              { id: "col-url-4", name: "user_id", dataType: "uuid", isForeignKey: true, nullable: false },
              { id: "col-url-5", name: "expires_at", dataType: "timestamptz", nullable: true },
              { id: "col-url-6", name: "created_at", dataType: "timestamptz", nullable: false },
              { id: "col-url-7", name: "click_count", dataType: "bigint", nullable: false },
            ],
          },
          "us-cp-db-table-clicks": {
            id: "us-cp-db-table-clicks",
            name: "url_clicks",
            type: "db-table",
            description: "Eventos de clique pré-agregados para analytics.",
            parentId: "us-cp-lane-infra",
            tableName: "url_clicks",
            columns: [
              { id: "col-clk-1", name: "id", dataType: "bigserial", isPrimaryKey: true, nullable: false },
              { id: "col-clk-2", name: "url_id", dataType: "uuid", isForeignKey: true, nullable: false },
              { id: "col-clk-3", name: "clicked_at", dataType: "timestamptz", nullable: false },
              { id: "col-clk-4", name: "country_code", dataType: "char(2)", nullable: true },
              { id: "col-clk-5", name: "device_type", dataType: "varchar(20)", nullable: true },
              { id: "col-clk-6", name: "ip_hash", dataType: "varchar(64)", nullable: true },
            ],
          },

          // ── JSON Viewers ─────────────────────────────────────────────────
          "us-cp-json-create-req": {
            id: "us-cp-json-create-req",
            name: "POST /urls — Request",
            type: "json-viewer",
            description: "Schema do body para criar uma URL curta.",
            parentId: "us-cp-lane-infra",
            jsonContent: JSON.stringify({
              longUrl: "https://meu-site.com/artigo-muito-longo-2026",
              customSlug: "artigo26",
              expiresAt: null,
            }, null, 2),
          },
          "us-cp-json-create-res": {
            id: "us-cp-json-create-res",
            name: "POST /urls — Response 201",
            type: "json-viewer",
            description: "Resposta de sucesso na criação de URL curta.",
            parentId: "us-cp-lane-infra",
            jsonContent: JSON.stringify({
              id: "018e4c2a-...",
              slug: "artigo26",
              shortUrl: "https://url.sh/artigo26",
              longUrl: "https://meu-site.com/artigo-muito-longo-2026",
              expiresAt: null,
              createdAt: Date.parse("2026-03-20T14:00:00Z"),
            }, null, 2),
          },
        },
        connections: {
          "us-cp-conn-ep-guard": { id: "us-cp-conn-ep-guard", sourceId: "us-cp-ep-post", targetId: "us-cp-auth-guard", label: "valida JWT", intent: "call" },
          "us-cp-conn-guard-svc": { id: "us-cp-conn-guard-svc", sourceId: "us-cp-auth-guard", targetId: "us-cp-url-svc", label: "injeta contexto", intent: "call" },
          "us-cp-conn-svc-db": { id: "us-cp-conn-svc-db", sourceId: "us-cp-url-svc", targetId: "us-cp-db-table-urls", label: "INSERT / SELECT", intent: "data-flow", style: { strokeWidth: 2 } },
          "us-cp-conn-svc-cache": { id: "us-cp-conn-svc-cache", sourceId: "us-cp-url-svc", targetId: "us-cp-cache-svc", label: "write-through", intent: "call" },
          "us-cp-conn-svc-event": { id: "us-cp-conn-svc-event", sourceId: "us-cp-url-svc", targetId: "us-cp-event-pub", label: "link.created", intent: "event", style: { animated: true } },
          "us-cp-conn-anal-db": { id: "us-cp-conn-anal-db", sourceId: "us-cp-analytics-svc", targetId: "us-cp-db-table-clicks", label: "SELECT métricas", intent: "data-flow" },
          "us-cp-conn-ep-anal": { id: "us-cp-conn-ep-anal", sourceId: "us-cp-ep-analytics", targetId: "us-cp-analytics-svc", label: "consulta analytics", intent: "call" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Deployment — AWS
    // ═══════════════════════════════════════════════════════════════════════
    "d-us-deployment": {
      id: "d-us-deployment",
      name: "URLShort — Deployment AWS",
      description:
        "Infraestrutura AWS Well-Architected. Scene ativo: TO-BE com Lambda@Edge para geolocalização na borda.",
      level: "deployment",
      domain: "seed",
      folderId: FOLDER_ROOT,
      createdAt: Date.parse("2026-01-10T09:30:00.000Z"),
      updatedAt: Date.parse("2026-04-13T01:04:15.691Z"),
      viewport: { x: -892.5519056098267, y: -167.7171840061435, zoom: 0.5872534617699606 },
      edgeLayouts: {},
      // Scene TO-BE ativo por padrão para demonstrar a feature
      activeSceneId: "scene-tobe-geodeploy",
      scenes: {
        "scene-tobe-geodeploy": {
          id: "scene-tobe-geodeploy",
          name: "TO-BE — Lambda@Edge para GeoIP na borda",
          color: "#6366f1",
          createdAt: Date.parse("2026-03-01T00:00:00.000Z"),
          addedComponents: {
            "dp-lambda-edge": {
              id: "dp-lambda-edge",
              name: "Lambda@Edge — GeoIP",
              type: "aws-compute",
              description:
                "Executa nos POPs do CloudFront. Intercepta requests de redirect, resolve país por IP usando MaxMind embedded e injeta header X-Geo-Country antes de encaminhar ao ALB. Elimina a latência de rede do Analytics Worker para geolocalização.",
              parentId: "dp-public-subnet",
              awsService: "AWS Lambda",
              tags: ["edge", "performance", "geolocation"],
            },
            "dp-note-tobe": {
              id: "dp-note-tobe",
              name: "Por que Lambda@Edge?",
              type: "note",
              description:
                "## Problema (AS-IS)\nO Analytics Worker busca geolocalização **após** o redirect, com latência de rede para o MaxMind API (~80ms).\n\n## Solução (TO-BE)\nLambda@Edge resolve o país **no POP do CloudFront**, antes do redirect. Zero latência adicional para o usuário, GeoIP gratuito via DB local.\n\n## Benefícios\n- Analytics mais preciso (IP original antes de proxies)\n- Reduz custo do Analytics Worker (sem chamadas ao MaxMind API)\n- Dados de geolocalização disponíveis em < 1ms\n\n## Trade-offs\n- Cold start de ~50ms no Lambda@Edge (mitigado com Provisioned Concurrency)\n- DB MaxMind precisa ser atualizado mensalmente via S3",
              parentId: null,
            },
          },
          addedConnections: {
            "dp-r-cf-lambda": {
              id: "dp-r-cf-lambda",
              sourceId: "dp-cloudfront",
              targetId: "dp-lambda-edge",
              label: "Trigger viewer-request",
              technology: "Lambda@Edge",
              intent: "call",
              style: { strokeWidth: 2 },
            },
            "dp-r-lambda-alb": {
              id: "dp-r-lambda-alb",
              sourceId: "dp-lambda-edge",
              targetId: "dp-alb",
              label: "Forward + X-Geo-Country header",
              technology: "HTTPS",
              intent: "call",
            },
          },
          removedComponentIds: [],
          removedConnectionIds: ["dp-r-cf-alb"],
          nodeLayouts: {
            "dp-region": { elementId: "dp-region", x: 316.49666059502124, y: 259.4348310058693, width: 3473, height: 1123 },
            "dp-vpc": { elementId: "dp-vpc", x: 63.77175672940706, y: 40, width: 260, height: 109 },
            "dp-route53": { elementId: "dp-route53", x: 40, y: 256.808793766444, width: 260, height: 109 },
            "dp-public-subnet": { elementId: "dp-public-subnet", x: 40, y: 182.6388888888888, width: 1154, height: 644 },
            "dp-cloudfront": { elementId: "dp-cloudfront", x: 478.33814005262093, y: 251.25328880793364, width: 260, height: 109 },
            "dp-waf": { elementId: "dp-waf", x: 871.5239698551222, y: 158.13679798809704, width: 260, height: 109 },
            "dp-s3-spa": { elementId: "dp-s3-spa", x: 467.628263509411, y: 40, width: 260, height: 109 },
            "dp-alb": { elementId: "dp-alb", x: 517.3659178303985, y: 455.1113134992917, width: 260, height: 109 },
            "dp-private-subnet": { elementId: "dp-private-subnet", x: 1368.8904008769234, y: 156.44443765209405, width: 1745, height: 887 },
            "dp-ecs-cluster": { elementId: "dp-ecs-cluster", x: 40, y: 206.58643770966995, width: 406, height: 600 },
            "dp-ecs-mgmt": { elementId: "dp-ecs-mgmt", x: 82.57105598773478, y: 426.57055396056455, width: 260, height: 109 },
            "dp-ecs-redir": { elementId: "dp-ecs-redir", x: 68.27253473588007, y: 82.57105598773467, width: 260, height: 109 },
            "dp-ecs-worker": { elementId: "dp-ecs-worker", x: 51.57014206152553, y: 236.52936334325125, width: 260, height: 109 },
            "dp-az-a": { elementId: "dp-az-a", x: 861.0435305967474, y: 40, width: 340, height: 229 },
            "dp-az-b": { elementId: "dp-az-b", x: 1364.8882383482553, y: 41.406937615188326, width: 340, height: 229 },
            "dp-rds-primary": { elementId: "dp-rds-primary", x: 43.85802469135797, y: 92.08333333333337, width: 260, height: 109 },
            "dp-rds-standby": { elementId: "dp-rds-standby", x: 53.503086419753345, y: 101.7283950617284, width: 260, height: 109 },
            "dp-elasticache": { elementId: "dp-elasticache", x: 1371.1362571476986, y: 629.1346524769581, width: 260, height: 109 },
            "dp-sqs": { elementId: "dp-sqs", x: 3143.3798739451267, y: 687.2505117930084, width: 260, height: 109 },
            "dp-cloudwatch": { elementId: "dp-cloudwatch", x: 3141.590222898914, y: 383.7096931554442, width: 260, height: 109 },
            "dp-secrets": { elementId: "dp-secrets", x: 3147.7493803453135, y: 539.4562280975456, width: 260, height: 109 },
            "dp-note-waf": { elementId: "dp-note-waf", x: 2105.9153005464486, y: -567.3787568306011, width: 360, height: 600 }
          },
        },
      },
      nodeLayouts: {
        "dp-region": { elementId: "dp-region", x: 316.49666059502124, y: 259.4348310058693, width: 3473, height: 1123 },
        "dp-vpc": { elementId: "dp-vpc", x: 63.77175672940706, y: 40, width: 260, height: 109 },
        "dp-route53": { elementId: "dp-route53", x: 40, y: 256.808793766444, width: 260, height: 109 },
        "dp-public-subnet": { elementId: "dp-public-subnet", x: 40, y: 182.6388888888888, width: 1154, height: 644 },
        "dp-cloudfront": { elementId: "dp-cloudfront", x: 478.33814005262093, y: 251.25328880793364, width: 260, height: 109 },
        "dp-waf": { elementId: "dp-waf", x: 871.5239698551222, y: 158.13679798809704, width: 260, height: 109 },
        "dp-s3-spa": { elementId: "dp-s3-spa", x: 467.628263509411, y: 40, width: 260, height: 109 },
        "dp-alb": { elementId: "dp-alb", x: 517.3659178303985, y: 455.1113134992917, width: 260, height: 109 },
        "dp-private-subnet": { elementId: "dp-private-subnet", x: 1368.8904008769234, y: 156.44443765209405, width: 1745, height: 887 },
        "dp-ecs-cluster": { elementId: "dp-ecs-cluster", x: 40, y: 206.58643770966995, width: 406, height: 600 },
        "dp-ecs-mgmt": { elementId: "dp-ecs-mgmt", x: 82.57105598773478, y: 426.57055396056455, width: 260, height: 109 },
        "dp-ecs-redir": { elementId: "dp-ecs-redir", x: 68.27253473588007, y: 82.57105598773467, width: 260, height: 109 },
        "dp-ecs-worker": { elementId: "dp-ecs-worker", x: 51.57014206152553, y: 236.52936334325125, width: 260, height: 109 },
        "dp-az-a": { elementId: "dp-az-a", x: 861.0435305967474, y: 40, width: 340, height: 229 },
        "dp-az-b": { elementId: "dp-az-b", x: 1364.8882383482553, y: 41.406937615188326, width: 340, height: 229 },
        "dp-rds-primary": { elementId: "dp-rds-primary", x: 43.85802469135797, y: 92.08333333333337, width: 260, height: 109 },
        "dp-rds-standby": { elementId: "dp-rds-standby", x: 53.503086419753345, y: 101.7283950617284, width: 260, height: 109 },
        "dp-elasticache": { elementId: "dp-elasticache", x: 1371.1362571476986, y: 629.1346524769581, width: 260, height: 109 },
        "dp-sqs": { elementId: "dp-sqs", x: 3143.3798739451267, y: 687.2505117930084, width: 260, height: 109 },
        "dp-cloudwatch": { elementId: "dp-cloudwatch", x: 3141.590222898914, y: 383.7096931554442, width: 260, height: 109 },
        "dp-secrets": { elementId: "dp-secrets", x: 3147.7493803453135, y: 539.4562280975456, width: 260, height: 109 },
        "dp-note-waf": { elementId: "dp-note-waf", x: 2105.9153005464486, y: -567.3787568306011, width: 360, height: 600 },
        "dp-lambda-edge": { elementId: "dp-lambda-edge", x: 498.33814005262093, y: 360.25328880793364, width: 260, height: 109 },
        "dp-note-tobe": { elementId: "dp-note-tobe", x: 40, y: 520, width: 400, height: 280 },
      },
      snapshot: {
        iconLibrary: {},
        flows: {
          "flow-dp-redirect": {
            id: "flow-dp-redirect",
            name: "Request de Redirect — Infra",
            diagramId: "d-us-deployment",
            description:
              "Caminho completo de um request de redirect passando por toda a infra AWS. P95 < 50ms.",
            tags: ["infra", "redirect", "performance"],
            mermaid: "sequenceDiagram",
            entryStepId: "dp-f1",
            steps: steps([
              {
                id: "dp-f1",
                type: "action",
                componentId: "dp-route53",
                description: "Route53 resolve o DNS de url.sh para o IP do CloudFront distribution.",
                duration: "< 1ms (TTL 300s)",
              },
              {
                id: "dp-f2",
                type: "action",
                componentId: "dp-cloudfront",
                connectionId: "dp-r-cf-alb",
                description: "CloudFront verifica cache. Miss para /slug → WAF inspeciona o request.",
                duration: "~5ms",
              },
              {
                id: "dp-f3",
                type: "action",
                componentId: "dp-waf",
                description: "WAF aplica regras: rate limit por IP (1000 req/min), bloqueia padrões maliciosos.",
                duration: "~2ms",
              },
              {
                id: "dp-f4",
                type: "action",
                componentId: "dp-alb",
                connectionId: "dp-r-alb-redir",
                description: "ALB roteia para instância saudável do Redirect API (ECS Fargate).",
                duration: "~1ms",
              },
              {
                id: "dp-f5",
                type: "action",
                componentId: "dp-ecs-redir",
                connectionId: "dp-r-redir-cache",
                description: "Redirect API consulta Redis. Hit: retorna URL longa em ~2ms.",
                duration: "~2ms",
              },
              {
                id: "dp-f6",
                type: "action",
                componentId: "dp-ecs-redir",
                connectionId: "dp-r-redir-sqs",
                description: "Publica evento click.registered no SQS de forma assíncrona. HTTP 301 já foi enviado.",
                isAsync: true,
              },
              {
                id: "dp-f7",
                type: "action",
                componentId: "dp-sqs",
                connectionId: "dp-r-sqs-worker",
                description: "SQS entrega mensagem ao Analytics Worker. Worker persiste no RDS e atualiza CloudWatch.",
                isAsync: true,
              },
            ]),
          },
        },
        components: {
          // Region + Network
          "dp-region": {
            id: "dp-region",
            name: "AWS us-east-1",
            type: "panel",
            description: "Região AWS principal. Multi-AZ para RDS. CloudFront com edge locations globais.",
            parentId: null,
            panelKind: PanelKind.Default,
          },
          "dp-vpc": {
            id: "dp-vpc",
            name: "VPC — URLShort",
            type: "aws-networking",
            description: "VPC isolada 10.0.0.0/16. Flow logs habilitados. NAT Gateway para egress das subnets privadas.",
            parentId: "dp-region",
            awsService: "Amazon VPC",
          },
          "dp-public-subnet": {
            id: "dp-public-subnet",
            name: "Subnet Pública",
            type: "panel",
            description: "Subnet pública: ALB e recursos com acesso direto à internet.",
            parentId: "dp-vpc",
            panelKind: PanelKind.PublicSubnet,
          },
          "dp-private-subnet": {
            id: "dp-private-subnet",
            name: "Subnet Privada",
            type: "panel",
            description: "Subnet privada: ECS, RDS, ElastiCache. Sem acesso direto da internet.",
            parentId: "dp-vpc",
            panelKind: PanelKind.PrivateSubnet,
          },

          // Edge + CDN
          "dp-route53": {
            id: "dp-route53",
            name: "Route 53",
            type: "aws-networking",
            description: "DNS gerenciado. Alias record de url.sh → CloudFront distribution. Health checks habilitados.",
            parentId: "dp-public-subnet",
            awsService: "Amazon Route 53",
            tags: ["dns", "networking"],
          },
          "dp-cloudfront": {
            id: "dp-cloudfront",
            name: "CloudFront",
            type: "aws-networking",
            description:
              "CDN global com 450+ POPs. Serve o SPA React do S3 (cache longo). Proxy reverso para Redirect API e Management API via ALB. SSL/TLS termination.",
            parentId: "dp-public-subnet",
            awsService: "Amazon CloudFront",
            tags: ["cdn", "edge", "ssl"],
          },
          "dp-waf": {
            id: "dp-waf",
            name: "AWS WAF",
            type: "aws-security",
            description:
              "WAF acoplado ao CloudFront. Regras: rate limit 1000 req/min por IP, AWS Managed Rules (SQLi, XSS), bloqueio de bots. Logs no CloudWatch.",
            parentId: "dp-public-subnet",
            awsService: "AWS WAF",
            tags: ["seguranca", "waf"],
          },
          "dp-s3-spa": {
            id: "dp-s3-spa",
            name: "S3 — Dashboard SPA",
            type: "aws-storage",
            description:
              "Bucket S3 com versionamento habilitado. Serve o build estático do React via CloudFront. Cache-Control: max-age=31536000 para assets com hash.",
            parentId: "dp-public-subnet",
            awsService: "Amazon S3",
            tags: ["storage", "frontend"],
          },
          "dp-alb": {
            id: "dp-alb",
            name: "Application Load Balancer",
            type: "aws-networking",
            description:
              "ALB na subnet pública. Target groups: Redirect API (porta 8080) e Management API (porta 3000). Health check a cada 10s. Access logs no S3.",
            parentId: "dp-public-subnet",
            awsService: "Elastic Load Balancing",
            tags: ["loadbalancer", "networking"],
          },

          // ECS Cluster
          "dp-ecs-cluster": {
            id: "dp-ecs-cluster",
            name: "ECS Cluster — Fargate",
            type: "panel",
            description: "Cluster ECS Fargate. Sem instâncias EC2 para gerenciar. Container Insights habilitado.",
            parentId: "dp-private-subnet",
            panelKind: PanelKind.EcsCluster,
          },
          "dp-ecs-mgmt": {
            id: "dp-ecs-mgmt",
            name: "Management API",
            type: "aws-containers",
            description:
              "ECS Service: Management API. Fargate 0.5 vCPU / 1GB. Min 2 tasks, max 10. Scale por CPU > 70%. Secrets via Secrets Manager.",
            parentId: "dp-ecs-cluster",
            awsService: "Amazon ECS",
            tags: ["ecs", "fargate", "management"],
          },
          "dp-ecs-redir": {
            id: "dp-ecs-redir",
            name: "Redirect API",
            type: "aws-containers",
            description:
              "ECS Service: Redirect API em Go. Fargate 0.25 vCPU / 512MB. Min 3 tasks, max 50. Scale por req/task > 1000. Crítico: sem zero-downtime deploy via blue/green.",
            parentId: "dp-ecs-cluster",
            awsService: "Amazon ECS",
            tags: ["ecs", "fargate", "redirect", "critical"],
          },
          "dp-ecs-worker": {
            id: "dp-ecs-worker",
            name: "Analytics Worker",
            type: "aws-containers",
            description:
              "ECS Service: Analytics Worker. Fargate 0.5 vCPU / 1GB. Scale pela profundidade da fila SQS (ApproximateNumberOfMessages > 500).",
            parentId: "dp-ecs-cluster",
            awsService: "Amazon ECS",
            tags: ["ecs", "fargate", "worker", "analytics"],
          },

          // AZs + Data
          "dp-az-a": {
            id: "dp-az-a",
            name: "us-east-1a",
            type: "panel",
            description: "Availability Zone A — RDS Primary.",
            parentId: "dp-private-subnet",
            panelKind: PanelKind.AvailabilityZone,
          },
          "dp-az-b": {
            id: "dp-az-b",
            name: "us-east-1b",
            type: "panel",
            description: "Availability Zone B — RDS Standby (Multi-AZ).",
            parentId: "dp-private-subnet",
            panelKind: PanelKind.AvailabilityZone,
          },
          "dp-rds-primary": {
            id: "dp-rds-primary",
            name: "RDS PostgreSQL (Primary)",
            type: "aws-database",
            description:
              "RDS PostgreSQL 16. Multi-AZ: Primary em us-east-1a, Standby em us-east-1b. Failover automático < 60s. Backups automáticos 7 dias. db.t3.medium.",
            parentId: "dp-az-a",
            awsService: "Amazon RDS",
            tags: ["database", "postgres", "multi-az"],
          },
          "dp-rds-standby": {
            id: "dp-rds-standby",
            name: "RDS Standby (Multi-AZ)",
            type: "aws-database",
            description: "Standby síncrono do RDS Multi-AZ. Não serve leituras. Failover automático quando Primary falha.",
            parentId: "dp-az-b",
            awsService: "Amazon RDS",
            tags: ["database", "standby", "ha"],
          },
          "dp-elasticache": {
            id: "dp-elasticache",
            name: "ElastiCache Redis",
            type: "aws-database",
            description:
              "Redis 7 em modo cluster com 1 shard + 1 replica. cache.t3.micro. TTL 24h para slugs. Backups habilitados. Usado exclusivamente pelo Redirect API.",
            parentId: "dp-private-subnet",
            awsService: "Amazon ElastiCache",
            tags: ["cache", "redis"],
          },

          // Managed Services
          "dp-sqs": {
            id: "dp-sqs",
            name: "SQS — Click Events",
            type: "aws-integration",
            description:
              "Fila SQS Standard para eventos de clique. Retenção 4 dias. Visibility timeout 30s. DLQ após 3 tentativas com alarme CloudWatch.",
            parentId: "dp-region",
            awsService: "Amazon SQS",
            tags: ["queue", "async"],
          },
          "dp-cloudwatch": {
            id: "dp-cloudwatch",
            name: "CloudWatch",
            type: "aws-management",
            description:
              "Métricas, logs e alarmes. Dashboards: redirect latency P95/P99, cache hit rate, SQS queue depth, ECS CPU/mem. Alarmes no PagerDuty via SNS.",
            parentId: "dp-region",
            awsService: "Amazon CloudWatch",
            tags: ["observabilidade", "monitoramento"],
          },
          "dp-secrets": {
            id: "dp-secrets",
            name: "Secrets Manager",
            type: "aws-security",
            description:
              "Armazena: DATABASE_URL, REDIS_URL, AUTH0_JWKS_URI, SENDGRID_API_KEY. Rotação automática para credenciais do RDS. Injetado nos containers via ECS task definition.",
            parentId: "dp-region",
            awsService: "AWS Secrets Manager",
            tags: ["seguranca", "secrets"],
          },

          // Well-Architected Note
          "dp-note-waf": {
            id: "dp-note-waf",
            name: "Well-Architected — Reliability",
            type: "note",
            description:
              "## Pilares Atendidos\n\n**Reliability**\n- RDS Multi-AZ: failover automático < 60s\n- ECS min 3 tasks na Redirect API\n- SQS + DLQ: analytics não bloqueia redirect\n- Health checks no ALB a cada 10s\n\n**Performance Efficiency**\n- Redis elimina 95%+ das consultas ao RDS\n- CloudFront: < 5ms para assets estáticos\n- Go na Redirect API: zero GC pauses\n\n**Security**\n- WAF com rate limit e AWS Managed Rules\n- Subnets privadas: ECS e RDS sem acesso direto\n- Secrets Manager: zero credenciais hardcoded\n\n**Cost Optimization**\n- Fargate: paga somente pelo que usa\n- cache.t3.micro suficiente para 95% hit rate\n- CloudFront reduz egress do ALB",
            parentId: null,
          },
        },
        connections: {
          "dp-r-dns-cf": { id: "dp-r-dns-cf", sourceId: "dp-route53", targetId: "dp-cloudfront", label: "DNS alias", technology: "DNS", intent: "call" },
          "dp-r-cf-s3": { id: "dp-r-cf-s3", sourceId: "dp-cloudfront", targetId: "dp-s3-spa", label: "serve SPA estático", technology: "S3 Origin", intent: "call" },
          "dp-r-cf-waf": { id: "dp-r-cf-waf", sourceId: "dp-cloudfront", targetId: "dp-waf", label: "inspeciona requests", technology: "WAF ACL", intent: "call" },
          "dp-r-cf-alb": { id: "dp-r-cf-alb", sourceId: "dp-cloudfront", targetId: "dp-alb", label: "proxy /api/* e /{slug}", technology: "HTTPS", intent: "call" },
          "dp-r-alb-mgmt": { id: "dp-r-alb-mgmt", sourceId: "dp-alb", targetId: "dp-ecs-mgmt", label: "roteia /api/*", technology: "HTTP :3000", intent: "call" },
          "dp-r-alb-redir": { id: "dp-r-alb-redir", sourceId: "dp-alb", targetId: "dp-ecs-redir", label: "roteia /{slug}", technology: "HTTP :8080", intent: "call" },
          "dp-r-redir-cache": { id: "dp-r-redir-cache", sourceId: "dp-ecs-redir", targetId: "dp-elasticache", label: "GET slug (< 2ms)", technology: "Redis :6379", intent: "call" },
          "dp-r-redir-rds": { id: "dp-r-redir-rds", sourceId: "dp-ecs-redir", targetId: "dp-rds-primary", label: "cache miss — SELECT", technology: "TCP :5432", intent: "call", style: { strokeStyle: StrokeStyle.Dashed } },
          "dp-r-redir-sqs": { id: "dp-r-redir-sqs", sourceId: "dp-ecs-redir", targetId: "dp-sqs", label: "publica click.registered", technology: "AWS SDK", intent: "event", style: { animated: true } },
          "dp-r-mgmt-rds": { id: "dp-r-mgmt-rds", sourceId: "dp-ecs-mgmt", targetId: "dp-rds-primary", label: "CRUD de URLs", technology: "TCP :5432", intent: "data-flow", style: { strokeWidth: 2 } },
          "dp-r-mgmt-cache": { id: "dp-r-mgmt-cache", sourceId: "dp-ecs-mgmt", targetId: "dp-elasticache", label: "write-through", technology: "Redis :6379", intent: "call" },
          "dp-r-mgmt-secrets": { id: "dp-r-mgmt-secrets", sourceId: "dp-ecs-mgmt", targetId: "dp-secrets", label: "lê secrets", technology: "AWS SDK", intent: "call", style: { strokeStyle: StrokeStyle.Dashed } },
          "dp-r-redir-secrets": { id: "dp-r-redir-secrets", sourceId: "dp-ecs-redir", targetId: "dp-secrets", label: "lê secrets", technology: "AWS SDK", intent: "call", style: { strokeStyle: StrokeStyle.Dashed } },
          "dp-r-sqs-worker": { id: "dp-r-sqs-worker", sourceId: "dp-sqs", targetId: "dp-ecs-worker", label: "consome eventos", technology: "SQS polling", intent: "event", style: { animated: true } },
          "dp-r-worker-rds": { id: "dp-r-worker-rds", sourceId: "dp-ecs-worker", targetId: "dp-rds-primary", label: "INSERT métricas", technology: "TCP :5432", intent: "data-flow" },
          "dp-r-rds-standby": { id: "dp-r-rds-standby", sourceId: "dp-rds-primary", targetId: "dp-rds-standby", label: "replicação síncrona", technology: "Multi-AZ sync", intent: "data-flow", style: { strokeWidth: 2 } },
          "dp-r-ecs-cw": { id: "dp-r-ecs-cw", sourceId: "dp-ecs-redir", targetId: "dp-cloudwatch", label: "métricas e logs", technology: "CloudWatch", intent: "event", style: { strokeStyle: StrokeStyle.Dashed } },
        },
      },
    }
}
}
// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
export const SEED_US_DIAGRAMS: Record<string, Diagram> = buildDiagrams();
export const SEED_US_FOLDERS: Record<string, Folder> = buildFolders();
export const SEED_US_SERVICE_REGISTRY: Record<string, ServiceDefinition> = buildServiceRegistry();
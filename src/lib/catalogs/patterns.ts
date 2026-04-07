import type { ComponentType } from "@/features/diagram";

export interface PatternComponent {
  type: ComponentType;
  name: string;
  description?: string;
  technology?: string;
  awsService?: string;
  /**
   * Explicit 2-D position relative to the drop point (pixels).
   * When present, the slice uses these instead of the linear grid fallback.
   * Left-to-right reading order is expected: x grows rightward, y grows downward.
   */
  x?: number;
  y?: number;
}

export interface PatternConnection {
  fromIndex: number; // index into components array
  toIndex: number;
  label: string;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;
  components: PatternComponent[];
  connections: PatternConnection[];
}

export type PatternCategory =
  | "messaging"
  | "api"
  | "resilience"
  | "data"
  | "event-driven"
  | "security";

/** Category ids for sidebar — display labels from i18n `patterns.category.*` */
export const PATTERN_CATEGORIES: PatternCategory[] = [
  "messaging",
  "api",
  "resilience",
  "data",
  "event-driven",
  "security",
];

// ─── Layout constants ────────────────────────────────────────────────────────
// All positions are relative to the drop point (0, 0).
// Reading direction: left → right.  Secondary axis: top → bottom.
// Column spacing: 240px. Row spacing: 160px.
// Note is always anchored top-left at (-20, -220) so it floats above the diagram.

const COL = 240;  // horizontal step between columns
const ROW = 160;  // vertical step between rows
const NOTE_X = 0;
const NOTE_Y = -220;

export const PATTERNS: PatternTemplate[] = [
  // ── Messaging ────────────────────────────────────────────────────────────
  {
    id: "fifo-queue-aws",
    name: "FIFO Queue (AWS SQS)",
    description:
      "Producer → SQS FIFO queue → Consumer. Guarantees ordered, exactly-once delivery.",
    category: "messaging",
    components: [
      {
        type: "note",
        name: "FIFO Queue (AWS SQS)",
        description:
          "🔴 Problema\nMensagens processadas fora de ordem causam inconsistências (ex: cancelar antes de criar).\n\n⚙️ Como funciona\nO Producer envia mensagens para uma SQS FIFO Queue com um MessageGroupId. A fila garante entrega ordenada e exactly-once dentro de cada grupo. O Consumer consome na mesma ordem em que foram enfileiradas.\n\n✅ Quando usar\nPedidos financeiros, sequências de eventos críticos, pipelines onde a ordem importa.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Producer", description: "Sends messages", x: 0, y: 0 },
      { type: "aws-integration", name: "SQS FIFO Queue", description: "Ordered message queue", awsService: "sqs", x: COL, y: 0 },
      { type: "container", name: "Consumer", description: "Processes messages", x: COL * 2, y: 0 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Enqueue" },
      { fromIndex: 2, toIndex: 3, label: "Dequeue" },
    ],
  },

  {
    id: "fifo-queue-kafka",
    name: "FIFO Queue (Kafka / MSK)",
    description:
      "Producer → Kafka topic → Consumer Group. High-throughput ordered log streaming.",
    category: "messaging",
    components: [
      {
        type: "note",
        name: "FIFO Queue (Kafka / MSK)",
        description:
          "🔴 Problema\nSistemas de alta vazão precisam de ordenação por partição sem sacrificar throughput.\n\n⚙️ Como funciona\nO Producer publica eventos em um Kafka Topic (MSK). Cada partição mantém ordem estrita. O Consumer Group distribui partições entre instâncias — cada instância lê sua partição em ordem.\n\n✅ Quando usar\nEvent streaming de alta vazão, logs de auditoria, pipelines de dados em tempo real.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Producer", description: "Publishes events", x: 0, y: 0 },
      { type: "aws-analytics", name: "MSK Kafka Topic", description: "Distributed log", awsService: "msk", x: COL, y: 0 },
      { type: "container", name: "Consumer Group", description: "Reads partitions", x: COL * 2, y: 0 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Publish" },
      { fromIndex: 2, toIndex: 3, label: "Subscribe" },
    ],
  },

  {
    id: "dead-letter-queue-aws",
    name: "Dead Letter Queue (AWS)",
    description:
      "SQS → Lambda processor; failed messages go to DLQ; CloudWatch alarms on DLQ depth.",
    category: "messaging",
    components: [
      {
        type: "note",
        name: "Dead Letter Queue (AWS)",
        description:
          "🔴 Problema\nMensagens que falham repetidamente bloqueiam a fila e são silenciosamente perdidas.\n\n⚙️ Como funciona\nApós N tentativas, a SQS move a mensagem para uma Dead Letter Queue separada. Um alarme CloudWatch dispara quando a profundidade da DLQ cresce, permitindo investigação sem perda de dados.\n\n✅ Quando usar\nTodo sistema com processamento assíncrono que precisa de observabilidade sobre falhas.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "aws-integration", name: "SQS Queue", description: "Main message queue", awsService: "sqs", x: 0, y: 0 },
      { type: "aws-compute", name: "Lambda Processor", description: "Processes messages", awsService: "lambda", x: COL, y: 0 },
      { type: "aws-integration", name: "Dead Letter Queue", description: "Failed messages", awsService: "sqs", x: COL * 2, y: 0 },
      { type: "aws-management", name: "CloudWatch Alert", description: "Alarm on DLQ depth", awsService: "cloudwatch", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Triggers" },
      { fromIndex: 2, toIndex: 3, label: "Failed messages" },
      { fromIndex: 3, toIndex: 4, label: "Alarm on depth" },
    ],
  },

  {
    id: "fan-out",
    name: "Fan-out",
    description: "SNS topic fans out to multiple SQS queues for parallel processing.",
    category: "messaging",
    components: [
      {
        type: "note",
        name: "Fan-out",
        description:
          "🔴 Problema\nUm evento precisa ser processado por múltiplos consumidores independentes sem acoplamento direto.\n\n⚙️ Como funciona\nUm SNS Topic recebe a publicação e faz fan-out para N SQS Queues simultaneamente. Cada fila é consumida de forma independente e no seu próprio ritmo.\n\n✅ Quando usar\nNotificações multi-canal, pipelines paralelos, integração entre bounded contexts.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "aws-integration", name: "SNS Topic", description: "Pub/sub topic", awsService: "sns", x: 0, y: ROW },
      { type: "aws-integration", name: "SQS Queue A", description: "Subscriber queue", awsService: "sqs", x: COL, y: 0 },
      { type: "aws-integration", name: "SQS Queue B", description: "Subscriber queue", awsService: "sqs", x: COL, y: ROW },
      { type: "aws-integration", name: "SQS Queue C", description: "Subscriber queue", awsService: "sqs", x: COL, y: ROW * 2 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Fan-out" },
      { fromIndex: 1, toIndex: 3, label: "Fan-out" },
      { fromIndex: 1, toIndex: 4, label: "Fan-out" },
    ],
  },

  {
    id: "competing-consumers",
    name: "Competing Consumers",
    description:
      "Message broker distributes to multiple consumers; each writes to a shared database.",
    category: "messaging",
    components: [
      {
        type: "note",
        name: "Competing Consumers",
        description:
          "🔴 Problema\nUm único consumer não consegue acompanhar o volume de mensagens, gerando backlog crescente.\n\n⚙️ Como funciona\nVários consumers competem por mensagens no mesmo broker. Cada mensagem é entregue a exatamente um consumer (at-least-once). O processamento é paralelizado e os resultados escritos em um banco compartilhado.\n\n✅ Quando usar\nProcessamento batch de alta vazão, workers de background, filas de tarefas escaláveis.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Message Broker", description: "Distributes messages", technology: "Kafka / RabbitMQ", x: 0, y: ROW },
      { type: "container", name: "Consumer A", description: "Competing consumer", x: COL, y: 0 },
      { type: "container", name: "Consumer B", description: "Competing consumer", x: COL, y: ROW },
      { type: "container", name: "Consumer C", description: "Competing consumer", x: COL, y: ROW * 2 },
      { type: "container", name: "Database", description: "Shared persistence", technology: "PostgreSQL", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Distribute" },
      { fromIndex: 1, toIndex: 3, label: "Distribute" },
      { fromIndex: 1, toIndex: 4, label: "Distribute" },
      { fromIndex: 2, toIndex: 5, label: "Write" },
      { fromIndex: 3, toIndex: 5, label: "Write" },
      { fromIndex: 4, toIndex: 5, label: "Write" },
    ],
  },

  // ── API ───────────────────────────────────────────────────────────────────
  {
    id: "api-gateway-bff",
    name: "API Gateway + BFF",
    description:
      "Client → API Gateway → Backend For Frontend → downstream services.",
    category: "api",
    components: [
      {
        type: "note",
        name: "API Gateway + BFF",
        description:
          "🔴 Problema\nClientes diferentes (web, mobile) consomem os mesmos endpoints genéricos, gerando over-fetching e acoplamento.\n\n⚙️ Como funciona\nO API Gateway centraliza autenticação e rate-limiting. O BFF agrega chamadas a múltiplos serviços e molda a resposta para o cliente específico.\n\n✅ Quando usar\nAPIs com múltiplos tipos de cliente, times que precisam de autonomia por canal.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Client", description: "Web or mobile app", x: 0, y: 0 },
      { type: "aws-networking", name: "API Gateway", description: "Entry point, auth, rate-limiting", awsService: "api-gateway", x: COL, y: 0 },
      { type: "container", name: "BFF", description: "Backend for Frontend — aggregates APIs", x: COL * 2, y: 0 },
      { type: "container", name: "Service A", description: "Downstream microservice", x: COL * 3, y: 0 },
      { type: "container", name: "Service B", description: "Downstream microservice", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "HTTPS" },
      { fromIndex: 2, toIndex: 3, label: "Routes to" },
      { fromIndex: 3, toIndex: 4, label: "Calls" },
      { fromIndex: 3, toIndex: 5, label: "Calls" },
    ],
  },

  {
    id: "backend-for-frontend",
    name: "Backend for Frontend",
    description:
      "Dedicated BFFs adapt backend capabilities for specific client experiences such as web and mobile.",
    category: "api",
    components: [
      {
        type: "note",
        name: "Backend for Frontend",
        description:
          "🔴 Problema\nUm único backend genérico serve mal clientes com necessidades muito distintas (web vs mobile).\n\n⚙️ Como funciona\nCada tipo de cliente tem seu próprio BFF. O Web BFF retorna dados completos para layouts ricos; o Mobile BFF entrega payloads compactos otimizados para banda limitada. Ambos chamam os mesmos serviços de domínio.\n\n✅ Quando usar\nProdutos com clientes heterogêneos, times de frontend com autonomia de deploy.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Web Client", description: "Browser application", x: 0, y: 0 },
      { type: "person", name: "Mobile Client", description: "Mobile application", x: 0, y: ROW },
      { type: "container", name: "Web BFF", description: "Aggregates and shapes data for web journeys", x: COL, y: 0 },
      { type: "container", name: "Mobile BFF", description: "Optimises payloads and flows for mobile", x: COL, y: ROW },
      { type: "container", name: "Service A", description: "Domain service", x: COL * 2, y: 0 },
      { type: "container", name: "Service B", description: "Domain service", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 3, label: "HTTPS" },
      { fromIndex: 2, toIndex: 4, label: "HTTPS" },
      { fromIndex: 3, toIndex: 5, label: "Calls" },
      { fromIndex: 3, toIndex: 6, label: "Calls" },
      { fromIndex: 4, toIndex: 5, label: "Calls" },
      { fromIndex: 4, toIndex: 6, label: "Calls" },
    ],
  },

  {
    id: "feature-flag-rollout",
    name: "Feature Flag Rollout",
    description:
      "A feature is deployed dark and progressively enabled through runtime flags.",
    category: "api",
    components: [
      {
        type: "note",
        name: "Feature Flag Rollout",
        description:
          "🔴 Problema\nDeploy e release acoplados aumentam o risco — qualquer deploy pode expor código incompleto a todos os usuários.\n\n⚙️ Como funciona\nO código novo é deployado dark. O Flag Evaluator consulta o Flag Store em runtime e decide qual caminho executar por usuário ou segmento. O rollout é progressivo e reversível sem redeploy.\n\n✅ Quando usar\nLançamentos progressivos, A/B testing, kill switches de emergência.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Users", description: "Application users", x: 0, y: 0 },
      { type: "container", name: "Application", description: "Contains old and new code paths", x: COL, y: 0 },
      { type: "component", name: "Flag Evaluator", description: "Checks rollout rules at runtime", x: COL * 2, y: 0 },
      { type: "container", name: "Flag Store", description: "Stores targeting and rollout configuration", technology: "LaunchDarkly / Unleash / DB", x: COL * 3, y: 0 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Evaluate flag" },
      { fromIndex: 3, toIndex: 4, label: "Load rules" },
    ],
  },

  // ── Resilience ────────────────────────────────────────────────────────────
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    description:
      "Caller → Circuit Breaker → Provider. On failure the breaker opens and returns a fallback.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Circuit Breaker",
        description:
          "🔴 Problema\nFalhas em um serviço downstream causam cascade failure — o caller acumula threads bloqueadas até travar.\n\n⚙️ Como funciona\nO Circuit Breaker monitora a taxa de falhas. Quando ultrapassa o threshold, abre o circuito e retorna imediatamente via Fallback Handler sem chamar o Provider. Após um intervalo, tenta fechar o circuito novamente (half-open).\n\n✅ Quando usar\nChamadas síncronas a serviços externos ou instáveis, APIs de terceiros.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Caller", description: "Service that calls", x: 0, y: 0 },
      { type: "component", name: "Circuit Breaker", description: "Monitors failure rate, opens on threshold", x: COL, y: 0 },
      { type: "container", name: "Provider", description: "Target service (potentially unavailable)", x: COL * 2, y: 0 },
      { type: "component", name: "Fallback Handler", description: "Returns cached / default response when open", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Forward (closed)" },
      { fromIndex: 2, toIndex: 4, label: "Short-circuit (open)" },
    ],
  },

  {
    id: "bulkhead-isolation",
    name: "Bulkhead Isolation",
    description:
      "Requests are segmented into independent resource pools so saturation in one lane does not take down the whole system.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Bulkhead Isolation",
        description:
          "🔴 Problema\nUm tenant ou feature que consome todos os recursos do pool derruba todos os outros usuários do sistema.\n\n⚙️ Como funciona\nO tráfego é classificado e distribuído em pools de recursos dedicados (threads, conexões, instâncias). A saturação de um pool não afeta os demais.\n\n✅ Quando usar\nSistemas multi-tenant, workloads com prioridades diferentes, serviços com SLAs distintos.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Clients", description: "Mixed request traffic", x: 0, y: ROW * 0.5 },
      { type: "component", name: "Routing / Classification", description: "Separates traffic by tenant, capability or priority", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Pool A", description: "Dedicated workers / connections for segment A", x: COL * 2, y: 0 },
      { type: "container", name: "Pool B", description: "Dedicated workers / connections for segment B", x: COL * 2, y: ROW },
      { type: "container", name: "Service A", description: "Handles workload from pool A", x: COL * 3, y: 0 },
      { type: "container", name: "Service B", description: "Handles workload from pool B", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Route segment A" },
      { fromIndex: 2, toIndex: 4, label: "Route segment B" },
      { fromIndex: 3, toIndex: 5, label: "Use dedicated resources" },
      { fromIndex: 4, toIndex: 6, label: "Use dedicated resources" },
    ],
  },

  {
    id: "retry-with-fallback",
    name: "Retry with Fallback",
    description:
      "Caller retries transient failures against a dependency and degrades to a safe fallback when retries are exhausted.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Retry with Fallback",
        description:
          "🔴 Problema\nFalhas transientes (timeout, throttle) causam erros desnecessários quando uma simples tentativa resolveria.\n\n⚙️ Como funciona\nA Retry Policy tenta a chamada com backoff exponencial. Se todas as tentativas falharem, o Fallback entrega uma resposta degradada (cache, default, resposta parcial) em vez de propagar o erro.\n\n✅ Quando usar\nIntegrações com APIs externas, chamadas a serviços com SLA variável.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Caller", description: "Initiates remote operation", x: 0, y: 0 },
      { type: "component", name: "Retry Policy", description: "Backoff and retry on transient errors", x: COL, y: 0 },
      { type: "container", name: "Dependency", description: "Remote service or external API", x: COL * 2, y: 0 },
      { type: "component", name: "Fallback", description: "Cached, default or degraded response", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Call" },
      { fromIndex: 2, toIndex: 3, label: "Attempt / retry" },
      { fromIndex: 2, toIndex: 4, label: "Fallback on exhaustion" },
    ],
  },

  {
    id: "backpressure-buffer",
    name: "Backpressure Buffer",
    description:
      "Ingress is decoupled from processing with a queue so producers slow down or buffer when consumers are saturated.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Backpressure Buffer",
        description:
          "🔴 Problema\nPicos de ingestão derrabam consumers que não conseguem acompanhar o ritmo de produção.\n\n⚙️ Como funciona\nO Ingress Control aplica rate limiting ou sinais de backpressure ao Producer. Mensagens são enfileiradas no Buffer Queue, que absorve bursts. O Worker Pool drena na velocidade sustentável.\n\n✅ Quando usar\nIngestion de eventos, upload batch, integrações com sistemas lentos.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Producer", description: "Generates workload", x: 0, y: 0 },
      { type: "component", name: "Ingress Control", description: "Applies rate limits or backpressure signals", x: COL, y: 0 },
      { type: "container", name: "Buffer Queue", description: "Absorbs bursts and smooths throughput", technology: "Kafka / SQS", x: COL * 2, y: 0 },
      { type: "container", name: "Worker Pool", description: "Processes at sustainable rate", x: COL * 3, y: 0 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Send" },
      { fromIndex: 2, toIndex: 3, label: "Enqueue" },
      { fromIndex: 3, toIndex: 4, label: "Drain" },
    ],
  },

  {
    id: "blue-green-deployment",
    name: "Blue-Green Deployment",
    description:
      "Traffic is switched from the current environment to an identical new environment for low-risk releases and rollback.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Blue-Green Deployment",
        description:
          "🔴 Problema\nDeploys in-place causam downtime ou exigem rollback lento quando algo dá errado.\n\n⚙️ Como funciona\nDois ambientes idênticos são mantidos (Blue = produção atual, Green = nova versão). O Traffic Switch redireciona instantaneamente para o Green após validação. Rollback é trocar o switch de volta.\n\n✅ Quando usar\nReleases de alto risco, sistemas que não toleram downtime, ambientes com SLA rígido.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Users", description: "Application traffic", x: 0, y: ROW * 0.5 },
      { type: "component", name: "Traffic Switch", description: "Load balancer or router controlling active environment", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Blue Environment", description: "Current production version", x: COL * 2, y: 0 },
      { type: "container", name: "Green Environment", description: "New production candidate", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Active" },
      { fromIndex: 2, toIndex: 4, label: "Switch on release" },
    ],
  },

  {
    id: "canary-release",
    name: "Canary Release",
    description:
      "A small slice of traffic is routed to the new version before full rollout.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Canary Release",
        description:
          "🔴 Problema\nRollouts completos expõem 100% dos usuários a bugs antes de detectá-los.\n\n⚙️ Como funciona\nO Traffic Splitter envia uma fatia pequena (ex: 5%) para a Canary Version. O Metrics Gate avalia saúde (error rate, latência) antes de expandir o rollout. O rollback é instantâneo redirecionando o tráfego.\n\n✅ Quando usar\nFuncionalidades de alto impacto, mudanças de infraestrutura, validação em produção real.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Users", description: "Application traffic", x: 0, y: ROW * 0.5 },
      { type: "component", name: "Traffic Splitter", description: "Routes a small percentage to canary", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Stable Version", description: "Current version serving most traffic", x: COL * 2, y: 0 },
      { type: "container", name: "Canary Version", description: "New version serving limited traffic", x: COL * 2, y: ROW },
      { type: "component", name: "Metrics Gate", description: "Evaluates health before expansion", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Majority traffic" },
      { fromIndex: 2, toIndex: 4, label: "Canary traffic" },
      { fromIndex: 4, toIndex: 5, label: "Emit metrics" },
    ],
  },

  {
    id: "shadow-deployment",
    name: "Shadow Deployment",
    description:
      "Production traffic is mirrored to a new version for observation without affecting real responses.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Shadow Deployment",
        description:
          "🔴 Problema\nNão é possível testar comportamento real de uma nova versão sem expor usuários a risco.\n\n⚙️ Como funciona\nO Traffic Mirror duplica cada requisição: a Primary Version serve a resposta real ao usuário; a Shadow Version processa a cópia de forma isolada. Telemetria compara comportamento sem impacto no usuário.\n\n✅ Quando usar\nValidação de migração, teste de performance em produção, comparação de algoritmos.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Users", description: "Live traffic", x: 0, y: ROW * 0.5 },
      { type: "component", name: "Traffic Mirror", description: "Forwards real traffic to primary and shadow paths", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Primary Version", description: "Serves real responses", x: COL * 2, y: 0 },
      { type: "container", name: "Shadow Version", description: "Processes mirrored traffic only", x: COL * 2, y: ROW },
      { type: "component", name: "Observability", description: "Compares behaviour and performance", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Serve response" },
      { fromIndex: 2, toIndex: 4, label: "Mirror traffic" },
      { fromIndex: 4, toIndex: 5, label: "Emit telemetry" },
    ],
  },

  {
    id: "active-passive-failover",
    name: "Active-Passive Failover",
    description:
      "Primary instance serves traffic while a standby replica is promoted on failure.",
    category: "resilience",
    components: [
      {
        type: "note",
        name: "Active-Passive Failover",
        description:
          "🔴 Problema\nUma única instância é um single point of failure — quando cai, o serviço fica indisponível.\n\n⚙️ Como funciona\nO Failover Controller monitora a saúde do Primary Node. Em caso de falha, ele promove o Standby Node (que mantém estado replicado) e redireciona o tráfego. O processo é automático e sem intervenção manual.\n\n✅ Quando usar\nBancos de dados críticos, serviços stateful com RTO baixo.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Clients", description: "Send requests", x: 0, y: ROW * 0.5 },
      { type: "component", name: "Failover Controller", description: "Monitors health and promotes standby", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Primary Node", description: "Active serving node", x: COL * 2, y: 0 },
      { type: "container", name: "Standby Node", description: "Passive replica ready for promotion", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Route to primary" },
      { fromIndex: 3, toIndex: 4, label: "Replicate state" },
      { fromIndex: 2, toIndex: 4, label: "Promote on failure" },
    ],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    id: "sharding-router",
    name: "Sharding Router",
    description:
      "Application uses a shard router to direct reads and writes to the correct shard based on a partition key.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Sharding Router",
        description:
          "🔴 Problema\nUm único banco de dados não aguenta o volume de dados ou de requisições de sistemas de grande escala.\n\n⚙️ Como funciona\nO Shard Router inspeciona a chave de partição (tenant, região, faixa de ID) e redireciona a operação para o shard correto. Cada shard é um banco independente com seu próprio ciclo de vida.\n\n✅ Quando usar\nSistemas multi-tenant de grande escala, bases com bilhões de registros, necessidade de isolamento de dados por tenant.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Application", description: "Issues read and write operations", x: 0, y: ROW },
      { type: "component", name: "Shard Router", description: "Resolves shard from tenant, region or entity key", x: COL, y: ROW },
      { type: "container", name: "Shard A", description: "Partition for one key range / tenant set", technology: "PostgreSQL / MySQL", x: COL * 2, y: 0 },
      { type: "container", name: "Shard B", description: "Partition for another key range / tenant set", technology: "PostgreSQL / MySQL", x: COL * 2, y: ROW },
      { type: "container", name: "Shard C", description: "Partition for another key range / tenant set", technology: "PostgreSQL / MySQL", x: COL * 2, y: ROW * 2 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Read / Write" },
      { fromIndex: 2, toIndex: 3, label: "Route key A" },
      { fromIndex: 2, toIndex: 4, label: "Route key B" },
      { fromIndex: 2, toIndex: 5, label: "Route key C" },
    ],
  },

  {
    id: "transactional-outbox",
    name: "Transactional Outbox",
    description:
      "Write to DB + outbox table atomically; relay polls and publishes events.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Transactional Outbox",
        description:
          "🔴 Problema\nPublicar um evento e persistir dados em operações separadas é não-atômico — uma pode falhar e a outra não, causando inconsistência.\n\n⚙️ Como funciona\nO Service grava no banco principal e na tabela outbox dentro da mesma transação. O Outbox Relay (processo separado) lê a tabela de outbox e publica os eventos no broker de forma idempotente.\n\n✅ Quando usar\nTodo sistema event-driven que precisa de garantia de entrega sem dual-write.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Service", description: "Business logic", x: 0, y: 0 },
      { type: "aws-database", name: "Database", description: "Main DB + outbox table", awsService: "rds", x: COL, y: 0 },
      { type: "component", name: "Outbox Relay", description: "Polls outbox, publishes events", x: COL, y: ROW },
      { type: "aws-integration", name: "Message Broker", description: "EventBridge / SQS / Kafka", awsService: "eventbridge", x: COL * 2, y: ROW },
      { type: "container", name: "Consumer", description: "Receives published events", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Write + outbox (tx)" },
      { fromIndex: 3, toIndex: 2, label: "Poll outbox" },
      { fromIndex: 3, toIndex: 4, label: "Publish event" },
      { fromIndex: 4, toIndex: 5, label: "Consume" },
    ],
  },

  {
    id: "cqrs",
    name: "CQRS",
    description:
      "Commands write to the write model; queries read from a dedicated read model.",
    category: "data",
    components: [
      {
        type: "note",
        name: "CQRS",
        description:
          "🔴 Problema\nO mesmo modelo de dados otimizado para escrita raramente é eficiente para leitura, gerando queries complexas e lentidão.\n\n⚙️ Como funciona\nCommandos são processados pelo Command Handler e persistidos no Write DB. Eventos do Write DB alimentam o Projector que constrói um Read DB otimizado para as queries. Queries são respondidas pelo Query Handler diretamente do Read DB.\n\n✅ Quando usar\nSistemas com padrões de leitura e escrita muito distintos, alta carga de leitura.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Client", description: "Sends commands & queries", x: 0, y: ROW * 0.5 },
      { type: "container", name: "Command Handler", description: "Validates and applies commands", x: COL, y: 0 },
      { type: "aws-database", name: "Write DB", description: "Source of truth", awsService: "rds", x: COL * 2, y: 0 },
      { type: "component", name: "Projector", description: "Builds read model from events", x: COL * 3, y: 0 },
      { type: "aws-database", name: "Read DB", description: "Optimised query store", awsService: "dynamodb", x: COL * 3, y: ROW },
      { type: "container", name: "Query Handler", description: "Serves read-only queries", x: COL, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Command" },
      { fromIndex: 2, toIndex: 3, label: "Persist" },
      { fromIndex: 3, toIndex: 4, label: "Domain events" },
      { fromIndex: 4, toIndex: 5, label: "Upsert" },
      { fromIndex: 1, toIndex: 6, label: "Query" },
      { fromIndex: 6, toIndex: 5, label: "Read" },
    ],
  },

  {
    id: "cache-aside",
    name: "Cache-Aside",
    description:
      "Application checks cache first; on miss reads DB and populates cache.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Cache-Aside",
        description:
          "🔴 Problema\nLeituras repetidas ao banco sobrecarregam o storage e aumentam latência desnecessariamente.\n\n⚙️ Como funciona\nA Application verifica o Cache primeiro. Em caso de hit, retorna imediatamente. Em caso de miss, lê do Database, popula o Cache e retorna ao caller. A aplicação é responsável por invalidar o cache na escrita.\n\n✅ Quando usar\nDados lidos com frequência e escritos raramente, resultados de queries pesadas.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Application", description: "Business service", x: 0, y: 0 },
      { type: "aws-database", name: "Cache", description: "ElastiCache / Redis", awsService: "elasticache", x: COL, y: 0 },
      { type: "aws-database", name: "Database", description: "Source of truth", awsService: "rds", x: COL, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Read (hit)" },
      { fromIndex: 1, toIndex: 3, label: "Read (miss)" },
      { fromIndex: 1, toIndex: 2, label: "Populate cache" },
    ],
  },

  {
    id: "event-sourcing-cqrs",
    name: "Event Sourcing + CQRS",
    description:
      "Commands append to event store; event bus feeds projections; read model serves queries.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Event Sourcing + CQRS",
        description:
          "🔴 Problema\nSistemas complexos perdem rastreabilidade — é impossível saber como o estado chegou onde está.\n\n⚙️ Como funciona\nO Command Handler appenda eventos imutáveis no Event Store. O Event Bus distribui os eventos para o Projection Builder que constrói o Read Model. O Query Handler serve leituras do Read Model sem tocar no Event Store.\n\n✅ Quando usar\nDomínios financeiros, sistemas de auditoria, necessidade de time-travel e replay.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Command Handler", description: "Validates and appends events", x: 0, y: 0 },
      { type: "container", name: "Event Store", description: "Append-only event log", technology: "EventStoreDB", x: COL, y: 0 },
      { type: "container", name: "Event Bus", description: "Publishes domain events", technology: "Kafka / EventBridge", x: COL * 2, y: 0 },
      { type: "container", name: "Projection Builder", description: "Consumes events, builds read model", x: COL * 3, y: 0 },
      { type: "container", name: "Read Model", description: "Query-optimised store", technology: "PostgreSQL / Redis", x: COL * 3, y: ROW },
      { type: "container", name: "Query Handler", description: "Serves read-only queries", x: COL * 4, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Append event" },
      { fromIndex: 2, toIndex: 3, label: "Publish event" },
      { fromIndex: 3, toIndex: 4, label: "Consume" },
      { fromIndex: 4, toIndex: 5, label: "Update projection" },
      { fromIndex: 6, toIndex: 5, label: "Query" },
    ],
  },

  {
    id: "read-replica",
    name: "Read Replica",
    description: "Application writes to primary DB; reads from replica; primary replicates to replica.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Read Replica",
        description:
          "🔴 Problema\nLeituras e escritas no mesmo banco competem por recursos, degradando performance em ambos.\n\n⚙️ Como funciona\nO Application escreve exclusivamente no Primary DB. O Primary replica continuamente para o Read Replica. Leituras são direcionadas para a réplica, aliviando carga do primário.\n\n✅ Quando usar\nAplicações read-heavy, relatórios analíticos, separação de workloads OLTP e OLAP.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Application", description: "App service", x: 0, y: ROW * 0.5 },
      { type: "container", name: "Primary DB", description: "Source of truth", technology: "PostgreSQL", x: COL, y: 0 },
      { type: "container", name: "Read Replica", description: "Read-only copy", technology: "PostgreSQL", x: COL, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Write" },
      { fromIndex: 1, toIndex: 3, label: "Read" },
      { fromIndex: 2, toIndex: 3, label: "Replicate" },
    ],
  },

  {
    id: "database-per-service",
    name: "Database per Service",
    description:
      "Each service owns its database; services communicate via event bus.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Database per Service",
        description:
          "🔴 Problema\nBancos compartilhados criam acoplamento entre serviços — uma mudança de schema em um serviço quebra os outros.\n\n⚙️ Como funciona\nCada serviço possui seu banco privado com o modelo de dados adequado ao seu domínio. Comunicação entre serviços ocorre exclusivamente via Event Bus assíncrono, nunca por acesso direto ao banco alheio.\n\n✅ Quando usar\nArquiteturas de microserviços, times com deploys independentes.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Service A", description: "Bounded context A", x: 0, y: 0 },
      { type: "container", name: "Database A", description: "Service A data", technology: "PostgreSQL", x: COL, y: 0 },
      { type: "container", name: "Service B", description: "Bounded context B", x: 0, y: ROW },
      { type: "container", name: "Database B", description: "Service B data", technology: "MongoDB", x: COL, y: ROW },
      { type: "container", name: "Event Bus", description: "Async communication", technology: "Kafka", x: COL * 2, y: ROW * 0.5 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Read/Write" },
      { fromIndex: 3, toIndex: 4, label: "Read/Write" },
      { fromIndex: 1, toIndex: 5, label: "Publish" },
      { fromIndex: 3, toIndex: 5, label: "Subscribe" },
    ],
  },

  {
    id: "multi-tier-cache",
    name: "Multi-tier Cache",
    description:
      "L1 in-memory cache; on miss check L2 (Redis); on miss hit DB; populate back up the chain.",
    category: "data",
    components: [
      {
        type: "note",
        name: "Multi-tier Cache",
        description:
          "🔴 Problema\nUm único nível de cache não cobre todos os trade-offs: memória local é rápida mas limitada; cache distribuído é maior mas tem latência de rede.\n\n⚙️ Como funciona\nA Application verifica o L1 Cache (in-process). Em miss, consulta o L2 Cache (Redis). Em miss, acessa o Database. O caminho de retorno popula os caches de volta na cadeia.\n\n✅ Quando usar\nSistemas com requisitos extremos de latência, dados quentes com alta frequência de acesso.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Application", description: "App service", x: 0, y: 0 },
      { type: "container", name: "L1 Cache", description: "In-process cache", technology: "In-memory", x: COL, y: 0 },
      { type: "container", name: "L2 Cache", description: "Distributed cache", technology: "Redis", x: COL * 2, y: 0 },
      { type: "container", name: "Database", description: "Source of truth", technology: "PostgreSQL", x: COL * 3, y: 0 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Check cache" },
      { fromIndex: 2, toIndex: 3, label: "Cache miss" },
      { fromIndex: 3, toIndex: 4, label: "Cache miss" },
      { fromIndex: 4, toIndex: 3, label: "Populate" },
      { fromIndex: 3, toIndex: 2, label: "Populate" },
    ],
  },

  // ── Event-Driven ─────────────────────────────────────────────────────────
  {
    id: "saga-choreography",
    name: "Saga (Choreography)",
    description:
      "Each service publishes domain events; compensating events handle rollbacks.",
    category: "event-driven",
    components: [
      {
        type: "note",
        name: "Saga (Choreography)",
        description:
          "🔴 Problema\nTransações distribuídas entre microserviços não têm 2PC confiável — é preciso coordenar sem um orquestrador central.\n\n⚙️ Como funciona\nCada serviço reage a eventos do bus e publica seu próprio evento de resposta. O fluxo avança por reação em cadeia. Falhas disparam eventos de compensação que desfazem os passos anteriores.\n\n✅ Quando usar\nFluxos de negócio distribuídos onde autonomia dos serviços é prioritária.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Order Service", description: "Creates order, emits OrderCreated", x: 0, y: ROW },
      { type: "aws-integration", name: "Event Bus", description: "EventBridge / Kafka", awsService: "eventbridge", x: COL, y: ROW },
      { type: "container", name: "Payment Service", description: "Charges payment, emits PaymentProcessed", x: COL * 2, y: 0 },
      { type: "container", name: "Inventory Service", description: "Reserves stock, emits StockReserved", x: COL * 2, y: ROW },
      { type: "container", name: "Shipping Service", description: "Schedules shipment", x: COL * 2, y: ROW * 2 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "OrderCreated" },
      { fromIndex: 2, toIndex: 3, label: "OrderCreated" },
      { fromIndex: 3, toIndex: 2, label: "PaymentProcessed" },
      { fromIndex: 2, toIndex: 4, label: "PaymentProcessed" },
      { fromIndex: 4, toIndex: 2, label: "StockReserved" },
      { fromIndex: 2, toIndex: 5, label: "StockReserved" },
    ],
  },

  {
    id: "saga-orchestration",
    name: "Saga (Orchestration)",
    description:
      "A central orchestrator coordinates local transactions and compensations across services.",
    category: "event-driven",
    components: [
      {
        type: "note",
        name: "Saga (Orchestration)",
        description:
          "🔴 Problema\nFluxos distribuídos com lógica de compensação complexa ficam difíceis de entender quando espalhados por vários serviços.\n\n⚙️ Como funciona\nUm Saga Orchestrator central emite comandos diretos para cada serviço na sequência correta. Ele rastreia o estado do fluxo e emite compensações se um passo falhar.\n\n✅ Quando usar\nFluxos com lógica de compensação complexa, necessidade de visibilidade central do estado do processo.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Client", description: "Starts business process", x: 0, y: ROW },
      { type: "container", name: "Saga Orchestrator", description: "Coordinates steps and compensations", x: COL, y: ROW },
      { type: "container", name: "Order Service", description: "Creates order", x: COL * 2, y: 0 },
      { type: "container", name: "Payment Service", description: "Charges payment", x: COL * 2, y: ROW },
      { type: "container", name: "Inventory Service", description: "Reserves stock", x: COL * 2, y: ROW * 2 },
      { type: "container", name: "Shipping Service", description: "Schedules delivery", x: COL * 2, y: ROW * 3 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Start saga" },
      { fromIndex: 2, toIndex: 3, label: "Create order" },
      { fromIndex: 2, toIndex: 4, label: "Charge" },
      { fromIndex: 2, toIndex: 5, label: "Reserve" },
      { fromIndex: 2, toIndex: 6, label: "Ship" },
    ],
  },

  {
    id: "event-sourcing",
    name: "Event Sourcing",
    description:
      "State derived from an append-only event log; projections build read views.",
    category: "event-driven",
    components: [
      {
        type: "note",
        name: "Event Sourcing",
        description:
          "🔴 Problema\nSistemas que sobrescrevem estado perdem o histórico — é impossível auditar o que aconteceu ou reconstruir um estado passado.\n\n⚙️ Como funciona\nTodo comando gera um evento imutável que é appendado ao Event Store. O estado atual é o resultado do replay de todos os eventos. O Projection Engine constrói Read Views materializadas para queries eficientes.\n\n✅ Quando usar\nDomínios com requisito de auditoria, sistemas financeiros, necessidade de replay e time-travel.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Client", description: "Sends commands and queries", x: 0, y: ROW * 0.5 },
      { type: "container", name: "Command API", description: "Validates and emits events", x: COL, y: 0 },
      { type: "aws-database", name: "Event Store", description: "Append-only log (DynamoDB / Aurora)", awsService: "dynamodb", x: COL * 2, y: 0 },
      { type: "component", name: "Projection Engine", description: "Replays events into read views", x: COL * 3, y: 0 },
      { type: "aws-database", name: "Read Model", description: "Denormalised query store", awsService: "dynamodb", x: COL * 3, y: ROW },
      { type: "container", name: "Query API", description: "Serves read requests", x: COL, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Command" },
      { fromIndex: 2, toIndex: 3, label: "Append event" },
      { fromIndex: 3, toIndex: 4, label: "Stream events" },
      { fromIndex: 4, toIndex: 5, label: "Upsert view" },
      { fromIndex: 1, toIndex: 6, label: "Query" },
      { fromIndex: 6, toIndex: 5, label: "Read" },
    ],
  },

  {
    id: "event-carried-state-transfer",
    name: "Event-Carried State Transfer",
    description:
      "Producer publishes events with enough state for consumers to update local views without synchronous lookups.",
    category: "event-driven",
    components: [
      {
        type: "note",
        name: "Event-Carried State Transfer",
        description:
          "🔴 Problema\nConsumidores de eventos precisam fazer chamadas síncronas de volta ao produtor para buscar dados adicionais, criando acoplamento e latência.\n\n⚙️ Como funciona\nO Producer publica eventos com todo o estado necessário embutido no payload. Os Consumers atualizam suas Local Views sem precisar de lookups adicionais.\n\n✅ Quando usar\nConsumidores que precisam de dados do produtor para processar, redução de chattiness entre serviços.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "container", name: "Producer Service", description: "Owns source entity", x: 0, y: ROW * 0.5 },
      { type: "container", name: "Event Bus", description: "Distributes state-carrying events", technology: "Kafka / EventBridge", x: COL, y: ROW * 0.5 },
      { type: "container", name: "Consumer A", description: "Maintains local read model from events", x: COL * 2, y: 0 },
      { type: "container", name: "Consumer B", description: "Maintains local cache or projection from events", x: COL * 2, y: ROW },
      { type: "container", name: "Local View", description: "Denormalised local data for consumer needs", technology: "PostgreSQL / Redis", x: COL * 3, y: ROW * 0.5 },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Publish full event" },
      { fromIndex: 2, toIndex: 3, label: "Consume" },
      { fromIndex: 2, toIndex: 4, label: "Consume" },
      { fromIndex: 3, toIndex: 5, label: "Update local view" },
      { fromIndex: 4, toIndex: 5, label: "Update local view" },
    ],
  },

  // ── Security ─────────────────────────────────────────────────────────────
  {
    id: "policy-enforcement-point-opa",
    name: "Policy Enforcement Point (OPA)",
    description:
      "API Gateway delegates policy checks to OPA; OPA fetches policies from store; gateway forwards or denies.",
    category: "security",
    components: [
      {
        type: "note",
        name: "Policy Enforcement Point (OPA)",
        description:
          "🔴 Problema\nLógica de autorização espalhada em vários serviços é difícil de auditar, manter e atualizar consistentemente.\n\n⚙️ Como funciona\nO API Gateway delega toda decisão de autorização ao OPA Sidecar. O OPA avalia a policy contra os atributos da requisição e retorna Allow/Deny. Policies são versionadas no Policy Store separado da aplicação.\n\n✅ Quando usar\nAutorização centralizada, compliance, ambientes com políticas complexas e mutáveis.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "Client", description: "Request origin", x: 0, y: ROW * 0.5 },
      { type: "container", name: "API Gateway", description: "Entry point", technology: "Kong / Nginx", x: COL, y: ROW * 0.5 },
      { type: "container", name: "OPA Sidecar", description: "Policy evaluation", technology: "Open Policy Agent", x: COL * 2, y: 0 },
      { type: "container", name: "Policy Store", description: "Policies (Git / bundle)", technology: "Git / Bundle", x: COL * 3, y: 0 },
      { type: "container", name: "Service", description: "Backend service", x: COL * 2, y: ROW },
      { type: "container", name: "Data Store", description: "Persistence", x: COL * 3, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Request" },
      { fromIndex: 2, toIndex: 3, label: "Check policy" },
      { fromIndex: 3, toIndex: 4, label: "Fetch policies" },
      { fromIndex: 3, toIndex: 2, label: "Allow / Deny" },
      { fromIndex: 2, toIndex: 5, label: "Forward (if allowed)" },
      { fromIndex: 5, toIndex: 6, label: "Read/Write" },
    ],
  },

  {
    id: "rbac-with-opa",
    name: "RBAC with OPA",
    description:
      "User authenticates via Auth; OPA checks roles against Role Store; Auth issues token; user calls Resource with token.",
    category: "security",
    components: [
      {
        type: "note",
        name: "RBAC with OPA",
        description:
          "🔴 Problema\nControle de acesso baseado em roles hardcoded no serviço é difícil de escalar e auditar.\n\n⚙️ Como funciona\nO Auth Service autentica o usuário e consulta o OPA Engine com os atributos do usuário. O OPA avalia os roles contra o Role Store e retorna a decisão. O Auth emite um token com as permissões resolvidas para o Resource Server.\n\n✅ Quando usar\nSistemas corporativos com roles complexos, necessidade de auditoria de acesso, SSO com múltiplos recursos.",
        x: NOTE_X, y: NOTE_Y,
      },
      { type: "person", name: "User", description: "End user", x: 0, y: ROW * 0.5 },
      { type: "container", name: "Auth Service", description: "Issues tokens", technology: "OAuth2 / OIDC", x: COL, y: ROW * 0.5 },
      { type: "container", name: "OPA Engine", description: "Role-based policy", technology: "Open Policy Agent", x: COL * 2, y: 0 },
      { type: "container", name: "Role Store", description: "Roles and permissions", technology: "LDAP / DB", x: COL * 3, y: 0 },
      { type: "container", name: "Resource Server", description: "Protected API", x: COL * 2, y: ROW },
    ],
    connections: [
      { fromIndex: 1, toIndex: 2, label: "Authenticate" },
      { fromIndex: 2, toIndex: 3, label: "Check role" },
      { fromIndex: 3, toIndex: 4, label: "Fetch roles" },
      { fromIndex: 3, toIndex: 2, label: "Permit / Deny" },
      { fromIndex: 2, toIndex: 5, label: "Access token" },
      { fromIndex: 1, toIndex: 5, label: "Request + token" },
    ],
  },
];

export const PATTERNS_BY_CATEGORY = PATTERNS.reduce<
  Record<PatternCategory, PatternTemplate[]>
>(
  (acc, p) => {
    acc[p.category].push(p);
    return acc;
  },
  {
    messaging: [],
    api: [],
    resilience: [],
    data: [],
    "event-driven": [],
    security: [],
  },
);

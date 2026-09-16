import { PanelKind, type Component, type Diagram } from "@/features/diagram";
import { layout, SEED_TS } from "./helpers";
import { D_CATALOG, D_CONTEXT, FOLDER_CATALOG } from "./ids";

const COL_W = 220;
const COL_GAP = 40;
const ROW_H = 110;
const PANEL_PAD = 48;
const PANEL_W = 7 * (COL_W + COL_GAP) + PANEL_PAD;

function col(index: number): number {
  return PANEL_PAD / 2 + index * (COL_W + COL_GAP);
}

/** Design-system showcase of every element family Structura supports. */
export function buildCatalogDiagram(): Diagram {
  const panels: Record<string, { x: number; y: number; h: number }> = {
    "pl-cat-c4": { x: 40, y: 40, h: 280 },
    "pl-cat-aws": { x: 40, y: 360, h: 320 },
    "pl-cat-gcp": { x: 40, y: 720, h: 280 },
    "pl-cat-azure": { x: 40, y: 1040, h: 280 },
    "pl-cat-k8s": { x: 40, y: 1360, h: 240 },
    "pl-cat-oss": { x: 40, y: 1640, h: 220 },
    "pl-cat-struct": { x: 40, y: 1900, h: 520 },
  };

  const nodeLayouts: Diagram["nodeLayouts"] = {};
  for (const [id, p] of Object.entries(panels)) {
    nodeLayouts[id] = layout(id, p.x, p.y, PANEL_W, p.h);
  }

  const placeIn = (panelId: string, localId: string, colIndex: number, row: number) => {
    const panel = panels[panelId]!;
    nodeLayouts[localId] = layout(localId, col(colIndex), 56 + row * ROW_H, COL_W, ROW_H - 16);
    void panel;
  };

  // C4
  placeIn("pl-cat-c4", "pl-cat-person", 0, 0);
  placeIn("pl-cat-c4", "pl-cat-system", 1, 0);
  placeIn("pl-cat-c4", "pl-cat-container", 2, 0);
  placeIn("pl-cat-c4", "pl-cat-component", 3, 0);

  // AWS — one per core category
  const aws = [
    ["pl-cat-aws-lambda", "aws-compute", "lambda", "Lambda"],
    ["pl-cat-aws-s3", "aws-storage", "s3", "S3"],
    ["pl-cat-aws-rds", "aws-database", "rds", "RDS"],
    ["pl-cat-aws-vpc", "aws-networking", "vpc", "VPC"],
    ["pl-cat-aws-iam", "aws-security", "iam", "IAM"],
    ["pl-cat-aws-athena", "aws-analytics", "athena", "Athena"],
    ["pl-cat-aws-sqs", "aws-integration", "sqs", "SQS"],
    ["pl-cat-aws-ecr", "aws-containers", "ecr", "ECR"],
    ["pl-cat-aws-cw", "aws-management", "cloudwatch", "CloudWatch"],
  ] as const;
  aws.forEach(([id], index) => placeIn("pl-cat-aws", id, index % 7, Math.floor(index / 7)));

  // GCP
  const gcp = [
    ["pl-cat-gcp-run", "gcp-compute", "cloudrun", "Cloud Run"],
    ["pl-cat-gcp-gcs", "gcp-storage", "cloud-storage", "Cloud Storage"],
    ["pl-cat-gcp-sql", "gcp-database", "cloudsql", "Cloud SQL"],
    ["pl-cat-gcp-net", "gcp-networking", "networking", "Networking"],
    ["pl-cat-gcp-sec", "gcp-security", "securityidentity", "Security"],
    ["pl-cat-gcp-bq", "gcp-analytics", "bigquery", "BigQuery"],
    ["pl-cat-gcp-ai", "gcp-ai", "vertexai", "Vertex AI"],
    ["pl-cat-gcp-int", "gcp-integration", "integrationservices", "Integration"],
  ] as const;
  gcp.forEach(([id], index) => placeIn("pl-cat-gcp", id, index % 7, Math.floor(index / 7)));

  // Azure
  const azure = [
    ["pl-cat-az-fn", "azure-compute", "functions", "Functions"],
    ["pl-cat-az-blob", "azure-storage", "storageblob", "Blob Storage"],
    ["pl-cat-az-cosmos", "azure-database", "cosmosdb", "Cosmos DB"],
    ["pl-cat-az-vnet", "azure-networking", "virtualnetwork", "VNet"],
    ["pl-cat-az-kv", "azure-security", "keyvault", "Key Vault"],
    ["pl-cat-az-sa", "azure-analytics", "streamanalytics", "Stream Analytics"],
    ["pl-cat-az-bus", "azure-integration", "servicebus", "Service Bus"],
  ] as const;
  azure.forEach(([id], index) => placeIn("pl-cat-azure", id, index % 7, Math.floor(index / 7)));

  // K8s
  placeIn("pl-cat-k8s", "pl-cat-k8s-deploy", 0, 0);
  placeIn("pl-cat-k8s", "pl-cat-k8s-ing", 1, 0);
  placeIn("pl-cat-k8s", "pl-cat-k8s-pvc", 2, 0);
  placeIn("pl-cat-k8s", "pl-cat-k8s-cm", 3, 0);

  // OSS
  placeIn("pl-cat-oss", "pl-cat-oss-redis", 0, 0);
  placeIn("pl-cat-oss", "pl-cat-oss-kafka", 1, 0);

  // Structural
  placeIn("pl-cat-struct", "pl-cat-note", 0, 0);
  placeIn("pl-cat-struct", "pl-cat-db", 1, 0);
  placeIn("pl-cat-struct", "pl-cat-json", 2, 0);
  placeIn("pl-cat-struct", "pl-cat-api", 3, 0);
  placeIn("pl-cat-struct", "pl-cat-ep", 4, 0);
  placeIn("pl-cat-struct", "pl-cat-panel", 5, 0);
  placeIn("pl-cat-struct", "pl-cat-process", 0, 1);
  placeIn("pl-cat-struct", "pl-cat-ext", 1, 1);
  placeIn("pl-cat-struct", "pl-cat-svg", 2, 1);
  placeIn("pl-cat-struct", "pl-cat-unknown", 3, 1);

  const cloudCard = (
    id: string,
    type: Component["type"],
    cloudServiceId: string,
    name: string,
    parentId: string,
  ): Component =>
    ({
      id,
      name,
      type,
      description: `Exemplo de catálogo: ${name}.`,
      parentId,
      cloudServiceId,
    }) as Component;

  return {
    id: D_CATALOG,
    name: "Catálogo de elementos",
    description:
      "Vitrine de famílias Structura: C4, AWS, GCP, Azure, Kubernetes, OSS e tipos estruturais.",
    level: "component",
    domain: "seed",
    folderId: FOLDER_CATALOG,
    createdAt: SEED_TS.catalog,
    updatedAt: SEED_TS.updated,
    viewport: { x: 0, y: 0, zoom: 0.45 },
    edgeLayouts: {},
    scenes: {},
    activeSceneId: null,
    nodeLayouts,
    snapshot: {
      iconLibrary: {},
      flows: {},
      components: {
        "pl-cat-c4": {
          id: "pl-cat-c4",
          name: "C4",
          type: "panel",
          description: "Tipos C4: person, system, container, component.",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        "pl-cat-person": {
          id: "pl-cat-person",
          name: "Pagador (exemplo)",
          type: "person",
          description: "Atores humanos no modelo C4.",
          parentId: "pl-cat-c4",
        },
        "pl-cat-system": {
          id: "pl-cat-system",
          name: "Sistema (exemplo)",
          type: "system",
          description: "Sistema de software no contexto.",
          parentId: "pl-cat-c4",
        },
        "pl-cat-container": {
          id: "pl-cat-container",
          name: "Container (exemplo)",
          type: "container",
          description: "Container deployável (API, DB, fila).",
          parentId: "pl-cat-c4",
          technology: "Go",
        },
        "pl-cat-component": {
          id: "pl-cat-component",
          name: "Component (exemplo)",
          type: "component",
          description: "Componente interno de um container.",
          parentId: "pl-cat-c4",
          technology: "TypeScript",
        },

        "pl-cat-aws": {
          id: "pl-cat-aws",
          name: "AWS",
          type: "panel",
          description:
            "Um serviço por categoria núcleo (compute, storage, database, networking, security, analytics, integration, containers, management).",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        ...Object.fromEntries(
          aws.map(([id, type, serviceId, name]) => [
            id,
            cloudCard(id, type, serviceId, name, "pl-cat-aws"),
          ]),
        ),

        "pl-cat-gcp": {
          id: "pl-cat-gcp",
          name: "GCP",
          type: "panel",
          description: "Amostra representativa das categorias GCP.",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        ...Object.fromEntries(
          gcp.map(([id, type, serviceId, name]) => [
            id,
            cloudCard(id, type, serviceId, name, "pl-cat-gcp"),
          ]),
        ),

        "pl-cat-azure": {
          id: "pl-cat-azure",
          name: "Azure",
          type: "panel",
          description: "Amostra representativa das categorias Azure.",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        ...Object.fromEntries(
          azure.map(([id, type, serviceId, name]) => [
            id,
            cloudCard(id, type, serviceId, name, "pl-cat-azure"),
          ]),
        ),

        "pl-cat-k8s": {
          id: "pl-cat-k8s",
          name: "Kubernetes",
          type: "panel",
          description: "Uma amostra por categoria do catálogo K8s.",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        "pl-cat-k8s-deploy": cloudCard(
          "pl-cat-k8s-deploy",
          "k8s-workloads",
          "deployment",
          "Deployment",
          "pl-cat-k8s",
        ),
        "pl-cat-k8s-ing": cloudCard(
          "pl-cat-k8s-ing",
          "k8s-networking",
          "ingress",
          "Ingress",
          "pl-cat-k8s",
        ),
        "pl-cat-k8s-pvc": cloudCard(
          "pl-cat-k8s-pvc",
          "k8s-storage",
          "persistentvolumeclaim",
          "PVC",
          "pl-cat-k8s",
        ),
        "pl-cat-k8s-cm": cloudCard(
          "pl-cat-k8s-cm",
          "k8s-config",
          "configmap",
          "ConfigMap",
          "pl-cat-k8s",
        ),

        "pl-cat-oss": {
          id: "pl-cat-oss",
          name: "OSS",
          type: "panel",
          description: "Cobertura completa do catálogo OSS (datastore + messaging).",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        "pl-cat-oss-redis": cloudCard(
          "pl-cat-oss-redis",
          "oss-datastore",
          "redis",
          "Redis",
          "pl-cat-oss",
        ),
        "pl-cat-oss-kafka": cloudCard(
          "pl-cat-oss-kafka",
          "oss-messaging",
          "kafka",
          "Kafka",
          "pl-cat-oss",
        ),

        "pl-cat-struct": {
          id: "pl-cat-struct",
          name: "Tipos estruturais",
          type: "panel",
          description:
            "note, db-table, json-viewer, api-group, endpoint, panel, process-node, external-element, svg, unknown.",
          parentId: null,
          panelKind: PanelKind.Default,
        },
        "pl-cat-note": {
          id: "pl-cat-note",
          name: "Nota",
          type: "note",
          description: "## Nota de exemplo\n\nMarkdown em um `note` do catálogo.",
          parentId: "pl-cat-struct",
        },
        "pl-cat-db": {
          id: "pl-cat-db",
          name: "cobrancas",
          type: "db-table",
          description: "Tabela de cobranças Pix.",
          parentId: "pl-cat-struct",
          tableName: "cobrancas",
          columns: [
            {
              id: "pl-cat-col-1",
              name: "txid",
              dataType: "varchar(35)",
              isPrimaryKey: true,
              nullable: false,
              unique: true,
            },
            { id: "pl-cat-col-2", name: "valor", dataType: "numeric(15,2)", nullable: false },
            { id: "pl-cat-col-3", name: "status", dataType: "varchar(32)", nullable: false },
            {
              id: "pl-cat-col-4",
              name: "merchant_id",
              dataType: "uuid",
              isForeignKey: true,
              nullable: false,
            },
            { id: "pl-cat-col-5", name: "criado_em", dataType: "timestamptz", nullable: false },
          ],
        },
        "pl-cat-json": {
          id: "pl-cat-json",
          name: "Payload cob",
          type: "json-viewer",
          description: "Exemplo de body de criação de cobrança.",
          parentId: "pl-cat-struct",
          jsonContent: JSON.stringify(
            {
              valor: "149.90",
              chave: "loja@pixledger.com",
              solicitacaoPagador: "Pedido #4521",
              expiracao: 3600,
            },
            null,
            2,
          ),
        },
        "pl-cat-api": {
          id: "pl-cat-api",
          name: "Cob API",
          type: "api-group",
          description: "Grupo de endpoints Pix.",
          parentId: "pl-cat-struct",
          serviceName: "cob-api",
          basePath: "/v1",
          protocol: "REST",
          sla: "P95 < 300ms",
        },
        "pl-cat-ep": {
          id: "pl-cat-ep",
          name: "Criar cobrança",
          type: "endpoint",
          description: "POST /v1/cob",
          parentId: "pl-cat-api",
          method: "POST",
          path: "/cob",
          endpointDescription: "Cria cobrança imediata e retorna BR Code.",
          handlers: [
            {
              id: "pl-cat-h1",
              label: "Criar cobrança",
              description: "Valida, persiste e emite BR Code.",
            },
          ],
        },
        "pl-cat-panel": {
          id: "pl-cat-panel",
          name: "Painel (exemplo)",
          type: "panel",
          description: "Painel estrutural aninhado (demonstração).",
          parentId: "pl-cat-struct",
          panelKind: PanelKind.Default,
        },
        "pl-cat-process": {
          id: "pl-cat-process",
          name: "Pagamento ok?",
          type: "process-node",
          description: "Decisão de fluxo (diamond).",
          parentId: "pl-cat-struct",
          flowShape: "diamond",
        },
        "pl-cat-ext": {
          id: "pl-cat-ext",
          name: "Contexto PixLedger",
          type: "external-element",
          description: "Referência ao diagrama de contexto do cenário A.",
          parentId: "pl-cat-struct",
          referenceDiagramId: D_CONTEXT,
          linkedDiagramName: "PixLedger — Contexto",
        },
        "pl-cat-svg": {
          id: "pl-cat-svg",
          name: "QR Pix (SVG)",
          type: "svg",
          description: "Marcação SVG mínima de exemplo.",
          parentId: "pl-cat-struct",
          svgContent:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f172a"/><rect x="8" y="8" width="20" height="20" fill="#22c55e"/><rect x="36" y="8" width="20" height="20" fill="#22c55e"/><rect x="8" y="36" width="20" height="20" fill="#22c55e"/><rect x="36" y="36" width="8" height="8" fill="#f8fafc"/></svg>',
        },
        "pl-cat-unknown": {
          id: "pl-cat-unknown",
          name: "Tipo desconhecido",
          type: "unknown",
          description: "Placeholder para tipos de plugin ausentes.",
          parentId: "pl-cat-struct",
          rawContent: '{"plugin":"example","kind":"legacy-node"}',
        },
      },
      connections: {},
    },
  };
}

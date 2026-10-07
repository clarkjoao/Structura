import type { OpscrManifestInput, ViewElement } from "./types";

/** Kinds drawn as panels that hold the elements belonging to them. */
export const BOUNDARY_KINDS: ReadonlySet<string> = new Set(["Domain", "ApplicationService"]);

/** Kinds drawn as a leaf element. */
export const LEAF_KINDS: ReadonlySet<string> = new Set([
  "Application",
  "APIGateway",
  "LoadBalancer",
  "Database",
  "Cache",
  "Storage",
  "Queue",
  "Topic",
  "Notification",
  "Channel",
  "ExternalSystem",
]);

/** Graph manifests: they hold edges and are never elements themselves. */
export const GRAPH_KINDS: ReadonlySet<string> = new Set(["Relationship"]);

export function isDrawnKind(kind: string): boolean {
  return BOUNDARY_KINDS.has(kind) || LEAF_KINDS.has(kind);
}

interface CatalogService {
  type: string;
  catalogServiceId: string;
}

const svc = (type: string, catalogServiceId: string): CatalogService => ({
  type,
  catalogServiceId,
});

/**
 * opscr `spec.provider` → Structura catalog service, per Kind. Only providers with a
 * matching catalog service are listed; every other provider falls back to a C4
 * container naming the product. A test pins each entry to an existing catalog id.
 */
export const PROVIDER_SERVICES: Readonly<Record<string, Readonly<Record<string, CatalogService>>>> =
  {
    Application: {
      ECS: svc("aws-compute", "ecs"),
      EKS: svc("aws-compute", "eks"),
      Lambda: svc("aws-compute", "lambda"),
      Fargate: svc("aws-compute", "fargate"),
      EC2: svc("aws-compute", "ec2"),
      "App Runner": svc("aws-compute", "app-runner"),
      AKS: svc("azure-compute", "containerservice"),
      "Azure Functions": svc("azure-compute", "functions"),
      "Azure App Service": svc("azure-compute", "appservice"),
      GKE: svc("gcp-compute", "gke"),
      "Cloud Run": svc("gcp-compute", "cloudrun"),
      "Cloud Functions": svc("gcp-compute", "serverlesscomputing"),
    },
    APIGateway: {
      "AWS API Gateway": svc("aws-networking", "api-gateway"),
      "Azure API Management": svc("azure-integration", "apimanagement"),
      Apigee: svc("gcp-devtools", "apigee"),
    },
    LoadBalancer: {
      ALB: svc("aws-networking", "elb"),
      NLB: svc("aws-networking", "elb"),
      "Azure Load Balancer": svc("azure-networking", "loadbalancer"),
      "Azure Application Gateway": svc("azure-networking", "appgateway"),
    },
    Database: {
      DynamoDB: svc("aws-database", "dynamodb"),
      AuroraMySQL: svc("aws-database", "aurora"),
      AuroraPostgres: svc("aws-database", "aurora"),
      RDSMySQL: svc("aws-database", "rds"),
      RDSPostgres: svc("aws-database", "rds"),
      RDSSQLServer: svc("aws-database", "rds"),
      RDSOracle: svc("aws-database", "rds"),
      Neptune: svc("aws-database", "neptune"),
      DocumentDB: svc("aws-database", "documentdb"),
      Redshift: svc("aws-database", "redshift"),
      OpenSearch: svc("aws-analytics", "opensearch"),
      CosmosDB: svc("azure-database", "cosmosdb"),
      AzureSQL: svc("azure-database", "sqldatabase"),
      CloudSQLPostgres: svc("gcp-database", "cloudsql"),
      CloudSQLMySQL: svc("gcp-database", "cloudsql"),
      AlloyDB: svc("gcp-database", "alloydb"),
      Spanner: svc("gcp-database", "cloudspanner"),
      BigQuery: svc("gcp-database", "bigquery"),
    },
    Cache: {
      "ElastiCache Redis": svc("aws-database", "elasticache"),
      "ElastiCache Valkey": svc("aws-database", "elasticache"),
      "ElastiCache Memcached": svc("aws-database", "elasticache"),
      MemoryDB: svc("aws-database", "memorydb"),
      "Azure Cache for Redis": svc("azure-database", "rediscache"),
      Redis: svc("oss-datastore", "redis"),
    },
    Storage: {
      S3: svc("aws-storage", "s3"),
      "S3 Glacier": svc("aws-storage", "s3-glacier"),
      EFS: svc("aws-storage", "efs"),
      EBS: svc("aws-storage", "ebs"),
      FSx: svc("aws-storage", "fsx"),
      "Azure Blob Storage": svc("azure-storage", "storageblob"),
      "Azure Files": svc("azure-storage", "storagefiles"),
      "Cloud Storage": svc("gcp-storage", "cloud-storage"),
    },
    Queue: {
      SQS: svc("aws-integration", "sqs"),
      "Amazon MQ": svc("aws-integration", "mq"),
      "Azure Service Bus": svc("azure-integration", "servicebus"),
      "Azure Queue Storage": svc("azure-storage", "storagequeue"),
    },
    Topic: {
      SNS: svc("aws-integration", "sns"),
      MSK: svc("aws-analytics", "msk"),
      Kinesis: svc("aws-analytics", "kinesis"),
      EventBridge: svc("aws-integration", "eventbridge"),
      "Azure Event Hubs": svc("azure-integration", "eventhubs"),
      "Azure Event Grid": svc("azure-integration", "eventgrid"),
      Kafka: svc("oss-messaging", "kafka"),
    },
    Notification: {
      "SNS Mobile Push": svc("aws-integration", "sns"),
      "Azure Notification Hubs": svc("azure-integration", "notificationhubs"),
    },
  };

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** What a drawn manifest becomes. Assumes `isDrawnKind(manifest.kind)`. */
export function elementFor(manifest: OpscrManifestInput): ViewElement {
  const { kind, spec } = manifest;
  if (BOUNDARY_KINDS.has(kind)) return { type: "panel" };
  if (kind === "ExternalSystem") {
    const technology = text(spec["provider"]) ?? text(spec["type"]);
    return technology ? { type: "system", technology } : { type: "system" };
  }
  if (kind === "Channel") {
    const technology = text(spec["framework"]) ?? text(spec["type"]) ?? text(spec["provider"]);
    return technology ? { type: "container", technology } : { type: "container" };
  }

  const provider = text(spec["provider"]);
  const service = provider ? PROVIDER_SERVICES[kind]?.[provider] : undefined;
  if (service)
    return { type: service.type, catalogServiceId: service.catalogServiceId, technology: provider };
  return provider ? { type: "container", technology: provider } : { type: "container" };
}

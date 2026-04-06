import { AWS_CATEGORIES, type AwsCategoryId } from "@/lib/catalogs/aws";

export interface ComponentTypeDefinition {
  nodeType: string;
  displayName: string;
  description: string;
  requiredFields?: string[];
  example?: string;
}

export const STRUCTURAL_TYPES: ComponentTypeDefinition[] = [
  {
    nodeType: "panel",
    displayName: "Panel / Group",
    description:
      "A visual grouping container. Use for bounded contexts, domains, or any logical grouping of nodes. Supports swimlane layout.",
    example: '{ "nodeType": "panel", "name": "Payment Domain", "parentId": null }',
  },
  {
    nodeType: "note",
    displayName: "Note",
    description:
      "A free-text annotation or documentation block. Use for comments, ADRs, or design notes.",
    example: '{ "nodeType": "note", "name": "", "parentId": null }',
  },
  {
    nodeType: "api-group",
    displayName: "API Group",
    description:
      "Represents a REST/gRPC/GraphQL/WebSocket API surface. Use when defining a service API contract. Must have a basePath and protocol.",
    requiredFields: ["serviceName", "basePath", "protocol"],
    example: '{ "nodeType": "api-group", "name": "User API", "parentId": "service-node-id" }',
  },
  {
    nodeType: "endpoint",
    displayName: "API Endpoint",
    description:
      "A single HTTP or event endpoint. Must be a child of an api-group node. Requires method (GET/POST/PUT/PATCH/DELETE/EVENT) and path.",
    requiredFields: ["method", "path"],
    example: '{ "nodeType": "endpoint", "name": "Get Users", "parentId": "api-group-node-id" }',
  },
  {
    nodeType: "db-table",
    displayName: "Database Table",
    description:
      "Represents a relational database table with columns. Use for data modeling.",
    example: '{ "nodeType": "db-table", "name": "users", "parentId": null }',
  },
  {
    nodeType: "json-viewer",
    displayName: "JSON Viewer",
    description:
      "Displays a JSON payload or schema. Use for documenting request/response shapes.",
    example: '{ "nodeType": "json-viewer", "name": "User Response", "parentId": null }',
  },
];

export const C4_TYPES: ComponentTypeDefinition[] = [
  {
    nodeType: "person",
    displayName: "Person / Actor",
    description:
      "A human user or external actor that interacts with the system. Use in C4 context diagrams.",
    example: '{ "nodeType": "person", "name": "Customer", "parentId": null }',
  },
  {
    nodeType: "system",
    displayName: "Software System",
    description:
      "A top-level software system. Use for external systems or the system being described at context level.",
    example: '{ "nodeType": "system", "name": "Payment System", "parentId": null }',
  },
  {
    nodeType: "container",
    displayName: "Container",
    description:
      "A deployable unit: web app, microservice, database, mobile app, etc. Use at C4 container level.",
    example: '{ "nodeType": "container", "name": "BFF Service", "parentId": null }',
  },
  {
    nodeType: "component",
    displayName: "Component",
    description:
      "A module or component inside a container. Use at C4 component level.",
    example: '{ "nodeType": "component", "name": "AuthController", "parentId": "container-id" }',
  },
];

const AWS_CATEGORY_DESCRIPTIONS: Record<AwsCategoryId, string> = {
  "aws-compute":
    "Compute workloads such as EC2, Lambda, ECS, and EKS.",
  "aws-storage":
    "Storage workloads such as S3, EBS, EFS, and S3 Glacier.",
  "aws-database":
    "Database and caching workloads such as RDS, Aurora, DynamoDB, and ElastiCache.",
  "aws-networking":
    "Networking and edge services such as API Gateway, VPC, CloudFront, and Route 53.",
  "aws-security":
    "Identity and security services such as IAM and Cognito.",
  "aws-analytics":
    "Analytics and streaming services such as Athena, Kinesis, and OpenSearch.",
  "aws-ml":
    "Machine learning and AI services such as SageMaker and Bedrock.",
  "aws-integration":
    "Application integration and messaging services such as SQS, SNS, and EventBridge.",
  "aws-management":
    "Management and governance services such as CloudWatch and CloudFormation.",
  "aws-developer":
    "Developer and CI/CD services such as CodeBuild and CodePipeline.",
  "aws-containers":
    "Container platform services such as ECR, ECS, and EKS.",
  "aws-media":
    "Media processing and streaming services such as MediaLive and MediaConvert.",
  "aws-migration":
    "Migration and transfer services such as Migration Hub and Transfer Family.",
  "aws-iot":
    "IoT services such as IoT Core and Greengrass.",
  "aws-general":
    "General AWS infrastructure groups such as VPC, private subnet, and public subnet.",
};

export const AWS_TYPES: ComponentTypeDefinition[] = AWS_CATEGORIES.filter(
  (category): category is (typeof AWS_CATEGORIES)[number] & { id: AwsCategoryId } =>
    category.id in AWS_CATEGORY_DESCRIPTIONS,
).map((category) => ({
  nodeType: category.id,
  displayName: category.name,
  description: AWS_CATEGORY_DESCRIPTIONS[category.id],
  example: `{ "nodeType": "${category.id}", "name": "${category.services[0]?.name ?? category.name}", "parentId": null }`,
}));

export const ALL_COMPONENT_TYPES: ComponentTypeDefinition[] = [
  ...STRUCTURAL_TYPES,
  ...C4_TYPES,
  ...AWS_TYPES,
];

function formatTypeDef(def: ComponentTypeDefinition): string {
  const lines = [
    `nodeType: "${def.nodeType}" - ${def.displayName}`,
    `  Use when: ${def.description}`,
  ];
  if (def.requiredFields && def.requiredFields.length > 0) {
    lines.push(`  Required fields: ${def.requiredFields.join(", ")}`);
  }
  if (def.example) {
    lines.push(`  Example: ${def.example}`);
  }
  return lines.join("\n");
}

export function buildComponentTypeCatalog(): string {
  const sections: string[] = [
    "## Available Component Types",
    "",
    "You MUST use the exact nodeType string when calling add_node.",
    "Never invent nodeType values.",
    "",
    "### Structural & Canvas Types",
  ];

  for (const definition of STRUCTURAL_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push("### C4 Architecture Types");
  for (const definition of C4_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  sections.push("");
  sections.push("### AWS Service Types");
  sections.push("Use these for AWS infrastructure components.");
  for (const definition of AWS_TYPES) {
    sections.push(formatTypeDef(definition));
  }

  return sections.join("\n");
}

export function isValidNodeType(nodeType: string): boolean {
  return ALL_COMPONENT_TYPES.some((definition) => definition.nodeType === nodeType);
}

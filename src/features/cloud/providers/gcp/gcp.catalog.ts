export type GcpCategoryId =
  | "gcp-compute"
  | "gcp-storage"
  | "gcp-database"
  | "gcp-networking"
  | "gcp-security"
  | "gcp-analytics"
  | "gcp-ai"
  | "gcp-devtools"
  | "gcp-integration"
  | "gcp-management"
  | "gcp-media"
  | "gcp-general";

export const GCP_CATEGORIES = [
  {
    id: "gcp-compute" as const,
    name: "Compute",
    services: [
      { id: "computeengine", name: "Compute Engine", iconName: "computeengine-512-color-rgb" },
      { id: "cloudrun", name: "Cloud Run", iconName: "cloudrun-512-color-rgb" },
      { id: "gke", name: "Google Kubernetes Engine", iconName: "gke-512-color" },
      { id: "containers", name: "Containers", iconName: "containers-512-color" },
      { id: "serverlesscomputing", name: "Serverless Computing", iconName: "serverlesscomputing-512-color" },
    ],
  },
  {
    id: "gcp-storage" as const,
    name: "Storage",
    services: [
      { id: "cloud-storage", name: "Cloud Storage", iconName: "cloud-storage-512-color" },
      { id: "hyperdisk", name: "Hyperdisk", iconName: "hyperdisk-512-color" },
      { id: "storage", name: "Storage", iconName: "storage-512-color" },
    ],
  },
  {
    id: "gcp-database" as const,
    name: "Databases",
    services: [
      { id: "bigquery", name: "BigQuery", iconName: "bigquery-512-color" },
      { id: "cloudsql", name: "Cloud SQL", iconName: "cloudsql-512-color" },
      { id: "cloudspanner", name: "Cloud Spanner", iconName: "cloudspanner-512-color" },
      { id: "alloydb", name: "AlloyDB", iconName: "alloydb-512-color" },
    ],
  },
  {
    id: "gcp-networking" as const,
    name: "Networking",
    services: [
      { id: "networking", name: "Networking", iconName: "networking-512-color-rgb" },
      { id: "hybridmulticloud", name: "Hybrid & Multi-Cloud", iconName: "hybridmulticloud-512-color" },
      { id: "distributedcloud", name: "Distributed Cloud", iconName: "distributedcloud-512-color" },
    ],
  },
  {
    id: "gcp-security" as const,
    name: "Security",
    services: [
      { id: "securityidentity", name: "Security & Identity", iconName: "securityidentity-512-color" },
      { id: "securitycommandcenter", name: "Security Command Center", iconName: "securitycommandcenter-512-color" },
      { id: "secops", name: "SecOps", iconName: "secops-512-color-rgb" },
      { id: "mandiant", name: "Mandiant", iconName: "mandiant-512-color" },
      { id: "threatintelligence", name: "Threat Intelligence", iconName: "threatintelligence-512-color" },
    ],
  },
  {
    id: "gcp-analytics" as const,
    name: "Analytics",
    services: [
      { id: "dataanalytics", name: "Data Analytics", iconName: "dataanalytics-512-color" },
      { id: "businessintelligence", name: "Business Intelligence", iconName: "businessintelligence-512-color" },
      { id: "looker", name: "Looker", iconName: "looker-512-color" },
      { id: "observability", name: "Observability", iconName: "observability-512-color" },
      { id: "operations", name: "Operations", iconName: "operations-512-color" },
    ],
  },
  {
    id: "gcp-ai" as const,
    name: "AI & Machine Learning",
    services: [
      { id: "aimachinelearning", name: "AI & Machine Learning", iconName: "aimachinelearning-512-color" },
      { id: "vertexai", name: "Vertex AI", iconName: "vertexai-512-color" },
      { id: "agents", name: "AI Agents", iconName: "agents-512-color" },
      { id: "aihypercomputer", name: "AI Hypercomputer", iconName: "aihypercomputer-512-color" },
    ],
  },
  {
    id: "gcp-devtools" as const,
    name: "Developer Tools",
    services: [
      { id: "developer-tools", name: "Developer Tools", iconName: "developer-tools-512-color" },
      { id: "devops", name: "DevOps", iconName: "devops-512-color" },
      { id: "apigee", name: "Apigee", iconName: "apigee-512-color-rgb" },
    ],
  },
  {
    id: "gcp-integration" as const,
    name: "Integration",
    services: [
      { id: "integrationservices", name: "Integration Services", iconName: "integrationservices-512-color" },
    ],
  },
  {
    id: "gcp-management" as const,
    name: "Management",
    services: [
      { id: "managementtools", name: "Management Tools", iconName: "managementtools-512-color" },
      { id: "marketplace", name: "Marketplace", iconName: "marketplace-512-color" },
    ],
  },
  {
    id: "gcp-media" as const,
    name: "Media",
    services: [
      { id: "mediaservices", name: "Media Services", iconName: "mediaservices-512-color" },
    ],
  },
  {
    id: "gcp-general" as const,
    name: "General",
    services: [
      { id: "collaboration", name: "Collaboration", iconName: "collaboration-512-color" },
      { id: "mapsgeospatial", name: "Maps & Geospatial", iconName: "mapsgeospatial-512-color" },
      { id: "webmobile", name: "Web & Mobile", iconName: "webmobile-512-color" },
      { id: "migration", name: "Migration", iconName: "migration-512-color" },
    ],
  },
] as const;

const _categoryMap = new Map<string, (typeof GCP_CATEGORIES)[number]>();
const _serviceMap = new Map<string, { id: string; name: string; iconName: string; categoryId: string }>();

for (const cat of GCP_CATEGORIES) {
  _categoryMap.set(cat.id, cat);
  for (const svc of cat.services) {
    _serviceMap.set(svc.id, { ...svc, categoryId: cat.id });
  }
}

export const GCP_CATEGORY_MAP = _categoryMap;
export const GCP_SERVICE_MAP = _serviceMap;

export const GCP_CATEGORY_ID_GENERAL = "gcp-general" as const satisfies GcpCategoryId;

export const isGcpType = (type: string): type is GcpCategoryId =>
  type.startsWith("gcp-");

export type AzureCategoryId =
  | "azure-compute"
  | "azure-storage"
  | "azure-database"
  | "azure-networking"
  | "azure-security"
  | "azure-analytics"
  | "azure-ai"
  | "azure-integration"
  | "azure-devtools"
  | "azure-iot"
  | "azure-management"
  | "azure-media"
  | "azure-general";

export const AZURE_CATEGORIES = [
  {
    id: "azure-compute" as const,
    name: "Compute",
    services: [
      { id: "virtualmachine", name: "Virtual Machine", iconName: "AzVirtualMachine" },
      { id: "cloudservice", name: "Cloud Service", iconName: "AzCloudService" },
      { id: "functions", name: "Azure Functions", iconName: "AzFunctions" },
      { id: "appservice", name: "App Service", iconName: "AzAppService" },
      { id: "batch", name: "Batch", iconName: "AzBatch" },
      { id: "containerservice", name: "Container Service", iconName: "AzContainerService" },
      { id: "containerregistry", name: "Container Registry", iconName: "AzContainerRegistry" },
      { id: "servicefabric", name: "Service Fabric", iconName: "AzServiceFabric" },
      { id: "vmscaleset", name: "VM Scale Set", iconName: "AzVMScaleSet" },
    ],
  },
  {
    id: "azure-storage" as const,
    name: "Storage",
    services: [
      { id: "storage", name: "Storage", iconName: "AzStorage" },
      { id: "storageblob", name: "Blob Storage", iconName: "AzStorageBlob" },
      { id: "storagefiles", name: "Files", iconName: "AzStorageFiles" },
      { id: "storagequeue", name: "Queue Storage", iconName: "AzStorageQueue" },
      { id: "storagetable", name: "Table Storage", iconName: "AzStorageTable" },
    ],
  },
  {
    id: "azure-database" as const,
    name: "Databases",
    services: [
      { id: "sqldatabase", name: "SQL Database", iconName: "AzSQLDatabase" },
      { id: "cosmosdb", name: "Cosmos DB", iconName: "AzDocumentDB" },
      { id: "datawarehouse", name: "Data Warehouse", iconName: "AzDataWarehouse" },
      { id: "databricks", name: "Databricks", iconName: "AzDatabricks" },
      { id: "datalakestore", name: "Data Lake Store", iconName: "AzDataLakeStore" },
      { id: "rediscache", name: "Redis Cache", iconName: "AzCacheincludingRedis" },
    ],
  },
  {
    id: "azure-networking" as const,
    name: "Networking",
    services: [
      { id: "virtualnetwork", name: "Virtual Network", iconName: "AzVirtualNetwork" },
      { id: "loadbalancer", name: "Load Balancer", iconName: "AzLoadBalancer" },
      { id: "vpngateway", name: "VPN Gateway", iconName: "AzVPNGateway" },
      { id: "expressroute", name: "Express Route", iconName: "AzExpressRoute" },
      { id: "trafficmanager", name: "Traffic Manager", iconName: "AzTrafficManager" },
      { id: "dns", name: "DNS", iconName: "AzDNS" },
      { id: "cdn", name: "Content Delivery Network", iconName: "AzContentDeliveryNetwork" },
      { id: "appgateway", name: "Application Gateway", iconName: "AzApplicationGateway" },
    ],
  },
  {
    id: "azure-security" as const,
    name: "Security",
    services: [
      { id: "securitycenter", name: "Security Center", iconName: "AzSecurityCenter" },
      { id: "keyvault", name: "Key Vault", iconName: "AzKeyVault" },
      { id: "activedirectory", name: "Active Directory", iconName: "ActiveDirectory" },
      { id: "mfa", name: "Multi-Factor Authentication", iconName: "AzMultiFactorAuthentication" },
      { id: "rightsmanagement", name: "Rights Management", iconName: "AzRightsManagement" },
    ],
  },
  {
    id: "azure-analytics" as const,
    name: "Analytics",
    services: [
      { id: "streamanalytics", name: "Stream Analytics", iconName: "AzStreamAnalytics" },
      { id: "datafactory", name: "Data Factory", iconName: "AzDataFactory" },
      { id: "hdinsight", name: "HDInsight", iconName: "AzHDInsight" },
      { id: "datalakeanalytics", name: "Data Lake Analytics", iconName: "AzDataLakeAnalytics" },
    ],
  },
  {
    id: "azure-ai" as const,
    name: "AI & Machine Learning",
    services: [
      { id: "machinelearning", name: "Machine Learning", iconName: "AzMachineLearning" },
      { id: "cognitiveservices", name: "Cognitive Services", iconName: "AzCognativeServices" },
      { id: "botservices", name: "Bot Services", iconName: "AzBotServices" },
    ],
  },
  {
    id: "azure-integration" as const,
    name: "Integration",
    services: [
      { id: "servicebus", name: "Service Bus", iconName: "AzServiceBus" },
      { id: "eventgrid", name: "Event Grid", iconName: "AzEventGrid" },
      { id: "eventhubs", name: "Event Hubs", iconName: "AzEventHubs" },
      { id: "logicapps", name: "Logic Apps", iconName: "AzLogicApps" },
      { id: "apimanagement", name: "API Management", iconName: "APIManagement" },
      { id: "notificationhubs", name: "Notification Hubs", iconName: "AzNotificationHubs" },
    ],
  },
  {
    id: "azure-devtools" as const,
    name: "Developer Tools",
    services: [
      { id: "devops", name: "Azure DevOps", iconName: "VisualStudioTeamServices" },
      { id: "devtestlabs", name: "Dev/Test Labs", iconName: "AzDevTestLabs" },
      { id: "appinsights", name: "Application Insights", iconName: "AzApplicationInsights" },
    ],
  },
  {
    id: "azure-iot" as const,
    name: "IoT",
    services: [
      { id: "iothub", name: "IoT Hub", iconName: "AzIoTHub" },
      { id: "iotcentral", name: "IoT Central", iconName: "IoTCentralFifty" },
    ],
  },
  {
    id: "azure-management" as const,
    name: "Management",
    services: [
      { id: "monitor", name: "Monitor", iconName: "AzMonitor" },
      { id: "automation", name: "Automation", iconName: "AzAutomation" },
      { id: "advisor", name: "Advisor", iconName: "AzAdvisor" },
      { id: "scheduler", name: "Scheduler", iconName: "AzScheduler" },
    ],
  },
  {
    id: "azure-media" as const,
    name: "Media",
    services: [
      { id: "mediaservices", name: "Media Services", iconName: "AzMediaServices" },
    ],
  },
  {
    id: "azure-general" as const,
    name: "General",
    services: [
      { id: "azure", name: "Azure", iconName: "Azure" },
    ],
  },
] as const;

const _categoryMap = new Map<string, (typeof AZURE_CATEGORIES)[number]>();
const _serviceMap = new Map<string, { id: string; name: string; iconName: string; categoryId: string }>();

for (const cat of AZURE_CATEGORIES) {
  _categoryMap.set(cat.id, cat);
  for (const svc of cat.services) {
    _serviceMap.set(svc.id, { ...svc, categoryId: cat.id });
  }
}

export const AZURE_CATEGORY_MAP = _categoryMap;
export const AZURE_SERVICE_MAP = _serviceMap;

export const AZURE_CATEGORY_ID_GENERAL = "azure-general" as const satisfies AzureCategoryId;

export const isAzureType = (type: string): type is AzureCategoryId =>
  type.startsWith("azure-");




export interface AwsService {
  id: string; 
  name: string; 
  iconName: string; 
}

export interface AwsCategory {
  id: string;
  name: string;
  services: AwsService[];
}

export const AWS_CATEGORIES: AwsCategory[] = [
  {
    id: "aws-compute",
    name: "Compute",
    services: [
      {
        id: "ec2",
        name: "Amazon EC2",
        iconName: "ArchitectureServiceAmazonEC2",
      },
      {
        id: "lambda",
        name: "AWS Lambda",
        iconName: "ArchitectureServiceAWSLambda",
      },
      {
        id: "ecs",
        name: "Amazon ECS",
        iconName: "ArchitectureServiceAmazonElasticContainerService",
      },
      {
        id: "eks",
        name: "Amazon EKS",
        iconName: "ArchitectureServiceAmazonElasticKubernetesService",
      },
      {
        id: "fargate",
        name: "AWS Fargate",
        iconName: "ArchitectureServiceAWSFargate",
      },
      {
        id: "elastic-beanstalk",
        name: "AWS Elastic Beanstalk",
        iconName: "ArchitectureServiceAWSElasticBeanstalk",
      },
      {
        id: "batch",
        name: "AWS Batch",
        iconName: "ArchitectureServiceAWSBatch",
      },
      {
        id: "lightsail",
        name: "Amazon Lightsail",
        iconName: "ArchitectureServiceAmazonLightsail",
      },
      {
        id: "app-runner",
        name: "AWS App Runner",
        iconName: "ArchitectureServiceAWSAppRunner",
      },
      {
        id: "auto-scaling",
        name: "AWS Auto Scaling",
        iconName: "ArchitectureServiceAWSAutoScaling",
      },
      {
        id: "compute-optimizer",
        name: "AWS Compute Optimizer",
        iconName: "ArchitectureServiceAWSComputeOptimizer",
      },
      {
        id: "ec2-image-builder",
        name: "EC2 Image Builder",
        iconName: "ArchitectureServiceAmazonEC2ImageBuilder",
      },
    ],
  },
  {
    id: "aws-storage",
    name: "Storage",
    services: [
      {
        id: "s3",
        name: "Amazon S3",
        iconName: "ArchitectureServiceAmazonSimpleStorageService",
      },
      {
        id: "ebs",
        name: "Amazon EBS",
        iconName: "ArchitectureServiceAmazonElasticBlockStore",
      },
      {
        id: "efs",
        name: "Amazon EFS",
        iconName: "ArchitectureServiceAmazonElasticFileSystem",
      },
      {
        id: "s3-glacier",
        name: "Amazon S3 Glacier",
        iconName: "ArchitectureServiceAmazonSimpleStorageServiceGlacier",
      },
      {
        id: "storage-gateway",
        name: "AWS Storage Gateway",
        iconName: "ArchitectureServiceAWSStorageGateway",
      },
      {
        id: "fsx",
        name: "Amazon FSx",
        iconName: "ArchitectureServiceAmazonFSx",
      },
      {
        id: "backup",
        name: "AWS Backup",
        iconName: "ArchitectureServiceAWSBackup",
      },
      {
        id: "datasync",
        name: "AWS DataSync",
        iconName: "ArchitectureServiceAWSDataSync",
      },
    ],
  },
  {
    id: "aws-database",
    name: "Database",
    services: [
      {
        id: "rds",
        name: "Amazon RDS",
        iconName: "ArchitectureServiceAmazonRDS",
      },
      {
        id: "dynamodb",
        name: "Amazon DynamoDB",
        iconName: "ArchitectureServiceAmazonDynamoDB",
      },
      {
        id: "elasticache",
        name: "Amazon ElastiCache",
        iconName: "ArchitectureServiceAmazonElastiCache",
      },
      {
        id: "redshift",
        name: "Amazon Redshift",
        iconName: "ArchitectureServiceAmazonRedshift",
      },
      {
        id: "aurora",
        name: "Amazon Aurora",
        iconName: "ArchitectureServiceAmazonAurora",
      },
      {
        id: "neptune",
        name: "Amazon Neptune",
        iconName: "ArchitectureServiceAmazonNeptune",
      },
      {
        id: "documentdb",
        name: "Amazon DocumentDB",
        iconName: "ArchitectureServiceAmazonDocumentDB",
      },
      {
        id: "keyspaces",
        name: "Amazon Keyspaces",
        iconName: "ArchitectureServiceAmazonKeyspaces",
      },
      {
        id: "timestream",
        name: "Amazon Timestream",
        iconName: "ArchitectureServiceAmazonTimestream",
      },
      {
        id: "memorydb",
        name: "Amazon MemoryDB",
        iconName: "ArchitectureServiceAmazonMemoryDBforRedis",
      },
      {
        id: "dms",
        name: "AWS DMS",
        iconName: "ArchitectureServiceAWSDatabaseMigrationService",
      },
    ],
  },
  {
    id: "aws-networking",
    name: "Networking & Content Delivery",
    services: [
      {
        id: "vpc",
        name: "Amazon VPC",
        iconName: "ArchitectureServiceAmazonVirtualPrivateCloud",
      },
      {
        id: "cloudfront",
        name: "Amazon CloudFront",
        iconName: "ArchitectureServiceAmazonCloudFront",
      },
      {
        id: "route53",
        name: "Amazon Route 53",
        iconName: "ArchitectureServiceAmazonRoute53",
      },
      {
        id: "api-gateway",
        name: "Amazon API Gateway",
        iconName: "ArchitectureServiceAmazonAPIGateway",
      },
      {
        id: "elb",
        name: "Elastic Load Balancing",
        iconName: "ArchitectureServiceElasticLoadBalancing",
      },
      {
        id: "direct-connect",
        name: "AWS Direct Connect",
        iconName: "ArchitectureServiceAWSDirectConnect",
      },
      {
        id: "transit-gateway",
        name: "AWS Transit Gateway",
        iconName: "ArchitectureServiceAWSTransitGateway",
      },
      {
        id: "global-accelerator",
        name: "AWS Global Accelerator",
        iconName: "ArchitectureServiceAWSGlobalAccelerator",
      },
      {
        id: "app-mesh",
        name: "AWS App Mesh",
        iconName: "ArchitectureServiceAWSAppMesh",
      },
      {
        id: "cloud-map",
        name: "AWS Cloud Map",
        iconName: "ArchitectureServiceAWSCloudMap",
      },
      {
        id: "client-vpn",
        name: "AWS Client VPN",
        iconName: "ArchitectureServiceAWSClientVPN",
      },
      {
        id: "cloud-wan",
        name: "AWS Cloud WAN",
        iconName: "ArchitectureServiceAWSCloudWAN",
      },
      {
        id: "privatelink",
        name: "AWS PrivateLink",
        iconName: "ArchitectureServiceAWSPrivateLink",
      },
    ],
  },
  {
    id: "aws-security",
    name: "Security, Identity & Compliance",
    services: [
      {
        id: "iam",
        name: "AWS IAM",
        iconName: "ArchitectureServiceAWSIdentityandAccessManagement",
      },
      {
        id: "cognito",
        name: "Amazon Cognito",
        iconName: "ArchitectureServiceAmazonCognito",
      },
      {
        id: "guardduty",
        name: "Amazon GuardDuty",
        iconName: "ArchitectureServiceAmazonGuardDuty",
      },
      {
        id: "inspector",
        name: "Amazon Inspector",
        iconName: "ArchitectureServiceAmazonInspector",
      },
      {
        id: "macie",
        name: "Amazon Macie",
        iconName: "ArchitectureServiceAmazonMacie",
      },
      { id: "waf", name: "AWS WAF", iconName: "ArchitectureServiceAWSWAF" },
      {
        id: "shield",
        name: "AWS Shield",
        iconName: "ArchitectureServiceAWSShield",
      },
      {
        id: "kms",
        name: "AWS KMS",
        iconName: "ArchitectureServiceAWSKeyManagementService",
      },
      {
        id: "secrets-manager",
        name: "AWS Secrets Manager",
        iconName: "ArchitectureServiceAWSSecretsManager",
      },
      {
        id: "acm",
        name: "AWS Certificate Manager",
        iconName: "ArchitectureServiceAWSCertificateManager",
      },
      {
        id: "firewall-manager",
        name: "AWS Firewall Manager",
        iconName: "ArchitectureServiceAWSFirewallManager",
      },
      {
        id: "security-hub",
        name: "AWS Security Hub",
        iconName: "ArchitectureServiceAWSSecurityHub",
      },
      {
        id: "detective",
        name: "Amazon Detective",
        iconName: "ArchitectureServiceAmazonDetective",
      },
      {
        id: "cloudhsm",
        name: "AWS CloudHSM",
        iconName: "ArchitectureServiceAWSCloudHSM",
      },
      {
        id: "iam-identity-center",
        name: "IAM Identity Center",
        iconName: "ArchitectureServiceAWSIAMIdentityCenter",
      },
      {
        id: "directory-service",
        name: "AWS Directory Service",
        iconName: "ArchitectureServiceAWSDirectoryService",
      },
      {
        id: "audit-manager",
        name: "AWS Audit Manager",
        iconName: "ArchitectureServiceAWSAuditManager",
      },
      {
        id: "artifact",
        name: "AWS Artifact",
        iconName: "ArchitectureServiceAWSArtifact",
      },
    ],
  },
  {
    id: "aws-analytics",
    name: "Analytics",
    services: [
      {
        id: "athena",
        name: "Amazon Athena",
        iconName: "ArchitectureServiceAmazonAthena",
      },
      {
        id: "emr",
        name: "Amazon EMR",
        iconName: "ArchitectureServiceAmazonEMR",
      },
      {
        id: "kinesis",
        name: "Amazon Kinesis",
        iconName: "ArchitectureServiceAmazonKinesis",
      },
      {
        id: "quicksight",
        name: "Amazon QuickSight",
        iconName: "ArchitectureServiceAmazonQuickSight",
      },
      { id: "glue", name: "AWS Glue", iconName: "ArchitectureServiceAWSGlue" },
      {
        id: "lake-formation",
        name: "AWS Lake Formation",
        iconName: "ArchitectureServiceAWSLakeFormation",
      },
      {
        id: "opensearch",
        name: "Amazon OpenSearch",
        iconName: "ArchitectureServiceAmazonOpenSearchService",
      },
      {
        id: "data-exchange",
        name: "AWS Data Exchange",
        iconName: "ArchitectureServiceAWSDataExchange",
      },
      {
        id: "msk",
        name: "Amazon MSK",
        iconName: "ArchitectureServiceAmazonManagedStreamingforApacheKafka",
      },
      {
        id: "data-pipeline",
        name: "AWS Data Pipeline",
        iconName: "ArchitectureServiceAWSDataPipeline",
      },
      {
        id: "clean-rooms",
        name: "AWS Clean Rooms",
        iconName: "ArchitectureServiceAWSCleanRooms",
      },
    ],
  },
  {
    id: "aws-ml",
    name: "Machine Learning",
    services: [
      {
        id: "sagemaker",
        name: "Amazon SageMaker",
        iconName: "ArchitectureServiceAmazonSageMaker",
      },
      {
        id: "bedrock",
        name: "Amazon Bedrock",
        iconName: "ArchitectureServiceAmazonBedrock",
      },
      {
        id: "rekognition",
        name: "Amazon Rekognition",
        iconName: "ArchitectureServiceAmazonRekognition",
      },
      {
        id: "comprehend",
        name: "Amazon Comprehend",
        iconName: "ArchitectureServiceAmazonComprehend",
      },
      {
        id: "polly",
        name: "Amazon Polly",
        iconName: "ArchitectureServiceAmazonPolly",
      },
      {
        id: "transcribe",
        name: "Amazon Transcribe",
        iconName: "ArchitectureServiceAmazonTranscribe",
      },
      {
        id: "translate",
        name: "Amazon Translate",
        iconName: "ArchitectureServiceAmazonTranslate",
      },
      {
        id: "lex",
        name: "Amazon Lex",
        iconName: "ArchitectureServiceAmazonLex",
      },
      {
        id: "textract",
        name: "Amazon Textract",
        iconName: "ArchitectureServiceAmazonTextract",
      },
      {
        id: "personalize",
        name: "Amazon Personalize",
        iconName: "ArchitectureServiceAmazonPersonalize",
      },
      {
        id: "forecast",
        name: "Amazon Forecast",
        iconName: "ArchitectureServiceAmazonForecast",
      },
      {
        id: "kendra",
        name: "Amazon Kendra",
        iconName: "ArchitectureServiceAmazonKendra",
      },
      { id: "q", name: "Amazon Q", iconName: "ArchitectureServiceAmazonQ" },
    ],
  },
  {
    id: "aws-integration",
    name: "Application Integration",
    services: [
      {
        id: "sqs",
        name: "Amazon SQS",
        iconName: "ArchitectureServiceAmazonSimpleQueueService",
      },
      {
        id: "sns",
        name: "Amazon SNS",
        iconName: "ArchitectureServiceAmazonSimpleNotificationService",
      },
      {
        id: "eventbridge",
        name: "Amazon EventBridge",
        iconName: "ArchitectureServiceAmazonEventBridge",
      },
      {
        id: "step-functions",
        name: "AWS Step Functions",
        iconName: "ArchitectureServiceAWSStepFunctions",
      },
      {
        id: "appsync",
        name: "AWS AppSync",
        iconName: "ArchitectureServiceAWSAppSync",
      },
      { id: "mq", name: "Amazon MQ", iconName: "ArchitectureServiceAmazonMQ" },
    ],
  },
  {
    id: "aws-management",
    name: "Management & Governance",
    services: [
      {
        id: "cloudwatch",
        name: "Amazon CloudWatch",
        iconName: "ArchitectureServiceAmazonCloudWatch",
      },
      {
        id: "cloudformation",
        name: "AWS CloudFormation",
        iconName: "ArchitectureServiceAWSCloudFormation",
      },
      {
        id: "cloudtrail",
        name: "AWS CloudTrail",
        iconName: "ArchitectureServiceAWSCloudTrail",
      },
      {
        id: "systems-manager",
        name: "AWS Systems Manager",
        iconName: "ArchitectureServiceAWSSystemsManager",
      },
      {
        id: "config",
        name: "AWS Config",
        iconName: "ArchitectureServiceAWSConfig",
      },
      {
        id: "organizations",
        name: "AWS Organizations",
        iconName: "ArchitectureServiceAWSOrganizations",
      },
      {
        id: "control-tower",
        name: "AWS Control Tower",
        iconName: "ArchitectureServiceAWSControlTower",
      },
      {
        id: "trusted-advisor",
        name: "AWS Trusted Advisor",
        iconName: "ArchitectureServiceAWSTrustedAdvisor",
      },
      {
        id: "service-catalog",
        name: "AWS Service Catalog",
        iconName: "ArchitectureServiceAWSServiceCatalog",
      },
      {
        id: "health-dashboard",
        name: "AWS Health Dashboard",
        iconName: "ArchitectureServiceAWSHealthDashboard",
      },
      {
        id: "cost-explorer",
        name: "AWS Cost Explorer",
        iconName: "ArchitectureServiceAWSCostExplorer",
      },
    ],
  },
  {
    id: "aws-developer",
    name: "Developer Tools",
    services: [
      {
        id: "codebuild",
        name: "AWS CodeBuild",
        iconName: "ArchitectureServiceAWSCodeBuild",
      },
      {
        id: "codepipeline",
        name: "AWS CodePipeline",
        iconName: "ArchitectureServiceAWSCodePipeline",
      },
      {
        id: "codedeploy",
        name: "AWS CodeDeploy",
        iconName: "ArchitectureServiceAWSCodeDeploy",
      },
      {
        id: "codecommit",
        name: "AWS CodeCommit",
        iconName: "ArchitectureServiceAWSCodeCommit",
      },
      {
        id: "codeartifact",
        name: "AWS CodeArtifact",
        iconName: "ArchitectureServiceAWSCodeArtifact",
      },
      {
        id: "cloud9",
        name: "AWS Cloud9",
        iconName: "ArchitectureServiceAWSCloud9",
      },
      { id: "xray", name: "AWS X-Ray", iconName: "ArchitectureServiceAWSXRay" },
      {
        id: "cdk",
        name: "AWS CDK",
        iconName: "ArchitectureServiceAWSCloudDevelopmentKit",
      },
      {
        id: "cli",
        name: "AWS CLI",
        iconName: "ArchitectureServiceAWSCommandLineInterface",
      },
      {
        id: "amplify",
        name: "AWS Amplify",
        iconName: "ArchitectureServiceAWSAmplify",
      },
    ],
  },
  {
    id: "aws-containers",
    name: "Containers",
    services: [
      {
        id: "ecr",
        name: "Amazon ECR",
        iconName: "ArchitectureServiceAmazonElasticContainerRegistry",
      },
      {
        id: "ecs-2",
        name: "Amazon ECS",
        iconName: "ArchitectureServiceAmazonElasticContainerService",
      },
      {
        id: "eks-2",
        name: "Amazon EKS",
        iconName: "ArchitectureServiceAmazonElasticKubernetesService",
      },
      {
        id: "fargate-2",
        name: "AWS Fargate",
        iconName: "ArchitectureServiceAWSFargate",
      },
    ],
  },
  {
    id: "aws-media",
    name: "Media Services",
    services: [
      {
        id: "media-convert",
        name: "AWS Elemental MediaConvert",
        iconName: "ArchitectureServiceAWSElementalMediaConvert",
      },
      {
        id: "media-live",
        name: "AWS Elemental MediaLive",
        iconName: "ArchitectureServiceAWSElementalMediaLive",
      },
      {
        id: "media-package",
        name: "AWS Elemental MediaPackage",
        iconName: "ArchitectureServiceAWSElementalMediaPackage",
      },
      {
        id: "media-store",
        name: "AWS Elemental MediaStore",
        iconName: "ArchitectureServiceAWSElementalMediaStore",
      },
      {
        id: "media-connect",
        name: "AWS Elemental MediaConnect",
        iconName: "ArchitectureServiceAWSElementalMediaConnect",
      },
      {
        id: "ivs",
        name: "Amazon IVS",
        iconName: "ArchitectureServiceAmazonInteractiveVideoService",
      },
    ],
  },
  {
    id: "aws-migration",
    name: "Migration & Transfer",
    services: [
      {
        id: "migration-hub",
        name: "AWS Migration Hub",
        iconName: "ArchitectureServiceAWSMigrationHub",
      },
      {
        id: "app-migration",
        name: "AWS Application Migration",
        iconName: "ArchitectureServiceAWSApplicationMigrationService",
      },
      {
        id: "app-discovery",
        name: "AWS Application Discovery",
        iconName: "ArchitectureServiceAWSApplicationDiscoveryService",
      },
      {
        id: "transfer-family",
        name: "AWS Transfer Family",
        iconName: "ArchitectureServiceAWSTransferFamily",
      },
      {
        id: "snowball",
        name: "AWS Snow Family",
        iconName: "ArchitectureServiceAWSSnowFamily",
      },
    ],
  },
  {
    id: "aws-iot",
    name: "Internet of Things",
    services: [
      {
        id: "iot-core",
        name: "AWS IoT Core",
        iconName: "ArchitectureServiceAWSIoTCore",
      },
      {
        id: "iot-greengrass",
        name: "AWS IoT Greengrass",
        iconName: "ArchitectureServiceAWSIoTGreengrass",
      },
      {
        id: "iot-analytics",
        name: "AWS IoT Analytics",
        iconName: "ArchitectureServiceAWSIoTAnalytics",
      },
      {
        id: "iot-events",
        name: "AWS IoT Events",
        iconName: "ArchitectureServiceAWSIoTEvents",
      },
      {
        id: "iot-sitewise",
        name: "AWS IoT SiteWise",
        iconName: "ArchitectureServiceAWSIoTSiteWise",
      },
      {
        id: "iot-twinmaker",
        name: "AWS IoT TwinMaker",
        iconName: "ArchitectureServiceAWSIoTTwinMaker",
      },
      {
        id: "iot-device-mgmt",
        name: "AWS IoT Device Mgmt",
        iconName: "ArchitectureServiceAWSIoTDeviceManagement",
      },
      {
        id: "iot-fleetwise",
        name: "AWS IoT FleetWise",
        iconName: "ArchitectureServiceAWSIoTFleetWise",
      },
    ],
  },
  {
    id: "aws-end-user",
    name: "End User Computing",
    services: [
      {
        id: "workspaces",
        name: "Amazon WorkSpaces",
        iconName: "ArchitectureServiceAmazonWorkSpaces",
      },
      {
        id: "appstream",
        name: "Amazon AppStream 2.0",
        iconName: "ArchitectureServiceAmazonAppStream",
      },
    ],
  },
  {
    id: "aws-general",
    name: "General / Infra",
    services: [
      {
        id: "aws-cloud",
        name: "AWS Cloud",
        iconName: "ArchitectureGroupAWSCloud",
      },
      {
        id: "aws-region",
        name: "AWS Region",
        iconName: "ArchitectureGroupRegion",
      },
      {
        id: "aws-vpc-group",
        name: "VPC",
        iconName: "ArchitectureGroupVirtualprivatecloudVPC",
      },
      {
        id: "aws-account",
        name: "AWS Account",
        iconName: "ArchitectureGroupAWSAccount",
      },
      {
        id: "private-subnet",
        name: "Private Subnet",
        iconName: "ArchitectureGroupPrivatesubnet",
      },
      {
        id: "public-subnet",
        name: "Public Subnet",
        iconName: "ArchitectureGroupPublicsubnet",
      },
    ],
  },
];


export const AWS_CATEGORY_MAP = new Map(AWS_CATEGORIES.map((c) => [c.id, c]));

const _serviceMap = new Map<string, AwsService & { categoryId: string }>();
AWS_CATEGORIES.forEach((cat) => {
  cat.services.forEach((svc) => {
    _serviceMap.set(svc.id, { ...svc, categoryId: cat.id });
  });
});
export const AWS_SERVICE_MAP = _serviceMap;


export type AwsCategoryId =
  | "aws-compute"
  | "aws-storage"
  | "aws-database"
  | "aws-networking"
  | "aws-security"
  | "aws-analytics"
  | "aws-ml"
  | "aws-integration"
  | "aws-management"
  | "aws-developer"
  | "aws-containers"
  | "aws-media"
  | "aws-migration"
  | "aws-iot"
  | "aws-general";


export const AWS_CATEGORY_ID_GENERAL = "aws-general" as const satisfies AwsCategoryId;


export const isAwsType = (type: string): type is AwsCategoryId =>
  type.startsWith("aws-");

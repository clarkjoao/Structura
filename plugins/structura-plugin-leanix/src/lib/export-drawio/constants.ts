import type { C4MetaInfo, AwsServiceInfo } from "./types";

/**
 * Grid and dimension configuration
 */
export const CONFIG = {
  minDimensions: {
    c4: { width: 240, height: 120 },
    aws: { width: 90, height: 120 },
  },
  grid: {
    dx: 1422,
    dy: 762,
    gridSize: 10,
    pageWidth: 1169,
    pageHeight: 827,
  },
  defaults: {
    panelColor: "#666666",
    noteWidth: 336,
    noteHeight: 475,
    panelWidth: 400,
    panelHeight: 300,
  },
} as const;

/**
 * Theme colors for C4, AWS, and connections
 */
export const THEME = {
  colors: {
    c4: {
      person: "#083F75",
      personStroke: "#06315C",
      system: "#1061B0",
      systemStroke: "#0D5091",
      container: "#23A2D9",
      containerStroke: "#0E7DAD",
      component: "#85BBF0",
      componentStroke: "#5D82A8",
    },
    aws: {
      compute: "#ED7100",
      storage: "#3F8624",
      database: "#C7131F",
      networking: "#8C4FFF",
      security: "#DD344C",
      analytics: "#8C4FFF",
      ml: "#01A88D",
      integration: "#E7157B",
      management: "#E7157B",
      developer: "#C7131F",
      containers: "#ED7100",
      media: "#8C4FFF",
      migration: "#8A6D3B",
      iot: "#1A9C3E",
      "end-user": "#ED7100",
      general: "#232F3E",
    },
  },
  fonts: {
    c4: { name: 16, type: 11, line2: 11, badge: 9 },
    aws: { name: 14, line2: 11, badge: 9 },
    edge: { label: 11 },
    panel: { title: 16, label: 11 },
  },
  strokes: {
    call: "#1f2937",
    event: "#6366f1",
    dataFlow: "#059669",
    asyncMessage: "#7c3aed",
    dependency: "#666666",
    default: "#666666",
  },
} as const;

/**
 * AWS category mapping
 */
export const AWS_CATEGORY_MAP_LOCAL: Record<string, string> = {
  "aws-compute": "compute",
  "aws-storage": "storage",
  "aws-database": "database",
  "aws-networking": "networking",
  "aws-security": "security",
  "aws-analytics": "analytics",
  "aws-ml": "ml",
  "aws-integration": "integration",
  "aws-management": "management",
  "aws-developer": "developer",
  "aws-containers": "containers",
  "aws-media": "media",
  "aws-migration": "migration",
  "aws-iot": "iot",
  "aws-end-user": "end-user",
  "aws-general": "general",
};

/**
 * AWS resource icon mapping for draw.io
 */
export const AWS_RESICON: Record<string, string> = {
  ec2: "ec2",
  lambda: "lambda",
  ecs: "ecs",
  eks: "eks",
  fargate: "fargate",
  "elastic-beanstalk": "elastic_beanstalk",
  batch: "batch",
  lightsail: "lightsail",
  "app-runner": "app_runner",
  "auto-scaling": "auto_scaling",
  s3: "s3",
  ebs: "ebs",
  efs: "efs",
  "s3-glacier": "s3_glacier",
  "storage-gateway": "storage_gateway",
  fsx: "fsx",
  backup: "backup",
  datasync: "datasync",
  rds: "rds",
  dynamodb: "dynamodb",
  elasticache: "elasticache",
  redshift: "redshift",
  aurora: "aurora",
  neptune: "neptune",
  documentdb: "documentdb",
  keyspaces: "keyspaces",
  timestream: "timestream",
  memorydb: "memorydb_for_redis",
  dms: "database_migration_service",
  vpc: "vpc",
  cloudfront: "cloudfront",
  route53: "route_53",
  "api-gateway": "api_gateway",
  elb: "elastic_load_balancing",
  "direct-connect": "direct_connect",
  "transit-gateway": "transit_gateway",
  iam: "iam",
  cognito: "cognito",
  guardduty: "guardduty",
  inspector: "inspector",
  macie: "macie",
  waf: "waf",
  shield: "shield",
  kms: "key_management_service",
  "secrets-manager": "secrets_manager",
  acm: "certificate_manager",
  athena: "athena",
  emr: "emr",
  kinesis: "kinesis",
  quicksight: "quicksight",
  glue: "glue",
  opensearch: "opensearch_service",
  sagemaker: "sagemaker",
  bedrock: "bedrock",
  rekognition: "rekognition",
  sqs: "sqs",
  sns: "sns",
  eventbridge: "event_bridge",
  "step-functions": "step_functions",
  appsync: "appsync",
  mq: "mq",
  cloudwatch: "cloudwatch",
  cloudformation: "cloudformation",
  cloudtrail: "cloudtrail",
  "systems-manager": "systems_manager",
  config: "config",
  organizations: "organizations",
  codebuild: "codebuild",
  codepipeline: "codepipeline",
  codedeploy: "codedeploy",
  codecommit: "codecommit",
  codeartifact: "codeartifact",
  cloud9: "cloud9",
  xray: "x_ray",
  cdk: "cloud_development_kit",
  amplify: "amplify",
  ecr: "ecr",
};

/**
 * C4 metadata for each component type
 */
export const C4_META: Record<string, C4MetaInfo> = {
  person: {
    fillColor: THEME.colors.c4.person,
    strokeColor: THEME.colors.c4.personStroke,
    fontColor: "#ffffff",
    width: 200,
    height: 180,
  },
  system: {
    fillColor: THEME.colors.c4.system,
    strokeColor: THEME.colors.c4.systemStroke,
    fontColor: "#ffffff",
    width: 240,
    height: 120,
  },
  container: {
    fillColor: THEME.colors.c4.container,
    strokeColor: THEME.colors.c4.containerStroke,
    fontColor: "#ffffff",
    width: 240,
    height: 120,
  },
  component: {
    fillColor: THEME.colors.c4.component,
    strokeColor: THEME.colors.c4.componentStroke,
    fontColor: "#000000",
    width: 240,
    height: 120,
  },
};

export const PERSON_POINTS =
  "points=[[0.5,0,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0]];";

export const BOX_POINTS =
  "points=[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];";

export const C4_SHAPE_POINTS: Record<string, string> = {
  person: PERSON_POINTS,
  system: BOX_POINTS,
  container: BOX_POINTS,
  component: BOX_POINTS,
};

export const C4_LABEL_TEMPLATE =
  '<font style="font-size:%fontSize%px"><b>%c4Name%</b></font>' +
  '<div><font style="font-size:11px">[%c4Type%]</font></div>' +
  "<br>" +
  '<div><font style="font-size:11px">%c4Line2%</font></div>' +
  "%c4RegistryBadge%";

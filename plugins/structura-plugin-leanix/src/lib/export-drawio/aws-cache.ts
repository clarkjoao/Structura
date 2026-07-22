import type { AwsServiceInfo } from "./types";
import { AWS_CATEGORY_MAP_LOCAL, AWS_RESICON, THEME } from "./constants";

/**
 * Simplified AWS service map for the plugin
 * Maps service IDs to their category IDs
 */
const AWS_SERVICE_MAP_LOCAL: Map<string, string> = new Map([
  // Compute
  ["ec2", "aws-compute"],
  ["lambda", "aws-compute"],
  ["ecs", "aws-compute"],
  ["eks", "aws-compute"],
  ["fargate", "aws-compute"],
  ["elastic-beanstalk", "aws-compute"],
  ["batch", "aws-compute"],
  ["lightsail", "aws-compute"],
  ["app-runner", "aws-compute"],
  // Storage
  ["s3", "aws-storage"],
  ["ebs", "aws-storage"],
  ["efs", "aws-storage"],
  ["s3-glacier", "aws-storage"],
  ["storage-gateway", "aws-storage"],
  ["fsx", "aws-storage"],
  // Database
  ["rds", "aws-database"],
  ["dynamodb", "aws-database"],
  ["elasticache", "aws-database"],
  ["redshift", "aws-database"],
  ["aurora", "aws-database"],
  ["neptune", "aws-database"],
  ["documentdb", "aws-database"],
  ["keyspaces", "aws-database"],
  ["timestream", "aws-database"],
  ["memorydb", "aws-database"],
  // Networking
  ["vpc", "aws-networking"],
  ["cloudfront", "aws-networking"],
  ["route53", "aws-networking"],
  ["api-gateway", "aws-networking"],
  ["elb", "aws-networking"],
  ["direct-connect", "aws-networking"],
  ["transit-gateway", "aws-networking"],
  // Security
  ["iam", "aws-security"],
  ["cognito", "aws-security"],
  ["guardduty", "aws-security"],
  ["waf", "aws-security"],
  ["kms", "aws-security"],
  ["secrets-manager", "aws-security"],
  // Analytics
  ["athena", "aws-analytics"],
  ["emr", "aws-analytics"],
  ["kinesis", "aws-analytics"],
  ["quicksight", "aws-analytics"],
  ["glue", "aws-analytics"],
  ["opensearch", "aws-analytics"],
  // ML
  ["sagemaker", "aws-ml"],
  ["bedrock", "aws-ml"],
  ["rekognition", "aws-ml"],
  // Integration
  ["sqs", "aws-integration"],
  ["sns", "aws-integration"],
  ["eventbridge", "aws-integration"],
  ["step-functions", "aws-integration"],
  ["appsync", "aws-integration"],
  ["mq", "aws-integration"],
  // Management
  ["cloudwatch", "aws-management"],
  ["cloudformation", "aws-management"],
  ["cloudtrail", "aws-management"],
  ["systems-manager", "aws-management"],
  // Developer
  ["codebuild", "aws-developer"],
  ["codepipeline", "aws-developer"],
  ["codedeploy", "aws-developer"],
  ["codecommit", "aws-developer"],
  ["codeartifact", "aws-developer"],
  ["cloud9", "aws-developer"],
  ["xray", "aws-developer"],
  // Containers
  ["ecr", "aws-containers"],
]);

/**
 * Cache for AWS service info
 */
export class AwsServiceCache {
  private cache = new Map<string, AwsServiceInfo>();

  getInfo(serviceId: string): AwsServiceInfo {
    if (!this.cache.has(serviceId)) {
      const categoryId = AWS_SERVICE_MAP_LOCAL.get(serviceId) ?? "aws-general";
      const categoryKey = AWS_CATEGORY_MAP_LOCAL[categoryId] ?? "general";
      const iconKey = AWS_RESICON[serviceId] ?? "general";

      this.cache.set(serviceId, {
        icon: iconKey,
        categoryId,
        color:
          THEME.colors.aws[categoryKey as keyof typeof THEME.colors.aws] ??
          THEME.colors.aws.general,
      });
    }
    return this.cache.get(serviceId)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const awsServiceCache = new AwsServiceCache();

/** localStorage key for last sidebar category */
export const LAST_CATEGORY_KEY = "structura:lastElementCategory";

/** Popular AWS services shown on the "All" tab (order preserved). */
export const AWS_SPOTLIGHT_IDS: string[] = [
  "ec2",
  "lambda",
  "s3",
  "rds",
  "elb",
  "ecs",
  "eks",
  "vpc",
  "cloudfront",
  "dynamodb",
  "sqs",
  "api-gateway",
];

export const REGISTRY_PREVIEW_LIMIT = 5;

/** Primary AWS groups shown first; remaining catalog categories roll into "Other". */
export const AWS_PRIMARY_CATEGORY_IDS: string[] = [
  "aws-compute",
  "aws-networking",
  "aws-storage",
  "aws-database",
  "aws-security",
  "aws-containers",
];

export const OTHER_AWS_SECTION_KEY = "__aws_other__";

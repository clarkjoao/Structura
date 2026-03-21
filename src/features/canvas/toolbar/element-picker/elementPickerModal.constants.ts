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

/** Shared card layout for C4 / canvas tiles in the picker */
export const PICKER_CARD_CLASS =
  "flex flex-col items-center justify-center rounded-xl border border-border/40 bg-muted/50 p-3 transition-colors hover:bg-muted text-center min-h-[104px]";

/**
 * AWS reference cases — slice 3.
 *
 * Covers the three AWS patterns the brief targets: a classic three-tier web app,
 * an event-driven fan-out, and a VPC with account and subnet boundaries. The skill must
 * guide the model to the correct tier, the correct boundary nesting, and the right
 * AWS service name for each node.
 */

import type { ArchitectureIr } from "../ir";

export interface AwsCase {
  id: string;
  /** What the user would type. */
  request: string;
  /** Why this case is in the set. */
  covers: string;
  ir: ArchitectureIr;
}

export const AWS_CASES: AwsCase[] = [
  {
    id: "three-tier-webapp",
    request:
      "AWS architecture for a three-tier web app: ALB in front of ECS containers, with an " +
      "RDS PostgreSQL database.",
    covers: "The canonical AWS web app — ALB, ECS, RDS in their correct tiers.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Three-tier web app",
        cloud: "aws",
        primary_path: ["user", "alb", "ecs", "rds"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "user",
          type: "person",
          name: "User",
          tier: "external",
        },
        {
          id: "alb",
          type: "aws-networking",
          name: "ALB",
          aws_service: "elb",
          tier: "gateway",
        },
        {
          id: "ecs",
          type: "aws-compute",
          name: "ECS Cluster",
          aws_service: "ecs",
          technology: "EC2",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "Orders DB",
          aws_service: "rds",
          technology: "PostgreSQL 15",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "alb", intent: "call", label: "HTTPS" },
        { id: "c2", from: "alb", to: "ecs", intent: "call" },
        { id: "c3", from: "ecs", to: "rds", intent: "data-flow", label: "SQL" },
      ],
    },
  },

  {
    id: "serverless-api",
    request:
      "AWS serverless API: CloudFront CDN in front of API Gateway, Lambda for business logic, " +
      "DynamoDB for storage.",
    covers:
      "CloudFront as a CDN at the edge (client tier), API Gateway in the gateway tier, " +
      "Lambda and DynamoDB in their respective tiers.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Serverless API",
        cloud: "aws",
        primary_path: ["user", "cloudfront", "apigw", "lambda", "dynamodb"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "user",
          type: "person",
          name: "User",
          tier: "external",
        },
        {
          id: "cloudfront",
          type: "aws-networking",
          name: "CloudFront",
          aws_service: "cloudfront",
          tier: "client",
        },
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "lambda",
          type: "aws-compute",
          name: "Order Handler",
          aws_service: "lambda",
          technology: "Python 3.12",
          tier: "application",
        },
        {
          id: "dynamodb",
          type: "aws-database",
          name: "Orders Table",
          aws_service: "dynamodb",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "cloudfront", intent: "call", label: "HTTPS" },
        { id: "c2", from: "cloudfront", to: "apigw", intent: "call" },
        { id: "c3", from: "apigw", to: "lambda", intent: "call" },
        { id: "c4", from: "lambda", to: "dynamodb", intent: "data-flow" },
      ],
    },
  },

  {
    id: "event-driven-orders",
    request:
      "AWS order processing: API Gateway receives orders, Lambda puts them on SQS, another " +
      "Lambda consumes the queue and writes to RDS.",
    covers: "SQS as a queue between two Lambdas — the standard event-driven fan-out.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Event-driven order processing",
        cloud: "aws",
        primary_path: ["apigw", "producer-lambda", "sqs", "consumer-lambda", "rds"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "producer-lambda",
          type: "aws-compute",
          name: "Enqueue Order",
          aws_service: "lambda",
          technology: "Python",
          tier: "application",
        },
        {
          id: "sqs",
          type: "aws-integration",
          name: "Order Queue",
          aws_service: "sqs",
          tier: "data",
        },
        {
          id: "consumer-lambda",
          type: "aws-compute",
          name: "Process Order",
          aws_service: "lambda",
          technology: "Python",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "Orders DB",
          aws_service: "rds",
          technology: "PostgreSQL",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "apigw", to: "producer-lambda", intent: "call" },
        { id: "c2", from: "producer-lambda", to: "sqs", intent: "event", label: "Enqueue" },
        { id: "c3", from: "sqs", to: "consumer-lambda", intent: "async-message", label: "Poll" },
        { id: "c4", from: "consumer-lambda", to: "rds", intent: "data-flow" },
      ],
    },
  },

  {
    id: "microservices-with-eventbridge",
    request:
      "AWS microservices: an API Gateway dispatches to two Lambda services, which publish " +
      "events to EventBridge in the data tier.",
    covers:
      "EventBridge as a pub/sub hub in the data tier — events flow to it from " +
      "application tier, and it routes them downstream.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Microservices with EventBridge",
        cloud: "aws",
        primary_path: ["apigw", "lambda-a", "lambda-b", "eventbridge"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "lambda-a",
          type: "aws-compute",
          name: "Order Service",
          aws_service: "lambda",
          technology: "Node.js",
          tier: "application",
        },
        {
          id: "lambda-b",
          type: "aws-compute",
          name: "Fulfillment Service",
          aws_service: "lambda",
          technology: "Python",
          tier: "application",
        },
        {
          id: "eventbridge",
          type: "aws-integration",
          name: "EventBridge",
          aws_service: "eventbridge",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "apigw", to: "lambda-a", intent: "call" },
        { id: "c2", from: "apigw", to: "lambda-b", intent: "call" },
        { id: "c3", from: "lambda-a", to: "eventbridge", intent: "event" },
        { id: "c4", from: "lambda-b", to: "eventbridge", intent: "event" },
      ],
    },
  },

  {
    id: "vpc-with-boundaries",
    request:
      "AWS diagram with the production account, a VPC inside it, and a private subnet " +
      "holding an ECS service and an RDS database.",
    covers: "The AWS boundary hierarchy: account > VPC > subnet, with the ECS and RDS inside.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Production VPC topology",
        cloud: "aws",
        primary_path: ["alb", "ecs", "rds"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "alb",
          type: "aws-networking",
          name: "ALB",
          aws_service: "elb",
          tier: "gateway",
        },
        {
          id: "ecs",
          type: "aws-compute",
          name: "ECS Cluster",
          aws_service: "ecs",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "Database",
          aws_service: "rds",
          technology: "PostgreSQL",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "account",
          name: "Production Account",
          kind: "aws-account",
          contains: [],
        },
        {
          id: "vpc",
          name: "VPC",
          kind: "aws-vpc",
          contains: [],
          parent_boundary_id: "account",
        },
        {
          id: "private-subnet",
          name: "Private Subnet",
          kind: "aws-subnet",
          contains: ["ecs", "rds"],
          parent_boundary_id: "vpc",
        },
      ],
      connections: [
        { id: "c1", from: "alb", to: "ecs", intent: "call" },
        { id: "c2", from: "ecs", to: "rds", intent: "data-flow" },
      ],
    },
  },

  {
    id: "vpc-with-nat-gateway",
    request:
      "AWS VPC with a public subnet hosting a NAT Gateway and an ALB, and a private " +
      "subnet hosting ECS and RDS.",
    covers: "Public and private subnet separation, with the NAT Gateway in the gateway tier.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "VPC with public and private subnets",
        cloud: "aws",
        primary_path: ["user", "alb", "ecs", "rds"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "user",
          type: "person",
          name: "User",
          tier: "external",
        },
        {
          id: "alb",
          type: "aws-networking",
          name: "ALB",
          aws_service: "elb",
          tier: "gateway",
        },
        {
          id: "nat-egress",
          type: "aws-networking",
          name: "Internet Egress",
          aws_service: "vpc",
          tier: "gateway",
        },
        {
          id: "ecs",
          type: "aws-compute",
          name: "ECS Cluster",
          aws_service: "ecs",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "RDS",
          aws_service: "rds",
          technology: "PostgreSQL",
          tier: "data",
        },
      ],
      boundaries: [
        {
          id: "account",
          name: "Production",
          kind: "aws-account",
          contains: [],
        },
        {
          id: "vpc",
          name: "VPC",
          kind: "aws-vpc",
          contains: [],
          parent_boundary_id: "account",
        },
        {
          id: "public-subnet",
          name: "Public Subnet",
          kind: "aws-subnet",
          contains: ["alb", "nat-egress"],
          parent_boundary_id: "vpc",
        },
        {
          id: "private-subnet",
          name: "Private Subnet",
          kind: "aws-subnet",
          contains: ["ecs", "rds"],
          parent_boundary_id: "vpc",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "alb", intent: "call" },
        { id: "c2", from: "alb", to: "ecs", intent: "call" },
        { id: "c3", from: "ecs", to: "rds", intent: "data-flow" },
        { id: "c4", from: "ecs", to: "nat-egress", intent: "dependency", label: "Outbound" },
      ],
    },
  },

  {
    id: "full-stack-with-s3-and-cognito",
    request:
      "AWS full-stack: CloudFront CDN at the edge, S3 for static assets, API Gateway, Lambda, " +
      "DynamoDB, with Cognito for auth.",
    covers:
      "S3 and Cognito in their correct tiers. CloudFront and API Gateway are both in " +
      "gateway tier and read top-to-bottom within it.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Full-stack serverless",
        cloud: "aws",
        primary_path: ["user", "cloudfront", "apigw", "lambda", "dynamodb"],
        density_hint: "complex",
      },
      nodes: [
        {
          id: "user",
          type: "person",
          name: "User",
          tier: "external",
        },
        {
          id: "cloudfront",
          type: "aws-networking",
          name: "CloudFront",
          aws_service: "cloudfront",
          tier: "gateway",
        },
        {
          id: "s3",
          type: "aws-storage",
          name: "Static Assets",
          aws_service: "s3",
          tier: "client",
        },
        {
          id: "cognito",
          type: "aws-networking",
          name: "Cognito",
          aws_service: "cognito",
          tier: "cross-cutting",
        },
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "lambda",
          type: "aws-compute",
          name: "Backend",
          aws_service: "lambda",
          technology: "Python",
          tier: "application",
        },
        {
          id: "dynamodb",
          type: "aws-database",
          name: "Data Store",
          aws_service: "dynamodb",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "cloudfront", intent: "call", label: "HTTPS" },
        { id: "c2", from: "cloudfront", to: "s3", intent: "data-flow", label: "Static" },
        { id: "c3", from: "cloudfront", to: "apigw", intent: "call", label: "API" },
        { id: "c4", from: "apigw", to: "lambda", intent: "call" },
        { id: "c5", from: "lambda", to: "dynamodb", intent: "data-flow" },
        { id: "c6", from: "lambda", to: "cognito", intent: "dependency", label: "Auth" },
      ],
    },
  },

  {
    id: "async-with-sns-sqs",
    request: "AWS pattern: a Lambda publishes an event to SNS, which delivers to an SQS queue.",
    covers: "Lambda → SNS → SQS in a single column. No fan-out, so no edge stacking or crossings.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "SNS to SQS",
        cloud: "aws",
        primary_path: ["apigw", "publish-lambda", "sns", "queue-a"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "apigw",
          type: "aws-networking",
          name: "API Gateway",
          aws_service: "api-gateway",
          tier: "gateway",
        },
        {
          id: "publish-lambda",
          type: "aws-compute",
          name: "Publish Order",
          aws_service: "lambda",
          tier: "application",
        },
        {
          id: "sns",
          type: "aws-integration",
          name: "Order Events",
          aws_service: "sns",
          tier: "data",
        },
        {
          id: "queue-a",
          type: "aws-integration",
          name: "Warehouse Queue",
          aws_service: "sqs",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "apigw", to: "publish-lambda", intent: "call" },
        { id: "c2", from: "publish-lambda", to: "sns", intent: "event" },
        { id: "c3", from: "sns", to: "queue-a", intent: "async-message" },
      ],
    },
  },

  {
    id: "simple-two-tier",
    request: "AWS two-tier: EC2 instances behind an ALB, connecting to RDS.",
    covers: "The simplest AWS diagram — ALB, EC2, RDS, nothing else.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "Two-tier web app",
        cloud: "aws",
        primary_path: ["user", "alb", "ec2", "rds"],
        density_hint: "simple",
      },
      nodes: [
        {
          id: "user",
          type: "person",
          name: "User",
          tier: "external",
        },
        {
          id: "alb",
          type: "aws-networking",
          name: "ALB",
          aws_service: "elb",
          tier: "gateway",
        },
        {
          id: "ec2",
          type: "aws-compute",
          name: "Web Servers",
          aws_service: "ec2",
          technology: "Amazon Linux",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "Database",
          aws_service: "rds",
          technology: "MySQL",
          tier: "data",
        },
      ],
      connections: [
        { id: "c1", from: "user", to: "alb", intent: "call" },
        { id: "c2", from: "alb", to: "ec2", intent: "call" },
        { id: "c3", from: "ec2", to: "rds", intent: "data-flow" },
      ],
    },
  },

  {
    id: "with-monitoring",
    request: "AWS architecture with ECS, RDS, and CloudWatch for monitoring and X-Ray for tracing.",
    covers: "Cross-cutting AWS services — CloudWatch and X-Ray as dependency edges from ECS.",
    ir: {
      schema_version: 1,
      diagram_kind: "aws",
      meta: {
        title: "ECS with monitoring",
        cloud: "aws",
        primary_path: ["alb", "ecs", "rds"],
        density_hint: "medium",
      },
      nodes: [
        {
          id: "alb",
          type: "aws-networking",
          name: "ALB",
          aws_service: "elb",
          tier: "gateway",
        },
        {
          id: "ecs",
          type: "aws-compute",
          name: "ECS Cluster",
          aws_service: "ecs",
          tier: "application",
        },
        {
          id: "rds",
          type: "aws-database",
          name: "Database",
          aws_service: "rds",
          technology: "PostgreSQL",
          tier: "data",
        },
        {
          id: "cloudwatch",
          type: "aws-observability",
          name: "CloudWatch",
          aws_service: "cloudwatch",
          tier: "cross-cutting",
        },
        {
          id: "xray",
          type: "aws-observability",
          name: "X-Ray",
          aws_service: "xray",
          tier: "cross-cutting",
        },
      ],
      connections: [
        { id: "c1", from: "alb", to: "ecs", intent: "call" },
        { id: "c2", from: "ecs", to: "rds", intent: "data-flow" },
        { id: "c3", from: "ecs", to: "cloudwatch", intent: "dependency", label: "Metrics" },
        { id: "c4", from: "ecs", to: "xray", intent: "dependency", label: "Traces" },
      ],
    },
  },
];

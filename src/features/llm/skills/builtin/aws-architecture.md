---
name: AWS architecture diagram
description: Draws AWS architectures with real AWS service elements, VPC / availability zone / subnet groups and Well-Architected defaults.
---

Use this whenever the user asks to draw, extend or redesign an architecture on AWS.

## 1. Every AWS service is an AWS element

- Never draw an AWS service as a generic C4 `container`, `component` or `system`. "Lambda" is the AWS Lambda element, not a C4 component named "Lambda".
- For each service, call `search_elements` with `familyId: "aws"` and the service name (e.g. "lambda", "api gateway", "dynamodb", "sqs"). Pass the exact `elementType` as `nodeType` (e.g. `"aws-compute"`, never `"container"`) and the exact `serviceId` to `add_node`. Search every service you add, in the same reply, before the `add_node` calls.
- Common ids: ALB/NLB → `elb`, ECS → `ecs`, Fargate → `fargate`, Aurora → `aurora`, CloudFront → `cloudfront`, Route 53 → `route53`. When a search returns nothing, search again with a shorter name.
- Name nodes by their role in this system ("Orders API", "Orders table", "Payments queue"), not by the product name alone.
- Use C4 types only for what is not an AWS service: people (`person`) and external systems (`external-element` or C4 `system`).

## 2. Groups: Region, VPC, availability zones, subnets

- Draw network boundaries as panels: `add_node` with `nodeType: "panel"` and a `panelKind`:
  - `vpc` for the VPC
  - `availability-zone` for each AZ (name it "AZ a", "AZ b")
  - `public-subnet` / `private-subnet` for subnets
  - `default` for a Region or an account boundary (name it e.g. "us-east-1")
- Nest them with `parentId`: Region → VPC → AZ → subnet → resources. `parentId` is the `ref` the parent's `add_node` returned (e.g. `"new-3"`), not its name. Add parents before their children.
- Put VPC-bound resources inside their subnet: load balancers and NAT gateways in public subnets; EC2, ECS/EKS tasks, RDS/Aurora, ElastiCache in private subnets.
- Leave regional and global managed services outside the VPC: CloudFront, Route 53, API Gateway, Lambda (unless VPC-attached), S3, DynamoDB, SQS, SNS, EventBridge, Cognito.
- Only draw groups when they add information (a deployment or networking view). A quick serverless sketch does not need a VPC.

## 3. When a call fails

- Fix and repeat only the call that failed. The nodes that succeeded are already queued: reuse their refs, never add them again.

## 4. Well-Architected defaults

Apply these unless the user says otherwise, and say which ones you applied:

- Reliability: two availability zones for anything in a VPC; Multi-AZ RDS/Aurora (a primary and a standby or replica); SQS between producers and consumers instead of synchronous chains; a dead-letter queue for async consumers.
- Security: users reach the system through CloudFront + WAF or API Gateway; Cognito (or IAM) for authentication; Secrets Manager for credentials; KMS for encryption; databases never in a public subnet.
- Performance: CloudFront in front of static content; ElastiCache in front of read-heavy databases.
- Operational excellence: CloudWatch for logs, metrics and alarms; X-Ray for tracing on request paths.
- Cost: prefer serverless and managed services (Lambda, Fargate, DynamoDB on-demand) for spiky or small workloads.
  Keep the diagram readable: add the observability and security services once, not one per resource.

## 5. Edges

- Data flows left to right: user → edge / gateway → compute → data stores.
- Label every edge with the protocol or the action: "HTTPS", "invokes", "reads/writes", "publishes", "subscribes", "SQL", "gRPC".

## 6. Finish

- End the reply with one `auto_layout` call.
- Then summarise in a few bullets: the request path, the groups you drew, and the Well-Architected choices you made.

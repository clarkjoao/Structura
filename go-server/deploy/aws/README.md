# Deploying the Go relay on AWS

Two CloudFormation templates, one per mode. Both output `WebSocketUrl`: the URL people give the
app's **Live session** dialog. Both validate with `cfn-lint`.

## ECS Fargate — `ecs.yaml`

The long-lived relay behind an Application Load Balancer. Sockets need no session affinity: any
task serves any room through Redis.

```sh
# Image (the tasks run on ARM64).
aws ecr create-repository --repository-name structura-collab-relay
docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.<region>.amazonaws.com/structura-collab-relay:v1 --push ..

aws cloudformation deploy --stack-name structura-collab --template-file ecs.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Image=<account>.dkr.ecr.<region>.amazonaws.com/structura-collab-relay:v1 \
    VpcId=vpc-… PublicSubnetIds=subnet-a,subnet-b PrivateSubnetIds=subnet-c,subnet-d \
    CertificateArn=arn:aws:acm:…   # optional: wss:// on 443
```

- `Rooms=create-redis` (default) creates an ElastiCache Redis (primary + replica, TLS) and
  autoscales the service on CPU between `DesiredCount` and `MaxCount`.
- `Rooms=external-redis` with `ExternalRedisUrl` uses yours.
- `Rooms=memory` keeps rooms in a single task (`DesiredCount=1`): the cheapest, but a deploy or a
  task replacement ends every session.
- On SIGTERM a task stops advertising itself (`/health` answers 503), closes its sockets with
  1012, and its clients reconnect to another task within a second.

## Lambda + API Gateway — `lambda.yaml`

The relay as one function behind an API Gateway WebSocket API, rooms in DynamoDB, plus a
one-minute EventBridge schedule for the reaper.

```sh
# Either a container image…
aws ecr create-repository --repository-name structura-collab-lambda
docker buildx build --platform linux/arm64 -f ../Dockerfile.lambda \
  -t <account>.dkr.ecr.<region>.amazonaws.com/structura-collab-lambda:v1 --push ..
aws cloudformation deploy --stack-name structura-collab-sl --template-file lambda.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides ImageUri=<account>.dkr.ecr.<region>.amazonaws.com/structura-collab-lambda:v1

# …or a zip.
make -C .. lambda-zip                       # writes ../dist/lambda.zip (arm64)
aws s3 cp ../dist/lambda.zip s3://<bucket>/collab/lambda.zip
aws cloudformation deploy --stack-name structura-collab-sl --template-file lambda.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides CodeS3Bucket=<bucket> CodeS3Key=collab/lambda.zip
```

- The function gets `CALLBACK_URL` (the stage's `@connections` endpoint) from the template; with a
  custom domain for the API, keep it pointing at the `execute-api` URL.
- `RedisUrl` (with `SubnetIds` and `SecurityGroupIds`) keeps rooms in ElastiCache instead, for
  rooms where many people drag at once. The function then runs in your VPC and needs a NAT
  gateway to reach the API Gateway management endpoint and DynamoDB.
- Stage throttling (`ThrottleRate`, `ThrottleBurst`) caps messages per second for the whole API.

## Smoke test after a deploy

```sh
curl -s https://<alb-dns>/health                          # ECS: {"status":"ok",…,"store":"redis"}
cd ../../server
WS_URL=wss://… SCENARIOS=load TOTAL=60 ROOMS=6 BIG_ROOMS=1 BIG_SIZE=20 npm run loadtest
WS_URL=wss://… SCENARIOS=host-drop TOTAL=20 ROOMS=2 BIG_ROOMS=0 npm run loadtest
```

# Collaboration relay (Go). `make test` needs nothing; `make test-all` needs Redis and DynamoDB
# Local (see README).
GOARCH_LAMBDA ?= arm64
REDIS_URL ?= redis://localhost:6379
DYNAMODB_ENDPOINT ?= http://localhost:8000

.PHONY: test test-all cover vet build lambda-zip images lint-templates

vet:
	go vet ./...

test:
	go test -race ./...

test-all:
	REDIS_URL=$(REDIS_URL) DYNAMODB_ENDPOINT=$(DYNAMODB_ENDPOINT) go test -race -count=1 ./...

# Every package fully covered by its own tests (needs Redis and DynamoDB Local, like test-all).
# Writes coverage.out; fails, listing what is not covered, below 100%.
cover:
	REDIS_URL=$(REDIS_URL) DYNAMODB_ENDPOINT=$(DYNAMODB_ENDPOINT) go test -race -count=1 -coverprofile=coverage.out ./...
	@go tool cover -func=coverage.out | awk '$$NF != "100.0%" { print; short = 1 } END { exit short }' \
		|| { echo "coverage below 100%"; exit 1; }
	@echo "coverage: 100.0% of statements"

build:
	CGO_ENABLED=0 go build -trimpath -o dist/relay ./cmd/relay
	CGO_ENABLED=0 go build -trimpath -o dist/apigw-local ./cmd/apigw-local

# The Lambda zip: one `bootstrap` for the provided.al2023 runtime.
lambda-zip:
	mkdir -p dist/lambda
	CGO_ENABLED=0 GOOS=linux GOARCH=$(GOARCH_LAMBDA) go build -tags lambda.norpc -trimpath -ldflags="-s -w" -o dist/lambda/bootstrap ./cmd/lambda
	cd dist/lambda && zip -q -j ../lambda.zip bootstrap
	@echo dist/lambda.zip

images:
	docker build -t structura-collab-relay:local .
	docker build -f Dockerfile.lambda -t structura-collab-lambda:local .

lint-templates:
	cfn-lint deploy/aws/*.yaml

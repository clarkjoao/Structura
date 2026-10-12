package store

import (
	"context"
	"github.com/clarkjoao/structura/go-server/internal/awsx"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// NewDynamoClient builds a DynamoDB client from the environment. With an endpoint (DynamoDB
// Local) it uses static dummy credentials unless real ones are configured.
func NewDynamoClient(ctx context.Context, endpoint string) (*dynamodb.Client, error) {
	opts := awsx.LoadOptions()
	if os.Getenv("AWS_REGION") == "" && os.Getenv("AWS_DEFAULT_REGION") == "" {
		opts = append(opts, config.WithRegion("us-east-1"))
	}
	if endpoint != "" && os.Getenv("AWS_ACCESS_KEY_ID") == "" {
		opts = append(opts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("local", "local", "")))
	}
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg, func(o *dynamodb.Options) {
		if endpoint != "" {
			o.BaseEndpoint = aws.String(endpoint)
			// DynamoDB Local answers with checksums the SDK cannot match.
			o.DisableValidateResponseChecksum = true
		}
	}), nil
}

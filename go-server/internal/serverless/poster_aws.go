package serverless

import (
	"context"
	"errors"
	"github.com/clarkjoao/structura/go-server/internal/awsx"
	"os"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi"
	"github.com/aws/aws-sdk-go-v2/service/apigatewaymanagementapi/types"
	"github.com/aws/smithy-go"
)

// AWSPoster sends through the API Gateway management API (`@connections`).
type AWSPoster struct {
	cfg     aws.Config
	fixed   string
	mu      sync.Mutex
	clients map[string]*apigatewaymanagementapi.Client
}

// NewAWSPoster posts to callbackURL when set (CALLBACK_URL: a custom domain, or the local
// emulator); otherwise to the endpoint of the invocation's own API (see WithEndpoint).
func NewAWSPoster(ctx context.Context, callbackURL string) (*AWSPoster, error) {
	opts := awsx.LoadOptions()
	if os.Getenv("AWS_REGION") == "" && os.Getenv("AWS_DEFAULT_REGION") == "" {
		opts = append(opts, config.WithRegion("us-east-1"))
	}
	if callbackURL != "" && strings.HasPrefix(callbackURL, "http://") && os.Getenv("AWS_ACCESS_KEY_ID") == "" {
		opts = append(opts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("local", "local", "")))
	}
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, err
	}
	return &AWSPoster{cfg: cfg, fixed: strings.TrimRight(callbackURL, "/"), clients: map[string]*apigatewaymanagementapi.Client{}}, nil
}

type endpointKey struct{}

// WithEndpoint carries the invocation's API endpoint (https://<domain>/<stage>).
func WithEndpoint(ctx context.Context, endpoint string) context.Context {
	return context.WithValue(ctx, endpointKey{}, endpoint)
}

func (p *AWSPoster) client(ctx context.Context) (*apigatewaymanagementapi.Client, error) {
	endpoint := p.fixed
	if endpoint == "" {
		endpoint, _ = ctx.Value(endpointKey{}).(string)
	}
	if endpoint == "" {
		return nil, errors.New("serverless: no API Gateway endpoint (set CALLBACK_URL)")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if c := p.clients[endpoint]; c != nil {
		return c, nil
	}
	c := apigatewaymanagementapi.NewFromConfig(p.cfg, func(o *apigatewaymanagementapi.Options) {
		o.BaseEndpoint = aws.String(endpoint)
	})
	p.clients[endpoint] = c
	return c, nil
}

func translate(err error) error {
	if err == nil {
		return nil
	}
	var gone *types.GoneException
	if errors.As(err, &gone) {
		return ErrGone
	}
	var tooLarge *types.PayloadTooLargeException
	if errors.As(err, &tooLarge) {
		return ErrTooLarge
	}
	var api smithy.APIError
	if errors.As(err, &api) {
		switch api.ErrorCode() {
		case "GoneException":
			return ErrGone
		case "PayloadTooLargeException":
			return ErrTooLarge
		}
	}
	return err
}

func (p *AWSPoster) Post(ctx context.Context, connID string, payload []byte) error {
	c, err := p.client(ctx)
	if err != nil {
		return err
	}
	_, err = c.PostToConnection(ctx, &apigatewaymanagementapi.PostToConnectionInput{ConnectionId: aws.String(connID), Data: payload})
	return translate(err)
}

func (p *AWSPoster) Disconnect(ctx context.Context, connID string) error {
	c, err := p.client(ctx)
	if err != nil {
		return err
	}
	_, err = c.DeleteConnection(ctx, &apigatewaymanagementapi.DeleteConnectionInput{ConnectionId: aws.String(connID)})
	if errors.Is(translate(err), ErrGone) {
		return nil
	}
	return translate(err)
}

func (p *AWSPoster) Alive(ctx context.Context, connID string) (bool, error) {
	c, err := p.client(ctx)
	if err != nil {
		return false, err
	}
	_, err = c.GetConnection(ctx, &apigatewaymanagementapi.GetConnectionInput{ConnectionId: aws.String(connID)})
	if errors.Is(translate(err), ErrGone) {
		return false, nil
	}
	return err == nil, translate(err)
}

var _ Poster = (*AWSPoster)(nil)

// Command lambda is the collaboration relay as an AWS Lambda function behind an API Gateway
// WebSocket API ($connect, $disconnect, $default routes), plus a scheduled reaper (an EventBridge
// rule invoking the same function). See internal/serverless and deploy/aws.
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/clarkjoao/structura/go-server/internal/serverless"
)

type probe struct {
	RequestContext *events.APIGatewayWebsocketProxyRequestContext `json:"requestContext"`
	Body           string                                         `json:"body"`
	IsBase64       bool                                           `json:"isBase64Encoded"`
	Source         string                                         `json:"source"`
	Reap           bool                                           `json:"reap"`
}

var ok = events.APIGatewayProxyResponse{StatusCode: 200}

// eventHandler is what the function does for API Gateway and the schedule (serverless.Handler).
type eventHandler interface {
	Connect(ctx context.Context, connID string) error
	Disconnect(ctx context.Context, connID string) error
	Message(ctx context.Context, connID string, body []byte) error
	Reap(ctx context.Context) error
}

var (
	build = func(ctx context.Context) (eventHandler, error) {
		return serverless.Build(ctx, serverless.ConfigFromEnv(), nil)
	}
	start = lambda.Start
	fatal = log.Fatalf
)

func main() {
	handler, err := build(context.Background())
	if err != nil {
		fatal("[collab] %v", err)
		return
	}
	start(dispatch(handler))
}

// dispatch routes one invocation: an API Gateway WebSocket event, or the reaper's schedule.
func dispatch(handler eventHandler) func(ctx context.Context, raw json.RawMessage) (any, error) {
	return func(ctx context.Context, raw json.RawMessage) (any, error) {
		var event probe
		if err := json.Unmarshal(raw, &event); err != nil {
			return nil, err
		}
		rc := event.RequestContext
		if rc == nil || rc.ConnectionID == "" {
			// EventBridge schedule (or a manual {"reap":true}).
			if event.Source == "aws.events" || event.Reap {
				return nil, handler.Reap(ctx)
			}
			return nil, nil
		}
		ctx = serverless.WithEndpoint(ctx, "https://"+rc.DomainName+"/"+rc.Stage)
		switch rc.RouteKey {
		case "$connect":
			return ok, handler.Connect(ctx, rc.ConnectionID)
		case "$disconnect":
			return ok, handler.Disconnect(ctx, rc.ConnectionID)
		default:
			body := []byte(event.Body)
			if event.IsBase64 {
				decoded, err := base64.StdEncoding.DecodeString(event.Body)
				if err != nil {
					return ok, nil
				}
				body = decoded
			}
			return ok, handler.Message(ctx, rc.ConnectionID, body)
		}
	}
}

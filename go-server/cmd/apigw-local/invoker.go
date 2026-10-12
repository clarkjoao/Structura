package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/clarkjoao/structura/go-server/internal/serverless"
)

// invoker runs the function for one API Gateway event.
type invoker interface {
	connect(ctx context.Context, connID string) error
	message(ctx context.Context, connID string, body []byte) error
	disconnect(ctx context.Context, connID string) error
	reap(ctx context.Context) error
}

// inProcess calls the handler directly.
type inProcess struct{ h *serverless.Handler }

func (p inProcess) connect(ctx context.Context, id string) error    { return p.h.Connect(ctx, id) }
func (p inProcess) disconnect(ctx context.Context, id string) error { return p.h.Disconnect(ctx, id) }
func (p inProcess) reap(ctx context.Context) error                  { return p.h.Reap(ctx) }
func (p inProcess) message(ctx context.Context, id string, body []byte) error {
	return p.h.Message(ctx, id, body)
}

// overHTTP posts API Gateway-shaped events to Lambda Runtime Interface Emulators (LAMBDA_URL, a
// comma-separated list), so the real `cmd/lambda` binary runs in the real Lambda base image. An
// emulator takes one invocation at a time, so each URL is one slot of the pool.
type overHTTP struct {
	slots  chan string
	client *http.Client
	domain string
}

func newOverHTTP(urls string) overHTTP {
	list := strings.Split(urls, ",")
	o := overHTTP{slots: make(chan string, len(list)), client: &http.Client{Timeout: 60 * time.Second}, domain: "localhost"}
	for _, u := range list {
		o.slots <- strings.TrimSpace(u)
	}
	return o
}

func (o overHTTP) event(eventType, routeKey, connID string, body []byte) map[string]any {
	now := time.Now()
	event := map[string]any{
		"requestContext": map[string]any{
			"routeKey":         routeKey,
			"eventType":        eventType,
			"connectionId":     connID,
			"domainName":       o.domain,
			"stage":            "local",
			"apiId":            "local",
			"requestId":        fmt.Sprintf("req-%d", now.UnixNano()),
			"messageDirection": "IN",
			"requestTimeEpoch": now.UnixMilli(),
			"connectedAt":      now.UnixMilli(),
			"identity":         map[string]any{"sourceIp": "127.0.0.1"},
		},
		"isBase64Encoded": false,
	}
	if body != nil {
		event["body"] = string(body)
	}
	return event
}

func (o overHTTP) post(ctx context.Context, event any) error {
	payload, _ := json.Marshal(event)
	url := <-o.slots
	defer func() { o.slots <- url }()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	res, err := o.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK || strings.Contains(string(out), `"errorMessage"`) {
		return fmt.Errorf("lambda: %d %s", res.StatusCode, out)
	}
	return nil
}

func (o overHTTP) connect(ctx context.Context, id string) error {
	return o.post(ctx, o.event("CONNECT", "$connect", id, nil))
}
func (o overHTTP) disconnect(ctx context.Context, id string) error {
	return o.post(ctx, o.event("DISCONNECT", "$disconnect", id, nil))
}
func (o overHTTP) message(ctx context.Context, id string, body []byte) error {
	return o.post(ctx, o.event("MESSAGE", "$default", id, body))
}
func (o overHTTP) reap(ctx context.Context) error {
	return o.post(ctx, map[string]any{"source": "aws.events", "detail-type": "Scheduled Event", "detail": map[string]any{}})
}

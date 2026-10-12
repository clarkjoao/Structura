package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

type recorder struct{ calls []string }

func (r *recorder) Connect(_ context.Context, id string) error {
	r.calls = append(r.calls, "connect "+id)
	return nil
}
func (r *recorder) Disconnect(_ context.Context, id string) error {
	r.calls = append(r.calls, "disconnect "+id)
	return nil
}
func (r *recorder) Message(_ context.Context, id string, body []byte) error {
	r.calls = append(r.calls, "message "+id+" "+string(body))
	return nil
}
func (r *recorder) Reap(context.Context) error {
	r.calls = append(r.calls, "reap")
	return nil
}

func TestDispatchRoutesEveryEvent(t *testing.T) {
	r := &recorder{}
	fn := dispatch(r)
	ctx := context.Background()
	ws := func(route, body string, b64 bool) string {
		return fmt.Sprintf(`{"requestContext":{"routeKey":%q,"connectionId":"c1","domainName":"d","stage":"s"},"body":%q,"isBase64Encoded":%v}`, route, body, b64)
	}
	for _, raw := range []string{
		ws("$connect", "", false),
		ws("$default", `{"type":"ping"}`, false),
		ws("$default", "eyJ0eXBlIjoicG9uZyJ9", true),
		ws("$default", "%%%", true),
		ws("$disconnect", "", false),
		`{"source":"aws.events"}`,
		`{"reap":true}`,
		`{"something":"else"}`,
	} {
		out, err := fn(ctx, json.RawMessage(raw))
		if err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
		if strings.Contains(raw, "requestContext") {
			if resp, ok := out.(events.APIGatewayProxyResponse); !ok || resp.StatusCode != 200 {
				t.Errorf("%s: %v", raw, out)
			}
		}
	}
	want := []string{"connect c1", `message c1 {"type":"ping"}`, `message c1 {"type":"pong"}`, "disconnect c1", "reap", "reap"}
	if strings.Join(r.calls, "|") != strings.Join(want, "|") {
		t.Errorf("calls %v", r.calls)
	}
	if _, err := fn(ctx, json.RawMessage(`not json`)); err == nil {
		t.Error("garbage accepted")
	}
}

func TestMainStartsTheFunctionOrFails(t *testing.T) {
	defer func(b func(context.Context) (eventHandler, error), s func(any), f func(string, ...any)) {
		build, start, fatal = b, s, f
	}(build, start, fatal)

	var started any
	build = func(context.Context) (eventHandler, error) { return &recorder{}, nil }
	start = func(h any) { started = h }
	main()
	if started == nil {
		t.Error("not started")
	}

	var failed string
	build = func(context.Context) (eventHandler, error) { return nil, errors.New("no table") }
	fatal = func(format string, args ...any) { failed = fmt.Sprintf(format, args...) }
	started = nil
	main()
	if started != nil || !strings.Contains(failed, "no table") {
		t.Errorf("started %v, failed %q", started, failed)
	}
}

func TestDefaultBuildReadsTheEnvironment(t *testing.T) {
	t.Setenv("REDIS_URL", "not a url")
	if _, err := build(context.Background()); err == nil {
		t.Error("a bad configuration built")
	}
}

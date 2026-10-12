package serverless

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/smithy-go"
)

// fakeConnections answers the API Gateway management API by connection id: "ok" exists, "gone"
// is gone, "big" refuses the payload, anything else is a bad request.
func fakeConnections(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[strings.LastIndexByte(r.URL.Path, '/')+1:]
		fail := func(status int, kind string) {
			w.Header().Set("X-Amzn-ErrorType", kind)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"message":"` + kind + `"}`))
		}
		switch id {
		case "ok":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{}`))
		case "gone":
			fail(http.StatusGone, "GoneException")
		case "big":
			fail(http.StatusRequestEntityTooLarge, "PayloadTooLargeException")
		default:
			fail(http.StatusBadRequest, "BadRequestException")
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newTestPoster(t *testing.T, callback string) *AWSPoster {
	t.Setenv("AWS_REGION", "")
	t.Setenv("AWS_DEFAULT_REGION", "")
	t.Setenv("AWS_ACCESS_KEY_ID", "")
	t.Setenv("AWS_PROFILE", "")
	p, err := NewAWSPoster(context.Background(), callback)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestAWSPosterTranslatesAPIGatewayAnswers(t *testing.T) {
	ctx := context.Background()
	srv := fakeConnections(t)
	p := newTestPoster(t, srv.URL+"/")

	if err := p.Post(ctx, "ok", []byte("{}")); err != nil {
		t.Errorf("post: %v", err)
	}
	if err := p.Post(ctx, "gone", []byte("{}")); !errors.Is(err, ErrGone) {
		t.Errorf("post to a gone socket: %v", err)
	}
	if err := p.Post(ctx, "big", []byte("{}")); !errors.Is(err, ErrTooLarge) {
		t.Errorf("post too large: %v", err)
	}
	if err := p.Post(ctx, "bad", []byte("{}")); err == nil || errors.Is(err, ErrGone) {
		t.Errorf("post refused: %v", err)
	}
	if err := p.Disconnect(ctx, "ok"); err != nil {
		t.Errorf("disconnect: %v", err)
	}
	if err := p.Disconnect(ctx, "gone"); err != nil {
		t.Errorf("disconnect a gone socket: %v", err)
	}
	if err := p.Disconnect(ctx, "bad"); err == nil {
		t.Error("disconnect refused")
	}
	if alive, err := p.Alive(ctx, "ok"); !alive || err != nil {
		t.Errorf("alive: %v %v", alive, err)
	}
	if alive, err := p.Alive(ctx, "gone"); alive || err != nil {
		t.Errorf("gone: %v %v", alive, err)
	}
	if alive, err := p.Alive(ctx, "bad"); alive || err == nil {
		t.Errorf("refused: %v %v", alive, err)
	}
}

func TestAWSPosterUsesTheInvocationsEndpoint(t *testing.T) {
	ctx := context.Background()
	srv := fakeConnections(t)
	// Without CALLBACK_URL the poster takes the environment's credentials, as on Lambda.
	t.Setenv("AWS_REGION", "us-east-1")
	t.Setenv("AWS_ACCESS_KEY_ID", "test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test")
	t.Setenv("AWS_PROFILE", "")
	p, err := NewAWSPoster(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := p.Post(ctx, "ok", nil); err == nil {
		t.Error("posted without an endpoint")
	}
	if err := p.Disconnect(ctx, "ok"); err == nil {
		t.Error("disconnected without an endpoint")
	}
	if _, err := p.Alive(ctx, "ok"); err == nil {
		t.Error("checked without an endpoint")
	}
	withEndpoint := WithEndpoint(ctx, srv.URL)
	if _, err := p.Alive(withEndpoint, "ok"); err != nil {
		t.Errorf("through the invocation's endpoint: %v", err)
	}
	if err := p.Post(withEndpoint, "ok", []byte("{}")); err != nil || len(p.clients) != 1 {
		t.Errorf("client not reused: %v, %d clients", err, len(p.clients))
	}
}

func TestTranslate(t *testing.T) {
	if translate(&smithy.GenericAPIError{Code: "GoneException"}) != ErrGone {
		t.Error("generic gone")
	}
	if translate(&smithy.GenericAPIError{Code: "PayloadTooLargeException"}) != ErrTooLarge {
		t.Error("generic too large")
	}
	other := &smithy.GenericAPIError{Code: "Other"}
	if translate(other) != other {
		t.Error("other API error")
	}
}

func TestAWSPosterReportsABadConfiguration(t *testing.T) {
	t.Setenv("AWS_PROFILE", "structura-test-profile-that-does-not-exist")
	t.Setenv("AWS_CONFIG_FILE", "/dev/null")
	if _, err := NewAWSPoster(context.Background(), ""); err == nil {
		t.Error("a missing profile was accepted")
	}
}

package awsx

import (
	"context"
	"net/http"
	"testing"

	"github.com/aws/aws-sdk-go-v2/config"
)

func TestHTTPClientKeepsConnectionsPerHost(t *testing.T) {
	var transport *http.Transport
	HTTPClient().WithTransportOptions(func(tr *http.Transport) { transport = tr }).GetTransport()
	if transport == nil || transport.MaxIdleConnsPerHost != 512 || transport.MaxIdleConns != 1024 {
		t.Errorf("transport %+v", transport)
	}
}

func TestRetryerHasNoClientQuota(t *testing.T) {
	r := Retryer()
	if r.MaxAttempts() != 4 {
		t.Errorf("attempts %d", r.MaxAttempts())
	}
	// Without a quota every retry is granted, however many failed before.
	for i := 0; i < 1000; i++ {
		if _, err := r.GetRetryToken(context.Background(), errTimeout{}); err != nil {
			t.Fatalf("retry %d refused: %v", i, err)
		}
	}
}

type errTimeout struct{}

func (errTimeout) Error() string   { return "timeout" }
func (errTimeout) Timeout() bool   { return true }
func (errTimeout) Temporary() bool { return true }

func TestLoadOptionsApplyBoth(t *testing.T) {
	cfg, err := config.LoadDefaultConfig(context.Background(), append(LoadOptions(), config.WithRegion("us-east-1"))...)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTPClient == nil || cfg.Retryer == nil || cfg.Retryer().MaxAttempts() != 4 {
		t.Errorf("config %+v", cfg)
	}
}
